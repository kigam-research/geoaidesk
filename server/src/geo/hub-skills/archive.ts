/** Bounded snapshots and deterministic archives. Links and credential files are never read. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { readTar, safeEntryPath, type TarEntry } from "../tar.ts";
import { AuthoringError } from "../authoring/store.ts";
import { SKILL_HUB_LIMITS } from "../skill-hub.ts";
import type { HubSkillFile } from "../../../../web/src/geo/contracts/hub-skills.ts";

export const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const fail = (message: string): never => { throw new AuthoringError(message, 422); };
const credential = (p: string) => p.split("/").some((x) => /^(?:\.env.*|secrets|secure|id_.*)$/i.test(x)) || /\.(?:pem|key)$/i.test(p);

export function snapshotDirectory(dir: string): TarEntry[] {
  const entries: TarEntry[] = [];
  let size = 0;
  if (fs.lstatSync(dir).isSymbolicLink()) fail("스킬 폴더의 링크는 등록할 수 없습니다.");
  const walk = (folder: string, prefix: string, depth: number) => {
    if (depth > 32) fail("스킬 폴더의 깊이 제한을 초과했습니다.");
    for (const e of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === "__pycache__" || /\.py[co]$/.test(e.name)) continue;
      const p = prefix ? `${prefix}/${e.name}` : e.name;
      safeEntryPath(p);
      if (credential(p)) fail("인증 정보 파일이 있는 스킬은 등록할 수 없습니다.");
      if (e.isSymbolicLink() || (!e.isDirectory() && !e.isFile())) fail("스킬의 링크나 특수 파일은 등록할 수 없습니다.");
      if (entries.length + 2 >= SKILL_HUB_LIMITS.entries) fail("스킬 파일 개수 제한을 초과했습니다.");
      const full = join(folder, e.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) fail("스킬의 링크는 등록할 수 없습니다.");
      size += stat.isFile() ? stat.size : 0;
      if (size > SKILL_HUB_LIMITS.expanded) fail("스킬 크기 제한을 초과했습니다.");
      const data = e.isFile() ? fs.readFileSync(full) : Buffer.alloc(0);
      entries.push({ path: p, type: e.isDirectory() ? "directory" : "file", mode: stat.mode & 0o111 ? 0o755 : 0o644, data });
      if (e.isDirectory()) walk(full, p, depth + 1);
    }
  };
  walk(dir, "", 0);
  return entries;
}

/** Same kady-skill-tree-v1 format as methodTreeHash/hashDirectory, including empty folders. */
export function treeHash(entries: TarEntry[]): string {
  const hash = createHash("sha256").update("kady-skill-tree-v1\0");
  const walk = (prefix: string) => {
    const children = entries.filter((e) => e.path.slice(0, e.path.lastIndexOf("/") + 1) === prefix)
      .sort((a, b) => a.path.slice(prefix.length).localeCompare(b.path.slice(prefix.length)));
    for (const e of children) {
      hash.update(`${e.type === "directory" ? "d" : "f"}\0${e.path}\0`);
      if (e.type === "directory") walk(`${e.path}/`);
      else hash.update(e.data).update("\0");
    }
  };
  walk("");
  return hash.digest("hex");
}
export const fileList = (entries: TarEntry[]): HubSkillFile[] => entries.filter((e) => e.type === "file")
  .map((e) => ({ path: e.path, size: e.data.length, sha256: digest(e.data) })).sort((a, b) => a.path.localeCompare(b.path));

function header(name: string, size: number, mode: number, type: string) {
  const h = Buffer.alloc(512);
  const oct = (n: number, len: number) => n.toString(8).padStart(len - 1, "0") + "\0";
  h.write(name, 0, 100); h.write(oct(mode, 8), 100); h.write(oct(0, 8), 108); h.write(oct(0, 8), 116);
  h.write(oct(size, 12), 124); h.write(oct(0, 12), 136); h.fill(32, 148, 156);
  h.write(type, 156); h.write("ustar\0", 257); h.write("00", 263);
  h.write([...h].reduce((a, b) => a + b, 0).toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
}
export function buildArchive(name: string, entries: TarEntry[], revision?: number): Buffer {
  const blocks: Buffer[] = [];
  const append = (p: string, data: Buffer, mode: number, type: string) => {
    if (Buffer.byteLength(p) > 99) {
      const record = (n: number) => `${n} path=${p}\n`;
      let n = Buffer.byteLength(record(0));
      while (Buffer.byteLength(record(n)) !== n) n = Buffer.byteLength(record(n));
      const pax = Buffer.from(record(n));
      blocks.push(header("PaxHeader", pax.length, 0o644, "x"), pax, Buffer.alloc((512 - pax.length % 512) % 512));
    }
    blocks.push(header(p.slice(0, 99), data.length, mode, type), data, Buffer.alloc((512 - data.length % 512) % 512));
  };
  append(`${name}/`, Buffer.alloc(0), 0o755, "5");
  for (const e of [...entries].sort((a, b) => a.path.localeCompare(b.path)))
    append(`${name}/${e.path}${e.type === "directory" ? "/" : ""}`, e.data, e.mode, e.type === "directory" ? "5" : "0");
  blocks.push(Buffer.alloc(1024));
  const tar = Buffer.concat(blocks);
  if (tar.length > SKILL_HUB_LIMITS.expanded) fail("스킬 크기 제한을 초과했습니다.");
  let archive = gzipSync(tar, { level: 9 });
  // Keep package-origin identities distinct if a later revision returns to earlier bytes.
  // The gzip comment is deterministic per revision and does not add a file to the skill tree.
  if (revision !== undefined) {
    const header = Buffer.from(archive.subarray(0, 10)); header[3] |= 0x10;
    archive = Buffer.concat([header, Buffer.from(`gaid-hub-skill revision=${revision}\0`), archive.subarray(10)]);
  }
  if (archive.length > SKILL_HUB_LIMITS.compressed) fail("스킬 압축 크기 제한을 초과했습니다.");
  return archive;
}
export function readArchive(archive: Buffer, name: string): TarEntry[] {
  try {
    if (archive.length > SKILL_HUB_LIMITS.compressed) throw new Error("size");
    const all = readTar(gunzipSync(archive, { maxOutputLength: SKILL_HUB_LIMITS.expanded }));
    if (all.length > SKILL_HUB_LIMITS.entries || new Set(all.map((e) => e.path)).size !== all.length) throw new Error("entries");
    if (all.some((e) => e.path !== name && !e.path.startsWith(`${name}/`))) throw new Error("root");
    if (all.some((e) => e.path === name && e.type !== "directory")) throw new Error("root");
    const entries = all.filter((e) => e.path !== name).map((e) => ({ ...e, path: e.path.slice(name.length + 1) }));
    if (!entries.some((e) => e.path === "SKILL.md" && e.type === "file")) throw new Error("SKILL.md");
    // Make implicit parent folders explicit so the tree hash also checks empty directories.
    const dirs = new Set(entries.filter((e) => e.type === "directory").map((e) => e.path));
    for (const e of [...entries]) {
      const parts = e.path.split("/"); parts.pop();
      while (parts.length) {
        const p = parts.join("/");
        if (entries.some((f) => f.path === p && f.type === "file")) throw new Error("parent");
        if (!dirs.has(p)) { dirs.add(p); entries.push({ path: p, type: "directory", mode: 0o755, data: Buffer.alloc(0) }); }
        parts.pop();
      }
    }
    return entries;
  } catch {
    return fail("저장된 스킬 압축 파일을 읽지 못했습니다.");
  }
}

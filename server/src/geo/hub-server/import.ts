/** Read-only migration from SharedHubStore's on-disk format; never initializes or changes the source. */
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { HubComment, HubFolder } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { Actor } from "../hub-shared/records.ts";
import type { StoredEntry } from "../hub-shared/store.ts";
import { HubAccounts } from "./accounts.ts";
import { entryId, filePath, HubDatabase, HubServerError, object, sha256 } from "./core.ts";
import { SQLiteHubStore } from "./records.ts";
export interface ImportOptions { from: string; authors: Record<string, string>; unmappedTo?: string; apply?: boolean }
interface ImportEntry { record: StoredEntry; files: Map<string, Buffer>; comments: HubComment[]; stars: string[]; digest: string; actor: Actor; skip: boolean }
export interface ImportResult { dryRun: boolean; entries: number; imported: number; skipped: number; files: number; comments: number; stars: number }
export async function importHub(hub: HubDatabase, options: ImportOptions): Promise<ImportResult> {
  const source = realpathSync(resolve(options.from));
  const accounts = new HubAccounts(hub);
  if (!object(options.authors) || Object.values(options.authors).some((v) => typeof v !== "string")) throw new HubServerError("작성자 이메일 대응표를 확인해 주세요.");
  const actorFor = (name: string, required: boolean): Actor => {
    const email = Object.hasOwn(options.authors, name) ? options.authors[name] : (required ? options.unmappedTo : undefined);
    const account = email ? accounts.byEmail(email) : null;
    if (email && !account) throw new HubServerError(`대응표의 계정을 찾을 수 없습니다: ${email}`, 409);
    if (account) return { id: account.id, name: account.displayName };
    if (required) throw new HubServerError(`작성자 대응표에 없는 이름입니다: ${name}`, 409);
    return { id: `legacy-${sha256(name)}`, name: `이전 사용자 · ${name}` };
  };
  const read = (path: string, optional = false): Buffer | null => {
    const file = join(source, path);
    if (optional && !existsSync(file)) return null;
    const rel = relative(source, realpathSync(file));
    if (rel.startsWith("..") || !lstatSync(file).isFile()) throw new HubServerError("가져올 파일 경로를 확인해 주세요.", 409);
    return readFileSync(file);
  };
  const folders = JSON.parse(read("folders.json")!.toString("utf8")) as HubFolder[];
  if (!Array.isArray(folders) || folders.some((f) => !object(f) || typeof f.id !== "string" || typeof f.name !== "string"))
    throw new HubServerError("가져올 폴더 목록을 확인해 주세요.", 409);
  const entries: ImportEntry[] = [];
  const store = new SQLiteHubStore(hub, "CLI import");
  for (const dir of readdirSync(join(source, "entries"), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!dir.isDirectory()) continue;
    entryId(dir.name);
    const bytes = read(`entries/${dir.name}/entry.json`)!;
    const record = JSON.parse(bytes.toString("utf8")) as StoredEntry;
    if (!object(record) || record.schemaVersion !== "gaid-hub-entry/v1" || !object(record.entry) || !object(record.snapshots) || record.entry.id !== dir.name)
      throw new HubServerError("가져올 등록 기록을 확인해 주세요.", 409);
    const actor = actorFor(record.entry.author, true);
    for (const revision of record.entry.revisions) actorFor(revision.registeredBy, true);
    const files = new Map<string, Buffer>();
    for (const [revision, snapshot] of Object.entries(record.snapshots)) {
      const pkg = `packages/${revision}.tar.gz`;
      const paths = [pkg, ...Object.values(snapshot.visuals).flatMap((v) => [v.file, ...(v.dark ? [v.dark.file] : [])])];
      for (const path of paths) {
        filePath(path);
        const file = read(`entries/${dir.name}/${path}`)!;
        if (path === pkg && (sha256(file) !== snapshot.package.sha256 || file.length !== snapshot.package.size))
          throw new HubServerError("가져올 패키지의 해시 또는 크기가 맞지 않습니다.", 409);
        files.set(path, file);
      }
    }
    const starsBytes = read(`entries/${dir.name}/stars.json`, true);
    const starsValue: unknown = starsBytes ? JSON.parse(starsBytes.toString("utf8")) : {};
    if (!object(starsValue) || Object.values(starsValue).some((v) => v !== true)) throw new HubServerError("가져올 별표 기록을 확인해 주세요.", 409);
    const stars = Object.keys(starsValue);
    const commentsBytes = read(`entries/${dir.name}/comments.jsonl`, true);
    const comments = (commentsBytes?.toString("utf8") ?? "").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as HubComment);
    for (const c of comments) {
      if (!object(c) || c.entryId !== record.entry.id || typeof c.author !== "string" || typeof c.body !== "string" || typeof c.id !== "string")
        throw new HubServerError("가져올 댓글 기록을 확인해 주세요.", 409);
      actorFor(c.author, false);
    }
    for (const name of stars) actorFor(name, false);
    const digest = sha256(JSON.stringify([bytes.toString("base64"), [...files].map(([p, b]) => [p, sha256(b)]), stars, comments]));
    const prior = hub.get<{ digest: string }>("SELECT digest FROM hub_imports WHERE source=? AND entry_id=?", source, dir.name);
    if (prior && prior.digest !== digest) throw new HubServerError("이미 가져온 원본이 달라졌습니다. 새 가져오기를 별도로 검토하세요.", 409);
    if (!prior && await store.find(dir.name)) throw new HubServerError("같은 식별자의 Workflow가 서버에 있습니다.", 409);
    entries.push({ record, files, comments, stars, digest, actor, skip: Boolean(prior) });
  }
  const result: ImportResult = { dryRun: !options.apply, entries: entries.length, imported: 0, skipped: entries.filter((e) => e.skip).length,
    files: entries.reduce((n, e) => n + e.files.size, 0), comments: entries.reduce((n, e) => n + e.comments.length, 0), stars: entries.reduce((n, e) => n + e.stars.length, 0) };
  // Validate through the real record rules for dry-run too. Roll back all DB mutations at the end of a dry-run.
  const DRY_RUN = Symbol("dry-run");
  try {
    const execute = () => hub.importTransaction(async () => {
      const folderMap = new Map<string, string>();
      for (const folder of folders) {
        const sameId = hub.get<{ name: string }>("SELECT name FROM hub_folders WHERE id=?", folder.id);
        if (sameId && sameId.name !== folder.name) throw new HubServerError("서버와 원본의 폴더 식별자가 다른 이름을 가리킵니다.", 409);
        const byName = hub.get<{ id: string }>("SELECT id FROM hub_folders WHERE name=?", folder.name);
        folderMap.set(folder.id, byName?.id ?? folder.id);
        if (!byName) {
          hub.run("INSERT INTO hub_folders VALUES (?,?,?,?)", folder.id, folder.name, folder.createdBy ?? "이전 사용자", folder.createdAt ?? hub.now());
          hub.audit({ id: "operator", device: "CLI" }, "import.folder", folder.id);
        }
      }
      for (const entry of entries) {
        if (entry.skip) continue;
        const { record, actor } = entry;
        for (const [path, bytes] of entry.files) await store.immutableBytes(record.entry.id, path, bytes, actor);
        const revisions = record.entry.revisions.map((r) => {
          const registered = actorFor(r.registeredBy, true);
          return { ...r, registeredBy: registered.name, registeredById: registered.id };
        });
        let current: StoredEntry | null = null;
        for (let n = 1; n <= record.entry.latestRevision; n++) {
          const next: StoredEntry = structuredClone({ ...record, entry: { ...record.entry,
            folderId: folderMap.get(record.entry.folderId) ?? record.entry.folderId,
            latestRevision: n, revisions: [...(current?.entry.revisions ?? []), revisions[n - 1]] },
            snapshots: Object.fromEntries(Object.entries(record.snapshots).filter(([key]) => Number(key) <= n)), installs: [] });
          await store.write(next, actor);
          current = await store.read(record.entry.id);
        }
        if (!current) throw new HubServerError("가져올 등록 판이 없습니다.", 409);
        current.entry.revisions = revisions; // Preserve source registration times; identities came only from the explicit map.
        current.entry.updatedAt = record.entry.updatedAt;
        const { installs: _installs, ...stored } = current;
        hub.run("UPDATE hub_entries SET record=?,updated_at=? WHERE id=?", JSON.stringify(stored), current.entry.updatedAt, current.entry.id);
        for (const install of record.installs ?? []) await store.recordInstall(current.entry.id, install, actor);
        for (const name of entry.stars) await store.star(current.entry.id, actorFor(name, false), true);
        for (const comment of entry.comments) {
          const author = actorFor(comment.author, false);
          const imported = { ...comment, author: author.name, authorId: author.id };
          // Scope legacy comment ids to this source and entry (local stores need not have globally unique ids).
          const id = `comment-${sha256(`${source}\n${current.entry.id}\n${comment.id}`)}`;
          imported.id = id;
          hub.run("INSERT INTO hub_comments VALUES (?,?,?,?,?)", id, current.entry.id, author.id, JSON.stringify(imported), imported.at);
        }
        hub.run("INSERT INTO hub_imports VALUES (?,?,?,?)", source, current.entry.id, entry.digest, hub.now());
        hub.audit({ id: "operator", device: "CLI" }, "import.entry", current.entry.id, { authorId: actor.id, comments: entry.comments.length });
        result.imported++;
      }
      if (!options.apply) throw DRY_RUN;
    });
    if (options.apply) await execute();
    else await hub.simulateBlobWrites(execute);
  } catch (e) { if (e !== DRY_RUN) throw e; }
  if (!options.apply) result.imported = 0;
  return result;
}

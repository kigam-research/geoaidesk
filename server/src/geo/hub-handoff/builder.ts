/** GAID analysis → hub draft material. No upload, publication or skill creation. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { TarArchive } from "archiver";
import type { ProjectPaths } from "../../projects.ts";
import { REPO_ROOT } from "../../config.ts";
import { findSessionFile, readEntries, textOf } from "../../agent/session-export.ts";
import { readSteps, stepsPath } from "../../provenance/store.ts";
import { readDistributionRelease } from "../distribution.ts";

export const HANDOFF_SCHEMA = "gaid-analysis-handoff/v1" as const;
export const HANDOFF_LIMITS = { files: 200, fileBytes: 5 * 1024 * 1024, totalBytes: 20 * 1024 * 1024, textChars: 16_000, noteChars: 4_000, logBytes: 32 * 1024 * 1024 } as const;
const CODE = new Set([".py", ".r", ".ipynb", ".sh", ".js", ".ts", ".sql", ".m", ".json", ".yaml", ".yml", ".toml", ".md"]);
const hash = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const clip = (text: string, limit = HANDOFF_LIMITS.textChars) => text.length > limit ? text.slice(0, limit) + "\n[…truncated]" : text;
export class HandoffError extends Error {
  constructor(readonly code: "input" | "session" | "file" | "size", message: string, readonly status = 400) { super(message); }
}
export interface HandoffFile {
  path: string; sha256: string; size: number; role: "code" | "result" | "user-data"; provenanceStepIds: string[];
}
export interface HandoffPreview {
  request: string; finalAnswer: string; modelRef: string | null; projectId: string; sessionId: string;
  files: HandoffFile[];
  excluded: { policy: number; unavailable: number; tooLarge: number; fileLimit: number; unselected: number };
  truncated: { request: boolean; finalAnswer: boolean; provenanceStepIds: boolean };
  limits: typeof HANDOFF_LIMITS;
}

/** Refuse unsafe names before touching the filesystem, including secret directories. */
function safeName(name: string): boolean {
  return name.length > 0 && name.length <= 1024 && !/[\\\x00-\x1f\x7f:]/.test(name) && !path.posix.isAbsolute(name) &&
    name.split("/").every(p => !!p && !p.startsWith(".") && !/^(secrets?|secure)$/i.test(p) && !/^id_/i.test(p) && !/\.(pem|key)$/i.test(p));
}
function boundedLog(file: string) {
  try { if (fs.statSync(file).size > HANDOFF_LIMITS.logBytes) throw new HandoffError("size", "Session record exceeds the handoff read limit", 413); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
/** Read into bounded memory. Never archive a path/stream that can change after hashing. */
function fileBytes(root: string, name: string): Buffer {
  if (!safeName(name)) throw new HandoffError("file", "File path is not allowed");
  const canonicalRoot = fs.realpathSync(root);
  let abs = canonicalRoot;
  for (const segment of name.split("/")) {
    abs = path.join(abs, segment);
    if (fs.lstatSync(abs).isSymbolicLink()) throw new HandoffError("file", "Symbolic links are not allowed");
  }
  const real = fs.realpathSync(abs);
  if (!real.startsWith(canonicalRoot + path.sep)) throw new HandoffError("file", "File is outside the sandbox");
  const fd = fs.openSync(abs, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new HandoffError("file", "Only regular files are allowed");
    if (stat.size > HANDOFF_LIMITS.fileBytes) throw new HandoffError("size", "File exceeds 5 MiB", 413);
    const buf = Buffer.alloc(HANDOFF_LIMITS.fileBytes + 1);
    let size = 0;
    while (size < buf.length) {
      const n = fs.readSync(fd, buf, size, buf.length - size, null);
      if (!n) break;
      size += n;
    }
    if (size > HANDOFF_LIMITS.fileBytes) throw new HandoffError("size", "File exceeds 5 MiB", 413);
    return Buffer.from(buf.subarray(0, size));
  } finally { fs.closeSync(fd); }
}

export function previewHandoff(paths: ProjectPaths, sessionId: unknown): HandoffPreview {
  if (typeof sessionId !== "string" || sessionId.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sessionId)) throw new HandoffError("input", "Provide a session id");
  const file = findSessionFile(paths, sessionId);
  if (!file) throw new HandoffError("session", "No such session", 404);
  boundedLog(file);
  boundedLog(stepsPath(sessionId, paths.id));
  // The same shared reader/text projection used by /sessions/:id/history.
  // Pick the last assistant text message, excluding reasoning and tool output.
  const entries = readEntries(file);
  let request = "", finalAnswer = "", modelRef: string | null = null, sawRequest = false;
  for (const row of entries) {
    if (row.type !== "message") continue;
    const m = row.message;
    if (m.role === "user" && !sawRequest) { request = textOf(m.content); sawRequest = true; }
    if (m.role === "assistant") {
      const text = textOf(m.content);
      if (!text) continue;
      finalAnswer = text;
      const identity = m as typeof m & { provider?: string; model?: string };
      modelRef = identity.provider && identity.model ? `${identity.provider}/${identity.model}` : null;
    }
  }
  const excluded = { policy: 0, unavailable: 0, tooLarge: 0, fileLimit: 0, unselected: 0 };
  const candidates = new Map<string, Set<string>>();
  const steps = readSteps(sessionId, paths.id);
  for (const step of steps) {
    for (const ref of [...(step.outputs ?? []).filter(r => ["created", "modified", "wrote"].includes(r.change)), ...(step.inputs ?? []).filter(r => r.path?.startsWith("user_data/"))]) {
      if (typeof ref.path !== "string") continue;
      let ids = candidates.get(ref.path);
      if (!ids) { ids = new Set(); candidates.set(ref.path, ids); }
      if (typeof step.id === "string") ids.add(step.id);
    }
  }
  const files: HandoffFile[] = [];
  let idsTruncated = false;
  // Produced code/results first; read-only user data remains opt-in.
  const names = [...candidates.keys()].sort((a, b) => Number(a.startsWith("user_data/")) - Number(b.startsWith("user_data/")) || a.localeCompare(b));
  for (const name of names) {
    if (!safeName(name)) { excluded.policy++; continue; }
    if (files.length >= HANDOFF_LIMITS.files) { excluded.fileLimit++; continue; }
    try {
      const data = fileBytes(paths.sandbox, name);
      const ids = [...candidates.get(name)!];
      idsTruncated ||= ids.length > 200;
      files.push({ path: name, sha256: hash(data), size: data.length, role: name.startsWith("user_data/") ? "user-data" : CODE.has(path.extname(name).toLowerCase()) ? "code" : "result", provenanceStepIds: ids.slice(0, 200).map(id => clip(id, 200)) });
    } catch (error) {
      if (error instanceof HandoffError && error.code === "size") excluded.tooLarge++;
      else if (error instanceof HandoffError) excluded.policy++;
      else excluded.unavailable++;
    }
  }
  return { request: clip(request), finalAnswer: clip(finalAnswer), modelRef: modelRef ? clip(modelRef, 500) : null, projectId: paths.id, sessionId, files, excluded,
    truncated: { request: request.length > HANDOFF_LIMITS.textChars, finalAnswer: finalAnswer.length > HANDOFF_LIMITS.textChars, provenanceStepIds: idsTruncated }, limits: HANDOFF_LIMITS };
}

export async function buildHandoff(paths: ProjectPaths, input: { sessionId?: unknown; files?: unknown; note?: unknown }) {
  if (!Array.isArray(input.files) || input.files.length > HANDOFF_LIMITS.files || !input.files.every(f => typeof f === "string") || new Set(input.files).size !== input.files.length || (input.note !== undefined && (typeof input.note !== "string" || input.note.length > HANDOFF_LIMITS.noteChars))) throw new HandoffError("input", "Select at most 200 distinct files and a note up to 4000 characters");
  const preview = previewHandoff(paths, input.sessionId);
  const allowed = new Map(preview.files.map(f => [f.path, f]));
  const contents: { file: HandoffFile; data: Buffer }[] = [];
  let total = 0;
  for (const name of input.files as string[]) {
    const candidate = allowed.get(name);
    if (!candidate) throw new HandoffError("file", "Selected file is not available in this session's preview");
    let data: Buffer;
    try { data = fileBytes(paths.sandbox, name); }
    catch (error) { if (error instanceof HandoffError) throw error; throw new HandoffError("file", "Selected file could not be read"); }
    total += data.length;
    if (total > HANDOFF_LIMITS.totalBytes) throw new HandoffError("size", "Selected files exceed 20 MiB", 413);
    contents.push({ file: { ...candidate, sha256: hash(data), size: data.length }, data });
  }
  const createdAt = new Date().toISOString();
  const { limits: _limits, ...metadata } = preview;
  const manifest = { ...metadata, schemaVersion: HANDOFF_SCHEMA, note: input.note ?? "", gaidVersion: readDistributionRelease(REPO_ROOT)?.version ?? "unknown", createdAt,
    files: contents.map(c => c.file), excluded: { ...preview.excluded, unselected: preview.files.length - contents.length } };
  const json = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  // The limit covers payload and tar overhead, not just compressed bytes.
  const tarSize = 1024 + [json, ...contents.map(c => c.data)].reduce((n, b) => n + 512 + Math.ceil(b.length / 512) * 512, 0) + contents.reduce((n, c) => n + (Buffer.byteLength(`files/${c.file.path}`) > 99 ? 2048 : 0), 0);
  if (tarSize > HANDOFF_LIMITS.totalBytes) throw new HandoffError("size", "Bundle exceeds 20 MiB including metadata", 413);
  const archive = new TarArchive({ gzip: true });
  const chunks: Buffer[] = [];
  let compressed = 0;
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on("error", reject); archive.on("warning", reject);
    archive.on("data", (chunk: Buffer) => { compressed += chunk.length; if (compressed > HANDOFF_LIMITS.totalBytes) { archive.abort(); reject(new HandoffError("size", "Compressed bundle exceeds 20 MiB", 413)); } else chunks.push(chunk); });
    archive.on("end", () => resolve(Buffer.concat(chunks)));
  });
  archive.append(json, { name: "handoff.json", mode: 0o644 });
  for (const { file, data } of contents) archive.append(data, { name: `files/${file.path}`, mode: 0o644 });
  void archive.finalize().catch(() => { /* error event rejects done */ });
  return { archive: await done, manifest, filename: `gaid-analysis-${preview.sessionId.slice(0, 8)}-${createdAt.slice(0, 10).replaceAll("-", "")}.tar.gz` };
}

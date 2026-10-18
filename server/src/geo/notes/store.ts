import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectPaths } from "../../projects.ts";
import { apiRelative, isWithin } from "../../sandbox-fs.ts";
import { geoStateDir } from "../context.ts";
import { installedMethods } from "../methods/local-methods.ts";
import { trialHandoffRef } from "../methods/trials.ts";
import { markdownImageTargets } from "../markdown-images.ts";
import {
  RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE, RESEARCH_NOTE_STATUSES,
  type ResearchNoteListResponse, type ResearchNoteMethod, type ResearchNoteResponse, type ResearchNoteStatus, type ResearchNoteSummary,
} from "../../../../web/src/geo/contracts/research-notes.ts";
import { frontmatterSpan, parseResearchNote } from "./parser.ts";

export const RESEARCH_NOTE_LIMITS = { notes: 500, fileBytes: 2 * 1024 * 1024 } as const;
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
type SessionMap = Record<string, string[]>;

export class ResearchNoteError extends Error {
  constructor(readonly statusCode: number, message: string) { super(message); }
}

export function safeNoteId(value: string): boolean {
  return !!value && value.length <= 255 && !value.startsWith(".") && !/[\\/\x00-\x1f\x7f:]/.test(value);
}

const inside = isWithin;

/** Resolve each actual on-disk segment, including NFD names written by macOS. */
function actualPaths(root: string, relative: string): string[] {
  let candidates = [root];
  for (const segment of relative.split("/")) {
    if (segment === "." || !segment) continue;
    if (segment === "..") { candidates = candidates.map(current => path.dirname(current)); continue; }
    candidates = candidates.flatMap(current => {
      try {
        return fs.readdirSync(current).filter(name => name.normalize("NFC") === segment.normalize("NFC"))
          .sort((a, b) => Number(b === segment) - Number(a === segment)).map(name => path.join(current, name));
      } catch { return []; }
    });
  }
  return [...new Set(candidates)];
}

function sandboxFile(paths: ProjectPaths, relative: string): string {
  const root = fs.realpathSync(paths.sandbox);
  if (path.isAbsolute(relative) || /^[A-Za-z]:|\\|\x00/.test(relative)) throw new ResearchNoteError(404, "No such research note file");
  const lexical = path.resolve(root, relative);
  if (!inside(root, lexical)) throw new ResearchNoteError(404, "No such research note file");
  for (const actual of actualPaths(root, relative.normalize("NFC"))) {
    if (inside(root, fs.realpathSync(actual)) && fs.statSync(actual).isFile()) return actual;
  }
  throw new ResearchNoteError(404, "No such research note file");
}

function notePath(id: string): string {
  const normalized = id.normalize("NFC");
  if (!safeNoteId(normalized)) throw new ResearchNoteError(404, "No such research note");
  return `${RESEARCH_NOTES_DIR}/${normalized}/${RESEARCH_NOTE_FILE}`;
}

/** A bounded descriptor read, also when the file grows while it is read. */
function boundedRead(file: string): { bytes: Buffer; updatedAt: string } {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new ResearchNoteError(404, "No such research note");
    if (stat.size > RESEARCH_NOTE_LIMITS.fileBytes) throw new ResearchNoteError(413, "Research note exceeds 2 MiB");
    const buffer = Buffer.alloc(RESEARCH_NOTE_LIMITS.fileBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const n = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (!n) break;
      size += n;
    }
    if (size > RESEARCH_NOTE_LIMITS.fileBytes) throw new ResearchNoteError(413, "Research note exceeds 2 MiB");
    return { bytes: buffer.subarray(0, size), updatedAt: stat.mtime.toISOString() };
  } finally { fs.closeSync(fd); }
}

function atomicReplace(file: string, bytes: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    if (fs.existsSync(file)) fs.chmodSync(temporary, fs.statSync(file).mode);
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}

function sessionsFile(paths: ProjectPaths): string { return path.join(geoStateDir(paths), "notes.json"); }

function readSessionMap(paths: ProjectPaths, writing = false): SessionMap {
  try {
    const value: unknown = JSON.parse(boundedRead(sessionsFile(paths)).bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid note session map");
    const out: SessionMap = Object.create(null);
    for (const [id, sessions] of Object.entries(value)) {
      if (!safeNoteId(id) || !Array.isArray(sessions) || !sessions.every(s => typeof s === "string" && SESSION_ID.test(s))) throw new Error("Invalid note session map");
      out[id.normalize("NFC")] = [...new Set([...(out[id.normalize("NFC")] ?? []), ...sessions])];
    }
    return out;
  } catch (error) {
    if (writing && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return Object.create(null) as SessionMap;
  }
}

/** Synchronous read/replace serialises lead hooks in this server process. */
export function recordResearchNoteSession(paths: ProjectPaths, id: string, sessionId: string): void {
  if (!SESSION_ID.test(sessionId)) throw new ResearchNoteError(400, "Invalid session id");
  sandboxFile(paths, notePath(id));
  const key = id.normalize("NFC"), map = readSessionMap(paths, true);
  if (map[key]?.includes(sessionId)) return;
  map[key] = [...(map[key] ?? []), sessionId];
  atomicReplace(sessionsFile(paths), JSON.stringify(map, null, 2) + "\n");
}

function methodOf(paths: ProjectPaths, sessions: string[], methods: ReturnType<typeof installedMethods>): ResearchNoteMethod | null {
  for (const sessionId of [...sessions].reverse()) {
    const trial = trialHandoffRef(paths, sessionId);
    if (!trial || typeof trial.methodId !== "string") continue;
    const title = methods.find(m => m.file.method?.methodId === trial.methodId)?.file.method?.title;
    return { name: title?.ko ?? title?.en ?? null, methodId: trial.methodId, workflowId: trial.workflowId ?? null, assessment: trial.assessment?.outcome ?? null };
  }
  return null;
}

function readOne(paths: ProjectPaths, id: string, map: SessionMap, methods: ReturnType<typeof installedMethods>): ResearchNoteResponse {
  id = id.normalize("NFC");
  const relative = notePath(id);
  let file: string;
  try { file = sandboxFile(paths, relative); }
  catch { throw new ResearchNoteError(404, "No such research note"); }
  const { bytes, updatedAt } = boundedRead(file), content = bytes.toString("utf8");
  const parsed = parseResearchNote(content, id);
  const base = `${RESEARCH_NOTES_DIR}/${id}/`;
  const resolveImage = (target: string): string | null => {
    try {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(target)) return null;
      const decoded = decodeURIComponent(target.split(/[?#]/)[0]).normalize("NFC");
      const abs = sandboxFile(paths, `${base}${decoded}`);
      return apiRelative(fs.realpathSync(paths.sandbox), abs).normalize("NFC");
    } catch { return null; }
  };
  const cover = parsed.cover ? resolveImage(parsed.cover) : null;
  for (const target of new Set([...(parsed.cover ? [parsed.cover] : []), ...markdownImageTargets(content)])) {
    if (!resolveImage(target)) parsed.problems.push({ code: "image-missing", target });
  }
  const sessions = map[id] ?? [];
  return { content, note: { ...parsed, id, path: relative, cover, supersededBy: null, sessions, method: methodOf(paths, sessions, methods), updatedAt } };
}

function listSummaries(paths: ProjectPaths): ResearchNoteSummary[] {
  let dirs: string[];
  try {
    const root = fs.realpathSync(paths.sandbox);
    dirs = actualPaths(root, RESEARCH_NOTES_DIR).filter(dir => inside(root, fs.realpathSync(dir)) && fs.statSync(dir).isDirectory());
  } catch { return []; }
  const map = readSessionMap(paths), methods = installedMethods(paths);
  const out: ResearchNoteSummary[] = [];
  const ids = dirs.flatMap(dir => fs.readdirSync(dir, { withFileTypes: true })).filter(e => e.isDirectory() && safeNoteId(e.name)).map(e => e.name.normalize("NFC")).sort().reverse();
  for (const id of new Set(ids)) {
    if (out.length >= RESEARCH_NOTE_LIMITS.notes) break;
    try { out.push(readOne(paths, id, map, methods).note); }
    catch (error) {
      if (error instanceof ResearchNoteError || ["ENOENT", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
      throw error;
    }
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  for (const current of out) {
    const replacement = out.find(candidate => candidate.id !== current.id && candidate.supersedes.includes(current.id));
    if (replacement) { current.supersededBy = replacement.id; current.status = "superseded"; }
  }
  return out;
}

export function listResearchNotes(paths: ProjectPaths): ResearchNoteListResponse {
  return { dir: RESEARCH_NOTES_DIR, notes: listSummaries(paths) };
}

export function getResearchNote(paths: ProjectPaths, id: string): ResearchNoteResponse {
  // Read the requested file first so oversized files return 413, not a list-derived 404.
  const response = readOne(paths, id, readSessionMap(paths), installedMethods(paths));
  const replacement = listSummaries(paths).find(row => row.id !== response.note.id && row.supersedes.includes(response.note.id));
  if (replacement) { response.note.supersededBy = replacement.id; response.note.status = "superseded"; }
  return response;
}

/** Latin-1 makes ASCII status edits byte-preserving even for non-UTF8 body bytes. */
export function rewriteResearchNoteStatus(bytes: Buffer, status: ResearchNoteStatus): Buffer {
  const bom = bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? bytes.subarray(0, 3) : Buffer.alloc(0);
  const text = bytes.subarray(bom.length).toString("latin1"), span = frontmatterSpan(text);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  if (!span) return Buffer.concat([bom, Buffer.from(`---${newline}status: ${status}${newline}---${newline}`, "ascii"), bytes.subarray(bom.length)]);
  const front = text.slice(span.bodyStart, span.bodyEnd);
  const line = /^status:[^\r\n]*/m.exec(front);
  const next = line
    ? text.slice(0, span.bodyStart + line.index) + `status: ${status}` + text.slice(span.bodyStart + line.index + line[0].length)
    : text.slice(0, span.bodyEnd) + `status: ${status}${newline}` + text.slice(span.bodyEnd);
  return Buffer.concat([bom, Buffer.from(next, "latin1")]);
}

export function setResearchNoteStatus(paths: ProjectPaths, id: string, status: unknown): ResearchNoteSummary {
  if (!RESEARCH_NOTE_STATUSES.includes(status as ResearchNoteStatus)) throw new ResearchNoteError(400, "Invalid research note status");
  getResearchNote(paths, id);
  const file = sandboxFile(paths, notePath(id));
  const { bytes } = boundedRead(file);
  const updated = rewriteResearchNoteStatus(bytes, status as ResearchNoteStatus);
  if (updated.length > RESEARCH_NOTE_LIMITS.fileBytes) throw new ResearchNoteError(413, "Research note exceeds 2 MiB");
  atomicReplace(file, updated);
  return getResearchNote(paths, id).note;
}

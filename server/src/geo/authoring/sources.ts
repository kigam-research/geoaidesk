import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { readTar, safeEntryPath, type TarEntry } from "../tar.ts";
import type {
  AddSourceBody,
  AuthoringProject,
  CodeFileEntry,
  ExtractedFigure,
  ExtractionRecord,
  SourceDocument,
  SourceKind,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { AUTHORING_SOURCE_LIMITS } from "../../../../web/src/geo/contracts/authoring.ts";
import { CODE_NAME, inspectDataFiles, isDataName, renderDataSummary } from "./data-files.ts";
import { AuthoringError, newId, now, type AuthoringStore } from "./store.ts";

export const SOURCE_LIMIT_BYTES = AUTHORING_SOURCE_LIMITS.sourceBytes;
const MAX_FILES = 2000;
const TEXT_LIMIT = 512 * 1024;
export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ code: number; out: Buffer; err: string }> {
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => (err += c.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      fail(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code: code ?? -1, out: Buffer.concat(out), err });
    });
  });
}

export async function pdftotextVersion(): Promise<string | undefined> {
  try {
    const r = await run("pdftotext", ["-v"], 10_000);
    return /pdftotext version ([\d.]+)/.exec(r.err + r.out.toString())?.[1] ?? "unknown";
  } catch {
    return undefined;
  }
}

const FIGURE = /^\s*(Fig(?:ure)?\.?\s*\d+[a-z]?|Table\s+\d+|그림\s*\d+|표\s*\d+)[.:]?\s+(.{8,})$/i;

export function figureCaptions(page: number, text: string): ExtractedFigure[] {
  const out: ExtractedFigure[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = FIGURE.exec(lines[i]);
    if (!m) continue;
    let caption = m[2].trim();
    for (let j = i + 1; j < Math.min(lines.length, i + 4) && lines[j].trim(); j++) caption += ` ${lines[j].trim()}`;
    out.push({ page, label: m[1].replace(/\s+/g, " "), caption: caption.slice(0, 400) });
  }
  return out;
}

function kindOf(body: { kind?: SourceKind; name: string; mediaType?: string }, bytes: Uint8Array): SourceKind {
  if (body.kind) return body.kind;
  const name = body.name.toLowerCase();
  if (
    body.mediaType === "application/pdf" ||
    name.endsWith(".pdf") ||
    Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-"
  )
    return "pdf";
  // The chat's analysis bundle (server/src/geo/hub-handoff/builder.ts names it gaid-analysis-<session>-<date>.tar.gz).
  if (/^gaid-analysis-[a-z0-9-]+\.tar\.gz$/.test(name)) return "gaid-analysis";
  if (/\.(zip|tar\.gz|tgz)$/.test(name)) return "code";
  // A single script or notebook is code too, so a draft may include it (packaging accepts code sources only).
  if (CODE_NAME.test(name)) return "code";
  if (isDataName(name)) return "data";
  return "text";
}

/** An archive without code files whose files include geo data is a data source (e.g. a zipped shapefile set). */
function archiveKind(files: Map<string, Uint8Array>): SourceKind {
  const names = [...files.keys()];
  if (names.some((n) => CODE_NAME.test(n))) return "code";
  return names.some((n) => isDataName(n)) ? "data" : "code";
}

export function safeRelative(path: string): boolean {
  return (
    !!path &&
    ![...path].some((c) => c.charCodeAt(0) < 32) &&
    !/^(?:\/|[A-Za-z]:)|\\/.test(path) &&
    path.split("/").every((p) => p !== ".." && p !== "." && !!p) &&
    !path.split("/").some((p) => /^(?:\.git|__MACOSX|node_modules|\.venv|secrets?|secure)$/i.test(p)) &&
    !/(?:^|\/)(?:\.env[^/]*|id_[^/]*|[^/]*\.(?:pem|key))$/i.test(path)
  );
}

const isText = (b: Uint8Array) => b.length <= TEXT_LIMIT && !b.subarray(0, 8192).includes(0);

export async function extractPdf(store: AuthoringStore, projectId: string, source: SourceDocument, file: string) {
  const record: ExtractionRecord = {
    sourceId: source.id,
    sourceSha256: source.sha256,
    tool: `pdftotext ${(await pdftotextVersion()) ?? "unavailable"}`,
    coveredPages: [],
    emptyPages: [],
    figures: [],
    characters: 0,
    at: now(),
  };
  const info = await run("pdfinfo", [file], 30_000).catch(() => undefined);
  const pages = Number(/Pages:\s+(\d+)/.exec(info?.out.toString() ?? "")?.[1] ?? 0);
  if (!pages) {
    record.error = "PDF 쪽수를 읽지 못했습니다.";
    return record;
  }
  record.pages = pages;
  const title = /^Title:[ \t]+(\S.*)$/m.exec(info?.out.toString() ?? "")?.[1]?.trim();
  if (title && !source.title) source.title = title;
  for (let page = 1; page <= pages; page++) {
    const r = await run("pdftotext", ["-f", String(page), "-l", String(page), "-layout", "-enc", "UTF-8", file, "-"]);
    const text = r.code === 0 ? r.out.toString("utf8").replace(/\f/g, "") : "";
    await store.writeFile(projectId, pageFile(source.id, page), text);
    if (text.trim().length < 20) record.emptyPages.push(page);
    else {
      record.coveredPages.push(page);
      record.characters += text.length;
      record.figures.push(...figureCaptions(page, text));
    }
  }
  if (record.emptyPages.length) record.error = `${record.emptyPages.length}쪽에서 글자를 읽지 못했습니다.`;
  return record;
}

export const pageFile = (sourceId: string, page: number) =>
  `sources/${sourceId}/pages/${String(page).padStart(4, "0")}.txt`;
export const sourceFile = (sourceId: string, path: string) => `sources/${sourceId}/files/${path}`;

const EXPANDED_LIMIT = 64 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

const tooBig = () => new AuthoringError("압축을 푼 크기나 파일 수가 제한을 넘습니다.", 413);

/**
 * Unpack a code archive (zip or tar.gz) into memory without external tools: only regular files with safe relative
 * names, within the entry and expanded-size limits. Links, devices, absolute paths and `..` are refused.
 */
function unpack(name: string, bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let total = 0;
  const add = (path: string, data: Uint8Array) => {
    total += data.length;
    if (total > EXPANDED_LIMIT || files.size >= MAX_ENTRIES) throw tooBig();
    if (data.length <= SOURCE_LIMIT_BYTES) files.set(path, data);
  };
  if (/\.zip$/i.test(name)) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(Buffer.from(bytes));
    } catch {
      throw new AuthoringError("압축 파일 목록을 읽지 못했습니다.");
    }
    const entries = zip.getEntries();
    if (entries.length > MAX_ENTRIES) throw tooBig();
    let declared = 0;
    for (const e of entries) declared += e.header.size;
    if (declared > EXPANDED_LIMIT) throw tooBig();
    for (const e of entries) {
      if (e.isDirectory) continue;
      // Unix mode in the upper 16 bits of the external attributes: refuse symbolic links.
      if (((e.header.attr >>> 16) & 0o170000) === 0o120000)
        throw new AuthoringError(`링크나 특수 파일은 받을 수 없습니다: ${e.entryName}`);
      let path: string;
      try {
        path = safeEntryPath(e.entryName);
      } catch {
        throw new AuthoringError(`안전하지 않은 경로는 받을 수 없습니다: ${e.entryName}`);
      }
      add(path, e.getData());
    }
  } else {
    let tar: Buffer;
    try {
      tar = gunzipSync(Buffer.from(bytes), { maxOutputLength: EXPANDED_LIMIT + 1024 * 1024 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") throw tooBig();
      throw new AuthoringError("압축 파일을 풀지 못했습니다.");
    }
    let entries: TarEntry[];
    try {
      entries = readTar(tar);
    } catch (e) {
      throw new AuthoringError(
        /unsafe|unsupported|link/i.test(String(e))
          ? `링크, 특수 파일이나 안전하지 않은 경로는 받을 수 없습니다: ${String((e as Error).message ?? e)}`
          : "압축 파일 목록을 읽지 못했습니다.",
      );
    }
    if (entries.length > MAX_ENTRIES) throw tooBig();
    for (const e of entries) if (e.type === "file") add(e.path, e.data);
  }
  // Strip one common root folder (GitHub archives) so paths read like the repository.
  const roots = new Set([...files.keys()].map((p) => p.split("/")[0]));
  if (roots.size === 1 && [...files.keys()].every((p) => p.includes("/"))) {
    const root = [...roots][0];
    return new Map([...files].map(([p, d]) => [p.slice(root.length + 1), d]));
  }
  return files;
}

async function extractFiles(
  store: AuthoringStore,
  projectId: string,
  source: SourceDocument,
  files: Map<string, Uint8Array>,
): Promise<ExtractionRecord> {
  const entries: CodeFileEntry[] = [];
  let skipped = 0;
  let characters = 0;
  for (const [path, data] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!safeRelative(path) || entries.length >= MAX_FILES) {
      skipped++;
      continue;
    }
    await store.writeFile(projectId, sourceFile(source.id, path), data);
    const text = isText(data);
    if (text) characters += data.length;
    entries.push({ path, size: data.length, sha256: sha256(data), text });
  }
  return {
    sourceId: source.id,
    sourceSha256: source.sha256,
    tool: "file inventory",
    coveredPages: [],
    emptyPages: [],
    figures: [],
    files: entries,
    characters,
    ...(skipped ? { error: `${skipped}개 파일은 경로나 개수 제한 때문에 제외했습니다.` } : {}),
    at: now(),
  };
}

/** What a source is made of before it is stored: one original file, or a set of files read together. */
export interface SourceInput {
  name: string;
  mediaType?: string;
  kind?: SourceKind;
  /** The original bytes (absent for a file set). */
  bytes?: Uint8Array;
  /** A set of files forming one source, by relative path (shapefile set, note with figures). */
  files?: Map<string, Uint8Array>;
  documentKind?: string;
  doi?: string;
  title?: string;
  library?: SourceDocument["library"];
  note?: SourceDocument["note"];
}

const MiB = 1024 * 1024;

/** The authoring project is full (source count or total bytes). */
export class SourceCapacityError extends AuthoringError {}

/** Refuse a source the project cannot take: too many sources or too many bytes in total. */
async function checkCapacity(store: AuthoringStore, projectId: string, size: number) {
  const project = await store.read(projectId);
  if (project.sources.length >= AUTHORING_SOURCE_LIMITS.sources)
    throw new SourceCapacityError(`자료는 한 작업에 ${AUTHORING_SOURCE_LIMITS.sources}개까지 넣을 수 있습니다.`, 409);
  const used = project.sources.reduce((n, s) => n + s.size, 0);
  if (used + size > AUTHORING_SOURCE_LIMITS.projectBytes)
    throw new SourceCapacityError(`한 작업의 자료는 모두 합해 ${AUTHORING_SOURCE_LIMITS.projectBytes / MiB} MiB 이하만 넣을 수 있습니다.`, 413);
}

/** sha256sum-style list of a file set; its hash identifies the set. */
const setManifest = (files: Map<string, Uint8Array>) =>
  [...files]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([p, d]) => `${sha256(d)}  ${p}`)
    .join("\n") + "\n";

/** Store the original bytes, extract text or an inventory (data files: an inspection summary), and append the source. */
export async function storeSource(
  store: AuthoringStore,
  projectId: string,
  input: SourceInput,
): Promise<{ source: SourceDocument; extraction: ExtractionRecord }> {
  const name = input.name.split(/[\\/]/).pop()!.trim();
  if (!name || name.length > 200) throw new AuthoringError("파일 이름을 확인해 주세요.");
  const set = input.files;
  if (set) {
    if (!set.size) throw new AuthoringError("빈 파일입니다.");
    if (set.size > AUTHORING_SOURCE_LIMITS.setFiles)
      throw new AuthoringError(`함께 올리는 파일은 ${AUTHORING_SOURCE_LIMITS.setFiles}개 이하만 받을 수 있습니다.`, 413);
    for (const [p, d] of set) {
      if (!safeRelative(p)) throw new AuthoringError(`안전하지 않은 경로는 받을 수 없습니다: ${p}`);
      if (!d.length) throw new AuthoringError(`빈 파일입니다: ${p}`);
    }
  }
  const original: Uint8Array = set ? Buffer.from(setManifest(set)) : (input.bytes ?? new Uint8Array());
  if (!original.length) throw new AuthoringError("빈 파일입니다.");
  const size = set ? [...set.values()].reduce((n, d) => n + d.length, 0) : original.length;
  if (size > SOURCE_LIMIT_BYTES)
    throw new AuthoringError(`파일은 ${SOURCE_LIMIT_BYTES / MiB} MiB 이하만 받을 수 있습니다.`, 413);
  await checkCapacity(store, projectId, size);
  let files: Map<string, Uint8Array> | undefined = set;
  let kind = input.kind;
  // An archive is unpacked before its kind is known (code, data or the chat's analysis bundle); a failure is recorded
  // on the extraction like any other read failure.
  let unpackError: unknown;
  if (!files && /\.(zip|tar\.gz|tgz)$/i.test(name) && kind !== "pdf" && kind !== "text" && kind !== "note") {
    try {
      files = unpack(name, original);
    } catch (e) {
      unpackError = e;
    }
  }
  if (!kind)
    kind = set
      ? [...set.keys()].some((n) => CODE_NAME.test(n))
        ? "code"
        : "data"
      : files
        ? kindOf({ name, mediaType: input.mediaType }, original) === "gaid-analysis"
          ? "gaid-analysis"
          : archiveKind(files)
        : kindOf({ name, mediaType: input.mediaType }, original);
  const source: SourceDocument = {
    id: newId("src"),
    kind,
    name,
    mediaType: set ? "text/plain" : input.mediaType || "application/octet-stream",
    sha256: sha256(original),
    size,
    addedAt: now(),
    status: "received",
    ...(input.documentKind?.trim() ? { documentKind: input.documentKind.trim().slice(0, 200) } : {}),
    ...(input.doi?.trim() ? { doi: input.doi.trim().slice(0, 200) } : {}),
    ...(input.title?.trim() ? { title: input.title.trim().slice(0, 300) } : {}),
    ...(input.library ? { library: input.library } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  const originalPath = await store.writeFile(projectId, `sources/${source.id}/original`, original);
  let extraction: ExtractionRecord;
  try {
    if (kind === "pdf") extraction = await extractPdf(store, projectId, source, originalPath);
    else {
      if (unpackError) throw unpackError;
      extraction = await extractFiles(store, projectId, source, files ?? new Map([[name, new Uint8Array(original)]]));
      const entries = extraction.files ?? [];
      if (entries.some((e) => isDataName(e.path))) {
        await inspectDataFiles(store.within(projectId, "sources", source.id, "files"), entries);
        extraction.tool = "file inventory + geo inspection";
        // A data file counts as read when the inspection described it.
        for (const e of entries)
          if (e.data && !e.text) extraction.characters += renderDataSummary(e.path, e.size, e.data).length;
      }
    }
  } catch (e) {
    extraction = {
      sourceId: source.id,
      sourceSha256: source.sha256,
      tool: kind === "pdf" ? "pdftotext" : "file inventory",
      coveredPages: [],
      emptyPages: [],
      figures: [],
      characters: 0,
      error: e instanceof Error ? e.message : String(e),
      at: now(),
    };
  }
  source.status = extraction.characters ? (extraction.error ? "partial" : "extracted") : "failed";
  await store.mutate(projectId, (p: AuthoringProject) => {
    p.sources.push(source);
    // A new project takes its name from its first source (the paper title when the PDF states one).
    if (p.title === "새 방법" && p.sources.length === 1)
      p.title = (source.title || name.replace(/\.(pdf|zip|tar\.gz|tgz|md|txt)$/i, "")).slice(0, 120);
    p.extractions[source.id] = extraction;
    p.sourceRevision += 1;
  });
  return { source, extraction };
}

/** `POST …/sources`: one file (base64) or a set of files read together (`files`). */
export async function addSource(
  store: AuthoringStore,
  projectId: string,
  body: AddSourceBody,
): Promise<{ source: SourceDocument; extraction: ExtractionRecord }> {
  if (!body || typeof body.name !== "string") throw new AuthoringError("파일 이름과 내용이 필요합니다.");
  await store.read(projectId);
  if (body.files !== undefined) {
    if (!Array.isArray(body.files)) throw new AuthoringError("파일 목록을 확인해 주세요.");
    const files = new Map<string, Uint8Array>();
    let total = 0;
    for (const f of body.files) {
      if (!f || typeof f.name !== "string" || typeof f.contentBase64 !== "string")
        throw new AuthoringError("파일 이름과 내용이 필요합니다.");
      const n = f.name.split(/[\\/]/).pop()!.trim();
      if (!n || n.length > 200 || files.has(n)) throw new AuthoringError("파일 이름을 확인해 주세요.");
      const bytes = Buffer.from(f.contentBase64, "base64");
      total += bytes.length;
      if (total > SOURCE_LIMIT_BYTES)
        throw new AuthoringError(`파일은 ${SOURCE_LIMIT_BYTES / MiB} MiB 이하만 받을 수 있습니다.`, 413);
      files.set(n, new Uint8Array(bytes));
    }
    const { files: _list, ...meta } = body;
    return storeSource(store, projectId, { ...meta, files });
  }
  if (typeof body.contentBase64 !== "string") throw new AuthoringError("파일 이름과 내용이 필요합니다.");
  const bytes = Buffer.from(body.contentBase64, "base64");
  if (!bytes.length) throw new AuthoringError("빈 파일입니다.");
  if (bytes.length > SOURCE_LIMIT_BYTES)
    throw new AuthoringError(`파일은 ${SOURCE_LIMIT_BYTES / MiB} MiB 이하만 받을 수 있습니다.`, 413);
  const { files: _none, ...meta } = body;
  return storeSource(store, projectId, { ...meta, bytes: new Uint8Array(bytes) });
}

/** Remove a source and its stored files; refused while a draft revision still uses one of its code files. */
export async function removeSource(store: AuthoringStore, projectId: string, sourceId: string): Promise<void> {
  await store.mutate(projectId, (p: AuthoringProject) => {
    const index = p.sources.findIndex((s) => s.id === sourceId);
    if (index < 0) throw new AuthoringError("자료를 찾을 수 없습니다.", 404);
    if (p.drafts.some((d) => d.codeFiles?.some((c) => c.sourceId === sourceId)))
      throw new AuthoringError("초안이 이 자료의 코드 파일을 쓰고 있어 뺄 수 없습니다.", 409);
    p.sources.splice(index, 1);
    delete p.extractions[sourceId];
    p.sourceRevision += 1;
  });
  await rm(store.within(projectId, "sources", sourceId), { recursive: true, force: true });
}

export async function pageText(store: AuthoringStore, projectId: string, sourceId: string, page: number) {
  return (await store.readFile(projectId, pageFile(sourceId, page))).toString("utf8");
}

/** PNG of one PDF page (poppler `pdftoppm`), cached next to the page text; width 200-1600 px. */
export async function pageImage(
  store: AuthoringStore,
  projectId: string,
  sourceId: string,
  page: number,
  width: number,
): Promise<Buffer> {
  const w = Math.max(200, Math.min(1600, Math.round(width / 100) * 100 || 800));
  const cached = `sources/${sourceId}/page-images/${String(page).padStart(4, "0")}-${w}.png`;
  if (store.exists(projectId, cached)) return store.readFile(projectId, cached);
  const original = store.within(projectId, `sources/${sourceId}/original`);
  // pdftoppm writes files (it has no stdout mode for PNG): render into a temp folder, then cache.
  const dir = await mkdtemp(join(tmpdir(), "authoring-page-"));
  try {
    const root = join(dir, "page");
    const r = await run("pdftoppm", [
      "-png",
      "-f",
      String(page),
      "-l",
      String(page),
      "-scale-to-x",
      String(w),
      "-scale-to-y",
      "-1",
      "-singlefile",
      original,
      root,
    ]);
    const png = r.code === 0 ? await readFile(`${root}.png`).catch(() => null) : null;
    if (!png?.length) throw new AuthoringError("쪽 그림을 만들지 못했습니다.", 422);
    await store.writeFile(projectId, cached, png);
    return png;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

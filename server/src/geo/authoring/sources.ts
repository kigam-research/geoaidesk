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
import { AuthoringError, newId, now, type AuthoringStore } from "./store.ts";

export const SOURCE_LIMIT_BYTES = 30 * 1024 * 1024;
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

function kindOf(body: AddSourceBody, bytes: Uint8Array): SourceKind {
  if (body.kind) return body.kind;
  const name = body.name.toLowerCase();
  if (
    body.mediaType === "application/pdf" ||
    name.endsWith(".pdf") ||
    Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-"
  )
    return "pdf";
  if (/\.(zip|tar\.gz|tgz)$/.test(name)) return "code";
  // A single script or notebook is code too, so a draft may include it (packaging accepts code sources only).
  if (/\.(py|r|m|jl|js|ts|ipynb|sh)$/.test(name)) return "code";
  return "text";
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

/** Store the original bytes, extract text or an inventory, and append the source to the project. */
export async function addSource(
  store: AuthoringStore,
  projectId: string,
  body: AddSourceBody,
): Promise<{ source: SourceDocument; extraction: ExtractionRecord }> {
  if (!body || typeof body.name !== "string" || typeof body.contentBase64 !== "string")
    throw new AuthoringError("파일 이름과 내용이 필요합니다.");
  const name = body.name.split(/[\\/]/).pop()!.trim();
  if (!name || name.length > 200) throw new AuthoringError("파일 이름을 확인해 주세요.");
  const bytes = Buffer.from(body.contentBase64, "base64");
  if (!bytes.length) throw new AuthoringError("빈 파일입니다.");
  if (bytes.length > SOURCE_LIMIT_BYTES) throw new AuthoringError("파일은 30 MiB 이하만 받을 수 있습니다.", 413);
  await store.read(projectId);
  const kind = kindOf({ ...body, name }, bytes);
  const source: SourceDocument = {
    id: newId("src"),
    kind,
    name,
    mediaType: body.mediaType || "application/octet-stream",
    sha256: sha256(bytes),
    size: bytes.length,
    addedAt: now(),
    status: "received",
    ...(body.documentKind?.trim() ? { documentKind: body.documentKind.trim().slice(0, 200) } : {}),
    ...(body.doi?.trim() ? { doi: body.doi.trim().slice(0, 200) } : {}),
  };
  const original = await store.writeFile(projectId, `sources/${source.id}/original`, bytes);
  let extraction: ExtractionRecord;
  try {
    if (kind === "pdf") extraction = await extractPdf(store, projectId, source, original);
    else if (kind === "code" || kind === "gaid-analysis") {
      const files = /\.(zip|tar\.gz|tgz)$/i.test(name) ? unpack(name, bytes) : new Map([[name, new Uint8Array(bytes)]]);
      extraction = await extractFiles(store, projectId, source, files);
    } else extraction = await extractFiles(store, projectId, source, new Map([[name, new Uint8Array(bytes)]]));
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
    const r = await run("pdftoppm", ["-png", "-f", String(page), "-l", String(page), "-scale-to-x", String(w), "-scale-to-y", "-1", "-singlefile", original, root]);
    const png = r.code === 0 ? await readFile(`${root}.png`).catch(() => null) : null;
    if (!png?.length) throw new AuthoringError("쪽 그림을 만들지 못했습니다.", 422);
    await store.writeFile(projectId, cached, png);
    return png;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

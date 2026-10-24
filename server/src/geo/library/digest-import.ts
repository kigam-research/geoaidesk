/** Local-only import of exported Gemini Notebook material. No URL is fetched. */
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { Parser } from "htmlparser2";
import { DIGEST_IMPORT_BYTES, DIGEST_IMPORT_TYPES, isPaperItem, type DigestImportBody, type DigestImportPreview, type DigestImportPreviewBody, type LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import { normalizeNotebookUrl } from "../../../../web/src/geo/contracts/notebook-link.ts";
import { addExternalDigest, digestOutline } from "./digests.ts";
import { LibraryError, normalizeDoi, cslYear, type LibraryStore } from "./store.ts";
import { doiCandidates } from "./metadata/identifiers.ts";

export const DIGEST_IMPORT_LIMITS = { ttlMs: 30 * 60_000, pending: 20, expandedBytes: 64 * 1024 * 1024, entries: 2000, textBytes: 8 * 1024 * 1024, pages: 400, csvRows: 200, csvColumns: 30 } as const;
const media: Record<string, string> = { ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".pdf": "application/pdf", ".md": "text/markdown", ".markdown": "text/markdown", ".txt": "text/plain", ".csv": "text/csv" };
const fail = (message: string, status = 422): never => { throw new LibraryError(message, status); };
const normal = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/[\r\n\t]+/g, " ").trim();
function table(rows: string[][]): string {
  if (!rows.length) return "";
  const columns = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: columns }, (_, i) => cell(r[i] ?? "")).join(" | ")} |`;
  return [line(rows[0]), line(Array(columns).fill("---")), ...rows.slice(1).map(line)].join("\n");
}
function utf8(bytes: Buffer): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/[\u0000-\u0008\u000B\u000E-\u001F]/.test(text)) return fail("텍스트 파일이 아닙니다. UTF-8 텍스트로 다시 저장하세요.", 415);
    return text;
  } catch (e) {
    if (e instanceof LibraryError) throw e;
    return fail("텍스트를 읽지 못했습니다. UTF-8로 다시 저장하세요.", 415);
  }
}
function csvMarkdown(text: string): string {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false, rowCount = 0, lastWasBreak = true;
  const field = () => { if (row.length >= DIGEST_IMPORT_LIMITS.csvColumns) fail("CSV 열이 너무 많습니다. 30열 이하로 줄여 다시 가져오세요."); row.push(value); value = ""; };
  const end = () => { field(); rowCount++; if (rows.length <= DIGEST_IMPORT_LIMITS.csvRows) rows.push(row); row = []; lastWasBreak = true; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || !value) quoted = !quoted;
      else fail("CSV 따옴표를 읽지 못했습니다. 파일을 다시 저장하세요.");
      lastWasBreak = false;
    } else if (ch === "," && !quoted) { field(); lastWasBreak = false; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; end(); }
    else { value += ch; lastWasBreak = false; }
  }
  if (quoted) fail("CSV 따옴표가 닫히지 않았습니다. 파일을 확인하세요.");
  if (!lastWasBreak) end();
  const kept = Math.max(0, rows.length - 1), total = Math.max(0, rowCount - 1);
  return `${table(rows)}\n\nCSV: 본문 ${total}행 중 ${kept}행을 가져왔습니다. 첫 행은 열 제목으로 사용했습니다.\n`;
}
interface XmlNode { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string }
function docxMarkdown(bytes: Buffer): string {
  try {
    const zip = new AdmZip(bytes), entries = zip.getEntries();
    if (entries.length > DIGEST_IMPORT_LIMITS.entries || entries.reduce((sum, e) => sum + e.header.size, 0) > DIGEST_IMPORT_LIMITS.expandedBytes)
      return fail("Word 파일의 내용이 너무 큽니다. 문서를 나누어 가져오세요.", 413);
    if (entries.some((e) => (e.header.flags & 1) !== 0 || /vbaProject|EncryptedPackage|EncryptionInfo/i.test(e.entryName)))
      return fail("암호화되거나 매크로가 있는 Word 파일은 읽지 않습니다. 일반 .docx로 다시 저장하세요.", 415);
    const content = zip.getEntry("[Content_Types].xml");
    if (content && /macroEnabled|vbaProject/i.test(content.getData().toString("utf8")))
      return fail("매크로가 있는 Word 파일은 읽지 않습니다. 일반 .docx로 다시 저장하세요.", 415);
    const document = zip.getEntry("word/document.xml");
    if (!document) return fail("Word 문서 내용을 찾지 못했습니다. .docx로 다시 저장하세요.", 415);
    const data = document.getData();
    if (data.length > DIGEST_IMPORT_LIMITS.textBytes) return fail("Word 본문이 너무 큽니다. 문서를 나누어 가져오세요.", 413);
    const xml = utf8(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return fail("Word 문서 형식을 읽지 못했습니다. .docx로 다시 저장하세요.", 415);
    const root: XmlNode = { name: "root", attrs: {}, children: [], text: "" }, stack = [root];
    const parser = new Parser({
      onopentag(name, attrs) { const n: XmlNode = { name: name.split(":").pop()!, attrs, children: [], text: "" }; stack.at(-1)!.children.push(n); stack.push(n); },
      ontext(text) { stack.at(-1)!.text += text; },
      onclosetag() { stack.pop(); },
    }, { xmlMode: true, decodeEntities: true });
    parser.end(xml);
    const children = (n: XmlNode, name: string): XmlNode[] => n.children.filter((x) => x.name === name);
    const text = (n: XmlNode): string => n.name === "t" ? n.text : n.name === "tab" ? "\t" : n.name === "br" || n.name === "cr" ? "\n" : n.children.filter((x) => x.name !== "del").map(text).join("");
    const val = (n?: XmlNode) => n && (n.attrs["w:val"] ?? n.attrs.val ?? Object.entries(n.attrs).find(([k]) => k.endsWith(":val"))?.[1]);
    const paragraph = (n: XmlNode): string => {
      const props = children(n, "pPr")[0], style = props && val(children(props, "pStyle")[0]);
      const heading = /^Heading([123])$/i.exec(style ?? "");
      return `${heading ? "#".repeat(Number(heading[1])) + " " : props && children(props, "numPr").length ? "- " : ""}${text(n).trim()}`;
    };
    const render = (n: XmlNode): string => {
      if (n.name === "p") return paragraph(n);
      if (n.name === "tbl") return table(children(n, "tr").map((r) => children(r, "tc").map((c) => c.children.map(render).join(" "))));
      return n.children.map(render).filter(Boolean).join("\n\n");
    };
    return render(root);
  } catch (e) {
    if (e instanceof LibraryError) throw e;
    return fail("Word 파일을 읽지 못했습니다. 암호와 매크로가 없는 .docx로 다시 저장하세요.", 415);
  }
}
async function command(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(cmd, args, { timeout: 60_000, maxBuffer: DIGEST_IMPORT_LIMITS.textBytes, encoding: "utf8" }, (error, stdout) => {
    if (error) return reject(new LibraryError((error as NodeJS.ErrnoException).code === "ENOENT" ? "PDF를 읽는 도구가 없습니다. Word 또는 텍스트로 내려받아 가져오세요." : "PDF를 읽지 못했습니다. 암호를 해제하거나 Word 또는 텍스트로 내려받아 가져오세요.", 422));
    resolve(stdout);
  }));
}
async function pdfMarkdown(bytes: Buffer): Promise<string> {
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") return fail("PDF 파일이 아닙니다. 원본 PDF를 다시 선택하세요.", 415);
  const dir = await mkdtemp(path.join(os.tmpdir(), "gaid-digest-import-"));
  try {
    const file = path.join(dir, "input.pdf");
    await writeFile(file, bytes, { mode: 0o600 });
    const info = await command("pdfinfo", [file]);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if (!Number.isInteger(pages) || pages < 1) return fail("PDF 쪽 수를 읽지 못했습니다. 다른 형식으로 내려받아 가져오세요.");
    if (pages > DIGEST_IMPORT_LIMITS.pages) return fail("PDF가 400쪽을 넘습니다. 문서를 나누어 가져오세요.", 413);
    return (await command("pdftotext", ["-f", "1", "-l", String(pages), "-layout", "-enc", "UTF-8", file, "-"])).replace(/\f/g, "\n\n");
  } finally { await rm(dir, { recursive: true, force: true }); }
}
function matchesFor(text: string, all: LibraryItem[]): Pick<DigestImportPreview, "matches" | "unmatched"> {
  const papers = all.filter((i) => isPaperItem(i) && !i.removedFromSourceAt), dois = new Set(doiCandidates(text).map(normalizeDoi).filter(Boolean));
  const normalizedText = ` ${normal(text)} `;
  const matches: DigestImportPreview["matches"] = [];
  for (const p of papers) {
    const doi = normalizeDoi(p.csl.DOI), title = normal(p.csl.title);
    const by = doi && dois.has(doi) ? "doi" : title.length >= 20 && normalizedText.includes(` ${title} `) ? "title" : undefined;
    if (by && matches.length < 500) matches.push({ itemId: p.id, title: p.csl.title, authors: (p.csl.author ?? []).map((a) => a.family ?? a.literal ?? "").filter(Boolean).join(", "), ...(cslYear(p.csl) ? { year: cslYear(p.csl) } : {}), by });
  }
  const known = new Set(papers.map((p) => normalizeDoi(p.csl.DOI)).filter(Boolean));
  const lines = text.split(/\r?\n/);
  const unmatched = [...dois].filter((doi): doi is string => Boolean(doi) && !known.has(doi)).slice(0, 100).map((doi) => ({ title: (lines.find((line) => line.toLowerCase().includes(doi)) ?? doi).trim().slice(0, 300), doi }));
  return { matches, unmatched };
}
interface Pending { preview: DigestImportPreview; text: string; bytes: Buffer; root: string; expires: number; timer: ReturnType<typeof setTimeout>; importing?: boolean }
/** One instance per route registration; previews never cross library roots or survive restart. */
export class DigestImporter {
  private pending = new Map<string, Pending>();
  private reading = 0;
  close(): void { for (const p of this.pending.values()) clearTimeout(p.timer); this.pending.clear(); }
  private prune(): void { for (const [key, p] of this.pending) if (!p.importing && p.expires <= Date.now()) { clearTimeout(p.timer); this.pending.delete(key); } }
  async preview(store: LibraryStore, body: DigestImportPreviewBody): Promise<DigestImportPreview> {
    this.prune();
    if (!body || typeof body.fileName !== "string" || body.fileName.length > 255 || /[/\\\u0000-\u001F]/.test(body.fileName)) return fail("파일 이름을 확인하세요.", 400);
    const extension = path.extname(body.fileName).toLowerCase();
    if (!(DIGEST_IMPORT_TYPES as readonly string[]).includes(extension)) return fail("지원하지 않는 파일입니다. Word, PDF, Markdown, 텍스트 또는 CSV를 선택하세요.", 415);
    if (typeof body.data !== "string") return fail("파일을 다시 선택하세요.", 400);
    if (body.data.length > Math.ceil(DIGEST_IMPORT_BYTES / 3) * 4) return fail("파일이 30 MB를 넘습니다. 문서를 나누어 가져오세요.", 413);
    if (!body.data || body.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) return fail("파일을 읽지 못했습니다. 원본 파일을 다시 선택하세요.", 400);
    const bytes = Buffer.from(body.data, "base64");
    if (bytes.length > DIGEST_IMPORT_BYTES) return fail("파일이 30 MB를 넘습니다. 문서를 나누어 가져오세요.", 413);
    if (this.pending.size + this.reading >= DIGEST_IMPORT_LIMITS.pending) return fail("가져오기 대기 파일이 많습니다. 열린 가져오기 창을 마친 뒤 다시 시도하세요.", 429);
    this.reading++;
    try {
      const text = extension === ".docx" ? docxMarkdown(bytes) : extension === ".pdf" ? await pdfMarkdown(bytes) : extension === ".csv" ? csvMarkdown(utf8(bytes)) : utf8(bytes);
      if (!text.trim()) return fail("읽을 수 있는 텍스트가 없습니다. 스캔 PDF라면 문자를 인식한 파일이나 텍스트로 다시 가져오세요.");
      if (Buffer.byteLength(text) > DIGEST_IMPORT_LIMITS.textBytes) return fail("가져올 본문이 너무 큽니다. 문서를 나누어 가져오세요.", 413);
      const outline = digestOutline(text), token = randomUUID();
      const preview: DigestImportPreview = { token, fileName: body.fileName, mediaType: media[extension], size: bytes.length, title: outline.title ?? /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(text)?.[1]?.trim().slice(0, 120) ?? path.basename(body.fileName, path.extname(body.fileName)).slice(0, 120), headings: outline.headings, excerpt: text.slice(0, 600), ...matchesFor(text, await store.all()) };
      const timer = setTimeout(() => { if (!this.pending.get(token)?.importing) this.pending.delete(token); }, DIGEST_IMPORT_LIMITS.ttlMs);
      timer.unref();
      this.pending.set(token, { preview, text, bytes, root: store.root, expires: Date.now() + DIGEST_IMPORT_LIMITS.ttlMs, timer });
      return preview;
    } finally { this.reading--; }
  }
  async import(store: LibraryStore, body: DigestImportBody): Promise<LibraryItem> {
    this.prune();
    const pending = body && typeof body.token === "string" && this.pending.get(body.token);
    if (!pending || pending.root !== store.root) return fail("파일을 다시 선택하세요. 가져오기 대기 시간이 지났거나 서버가 다시 시작되었습니다.", 410);
    if (pending.importing) return fail("파일을 저장하고 있습니다. 잠시 기다리세요.", 409);
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 120) return fail("정리 이름을 1~120자로 입력하세요.", 400);
    if (!Array.isArray(body.covers) || body.covers.length > 500 || !body.covers.every((id) => typeof id === "string" && pending.preview.matches.some((m) => m.itemId === id))) return fail("연결할 논문을 다시 선택하세요.", 400);
    if (body.collectionId !== undefined && (typeof body.collectionId !== "string" || !(await store.collections()).some((c) => c.id === body.collectionId))) return fail("서재 폴더를 찾지 못했습니다. 폴더를 다시 선택하세요.", 404);
    const notebookUrl = body.notebookUrl === undefined || body.notebookUrl === "" ? undefined : normalizeNotebookUrl(body.notebookUrl);
    if (notebookUrl === null) return fail("노트북 주소를 확인하세요. 로그인 정보가 없는 https 주소를 입력하세요.", 400);
    pending.importing = true;
    try {
      const file = await store.storeFile(pending.bytes, DIGEST_IMPORT_BYTES);
      const item = await addExternalDigest(store, { title: body.title, text: pending.text, covers: body.covers, unmatched: pending.preview.unmatched, collectionId: body.collectionId, external: { service: "gemini-notebook", fileName: pending.preview.fileName, mediaType: pending.preview.mediaType, file, ...(notebookUrl ? { notebookUrl } : {}) } });
      clearTimeout(pending.timer); this.pending.delete(body.token);
      return item;
    } finally { pending.importing = false; }
  }
}

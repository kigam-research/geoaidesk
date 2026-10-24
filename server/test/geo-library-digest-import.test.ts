import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import AdmZip from "adm-zip";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryStore } from "../src/geo/library/store.ts";
import { DigestImporter, DIGEST_IMPORT_LIMITS } from "../src/geo/library/digest-import.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import type { DigestImportPreview } from "../../web/src/geo/contracts/library.ts";

let dir: string, store: LibraryStore, importer: DigestImporter;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-import-test-")); store = new LibraryStore(dir); importer = new DigestImporter(); });
afterEach(() => { importer.close(); vi.useRealTimers(); fs.rmSync(dir, { recursive: true, force: true }); });
const body = (fileName: string, content: string | Buffer) => ({ fileName, data: Buffer.from(content).toString("base64") });
const paper = (title: string, doi?: string) => store.addGaidItem({ csl: { type: "article-journal", title, ...(doi ? { DOI: doi } : {}) }, metadataOrigin: "manual" });
const docx = (xml: string, extra?: [string, string]): Buffer => { const zip = new AdmZip(); zip.addFile("word/document.xml", Buffer.from(xml)); if (extra) zip.addFile(extra[0], Buffer.from(extra[1])); return zip.toBuffer(); };
const previewUrl = "/geo/library/digests/import/preview", importUrl = "/geo/library/digests/import";
async function server() { const app = Fastify(); await registerGeoLibraryRoutes(app, { store: () => store }); await app.ready(); return app; }

// Tiny real PDF with correct offsets and optionally a text layer; no external fixture generator.
function pdf(text?: string): Buffer {
  const stream = text ? `BT /F1 12 Tf 40 700 Td (${text}) Tj ET` : "";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let out = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}
let poppler = false;
try { execFileSync("pdftotext", ["-v"], { stdio: "ignore" }); execFileSync("pdfinfo", ["-v"], { stdio: "ignore" }); poppler = true; } catch { /* Tests below explain the skip. */ }

describe("Gemini output import", () => {
  it("previews without writes, matches papers only, and creates an external pending digest excluded from references", async () => {
    const a = await paper("Magnetic inversion constraints in magnetite deposits", "10.1234/known");
    const b = await paper("Joint inversion of gravity and magnetic field observations");
    const removed = await paper("A removed library paper is not linked", "10.1234/removed");
    await store.mutate(removed.id, (item) => { item.removedFromSourceAt = new Date().toISOString(); });
    const nonpaper = await paper("A digest title must never match here", "10.1234/digest");
    await store.mutate(nonpaper.id, (item) => { item.kind = "digest"; });
    const folder = await store.addGaidCollection("포천 자철석");
    const md = `# Pocheon briefing\n\n## Comparison\nhttps://doi.org/10.1234/KNOWN\n${b.csl.title}\nUnknown reference doi:10.5678/not-here\n${removed.csl.title} 10.1234/removed\n${nonpaper.csl.title} 10.1234/digest\n`;
    const app = await server();
    try {
      const response = await app.inject({ method: "POST", url: previewUrl, payload: body("briefing.md", md) });
      expect(response.statusCode).toBe(200);
      const preview = response.json() as DigestImportPreview;
      expect(preview).toMatchObject({ title: "Pocheon briefing", headings: ["Comparison"], mediaType: "text/markdown" });
      expect(preview.excerpt.length).toBeLessThanOrEqual(600);
      expect(preview.matches).toEqual([expect.objectContaining({ itemId: a.id, by: "doi" }), expect.objectContaining({ itemId: b.id, by: "title" })]);
      expect(preview.unmatched).toContainEqual(expect.objectContaining({ doi: "10.5678/not-here", title: "Unknown reference doi:10.5678/not-here" }));
      expect(fs.readdirSync(path.join(dir, "files"))).toEqual([]);
      const saved = await app.inject({ method: "POST", url: importUrl, payload: { token: preview.token, title: "정리 이름", covers: [a.id], collectionId: folder.id, notebookUrl: " https://notebooklm.google.com/notebook/abc " } });
      expect(saved.statusCode).toBe(201);
      const item = saved.json().item;
      expect(item).toMatchObject({ kind: "digest", collectionIds: [folder.id], digest: { origin: "external", status: "pending", covers: [a.id], text: md, external: { fileName: "briefing.md", service: "gemini-notebook", notebookUrl: "https://notebooklm.google.com/notebook/abc" } } });
      expect(item.citationKey).toBeUndefined();
      expect(fs.readFileSync(store.filePath(item.digest.external.file.sha256)).equals(Buffer.from(md))).toBe(true);
      expect((await app.inject({ url: "/geo/library/export?format=csl-json" })).body).not.toContain("정리 이름");
      expect((await app.inject({ method: "POST", url: importUrl, payload: { token: preview.token, title: "again", covers: [] } })).statusCode).toBe(410);
    } finally { await app.close(); }
  });
  it("handles UTF-8 text and bounded quoted CSV with a kept-row notice", async () => {
    expect((await importer.preview(store, body("정리.txt", "한글 자료"))).title).toBe("정리");
    expect((await importer.preview(store, body("heading.markdown", "## First heading\n\nText"))).title).toBe("First heading");
    const csv = 'Name,Description\n"A|B","one,two"\n' + Array.from({ length: 250 }, (_, i) => `${i},value`).join("\n");
    const p = await importer.preview(store, body("table.csv", csv));
    const item = await importer.import(store, { token: p.token, title: p.title, covers: [] });
    expect(item.digest!.text).toContain("A\\|B | one,two");
    expect(item.digest!.text).toContain("본문 251행 중 200행");
    await expect(importer.preview(store, body("bad.csv", 'a,b\n"unterminated'))).rejects.toMatchObject({ status: 422 });
  });
  it("converts DOCX headings, runs, lists and tables; refuses macros, encryption, and excessive expanded size", async () => {
    const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>문헌 정리</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>비교</w:t></w:r></w:p><w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>목록 &amp; 내용</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>열</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>값</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const p = await importer.preview(store, body("briefing.docx", docx(xml)));
    expect(p).toMatchObject({ title: "문헌 정리", headings: ["비교"] });
    expect(p.excerpt).toContain("- 목록 & 내용"); expect(p.excerpt).toContain("| 열 |\n| --- |\n| 값 |");
    await expect(importer.preview(store, body("bad.docx", docx(xml, ["word/vbaProject.bin", "x"])))).rejects.toMatchObject({ status: 415 });
    await expect(importer.preview(store, body("bad.docx", docx(xml, ["[Content_Types].xml", "macroEnabled"])))).rejects.toMatchObject({ status: 415 });
    const encrypted = docx(xml); const header = encrypted.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); encrypted.writeUInt16LE(encrypted.readUInt16LE(header + 8) | 1, header + 8);
    await expect(importer.preview(store, body("bad.docx", encrypted))).rejects.toMatchObject({ status: 415 });
    const oversized = docx(xml); const pos = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); oversized.writeUInt32LE(DIGEST_IMPORT_LIMITS.expandedBytes + 1, pos + 24);
    await expect(importer.preview(store, body("big.docx", oversized))).rejects.toMatchObject({ status: 413 });
  });
  it.skipIf(!poppler)("reads a real whole-document PDF and rejects a PDF without a text layer (requires pdftotext + pdfinfo)", async () => {
    const p = await importer.preview(store, body("paper.pdf", pdf("Research literature comparison")));
    expect(p.excerpt).toContain("Research literature comparison");
    await expect(importer.preview(store, body("scan.pdf", pdf()))).rejects.toMatchObject({ status: 422, message: expect.stringContaining("읽을 수 있는 텍스트") });
  });
  it("expires tokens, bounds the queue, and keeps failed confirmation available for correction", async () => {
    vi.useFakeTimers();
    const p = await importer.preview(store, body("a.md", "# Summary"));
    for (const notebookUrl of ["http://notebooklm.google.com/x", "https://user:password@example.org", "javascript:alert(1)"]) await expect(importer.import(store, { token: p.token, title: "Summary", covers: [], notebookUrl })).rejects.toMatchObject({ status: 400 });
    await expect(importer.import(store, { token: p.token, title: "Summary", covers: ["not-previewed"] })).rejects.toMatchObject({ status: 400 });
    await expect(importer.import(store, { token: "unknown", title: "Summary", covers: [] })).rejects.toMatchObject({ status: 410 });
    await vi.advanceTimersByTimeAsync(DIGEST_IMPORT_LIMITS.ttlMs);
    await expect(importer.import(store, { token: p.token, title: "Summary", covers: [] })).rejects.toMatchObject({ status: 410 });
    for (let i = 0; i < DIGEST_IMPORT_LIMITS.pending; i++) await importer.preview(store, body("a.md", "# Summary"));
    await expect(importer.preview(store, body("a.md", "# Summary"))).rejects.toMatchObject({ status: 429 });
  });
  it("rejects unsupported, mislabelled, invalid UTF-8, blank and invalid base64 files without leaking contents", async () => {
    for (const [name, bytes, status] of [["data.exe", "secret", 415], ["bad.pdf", "secret", 415], ["bad.docx", "secret", 415], ["bad.txt", Buffer.from([0xff, 0xfe]), 415], ["empty.txt", "  ", 422]] as const) await expect(importer.preview(store, body(name, bytes))).rejects.toMatchObject({ status, message: expect.not.stringContaining("secret") });
    await expect(importer.preview(store, { fileName: "a.md", data: "not-base64" })).rejects.toMatchObject({ status: 400 });
    const app = await server();
    try { expect((await app.inject({ method: "POST", url: previewUrl, payload: body("file.docm", "no") })).statusCode).toBe(415); }
    finally { await app.close(); }
  });
});

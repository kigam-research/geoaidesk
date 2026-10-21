/**
 * Page text of library PDFs, for page-anchored answers. pdftotext (poppler) reads one page at a time, as hub authoring
 * does; the text is cached per PDF hash under `<library>/pages/<sha256>/`. A page with almost no text is unreadable
 * (scan without OCR, figure-only page) and is reported, never guessed.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryItem, ReadState } from "../../../../web/src/geo/contracts/library.ts";
import type { LibraryStore } from "./store.ts";

export const READER_LIMITS = { pages: 400, pageChars: 40_000, minPageChars: 40 } as const;

function run(cmd: string, args: string[], timeoutMs = 60_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
      const code = error ? (typeof (error as { code?: unknown }).code === "number" ? ((error as { code: number }).code) : -1) : 0;
      resolve({ code, out: stdout ?? "", err: stderr ?? "" });
    });
  });
}

let version: Promise<string | undefined> | undefined;
export function pdftotextVersion(): Promise<string | undefined> {
  version ??= run("pdftotext", ["-v"], 10_000).then((r) => (r.code === -1 && !r.err && !r.out ? undefined : (/pdftotext version ([\d.]+)/.exec(r.err + r.out)?.[1] ?? "unknown")));
  return version;
}

interface PagesMeta {
  pages: number;
  unreadable: number[];
  reader: { name: string; version: string };
  readAt: string;
}

const pagesDir = (store: LibraryStore, sha: string) => join(store.root, "pages", sha);

async function pageCount(file: string): Promise<number | undefined> {
  const r = await run("pdfinfo", [file], 30_000);
  const n = Number(/^Pages:\s+(\d+)/m.exec(r.out)?.[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Extracts and caches every page of a stored PDF; returns the read state for the item. */
export async function readStoredPdf(store: LibraryStore, sha: string): Promise<ReadState> {
  const dir = pagesDir(store, sha), metaFile = join(dir, "meta.json");
  if (existsSync(metaFile)) return toReadState(JSON.parse(await readFile(metaFile, "utf8")) as PagesMeta);
  const v = await pdftotextVersion();
  if (!v) return { coverage: "none" };
  const file = store.filePath(sha);
  const total = Math.min((await pageCount(file)) ?? 0, READER_LIMITS.pages);
  if (!total) return { coverage: "none" };
  await mkdir(dir, { recursive: true });
  const unreadable: number[] = [];
  for (let page = 1; page <= total; page++) {
    const r = await run("pdftotext", ["-f", String(page), "-l", String(page), "-layout", "-enc", "UTF-8", file, "-"]);
    const text = r.code === 0 ? r.out.slice(0, READER_LIMITS.pageChars) : "";
    if (text.replace(/\s+/g, "").length < READER_LIMITS.minPageChars) unreadable.push(page);
    await writeFile(join(dir, `${page}.txt`), text);
  }
  const meta: PagesMeta = { pages: total, unreadable, reader: { name: "pdftotext", version: v }, readAt: new Date().toISOString() };
  const tmp = `${metaFile}.tmp`;
  await writeFile(tmp, JSON.stringify(meta));
  await rename(tmp, metaFile);
  return toReadState(meta);
}

function toReadState(meta: PagesMeta): ReadState {
  const read = meta.pages - meta.unreadable.length;
  return {
    coverage: read === 0 ? "none" : meta.unreadable.length ? "partial" : "full",
    pagesRead: read,
    pagesTotal: meta.pages,
    ...(meta.unreadable.length ? { unreadablePages: meta.unreadable } : {}),
    reader: meta.reader,
    readAt: meta.readAt,
  };
}

/** The stored PDF hash of an item, if it has one GAID can read. */
export function storedPdf(item: LibraryItem): string | undefined {
  return item.attachments.find((a) => a.kind === "pdf" && a.stored)?.stored?.sha256;
}

export async function pageText(store: LibraryStore, sha: string, page: number): Promise<string | undefined> {
  const file = join(pagesDir(store, sha), `${page}.txt`);
  return existsSync(file) ? readFile(file, "utf8") : undefined;
}

/** Pages whose text contains every query term (case-insensitive), best first, with a short snippet. */
export async function searchPages(store: LibraryStore, sha: string, query: string, limit = 5): Promise<{ page: number; snippet: string; score: number }[]> {
  const metaFile = join(pagesDir(store, sha), "meta.json");
  if (!existsSync(metaFile)) return [];
  const meta = JSON.parse(await readFile(metaFile, "utf8")) as PagesMeta;
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const hits = [];
  for (let page = 1; page <= meta.pages; page++) {
    const text = (await pageText(store, sha, page)) ?? "";
    const lower = text.toLowerCase();
    const counts = terms.map((t) => lower.split(t).length - 1);
    if (counts.some((c) => c === 0)) continue;
    const at = lower.indexOf(terms[0]);
    const snippet = text.slice(Math.max(0, at - 160), at + 240).replace(/\s+/g, " ").trim();
    hits.push({ page, snippet, score: counts.reduce((a, b) => a + Math.log(1 + b), 0) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

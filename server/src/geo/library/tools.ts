/**
 * Lead-agent library tools and the research-note citation check (ADR 2026-10-21-research-hub-library, decision 6).
 * The agent searches and reads only the literature attached to the project; page text comes from the PDF, and every
 * answer states how much of a paper was read. Citations in research notes must be library keys.
 */
import fs from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionFactory, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../../projects.ts";
import { apiRelative } from "../../sandbox-fs.ts";
import { digestKey, isDigestItem, isPaperItem, parseCitations, type LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import { cslYear, libraryStore, shortAuthors, type LibraryStore } from "./store.ts";
import { pageText, searchPages, storedPdf } from "./reader.ts";
import { hasScope, projectItems, readProjectLiterature } from "./uses.ts";
import { newPapersSince, refreshDigestItems } from "./digests.ts";

const MAX_TOOL_BYTES = 24 * 1024;
const MAX_READ_PAGES = 5;

const bounded = (text: string) => (Buffer.byteLength(text) <= MAX_TOOL_BYTES ? text : Buffer.from(text).subarray(0, MAX_TOOL_BYTES - 40).toString("utf8").replace(/�$/, "") + "\n[truncated]");

/** Prefix within a UTF-8 budget, never splitting a Unicode character; offsets remain JavaScript character offsets. */
function bytePrefix(text: string, bytes: number): string {
  if (Buffer.byteLength(text) <= bytes) return text;
  let end = Buffer.from(text).subarray(0, Math.max(0, bytes)).toString("utf8").replace(/�+$/, "");
  // Avoid returning a replacement character when the stored text itself is valid Unicode.
  while (!text.startsWith(end) && end.length) end = end.slice(0, -1);
  return end;
}

/** ATX level-2 section boundaries outside fenced code; the returned offsets refer to the full stored text. */
function digestSections(text: string): { title: string; start: number; end: number }[] {
  const sections: { title: string; start: number; end: number }[] = [];
  let fence: { mark: string; length: number } | null = null;
  for (const line of text.matchAll(/^.*(?:\n|$)/gm)) {
    const value = line[0].replace(/[\r\n]+$/, "");
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(value)?.[1];
    if (marker) {
      if (!fence) fence = { mark: marker[0], length: marker.length };
      else if (marker[0] === fence.mark && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^ {0,3}(#{1,2})\s+(.+?)\s*#*\s*$/.exec(value);
    if (!heading) continue;
    const last = sections.at(-1);
    if (last && last.end === text.length) last.end = line.index!;
    if (heading[1] === "##") sections.push({ title: heading[2].trim(), start: line.index!, end: text.length });
  }
  return sections;
}

function coverageLine(item: LibraryItem): string {
  const r = item.read;
  switch (r.coverage) {
    case "full": return `read: full text, ${r.pagesTotal} pages`;
    case "partial": return `read: ${r.pagesRead}/${r.pagesTotal} pages; unreadable pages ${r.unreadablePages?.join(", ")}`;
    case "abstract": return "read: abstract/metadata only (no PDF text) - do not claim anything beyond the abstract";
    default: return "read: nothing (no readable PDF) - cite only bibliographic facts";
  }
}

function describe(item: LibraryItem): string {
  const year = cslYear(item.csl);
  return `[@${item.citationKey ?? item.id}] ${shortAuthors(item.csl, "en")}${year ? ` (${year})` : ""}. ${item.csl.title}${typeof item.csl["container-title"] === "string" ? `. ${item.csl["container-title"]}` : ""}${item.csl.DOI ? `. doi:${item.csl.DOI}` : ""}\n  ${coverageLine(item)}`;
}

/** Pages like "3", "3-5", "3,7" -> sorted page numbers (at most MAX_READ_PAGES). */
export function parsePages(spec: string | undefined, total: number): number[] {
  const out = new Set<number>();
  for (const part of (spec ?? "1").split(",")) {
    const [a, b] = part.split("-").map((x) => Number(x.trim()));
    if (!Number.isInteger(a)) continue;
    const end = Number.isInteger(b) ? b : a;
    for (let p = Math.max(1, a); p <= Math.min(end, total) && out.size < MAX_READ_PAGES; p++) out.add(p);
  }
  return [...out].sort((x, y) => x - y);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeLibraryTools(paths: ProjectPaths, storeOf: () => LibraryStore = libraryStore): ToolDefinition<any, any>[] {
  async function available(): Promise<{ items: LibraryItem[]; attached: boolean }> {
    const all = (await storeOf().all()).filter((i) => !i.removedFromSourceAt);
    const attached = projectItems(readProjectLiterature(paths), all, await storeOf().collections());
    return { items: attached, attached: attached.length > 0 };
  }
  async function find(ref: string): Promise<LibraryItem | undefined> {
    const key = ref.replace(/^\[?@/, "").replace(/\]$/, "");
    return (await available()).items.find((i) => i.citationKey === key || i.id === key || i.aliases?.citationKeys?.includes(key));
  }

  const searchParams = Type.Object({ query: Type.String({ description: "Words to find in titles, authors, abstracts and page text" }), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })) });
  const searchTool: ToolDefinition<typeof searchParams> = {
    name: "library_search",
    label: "Search project literature",
    description: "Search the papers the researcher attached to this project (their GAID library: Zotero or GAID items). Returns citation keys, how much of each paper was read, and matching pages with snippets.",
    promptSnippet: "library_search: find evidence in the project's attached papers (cite as [@key, p. N])",
    promptGuidelines: [
      "For literature questions in a project with attached papers, search them with library_search and read pages with library_read before answering.",
      "Cite only keys returned by library tools, as Pandoc citations [@key, p. N]; state when a paper was read only partly or only as an abstract. Do not invent citations; mark other sources as not in the library.",
    ],
    parameters: searchParams,
    async execute(_id, params) {
      const { items, attached } = await available();
      if (!attached) return { content: [{ type: "text", text: "No papers are attached to this project. Ask the researcher to attach papers from 서재 (프로젝트에 붙이기); do not cite library papers." }], details: { results: [] } };
      const terms = params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
      const store = storeOf(), limit = params.limit ?? 5, results = [];
      for (const item of items) {
        const hay = [item.csl.title, item.csl.abstract, item.csl["container-title"], ...(item.csl.author ?? []).map((a) => a.family ?? a.literal ?? "")].filter((x): x is string => typeof x === "string").join(" ").toLowerCase();
        const meta = terms.filter((t) => hay.includes(t)).length;
        const sha = storedPdf(item);
        const pages = sha ? await searchPages(store, sha, params.query, 3) : [];
        if (!meta && !pages.length) continue;
        results.push({ item, score: meta + pages.reduce((a, p) => a + p.score, 0), pages });
      }
      results.sort((a, b) => b.score - a.score);
      const top = results.slice(0, limit);
      const text = top.length
        ? top.map((r) => `${describe(r.item)}${r.pages.map((p) => `\n  p. ${p.page}: …${p.snippet}…`).join("")}`).join("\n\n")
        : `No attached paper matches "${params.query}". ${items.length} paper(s) attached.`;
      return { content: [{ type: "text", text: bounded(text) }], details: { results: top.map((r) => ({ itemId: r.item.id, key: r.item.citationKey, pages: r.pages.map((p) => p.page) })) } };
    },
  };

  const readParams = Type.Object({ key: Type.String({ description: "Citation key from library_search (with or without @)" }), pages: Type.Optional(Type.String({ description: "Pages like 3, 3-5 or 2,7 (at most 5)" })) });
  const readTool: ToolDefinition<typeof readParams> = {
    name: "library_read",
    label: "Read paper pages",
    description: "Read the text of up to 5 pages of an attached paper by citation key. Page numbers are PDF pages.",
    promptSnippet: "library_read: page text of an attached paper",
    parameters: readParams,
    async execute(_id, params) {
      const item = await find(params.key);
      if (!item) return { content: [{ type: "text", text: `No attached paper has the key ${params.key}. Use library_search first.` }], details: {} };
      const sha = storedPdf(item), total = item.read.pagesTotal ?? 0;
      if (!sha || !total) return { content: [{ type: "text", text: `${describe(item)}\nNo readable PDF text in GAID for this paper.${item.csl.abstract ? `\nAbstract: ${item.csl.abstract}` : ""}` }], details: { itemId: item.id } };
      const pages = parsePages(params.pages, total);
      const parts = [];
      for (const p of pages) {
        const unreadable = item.read.unreadablePages?.includes(p);
        parts.push(`--- p. ${p}${unreadable ? " (no extractable text: scan or figure page)" : ""} ---\n${unreadable ? "" : ((await pageText(storeOf(), sha, p)) ?? "").trim()}`);
      }
      return { content: [{ type: "text", text: bounded(`${describe(item)}\n${parts.join("\n")}`) }], details: { itemId: item.id, pages } };
    },
  };
  const digestParams = Type.Object({
    key: Type.String({ description: "digest:<itemId> from the Workflow start message, or the digest item id (not a citation key)" }),
    section: Type.Optional(Type.String({ description: "Exact level-2 heading to read (with or without ##)" })),
    offset: Type.Optional(Type.Integer({ minimum: 0, description: "Character offset in the full digest text; use nextOffset from the previous window" })),
  });
  const digestTool: ToolDefinition<typeof digestParams> = {
    name: "library_digest",
    label: "Read literature digest",
    description: "Read a prepared literature digest covering at least one paper attached to this project. Returns its origin, review state, paper citation keys and a text window of at most 24 KiB; continue with nextOffset or select a level-2 section.",
    promptSnippet: "library_digest: read the selected literature digest before analysis; never cite the digest",
    promptGuidelines: [
      "If a Workflow start names a library-digest, read it first with library_digest before analysis. Continue windows until the relevant sections have been read.",
      "Verify every digest claim used in results by reading the original paper with library_read, then cite [@key, p. N] using its PDF page. Never cite a digest (including [@digest:…]).",
      "An external summary (Gemini Notebook) is reference only, not citation evidence. Its review mark does not replace checking original papers. Respect the project's citation scope, including for papers listed by a digest.",
    ],
    parameters: digestParams,
    async execute(_id, params) {
      const store = storeOf();
      let all = await store.all();
      const id = params.key.replace(/^digest:/, "");
      let item = all.find((i) => i.id === id && isDigestItem(i) && !i.removedFromSourceAt);
      const refuse = (reason: string) => ({ content: [{ type: "text" as const, text: bounded(`Cannot read digest ${params.key}: ${reason}`) }], details: {} });
      if (!item?.digest) return refuse("no literature digest has this item id. Choose a digest from 서재.");
      await refreshDigestItems(store, [item]);
      all = await store.all();
      item = all.find((i) => i.id === id)!;
      const d = item.digest!;
      const collections = await store.collections();
      const scoped = new Set(projectItems(readProjectLiterature(paths), all, collections).map((i) => i.id));
      const covered = all.filter((p) => isPaperItem(p) && !p.removedFromSourceAt && (d.covers.includes(p.id) || p.aliases?.ids?.some((alias) => d.covers.includes(alias))));
      if (!covered.some((p) => scoped.has(p.id))) return refuse("it covers no paper in this project's attached citation scope. Attach a covered paper or its folder from 서재 first.");
      if (d.made?.missingAt) return refuse("its source file is missing. Restore or remake the digest in its original project.");
      const lines = [
        `Literature digest: ${bytePrefix(item.csl.title, 500)} (${digestKey(item.id)})`,
        `출처: ${d.origin === "gaid" ? "GAID에서 만듦" : "외부 정리 (Gemini Notebook, reference only)"}`,
        `상태: ${d.status === "confirmed" ? "확인함" : "검토 전"}`,
        "Read this digest first; verify every claim used in results with library_read on the original paper and cite [@key, p. N]. Never cite the digest. External summaries are reference only.",
      ];
      const added = newPapersSince(item, all, collections);
      if (added) lines.push(`Folder changed: ${added} paper(s) added/not covered since this digest; do not assume it includes them.`);
      if (d.truncated) lines.push("The stored digest is truncated; later text is not available here.");
      lines.push("Covered papers (outside-scope papers must not be cited):");
      let budget = 10 * 1024;
      const addList = (values: string[]) => {
        let count = 0;
        for (const value of values) {
          const line = bytePrefix(value.replace(/[\r\n]+/g, " "), 420);
          const size = Buffer.byteLength(line) + 1;
          if (size > budget) break;
          lines.push(line); budget -= size; count++;
        }
        if (count < values.length) lines.push(`[${values.length - count} more entries omitted from header]`);
      };
      addList(covered.map((p) => `- [@${p.citationKey ?? p.id}] ${p.csl.title}${scoped.has(p.id) ? "" : " [outside project citation scope]"}`));
      const missing = d.covers.length - covered.length;
      if (missing > 0) lines.push(`${missing} covered paper(s) are no longer available in 서재.`);
      if (d.unmatched?.length) { lines.push("Sources not in 서재 (not library citations):"); addList(d.unmatched.map((s) => `- ${s.title}${s.doi ? ` (doi:${s.doi})` : ""}`)); }
      let start = 0, end = d.text.length;
      if (params.section) {
        const title = params.section.replace(/^##\s+/, "").trim();
        const section = digestSections(d.text).find((s) => s.title === title);
        if (!section) return refuse(`no level-2 section named "${title}". Read without section to see the text.`);
        start = section.start; end = section.end;
      }
      const offset = params.offset ?? start;
      if (offset < start || offset > end || !Number.isInteger(offset)) return refuse(`offset must be between ${start} and ${end} for this text window.`);
      if (offset > 0 && /[\uDC00-\uDFFF]/.test(d.text[offset] ?? "") && /[\uD800-\uDBFF]/.test(d.text[offset - 1])) return refuse("offset splits a Unicode character; use nextOffset from the previous window.");
      const header = lines.join("\n") + `\n--- text (character offset ${offset}, section end ${end}) ---\n`;
      const window = bytePrefix(d.text.slice(offset, end), MAX_TOOL_BYTES - Buffer.byteLength(header) - 200);
      const next = offset + window.length;
      const more = next < end;
      const footer = more ? `\n[More text: call library_digest with key="${digestKey(item.id)}", offset=${next}; keep the same section if specified.]` : "\n[End of selected text.]";
      return { content: [{ type: "text", text: header + window + footer }], details: { itemId: item.id, offset, end: next, ...(more ? { nextOffset: next } : {}), sectionEnd: end } };
    },
  };
  return [searchTool, readTool, digestTool];
}

/**
 * After a lead write/edit of a research note, list citation keys that are not in the library, and keys outside the
 * project's citation scope (its attached folders and papers) when it has one. Never blocks.
 */
export function makeNoteCitationExtension(paths: ProjectPaths, storeOf: () => LibraryStore = libraryStore): ExtensionFactory {
  return (pi) => {
    pi.on("tool_result", async (event) => {
      if ((event.toolName !== "write" && event.toolName !== "edit") || event.isError) return;
      const target = (event.input as { path?: unknown } | null)?.path;
      if (typeof target !== "string") return;
      try {
        const abs = path.resolve(paths.sandbox, target.replace(/^@/, ""));
        const [dir, , file, extra] = apiRelative(path.resolve(paths.sandbox), abs).normalize("NFC").split("/");
        if (dir !== RESEARCH_NOTES_DIR || file !== RESEARCH_NOTE_FILE || extra !== undefined) return;
        const st = fs.statSync(abs);
        if (st.size > 2 * 1024 * 1024) return;
        const keys = [...new Set(parseCitations(fs.readFileSync(abs, "utf8")).map((c) => c.key))];
        if (!keys.length) return;
        const store = storeOf(), missing = [], outside = [], digests = [];
        const literature = readProjectLiterature(paths);
        const scope = hasScope(literature) ? new Set(projectItems(literature, await store.all(), await store.collections()).map((i) => i.id)) : undefined;
        for (const key of keys) {
          if (key.startsWith("digest:")) { digests.push(key); continue; }
          const item = await store.byCitationKey(key);
          if (!item) missing.push(key);
          else if (scope && !scope.has(item.id)) outside.push(key);
        }
        if (!missing.length && !outside.length && !digests.length) return;
        const lines = [
          digests.length ? `Citation check: ${digests.map((k) => `@${k}`).join(", ")} cites a literature digest, which is not a reference. Read the original paper with library_read, verify the claim and replace with [@paperKey, p. N]. External summaries are reference only; never cite them.` : "",
          missing.length ? `Citation check: ${missing.map((k) => `@${k}`).join(", ")} not in the researcher's library. Cite only keys from library_search, or write the source as plain text marked as not in the library.` : "",
          outside.length ? `Citation check: ${outside.map((k) => `@${k}`).join(", ")} in the library but outside this project's citation folders. Ask the researcher before citing it, or ask them to add the paper to the folder.` : "",
        ].filter(Boolean);
        return { content: [...event.content, { type: "text" as const, text: lines.join("\n") }] };
      } catch {
        return; // A failed check never changes the tool's own result.
      }
    });
  };
}

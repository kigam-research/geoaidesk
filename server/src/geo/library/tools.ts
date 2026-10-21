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
import { parseCitations, type LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import { cslYear, libraryStore, shortAuthors, type LibraryStore } from "./store.ts";
import { pageText, searchPages, storedPdf } from "./reader.ts";
import { hasScope, projectItems, readProjectLiterature } from "./uses.ts";

const MAX_TOOL_BYTES = 24 * 1024;
const MAX_READ_PAGES = 5;

const bounded = (text: string) => (Buffer.byteLength(text) <= MAX_TOOL_BYTES ? text : Buffer.from(text).subarray(0, MAX_TOOL_BYTES - 40).toString("utf8").replace(/�$/, "") + "\n[truncated]");

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
  return [searchTool, readTool];
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
        const store = storeOf(), missing = [], outside = [];
        const literature = readProjectLiterature(paths);
        const scope = hasScope(literature) ? new Set(projectItems(literature, await store.all(), await store.collections()).map((i) => i.id)) : undefined;
        for (const key of keys) {
          const item = await store.byCitationKey(key);
          if (!item) missing.push(key);
          else if (scope && !scope.has(item.id)) outside.push(key);
        }
        if (!missing.length && !outside.length) return;
        const lines = [
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

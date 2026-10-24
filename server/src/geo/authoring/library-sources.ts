/**
 * Papers and research notes as hub authoring sources (gaid-authoring-sources): a paper from 서재 enters with its
 * stored PDF (else its metadata and abstract as text), a research note with its index.md and the figures it shows.
 * Library note items follow gaid-note-library (`LibraryItem.kind === "note"`, `item.note`); a note whose project is not
 * on this machine (synced from another PC) enters as the library's Markdown copy.
 */
import fs from "node:fs";
import path from "node:path";
import type { AddLibrarySourcesResult, SourceDocument } from "../../../../web/src/geo/contracts/authoring.ts";
import type { LibraryItem } from "../../../../web/src/geo/contracts/library.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import { getProject, resolvePaths, type ProjectPaths } from "../../projects.ts";
import { apiRelative, isWithin } from "../../sandbox-fs.ts";
import { markdownImageTargets } from "../markdown-images.ts";
import { getResearchNote, safeNoteId } from "../notes/store.ts";
import { SourceCapacityError, storeSource } from "./sources.ts";
import { AuthoringError, type AuthoringStore } from "./store.ts";
import { normalizeDoi, type LibraryStore } from "../library/store.ts";
import { storedPdf } from "../library/reader.ts";
import type { ZoteroService } from "../library/zotero-service.ts";

const FIGURE_BYTES = 8 * 1024 * 1024;
const NOTE_FILES = 40;

/** The note fields of a library item (gaid-note-library); absent on papers and before that unit merges. */
interface NoteRef {
  projectId: string;
  noteId: string;
  origin?: string;
  markdown?: string;
  truncated?: boolean;
  projectName?: string;
}
type NoteItem = LibraryItem & { kind?: "paper" | "note"; note?: NoteRef };

export const isNoteItem = (item: LibraryItem): boolean => (item as NoteItem).kind === "note" && !!(item as NoteItem).note;

/** Figures the note shows that sit inside its own folder (regular files, no links outside the project). */
function noteFigures(sandbox: string, noteId: string, markdown: string): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const root = fs.realpathSync(sandbox);
  const folder = path.join(root, RESEARCH_NOTES_DIR, noteId);
  for (const target of markdownImageTargets(markdown)) {
    if (out.size >= NOTE_FILES) break;
    let rel: string;
    try {
      rel = decodeURI(target.replace(/^file:/i, "").split(/[?#]/)[0]);
    } catch {
      continue;
    }
    const abs = path.resolve(folder, rel);
    if (!isWithin(folder, abs)) continue;
    try {
      const real = fs.realpathSync(abs);
      const stat = fs.statSync(real);
      if (!isWithin(root, real) || !stat.isFile() || stat.size > FIGURE_BYTES) continue;
      const key = apiRelative(folder, abs);
      if (!out.has(key)) out.set(key, new Uint8Array(fs.readFileSync(real)));
    } catch {
      /* a missing figure is left out; the note text still names it */
    }
  }
  return out;
}

/** Add one research note from a GAID project on this machine (its index.md and the figures inside its folder). */
export async function addNoteSource(
  store: AuthoringStore,
  authoringId: string,
  ref: { projectId: string; noteId: string },
  library?: SourceDocument["library"],
  /** The project already resolved by the caller (the request's own project). */
  resolved?: ProjectPaths,
) {
  if (typeof ref?.projectId !== "string" || typeof ref.noteId !== "string" || !safeNoteId(ref.noteId))
    throw new AuthoringError("연구 노트를 찾을 수 없습니다.", 404);
  if (!resolved && !getProject(ref.projectId)) throw new AuthoringError("연구 노트의 프로젝트를 찾을 수 없습니다.", 404);
  const paths = resolved ?? resolvePaths(ref.projectId);
  let note: ReturnType<typeof getResearchNote>;
  try {
    note = getResearchNote(paths, ref.noteId);
  } catch {
    throw new AuthoringError("연구 노트를 찾을 수 없습니다.", 404);
  }
  const files = new Map<string, Uint8Array>([[RESEARCH_NOTE_FILE, new Uint8Array(Buffer.from(note.content))]]);
  for (const [p, d] of noteFigures(paths.sandbox, note.note.id, note.content)) if (p !== RESEARCH_NOTE_FILE) files.set(p, d);
  return storeSource(store, authoringId, {
    name: `${note.note.id}.md`,
    kind: "note",
    files,
    documentKind: "research-note",
    title: note.note.title,
    note: { projectId: ref.projectId, noteId: note.note.id, title: note.note.title },
    ...(library ? { library } : {}),
  });
}

/** Text of a paper GAID has no PDF for: its metadata and abstract, so the coauthor at least knows what it is. */
function metadataText(item: LibraryItem): string {
  const c = item.csl;
  const authors = (c.author ?? []).map((a) => [a.family, a.given].filter(Boolean).join(", ") || a.literal).filter(Boolean);
  const year = c.issued?.["date-parts"]?.[0]?.[0];
  return [
    `# ${c.title}`,
    "",
    authors.length ? `Authors: ${authors.join("; ")}` : "",
    year ? `Year: ${year}` : "",
    c["container-title"] ? `Published in: ${c["container-title"]}` : "",
    c.DOI ? `DOI: ${c.DOI}` : "",
    "",
    c.abstract ? `Abstract:\n${c.abstract}` : "(No abstract or full text is stored in the library.)",
  ]
    .filter((l, i, all) => l || all[i - 1])
    .join("\n");
}

export interface LibrarySourceDeps {
  get(id: string): Promise<LibraryItem>;
  /** Path of a stored file by sha256. */
  filePath(sha: string): string;
  /** Zotero items: mirror the PDF into GAID storage first (returns the refreshed item). */
  readZoteroPdf?(item: LibraryItem): Promise<LibraryItem>;
  storedPdf(item: LibraryItem): string | undefined;
  normalizeDoi(doi: unknown): string | undefined;
}

/** Add library items (papers and research notes) to an authoring project, each as its own source. */
export async function addLibrarySources(
  store: AuthoringStore,
  authoringId: string,
  itemIds: string[],
  deps: LibrarySourceDeps,
): Promise<AddLibrarySourcesResult> {
  const result: AddLibrarySourcesResult = { authoringId, added: [], skipped: [] };
  for (const itemId of itemIds) {
    let item: LibraryItem;
    try {
      item = await deps.get(itemId);
    } catch {
      result.skipped.push({ itemId, reason: "서재에서 항목을 찾지 못했습니다." });
      continue;
    }
    const ref = { itemId: item.id, ...(item.citationKey ? { citationKey: item.citationKey } : {}) };
    try {
      // A 문헌 정리 (gaid-library-prep) enters as its Markdown text, marked as reading material: the coauthor reads it first,
      // but evidence and citations come from the original papers (added alongside when the researcher asked for them).
      if (item.kind === "digest" && item.digest) {
        const d = item.digest;
        if (!d.text.trim()) throw new AuthoringError("문헌 정리에 본문이 없습니다.", 409);
        const covered = await Promise.all(d.covers.map(async (id) => { try { const p = await deps.get(id); return `- [@${p.citationKey ?? p.id}] ${p.csl.title}`; } catch { return ""; } }));
        const header = [
          `<!-- GAID literature digest (${d.origin === "external" ? "external summary imported from Gemini Notebook; reference only" : "made in GAID from the papers below"}; status ${d.status}). Read it first; every evidence anchor and citation must point to an original paper's page, never to this digest. -->`,
          covered.filter(Boolean).length ? `<!-- Papers it covers:\n${covered.filter(Boolean).join("\n")}\n-->` : "",
        ].filter(Boolean).join("\n");
        const safe = item.csl.title.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 60) || "digest";
        const added = await storeSource(store, authoringId, {
          name: `${safe}.md`,
          mediaType: "text/markdown",
          kind: "text",
          bytes: new Uint8Array(Buffer.from(`${header}\n\n${d.text}`)),
          documentKind: d.origin === "external" ? "literature digest (external summary, reference only; cite the original papers)" : "literature digest (read first; cite the original papers)",
          title: item.csl.title,
          library: { ...ref, category: "digest" as const },
        });
        result.added.push({ itemId, sourceId: added.source.id, kind: added.source.kind });
        continue;
      }
      if (isNoteItem(item)) {
        const note = (item as NoteItem).note!;
        const library = { ...ref, category: "note" as const };
        const local = getProject(note.projectId) && safeNoteId(note.noteId);
        let added;
        try {
          added = local ? await addNoteSource(store, authoringId, note, library) : undefined;
        } catch (e) {
          if (!(e instanceof AuthoringError) || e.status !== 404) throw e;
        }
        if (!added) {
          // Not on this machine (or no longer in its project): the library's Markdown copy.
          if (!note.markdown?.trim()) throw new AuthoringError("이 PC에 없는 연구 노트이고 서재에 본문 사본도 없습니다.", 409);
          added = await storeSource(store, authoringId, {
            name: `${note.noteId}.md`,
            kind: "note",
            files: new Map([[RESEARCH_NOTE_FILE, new Uint8Array(Buffer.from(note.markdown))]]),
            documentKind: "research-note",
            title: item.csl.title,
            note: { projectId: note.projectId, noteId: note.noteId, title: item.csl.title, snapshot: true },
            library,
          });
        }
        result.added.push({ itemId, sourceId: added.source.id, kind: added.source.kind });
        continue;
      }
      if (!deps.storedPdf(item) && item.source === "zotero" && deps.readZoteroPdf)
        item = await deps.readZoteroPdf(item).catch(() => item);
      const sha = deps.storedPdf(item);
      const doi = deps.normalizeDoi(item.csl.DOI);
      const library = { ...ref, category: "paper" as const };
      const added = sha
        ? await storeSource(store, authoringId, {
            name: `${item.citationKey ?? item.id}.pdf`,
            mediaType: "application/pdf",
            kind: "pdf",
            bytes: new Uint8Array(fs.readFileSync(deps.filePath(sha))),
            documentKind: "paper",
            title: item.csl.title,
            ...(doi ? { doi } : {}),
            library,
          })
        : await storeSource(store, authoringId, {
            name: `${item.citationKey ?? item.id}.md`,
            mediaType: "text/markdown",
            kind: "text",
            bytes: new Uint8Array(Buffer.from(metadataText(item))),
            documentKind: "paper (metadata and abstract only)",
            title: item.csl.title,
            ...(doi ? { doi } : {}),
            library,
          });
      result.added.push({ itemId, sourceId: added.source.id, kind: added.source.kind });
    } catch (e) {
      // Capacity limits stop the whole request; other failures skip this item.
      if (e instanceof SourceCapacityError) throw e;
      result.skipped.push({ itemId, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

/** Library dependencies of `addLibrarySources` from the library store and its Zotero service. */
export function libraryDeps(store: LibraryStore, zotero?: ZoteroService): LibrarySourceDeps {
  return {
    get: (itemId) => store.get(itemId),
    filePath: (sha) => store.filePath(sha),
    ...(zotero ? { readZoteroPdf: (item: LibraryItem) => zotero.readZoteroPdf(item) } : {}),
    storedPdf,
    normalizeDoi,
  };
}

// Library item -> hub authoring drafts made from it ("used in Workflow"). Kept in the library directory so the
// authoring contract stays as is.
function linksFile(store: LibraryStore) {
  return path.join(store.root, "links.json");
}
export function readLinks(store: LibraryStore): Record<string, string[]> {
  try {
    return JSON.parse(fs.readFileSync(linksFile(store), "utf8")).authoring ?? {};
  } catch {
    return {};
  }
}
export function linkLibraryAuthoring(store: LibraryStore, itemIds: string[], authoringId: string) {
  if (!itemIds.length) return;
  const links = readLinks(store);
  for (const itemId of itemIds) links[itemId] = [...new Set([...(links[itemId] ?? []), authoringId])];
  const tmp = `${linksFile(store)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ authoring: links }, null, 2) + "\n");
  fs.renameSync(tmp, linksFile(store));
}

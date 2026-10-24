/**
 * Where library items are used: research notes that cite them, projects that attach them, and hub Workflow drafts made
 * from them. Computed from the files (notes stay the master); cached per note file by mtime.
 */
import fs from "node:fs";
import path from "node:path";
import { listProjects, resolvePaths, type ProjectPaths } from "../../projects.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import {
  folderSubtree,
  parseCitations,
  PROJECT_LITERATURE_FILE,
  PROJECT_LITERATURE_SCHEMA,
  type LibraryCollection,
  type LibraryItem,
  type LibraryUse,
  type ProjectLiterature,
} from "../../../../web/src/geo/contracts/library.ts";

const NOTE_BYTES = 2 * 1024 * 1024;
const MAX_NOTES_PER_PROJECT = 500;

export function readProjectLiterature(paths: ProjectPaths): ProjectLiterature {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(paths.sandbox, PROJECT_LITERATURE_FILE), "utf8")) as ProjectLiterature;
    if (value?.schema === PROJECT_LITERATURE_SCHEMA)
      return { schema: PROJECT_LITERATURE_SCHEMA, collectionIds: (value.collectionIds ?? []).filter(isId), itemIds: (value.itemIds ?? []).filter(isId) };
  } catch {
    // missing or unreadable: nothing attached
  }
  return { schema: PROJECT_LITERATURE_SCHEMA, collectionIds: [], itemIds: [] };
}

// GAID item/collection ids, and partition-scoped Zotero collection ids from the connector (`zc-…`).
const isId = (v: unknown): v is string => typeof v === "string" && (/^l[ic]-[a-z0-9]{12}$/.test(v) || /^zc-[A-Za-z0-9%._~-]{8,400}$/.test(v));

export function writeProjectLiterature(paths: ProjectPaths, value: { collectionIds: string[]; itemIds: string[] }): ProjectLiterature {
  const next: ProjectLiterature = {
    schema: PROJECT_LITERATURE_SCHEMA,
    collectionIds: [...new Set(value.collectionIds.filter(isId))],
    itemIds: [...new Set(value.itemIds.filter(isId))],
  };
  const file = path.join(paths.sandbox, PROJECT_LITERATURE_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
  fs.renameSync(tmp, file);
  return next;
}

/** Folder ids of the attached folders and all their subfolders. */
export function scopeFolders(literature: ProjectLiterature, collections: Pick<LibraryCollection, "id" | "parentId">[]): Set<string> {
  const out = new Set<string>();
  for (const id of literature.collectionIds) for (const f of folderSubtree(collections, id)) out.add(f);
  return out;
}

/**
 * Items a project uses (its citation scope): attached items plus every item of an attached folder or one of its
 * subfolders. An item merged into another keeps counting through `aliases.ids`.
 */
export function projectItems(literature: ProjectLiterature, items: LibraryItem[], collections: Pick<LibraryCollection, "id" | "parentId">[] = []): LibraryItem[] {
  const ids = new Set(literature.itemIds), cols = scopeFolders(literature, collections);
  // Research notes are not references, so never part of a citation scope.
  return items.filter((i) => !i.removedFromSourceAt && (!i.kind || i.kind === "paper") && (ids.has(i.id) || (i.aliases?.ids ?? []).some((a) => ids.has(a)) || i.collectionIds.some((c) => cols.has(c))));
}

/** True when the project has attached anything (otherwise the whole library counts for its citations). */
export const hasScope = (literature: ProjectLiterature) => literature.itemIds.length > 0 || literature.collectionIds.length > 0;

interface NoteCitations {
  mtimeMs: number;
  title: string;
  citations: { key: string; locator?: string }[];
}
const noteCache = new Map<string, NoteCitations>();

function noteTitle(text: string, fallback: string): string {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  const title = fm && /^title:\s*(.+)$/m.exec(fm)?.[1]?.trim().replace(/^["']|["']$/g, "");
  return title || /^#\s+(.+)$/m.exec(text)?.[1]?.trim() || fallback;
}

/** Citations of every research note in a project (bounded). */
export function projectNoteCitations(paths: ProjectPaths): { noteId: string; title: string; citations: { key: string; locator?: string }[] }[] {
  const dir = path.join(paths.sandbox, RESEARCH_NOTES_DIR);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).slice(0, MAX_NOTES_PER_PROJECT);
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name, RESEARCH_NOTE_FILE);
    try {
      const st = fs.statSync(file);
      if (!st.isFile() || st.size > NOTE_BYTES) continue;
      let cached = noteCache.get(file);
      if (!cached || cached.mtimeMs !== st.mtimeMs) {
        const text = fs.readFileSync(file, "utf8");
        cached = { mtimeMs: st.mtimeMs, title: noteTitle(text, entry.name), citations: parseCitations(text).map(({ key, locator }) => ({ key, ...(locator ? { locator } : {}) })) };
        noteCache.set(file, cached);
      }
      if (cached.citations.length) out.push({ noteId: entry.name.normalize("NFC"), title: cached.title, citations: cached.citations });
    } catch {
      continue;
    }
  }
  return out;
}

export interface UsesIndex {
  usesOf(item: LibraryItem): LibraryUse[];
  counts(item: LibraryItem): { notes: number; workflows: number; projects: number };
}

/** Workflows installed in a project with the library items among their source papers (gaid-workflow-cite-scope). */
export type ProjectWorkflowPapers = (paths: ProjectPaths, literature: ProjectLiterature) => { title: string; itemIds: string[] }[];

/**
 * One pass over all projects. `workflowUses` supplies hub authoring links (drafts made from a library item) and
 * `projectWorkflows` the Workflows installed in each project; both are injected so this module does not depend on the
 * authoring store or the installed methods.
 */
export function buildUsesIndex(items: LibraryItem[], workflowUses: (item: LibraryItem) => LibraryUse[] = () => [], collections: Pick<LibraryCollection, "id" | "parentId">[] = [], instanceId?: string, projectWorkflows?: ProjectWorkflowPapers): UsesIndex {
  const byKey = new Map<string, LibraryItem>();
  for (const item of items) for (const key of item.aliases?.citationKeys ?? []) byKey.set(key, item);
  for (const item of items) if (item.citationKey) byKey.set(item.citationKey, item);
  const uses = new Map<string, LibraryUse[]>();
  const push = (id: string, use: LibraryUse) => uses.set(id, [...(uses.get(id) ?? []), use]);
  // Research notes in the library: a local note's citing row links to its item; a note whose project is not here
  // (another PC, through hub sync) cites through its item's last snapshot.
  const noteItems = items.filter((i) => i.kind === "note" && i.note && !i.removedFromSourceAt);
  const projects = listProjects();
  const here = new Set(projects.map((p) => p.id));
  const localNote = new Map<string, string>();
  for (const n of noteItems) {
    const ref = n.note!;
    if (instanceId && ref.origin === instanceId && here.has(ref.projectId)) { localNote.set(`${ref.projectId}\u0000${ref.noteId.normalize("NFC")}`, n.id); continue; }
    const locators = new Map<string, string[]>();
    for (const c of ref.citations) if (c.itemId) locators.set(c.itemId, [...(locators.get(c.itemId) ?? []), ...c.locators]);
    for (const [id, locs] of locators)
      push(id, { kind: "note", projectId: ref.projectId, projectName: ref.projectName, noteId: ref.noteId, title: n.csl.title, locators: [...new Set(locs)], libraryItemId: n.id, remote: true });
  }
  for (const project of projects) {
    let paths: ProjectPaths;
    try { paths = resolvePaths(project.id); } catch { continue; }
    const literature = readProjectLiterature(paths);
    for (const item of projectItems(literature, items, collections)) push(item.id, { kind: "project", projectId: project.id, projectName: project.name });
    for (const workflow of projectWorkflows?.(paths, literature) ?? [])
      for (const id of new Set(workflow.itemIds)) push(id, { kind: "workflow", title: workflow.title, projectId: project.id, projectName: project.name });
    for (const note of projectNoteCitations(paths)) {
      const locators = new Map<string, string[]>();
      for (const c of note.citations) {
        const item = byKey.get(c.key);
        if (!item) continue;
        locators.set(item.id, [...(locators.get(item.id) ?? []), ...(c.locator ? [c.locator] : [])]);
      }
      const libraryItemId = localNote.get(`${project.id}\u0000${note.noteId}`);
      for (const [id, locs] of locators)
        push(id, { kind: "note", projectId: project.id, projectName: project.name, noteId: note.noteId, title: note.title, locators: [...new Set(locs)], ...(libraryItemId ? { libraryItemId } : {}) });
    }
  }
  return {
    usesOf: (item) => [...(uses.get(item.id) ?? []), ...workflowUses(item)],
    counts: (item) => {
      const list = [...(uses.get(item.id) ?? []), ...workflowUses(item)];
      return {
        notes: list.filter((u) => u.kind === "note").length,
        workflows: list.filter((u) => u.kind === "workflow").length,
        projects: list.filter((u) => u.kind === "project").length,
      };
    },
  };
}

/**
 * Where library items are used: research notes that cite them, projects that attach them, and hub Workflow drafts made
 * from them. Computed from the files (notes stay the master); cached per note file by mtime.
 */
import fs from "node:fs";
import path from "node:path";
import { listProjects, resolvePaths, type ProjectPaths } from "../../projects.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import {
  parseCitations,
  PROJECT_LITERATURE_FILE,
  PROJECT_LITERATURE_SCHEMA,
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

/** Items a project uses: attached items plus every item of an attached collection. */
export function projectItems(literature: ProjectLiterature, items: LibraryItem[]): LibraryItem[] {
  const ids = new Set(literature.itemIds), cols = new Set(literature.collectionIds);
  return items.filter((i) => !i.removedFromSourceAt && (ids.has(i.id) || i.collectionIds.some((c) => cols.has(c))));
}

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

/**
 * One pass over all projects. `workflowUses` supplies hub authoring links (drafts made from a library item); it is
 * injected so this module does not depend on the authoring store.
 */
export function buildUsesIndex(items: LibraryItem[], workflowUses: (item: LibraryItem) => LibraryUse[] = () => []): UsesIndex {
  const byKey = new Map<string, LibraryItem>();
  for (const item of items) if (item.citationKey) byKey.set(item.citationKey, item);
  const uses = new Map<string, LibraryUse[]>();
  const push = (id: string, use: LibraryUse) => uses.set(id, [...(uses.get(id) ?? []), use]);
  for (const project of listProjects()) {
    let paths: ProjectPaths;
    try { paths = resolvePaths(project.id); } catch { continue; }
    const literature = readProjectLiterature(paths);
    for (const item of projectItems(literature, items)) push(item.id, { kind: "project", projectId: project.id, projectName: project.name });
    for (const note of projectNoteCitations(paths)) {
      const locators = new Map<string, string[]>();
      for (const c of note.citations) {
        const item = byKey.get(c.key);
        if (!item) continue;
        locators.set(item.id, [...(locators.get(item.id) ?? []), ...(c.locator ? [c.locator] : [])]);
      }
      for (const [id, locs] of locators)
        push(id, { kind: "note", projectId: project.id, projectName: project.name, noteId: note.noteId, title: note.title, locators: [...new Set(locs)] });
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

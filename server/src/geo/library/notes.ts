/**
 * Research notes in the library (gaid-note-library). A note item mirrors one research note file
 * (`연구노트/<id>/index.md` in a project sandbox); the file stays the master. Only the GAID instance that holds the
 * project refreshes the item: projects are per machine and the id `default` exists on every instance, so items carry the
 * instance id (`<libraryDir>/instance.json`, local, never synced). Items from other instances (institute hub sync) are
 * shown from their snapshot.
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listProjects, resolvePaths, type ProjectMeta, type ProjectPaths } from "../../projects.ts";
import { getResearchNote, listResearchNotes, ResearchNoteError, safeNoteId } from "../notes/store.ts";
import {
  LIBRARY_NOTE_SNAPSHOT_BYTES,
  isNoteItem,
  parseCitations,
  type LibraryItem,
  type LibraryNoteCandidate,
  type LibraryNoteRef,
  type LibraryNoteSummary,
} from "../../../../web/src/geo/contracts/library.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE } from "../../../../web/src/geo/contracts/research-notes.ts";
import { LibraryError, libraryOwner, newItemId, type LibraryStore } from "./store.ts";

const CANDIDATE_LIMIT = 2000;
const now = () => new Date().toISOString();

/** This instance's id, created once next to the library (not part of hub sync). */
export function libraryInstance(store: LibraryStore): { id: string; label: string } {
  const file = path.join(store.root, "instance.json");
  const label = os.hostname() || "GAID";
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8")) as { id?: unknown };
    if (typeof value.id === "string" && /^gi-[a-z0-9]{16}$/.test(value.id)) return { id: value.id, label };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new LibraryError("Library instance file is unreadable", 409);
  }
  const id = `gi-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  fs.mkdirSync(store.root, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ id }, null, 2) + "\n", { flag: "w" });
  fs.renameSync(tmp, file);
  return { id, label };
}

/** Beginning of `text` within `limit` UTF-8 bytes, never splitting a character. */
export function snapshot(text: string, limit = LIBRARY_NOTE_SNAPSHOT_BYTES): { markdown: string; truncated: boolean } {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= limit) return { markdown: text, truncated: false };
  let end = limit;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return { markdown: bytes.subarray(0, end).toString("utf8"), truncated: true };
}

function projectMeta(projectId: string): ProjectMeta | undefined {
  return listProjects().find((p) => p.id === projectId);
}

/** Citation keys of a note, with the library papers they resolve to now. */
async function resolveCitations(store: LibraryStore, keys: { key: string; locators: string[] }[]): Promise<LibraryNoteRef["citations"]> {
  const out: LibraryNoteRef["citations"] = [];
  for (const { key, locators } of keys) {
    const item = await store.byCitationKey(key);
    const paper = item && !item.removedFromSourceAt && !isNoteItem(item) ? item : undefined;
    out.push({ key, ...(paper ? { itemId: paper.id, title: paper.csl.title.slice(0, 300) } : {}), locators });
  }
  return out;
}

function citationKeys(markdown: string): { key: string; locators: string[] }[] {
  const byKey = new Map<string, Set<string>>();
  for (const c of parseCitations(markdown)) {
    const set = byKey.get(c.key) ?? new Set<string>();
    if (c.locator) set.add(c.locator);
    byKey.set(c.key, set);
  }
  return [...byKey].slice(0, 500).map(([key, locs]) => ({ key, locators: [...locs].slice(0, 20) }));
}

/** What the note file says now, as library fields. Throws ResearchNoteError when the note is not there. */
async function readNote(store: LibraryStore, paths: ProjectPaths, meta: ProjectMeta, noteId: string, instance: { id: string; label: string }): Promise<{ title: string; note: LibraryNoteRef }> {
  const { content, note } = getResearchNote(paths, noteId);
  const snap = snapshot(content);
  return {
    title: note.title.slice(0, 500),
    note: {
      origin: instance.id,
      originLabel: instance.label,
      projectId: meta.id,
      projectName: meta.name,
      noteId: note.id,
      path: note.path,
      date: note.date,
      status: note.status,
      ...(note.headline ? { headline: note.headline.slice(0, 1000) } : {}),
      markdown: snap.markdown,
      ...(snap.truncated ? { truncated: true } : {}),
      contentSha256: createHash("sha256").update(content).digest("hex"),
      fileUpdatedAt: note.updatedAt,
      refreshedAt: now(),
      citations: await resolveCitations(store, citationKeys(content)),
    },
  };
}

const issued = (date: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? { issued: { "date-parts": [[Number(m[1]), Number(m[2]), Number(m[3])]] } } : {};
};

function noteCsl(title: string, note: LibraryNoteRef): LibraryItem["csl"] {
  return { type: "document", title, ...issued(note.date), ...(note.headline ? { abstract: note.headline } : {}) };
}

/** The library item of a note on this instance, also when it was marked missing. */
async function findNoteItem(store: LibraryStore, origin: string, projectId: string, noteId: string): Promise<LibraryItem | undefined> {
  const id = noteId.normalize("NFC");
  return (await store.all()).find((i) => isNoteItem(i) && i.note?.origin === origin && i.note.projectId === projectId && i.note.noteId.normalize("NFC") === id);
}

/** Brings a research note into the library (idempotent per instance + project + note; an existing item is refreshed). */
export async function addNoteItem(store: LibraryStore, input: { projectId: string; noteId: unknown; collectionIds?: unknown }): Promise<{ item: LibraryItem; created: boolean }> {
  if (typeof input.noteId !== "string" || !safeNoteId(input.noteId.normalize("NFC"))) throw new LibraryError("noteId is required");
  const meta = projectMeta(input.projectId);
  if (!meta) throw new LibraryError("Project not found", 404);
  const paths = resolvePaths(meta.id);
  const instance = libraryInstance(store);
  let read: Awaited<ReturnType<typeof readNote>>;
  try { read = await readNote(store, paths, meta, input.noteId, instance); }
  catch (error) {
    if (error instanceof ResearchNoteError) throw new LibraryError(error.statusCode === 413 ? "Research note exceeds 2 MiB" : "Research note not found", error.statusCode === 413 ? 413 : 404);
    throw error;
  }
  const collections = await store.collections();
  const wanted = Array.isArray(input.collectionIds) ? input.collectionIds.filter((c): c is string => typeof c === "string" && collections.some((x) => x.id === c)) : [];
  const existing = await findNoteItem(store, instance.id, meta.id, read.note.noteId);
  if (existing) {
    const item = await store.mutate(existing.id, (next) => {
      next.csl = noteCsl(read.title, read.note);
      next.note = read.note;
      next.collectionIds = [...new Set([...next.collectionIds, ...wanted])];
    });
    return { item, created: false };
  }
  if ((await store.all()).length >= 20_000) throw new LibraryError("Library is full", 413);
  const at = now();
  const item: LibraryItem = {
    id: newItemId(),
    owner: libraryOwner(),
    source: "gaid",
    kind: "note",
    csl: noteCsl(read.title, read.note),
    metadataOrigin: "note",
    metadataConfirmed: true,
    collectionIds: [...new Set(wanted)],
    tags: [],
    attachments: [],
    read: { coverage: "full" },
    addedAt: at,
    updatedAt: at,
    note: read.note,
  };
  return { item: await store.put(item), created: true };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Re-reads the note files of this instance's note items whose file changed (mtime) or went missing, and re-resolves
 * citations against the library. Writes only items that changed. Items of other instances are left as synced.
 */
export async function refreshNoteItems(store: LibraryStore, only?: LibraryItem[]): Promise<number> {
  const instance = libraryInstance(store);
  const items = (only ?? (await store.all())).filter((i) => isNoteItem(i) && i.note?.origin === instance.id);
  if (!items.length) return 0;
  const projects = new Map(listProjects().map((p) => [p.id, p]));
  let changed = 0;
  for (const item of items) {
    const ref = item.note!;
    const meta = projects.get(ref.projectId);
    let next: { title: string; note: LibraryNoteRef } | null = null;
    let missing = !meta;
    if (meta) {
      const paths = resolvePaths(meta.id);
      let mtime: string | undefined;
      try { mtime = fs.statSync(path.join(paths.sandbox, RESEARCH_NOTES_DIR, ref.noteId, RESEARCH_NOTE_FILE)).mtime.toISOString(); } catch { /* NFD names or gone: read below */ }
      if (mtime && mtime === ref.fileUpdatedAt && !ref.missingAt && meta.name === ref.projectName) {
        const citations = await resolveCitations(store, ref.citations.map(({ key, locators }) => ({ key, locators })));
        if (!sameJson(citations, ref.citations)) next = { title: item.csl.title, note: { ...ref, citations } };
      } else {
        try { next = await readNote(store, paths, meta, ref.noteId, instance); }
        catch (error) { if (error instanceof ResearchNoteError) missing = true; else throw error; }
      }
    }
    if (missing) {
      if (ref.missingAt) continue;
      await store.mutate(item.id, (n) => { n.note = { ...ref, missingAt: now(), refreshedAt: now() }; });
      changed++;
      continue;
    }
    if (!next) continue;
    const { refreshedAt: _a, ...before } = ref;
    const { refreshedAt: _b, ...after } = next.note;
    if (sameJson(before, after) && item.csl.title === next.title) continue;
    const update = next;
    await store.mutate(item.id, (n) => { n.note = update.note; n.csl = noteCsl(update.title, update.note); });
    changed++;
  }
  return changed;
}

/** True when the note's project is on this instance and the file was found at the last refresh. */
export function noteIsLocal(item: LibraryItem, instanceId: string, projectIds: Set<string>): boolean {
  return Boolean(item.note && item.note.origin === instanceId && projectIds.has(item.note.projectId) && !item.note.missingAt);
}

export function noteSummary(item: LibraryItem, local: boolean): LibraryNoteSummary | undefined {
  const n = item.note;
  if (!n) return undefined;
  return {
    projectId: n.projectId,
    noteId: n.noteId,
    projectName: n.projectName,
    originLabel: n.originLabel,
    date: n.date,
    status: n.status,
    ...(n.headline ? { headline: n.headline } : {}),
    local,
    ...(n.missingAt ? { missing: true } : {}),
    cites: new Set(n.citations.flatMap((c) => (c.itemId ? [c.itemId] : []))).size,
  };
}

/** Research notes of the projects on this instance, with their library item when already brought in. */
export async function noteCandidates(store: LibraryStore): Promise<{ notes: LibraryNoteCandidate[]; truncated: boolean }> {
  const instance = libraryInstance(store);
  const inLibrary = new Map<string, string>();
  for (const i of await store.all()) if (isNoteItem(i) && i.note?.origin === instance.id) inLibrary.set(`${i.note.projectId}\u0000${i.note.noteId.normalize("NFC")}`, i.id);
  const notes: LibraryNoteCandidate[] = [];
  let truncated = false;
  for (const project of listProjects().filter((p) => !p.archived)) {
    let paths: ProjectPaths;
    try { paths = resolvePaths(project.id); } catch { continue; }
    for (const n of listResearchNotes(paths).notes) {
      if (notes.length >= CANDIDATE_LIMIT) { truncated = true; break; }
      const itemId = inLibrary.get(`${project.id}\u0000${n.id.normalize("NFC")}`);
      notes.push({ projectId: project.id, projectName: project.name, noteId: n.id, title: n.title, date: n.date, status: n.status, ...(n.headline ? { headline: n.headline } : {}), ...(itemId ? { itemId } : {}) });
    }
  }
  notes.sort((a, b) => b.date.localeCompare(a.date) || a.projectName.localeCompare(b.projectName) || a.noteId.localeCompare(b.noteId));
  return { notes, truncated };
}

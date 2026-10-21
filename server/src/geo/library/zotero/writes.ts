import { ZOTERO_INBOX_COLLECTION } from "../../../../../web/src/geo/contracts/library.ts";
import {
  libraryPath, itemKey, ZoteroConflictError, ZoteroError, ZoteroServerChangedError,
  type CslItem, type ZoteroClient, type ZoteroItemRef, type ZoteroLibrary, type ZoteroObject,
} from "./types.ts";
import { readZoteroPages } from "./sync.ts";

/** Persist this non-secret result in the parent's library store; partition it with the sync cursor. */
export interface InboxCollection { key: string; version: number; serverId?: string }

async function conflict<T>(client: ZoteroClient, path: string, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (!(error instanceof ZoteroError) || error.status !== 412 || error instanceof ZoteroServerChangedError) throw error;
    const current = await client.read(path);
    throw new ZoteroConflictError(current.data);
  }
}

/** Explicit confirmed action only. Caller can persist `key`; full listing also avoids duplicates after restart. */
export async function ensureInboxCollection(client: ZoteroClient, library: ZoteroLibrary): Promise<InboxCollection> {
  const path = `${libraryPath(library)}/collections`;
  const listed = await readZoteroPages<ZoteroObject>(client, path);
  const existing = listed.objects.find((object) => object.data.name === ZOTERO_INBOX_COLLECTION && !object.data.parentCollection);
  if (existing) return { key: existing.key, version: listed.version!, serverId: client.serverId };
  if (listed.version === undefined) throw new ZoteroError("unreachable", "missing-library-version");
  const created = await conflict(client, path, () => client.create(library, "collections", [{ name: ZOTERO_INBOX_COLLECTION, parentCollection: false }], listed.version!));
  return { key: created.data[0], version: created.version!, serverId: client.serverId };
}

/** Conservative CSL → editable Zotero JSON. Unsupported types fail before writing, rather than losing metadata. */
export function cslToZotero(csl: CslItem): Record<string, unknown> {
  const types: Record<string, string> = { "article-journal": "journalArticle", book: "book", chapter: "bookSection", "paper-conference": "conferencePaper", report: "report", thesis: "thesis", webpage: "webpage", manuscript: "manuscript", article: "preprint", dataset: "dataset" };
  const itemType = types[csl.type];
  if (!itemType) throw new Error(`Unsupported CSL type: ${csl.type}`);
  const item: Record<string, unknown> = { itemType, title: csl.title, creators: (csl.author ?? []).map((name) => name.literal ? { creatorType: "author", name: name.literal } : { creatorType: "author", firstName: name.given ?? "", lastName: name.family ?? "" }), tags: [], collections: [], relations: {} };
  const fields = { DOI: "DOI", URL: "url", language: "language", abstract: "abstractNote" } as const;
  for (const [from, to] of Object.entries(fields)) if (typeof csl[from] === "string") item[to] = csl[from];
  if (csl.issued?.["date-parts"]?.[0]) item.date = csl.issued["date-parts"][0].join("-");
  if (itemType === "journalArticle") {
    for (const [from, to] of Object.entries({ "container-title": "publicationTitle", volume: "volume", issue: "issue", page: "pages", ISSN: "ISSN" })) if (typeof csl[from] === "string") item[to] = csl[from];
  }
  if (["book", "bookSection", "conferencePaper", "report"].includes(itemType) && csl.publisher) item.publisher = csl.publisher;
  if (["bookSection", "conferencePaper"].includes(itemType)) {
    if (csl["container-title"]) item[itemType === "bookSection" ? "bookTitle" : "proceedingsTitle"] = csl["container-title"];
    if (csl.page) item.pages = csl.page;
  }
  // Zotero accepts extra for CSL fields not represented by an item's editable schema.
  if (itemType !== "journalArticle") {
    const extra = [csl.DOI && `DOI: ${csl.DOI}`, csl.ISSN && `ISSN: ${csl.ISSN}`].filter(Boolean);
    delete item.DOI;
    if (extra.length) item.extra = extra.join("\n");
  }
  return item;
}

function checkPartition(client: ZoteroClient, ref: ZoteroItemRef) {
  if (ref.connection !== client.connection || (client.connection === "local" && client.serverId !== ref.serverId)) throw new ZoteroError("unreachable", "wrong-item-partition");
}

export async function addItemToInbox(client: ZoteroClient, library: ZoteroLibrary, input: { existing: ZoteroItemRef } | { csl: CslItem }): Promise<ZoteroItemRef> {
  // Partition check before even creating a collection in another database.
  if ("existing" in input) {
    if (client.connection === "local" && !client.serverId) await client.read(`${libraryPath(library)}/items`, { discover: true, query: { limit: 1 } });
    checkPartition(client, input.existing);
    if (input.existing.libraryType !== library.libraryType || input.existing.libraryId !== library.libraryId) throw new Error("Wrong Zotero library");
  }
  const data = "csl" in input ? cslToZotero(input.csl) : undefined;
  const inbox = await ensureInboxCollection(client, library);
  if (data) {
    const created = await conflict(client, `${libraryPath(library)}/items`, () => client.create(library, "items", [{ ...data, collections: [inbox.key] }], inbox.version));
    const object = await client.read<ZoteroObject>(`${libraryPath(library)}/items/${itemKey(created.data[0])}`);
    return { connection: client.connection, serverId: client.serverId, ...library, itemKey: object.data.key, version: object.data.version };
  }
  const ref = (input as { existing: ZoteroItemRef }).existing;
  const path = `${libraryPath(library)}/items/${itemKey(ref.itemKey)}`;
  const current = await client.read<ZoteroObject>(path);
  if (current.data.version !== ref.version) throw new ZoteroConflictError(current.data);
  if (current.data.data.itemType === "annotation") throw new Error("Annotation writes are not supported");
  const collections = Array.isArray(current.data.data.collections) ? current.data.data.collections as string[] : [];
  if (!collections.includes(inbox.key)) await conflict(client, path, () => client.patchLinks(library, ref.itemKey, { collections: [...collections, inbox.key] }, ref.version));
  const updated = await client.read<ZoteroObject>(path);
  return { ...ref, version: updated.data.version };
}

/** Link is provided by parent, escaped as text and attribute; never stores note content in Zotero. */
export async function addResearchNoteLink(client: ZoteroClient, ref: ZoteroItemRef, link: { url: string; title: string }): Promise<ZoteroItemRef> {
  if (client.connection === "local" && !client.serverId) await client.read(`${libraryPath(ref)}/items`, { discover: true, query: { limit: 1 } });
  checkPartition(client, ref);
  const url = new URL(link.url);
  if (!["https:", "http:", "gaid:", "obsidian:"].includes(url.protocol)) throw new Error("Invalid research note URL");
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const parent = await client.read<ZoteroObject>(`${libraryPath(ref)}/items/${itemKey(ref.itemKey)}`);
  if (parent.data.version !== ref.version) throw new ZoteroConflictError(parent.data);
  if (parent.data.data.itemType === "annotation") throw new Error("Annotation writes are not supported");
  // Multi-object creation needs the library's version, not the parent's object version.
  const snapshot = await client.read(`${libraryPath(ref)}/items`, { query: { limit: 1 } });
  if (snapshot.version === undefined) throw new ZoteroError("unreachable", "missing-library-version");
  const created = await conflict(client, `${libraryPath(ref)}/items`, () => client.create(ref, "items", [{ itemType: "note", parentItem: ref.itemKey, note: `<p><a href="${escape(url.href)}">${escape(link.title)}</a></p>`, tags: [] }], snapshot.version!));
  const note = await client.read<ZoteroObject>(`${libraryPath(ref)}/items/${itemKey(created.data[0])}`);
  return { ...ref, itemKey: note.data.key, version: note.data.version };
}

export async function addTags(client: ZoteroClient, ref: ZoteroItemRef, tags: string[]): Promise<ZoteroItemRef> {
  if (client.connection === "local" && !client.serverId) await client.read(`${libraryPath(ref)}/items`, { discover: true, query: { limit: 1 } });
  checkPartition(client, ref);
  const path = `${libraryPath(ref)}/items/${itemKey(ref.itemKey)}`;
  const current = await client.read<ZoteroObject>(path);
  if (current.data.version !== ref.version) throw new ZoteroConflictError(current.data);
  if (["annotation"].includes(String(current.data.data.itemType))) throw new Error("Annotation writes are not supported");
  const merged = (Array.isArray(current.data.data.tags) ? structuredClone(current.data.data.tags) : []) as { tag: string; type?: number }[];
  for (const tag of tags) if (tag.trim() && !merged.some((old) => old.tag === tag.trim())) merged.push({ tag: tag.trim() });
  if (merged.length !== (current.data.data.tags as unknown[] ?? []).length) await conflict(client, path, () => client.patchLinks(ref, ref.itemKey, { tags: merged }, ref.version));
  const updated = await client.read<ZoteroObject>(path);
  return { ...ref, version: updated.data.version };
}

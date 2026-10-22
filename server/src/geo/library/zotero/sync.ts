import { numericCslDates, type LibraryCollection } from "../../../../../web/src/geo/contracts/library.ts";
import {
  ZoteroError, ZoteroServerChangedError, libraryPath, itemKey, zoteroRefKey, zoteroErrorDetail,
  type ZoteroClient, type ZoteroObject, type ZoteroItemRef, type LibraryItem, type ZoteroLibraryState,
} from "./types.ts";

export interface MapItemOptions {
  ref: ZoteroItemRef;
  owner: string;
  id: string;
  now: string;
  attachments?: ZoteroObject[];
  existing?: LibraryItem;
}

export function zoteroCollectionId(ref: Omit<ZoteroItemRef, "itemKey" | "version">, key: string): string {
  return `zc-${encodeURIComponent(JSON.stringify([ref.connection, ref.serverId ?? "", ref.libraryType, ref.libraryId, key]))}`;
}

/** IO-free conversion. GAID identity/time are supplied; an existing read state is preserved. */
export function mapZoteroItem(object: ZoteroObject, options: MapItemOptions): LibraryItem {
  const data = object.data;
  let exported = object.csljson;
  if (typeof exported === "string") {
    try { exported = JSON.parse(exported); } catch { throw new ZoteroError("failed", "invalid-csl-json"); }
  }
  const csl = Array.isArray(exported) ? exported.length === 1 ? exported[0] : undefined : typeof exported === "string" ? undefined : exported;
  if (!csl || typeof csl.type !== "string") throw new ZoteroError("failed", "missing-csl-json");
  const existing = options.existing;
  return {
    id: options.id, owner: options.owner, source: "zotero", zotero: { ...options.ref, itemKey: object.key, version: object.version },
    csl: numericCslDates({ ...structuredClone(csl), title: typeof csl.title === "string" ? csl.title : typeof data.title === "string" ? data.title : "" }),
    ...(typeof data.citationKey === "string" && data.citationKey ? { citationKey: data.citationKey } : {}),
    metadataOrigin: "zotero", metadataConfirmed: true,
    collectionIds: (Array.isArray(data.collections) ? data.collections : []).filter((key): key is string => typeof key === "string").map((key) => zoteroCollectionId(options.ref, key)),
    tags: (Array.isArray(data.tags) ? data.tags : []).flatMap((tag) => typeof tag?.tag === "string" ? [tag.tag] : []),
    attachments: (options.attachments ?? []).filter((child) => child.data.itemType === "attachment" && !child.data.deleted).map((child) => {
      const prior = existing?.attachments.find((a) => a.zoteroAttachmentKey === child.key);
      return {
        id: prior?.id ?? `za-${child.key}`, kind: child.data.contentType === "application/pdf" ? "pdf" as const : "other" as const,
        ...(typeof child.data.title === "string" ? { title: child.data.title } : {}), zoteroAttachmentKey: child.key,
        ...(prior?.pages === undefined ? {} : { pages: prior.pages }),
      };
    }),
    read: existing?.read ?? { coverage: csl.abstract ? "abstract" : "none" },
    addedAt: existing?.addedAt ?? (typeof data.dateAdded === "string" ? data.dateAdded : options.now), updatedAt: options.now,
    ...(existing?.sentToZoteroAt ? { sentToZoteroAt: existing.sentToZoteroAt } : {}),
  };
}

export interface SyncOptions {
  owner: string;
  now: string;
  existingItems?: LibraryItem[];
  /** Stable lookup by zoteroRefKey(ref), including a just-sent GAID item's original id. */
  idForItem: (ref: ZoteroItemRef) => string;
}
export interface ZoteroSyncResult {
  state: ZoteroLibraryState;
  /** Full snapshot: parent reconciles items/collections absent from upserts against the old partition. */
  reset: boolean;
  upserts: LibraryItem[];
  removals: ZoteroItemRef[];
  collections: LibraryCollection[];
  removedCollectionKeys: string[];
  /** Local Zotero 10.0.6 has no /deleted endpoint. Reconcile missing stored refs with these complete manifests. */
  sourceItemKeys?: string[];
  sourceCollectionKeys?: string[];
}

class SnapshotChanged extends Error {}
const noDeletedEndpoint = new WeakSet<ZoteroClient>();

async function readKeyManifest(client: ZoteroClient, path: string) {
  const keys: string[] = [];
  let version: number | undefined;
  for (let start = 0; ; start += 100) {
    const result = await client.read<Record<string, number>>(path, { query: { format: "versions", includeTrashed: 0, limit: 100, start, sort: "dateModified", direction: "asc" } });
    if (version !== undefined && version !== result.version) throw new SnapshotChanged();
    version = result.version;
    if (!result.data || Array.isArray(result.data) || typeof result.data !== "object") throw new ZoteroError("failed", "invalid-version-manifest");
    const page = Object.keys(result.data);
    keys.push(...page);
    if (page.length < 100) return { keys, version };
  }
}

/** Paged, consistently versioned endpoint reader; prevents advancing over edits between pages. */
export async function readZoteroPages<T>(client: ZoteroClient, path: string, since?: number, extra: Record<string, string | number> = {}): Promise<{ objects: T[]; version?: number }> {
  const objects: T[] = [];
  let version: number | undefined;
  for (let start = 0; ; start += 100) {
    // `since` alone, no If-Modified-Since-Version: a 200 always carries the library version, while a Web 304 has no
    // version header and its meaning for /collections differs from /items.
    const result = await client.read<T[]>(path, { query: { ...extra, limit: 100, start, ...(since === undefined ? {} : { since }) } });
    if (version !== undefined && result.version !== version) throw new SnapshotChanged();
    version = result.version;
    if (result.status === 304) return { objects, version };
    if (!Array.isArray(result.data)) throw new ZoteroError("failed", "invalid-list-response");
    objects.push(...result.data);
    if (result.data.length < 100) return { objects, version };
  }
}

/** No IO state is persisted here: parent commits the result/cursor atomically, only after success. */
export async function syncZoteroLibrary(client: ZoteroClient, prior: ZoteroLibraryState, options: SyncOptions): Promise<ZoteroSyncResult> {
  const path = libraryPath(prior);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (client.connection === "local") await client.read<ZoteroObject[]>(`${path}/items`, { discover: true, query: { limit: 1 } });
      const samePartition = prior.connection === client.connection && (client.connection !== "local" || prior.serverId === client.serverId);
      const reset = !samePartition || !prior.lastSyncAt;
      const since = reset ? undefined : prior.libraryVersion;
      const refBase = { connection: client.connection, ...(client.serverId ? { serverId: client.serverId } : {}), libraryType: prior.libraryType, libraryId: prior.libraryId };
      const items = await readZoteroPages<ZoteroObject>(client, `${path}/items`, since, { include: "data,csljson", includeTrashed: 1, sort: "dateModified", direction: "asc" });
      const collections = await readZoteroPages<ZoteroObject>(client, `${path}/collections`, since);
      let deleted: { data: { items: string[]; collections: string[] }; version?: number } = { data: { items: [], collections: [] }, version: items.version };
      let manifests: { sourceItemKeys: string[]; sourceCollectionKeys: string[] } | undefined;
      if (!noDeletedEndpoint.has(client)) {
        try { deleted = await client.read<{ items: string[]; collections: string[] }>(`${path}/deleted`, { query: { since: since ?? 0 } }); }
        catch (error) {
          if (client.connection !== "local" || !(error instanceof ZoteroError) || error.status !== 404) throw error;
          noDeletedEndpoint.add(client);
        }
      }
      const versions = [items.version, collections.version, deleted.version];
      if (noDeletedEndpoint.has(client)) {
        const itemManifest = await readKeyManifest(client, `${path}/items`);
        const collectionManifest = await readKeyManifest(client, `${path}/collections`);
        versions.push(itemManifest.version, collectionManifest.version);
        manifests = { sourceItemKeys: itemManifest.keys, sourceCollectionKeys: collectionManifest.keys };
      }
      if (versions.some((v) => v === undefined) || new Set(versions).size !== 1) throw new SnapshotChanged();
      const libraryVersion = items.version!;
      const existing = new Map((options.existingItems ?? []).filter((item) => item.zotero).map((item) => [zoteroRefKey(item.zotero!), item]));
      const objects = new Map(items.objects.map((object) => [object.key, object]));
      const affectedParents = new Set<string>();
      const removed = new Set(deleted.data.items ?? []);
      if (manifests) {
        const live = new Set(manifests.sourceItemKeys);
        for (const priorItem of options.existingItems ?? []) {
          const ref = priorItem.zotero;
          if (ref && zoteroRefKey(ref) === zoteroRefKey({ ...refBase, itemKey: ref.itemKey }) && !live.has(ref.itemKey)) removed.add(ref.itemKey);
          // Vanished attachments update their parent even when /deleted is unavailable.
          if (ref && zoteroRefKey(ref) === zoteroRefKey({ ...refBase, itemKey: ref.itemKey })) {
            for (const attachment of priorItem.attachments) if (attachment.zoteroAttachmentKey && !live.has(attachment.zoteroAttachmentKey)) removed.add(attachment.zoteroAttachmentKey);
          }
        }
      }
      for (const object of items.objects) {
        if (typeof object.data.parentItem === "string") affectedParents.add(object.data.parentItem);
      }
      for (const item of options.existingItems ?? []) {
        if (!item.zotero || zoteroRefKey({ ...refBase, itemKey: item.zotero.itemKey }) !== zoteroRefKey(item.zotero)) continue;
        if (item.attachments.some((attachment) => attachment.zoteroAttachmentKey && removed.has(attachment.zoteroAttachmentKey))) affectedParents.add(item.zotero.itemKey);
      }
      // Attachment-only edits/deletions must update the unchanged parent's attachment list too.
      for (const key of affectedParents) {
        if (!objects.has(key) && !removed.has(key)) {
          const parent = await client.read<ZoteroObject>(`${path}/items/${itemKey(key)}`, { query: { include: "data,csljson" } });
          objects.set(key, parent.data);
        }
      }
      // A full snapshot already holds every child (the items endpoint is not /top), so only an incremental sync reads
      // /children per changed parent; one request per paper made a first Web sync of a large library take minutes.
      const snapshotChildren = new Map<string, ZoteroObject[]>();
      if (reset) {
        for (const object of items.objects) {
          const parent = object.data.parentItem;
          if (typeof parent === "string" && !object.data.deleted) snapshotChildren.set(parent, [...snapshotChildren.get(parent) ?? [], object]);
        }
      }
      const upserts: LibraryItem[] = [];
      for (const object of objects.values()) {
        if (["attachment", "note", "annotation"].includes(String(object.data.itemType)) || object.data.parentItem) continue;
        const ref = { ...refBase, itemKey: object.key, version: object.version };
        if (object.data.deleted || (prior.follow !== "all" && !(Array.isArray(object.data.collections) && object.data.collections.some((key) => prior.follow.includes(String(key)))))) {
          removed.add(object.key);
          continue;
        }
        let children = snapshotChildren.get(object.key) ?? [];
        if (!reset) {
          const read = await readZoteroPages<ZoteroObject>(client, `${path}/items/${itemKey(object.key)}/children`);
          if (read.version !== libraryVersion) throw new SnapshotChanged();
          children = read.objects;
        }
        const old = existing.get(zoteroRefKey(ref));
        upserts.push(mapZoteroItem(object, { ref, owner: options.owner, id: old?.id ?? options.idForItem(ref), now: options.now, attachments: children, existing: old }));
      }
      // Parent/children reads can race the initial snapshot. Check the library once more before committing.
      const final = await client.read<Record<string, number>>(`${path}/items`, { query: { format: "versions", limit: 1 } });
      if (final.version !== libraryVersion) throw new SnapshotChanged();
      return {
        state: { ...prior, ...refBase, serverId: client.serverId, libraryVersion, state: "ok", lastSyncAt: options.now, failedAt: undefined, detail: undefined }, reset,
        upserts,
        removals: [...removed].map((key) => ({ ...refBase, itemKey: key, version: libraryVersion })),
        collections: collections.objects.map((object) => ({
          id: zoteroCollectionId(refBase, object.key), owner: options.owner, name: String(object.data.name ?? ""), source: "zotero",
          ...(typeof object.data.parentCollection === "string" ? { parentId: zoteroCollectionId(refBase, object.data.parentCollection) } : {}),
          zotero: { connection: client.connection, libraryType: prior.libraryType, libraryId: prior.libraryId, collectionKey: object.key },
        })),
        removedCollectionKeys: deleted.data.collections ?? [],
        ...manifests,
      };
    } catch (error) {
      if ((error instanceof ZoteroServerChangedError || error instanceof SnapshotChanged) && attempt < 2) continue;
      throw error instanceof SnapshotChanged ? new ZoteroError("library-changing", "library-kept-changing") : error;
    }
  }
  throw new ZoteroError("failed", "sync-failed");
}

/** A status probe never changes an existing sync cursor on failure. */
export async function probeZoteroLibrary(client: ZoteroClient, state: ZoteroLibraryState): Promise<ZoteroLibraryState> {
  try {
    await client.read(`${libraryPath(state)}/items`, { discover: true, query: { limit: 1 } });
    const changed = state.connection !== client.connection || state.serverId !== client.serverId;
    return { ...state, connection: client.connection, serverId: client.serverId, state: "ok", failedAt: undefined, detail: undefined, ...(changed ? { libraryVersion: 0, lastSyncAt: undefined } : {}) };
  } catch (error) {
    return { ...state, state: error instanceof ZoteroError ? error.state : "failed", failedAt: new Date().toISOString(), detail: zoteroErrorDetail(client.connection, error) };
  }
}

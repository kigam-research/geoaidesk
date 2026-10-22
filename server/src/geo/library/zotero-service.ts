/**
 * Zotero ↔ library store glue (ADR 2026-10-21-research-hub-library, decision 3). The connector module
 * (./zotero/) talks to Zotero; this file owns the secrets file, the sync commit and the narrow "send to Zotero" write.
 *
 * Commit rules from the connector README: commit upserts, removals and the cursor together after a whole sync; never
 * delete a GAID item (mark `removedFromSourceAt`); reconcile against the complete snapshot on reset and against the
 * key manifests when the Local API has no `/deleted`; collections are upserted by id (incremental) and reconciled the
 * same way.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { folderSubtree, type FolderMembershipResult, type LibraryCollection, type LibraryItem, type SendToZoteroResult, type ZoteroLibraryState } from "../../../../web/src/geo/contracts/library.ts";
import { LibraryError, defaultCitationKey, libraryOwner, newItemId, samePaper, zoteroLibraryKey, type LibraryStore } from "./store.ts";
import { pageText, readStoredPdf } from "./reader.ts";
import {
  LocalZoteroClient,
  WebZoteroClient,
  ZoteroError,
  addItemToCollections,
  addTags,
  createItem,
  ensureCollection,
  ensureInboxCollection,
  uploadAttachment,
  getAttachmentFile,
  probeZoteroLibrary,
  syncZoteroLibrary,
  zoteroCollectionId,
  zoteroErrorDetail,
  zoteroRefKey,
  type ZoteroClient,
  type ZoteroSecretStore,
  type ZoteroSyncResult,
} from "./zotero/index.ts";

/** Owner-scoped secrets in `<library>/secrets/zotero.json`, mode 0600; values never leave this file. */
export function fileSecretStore(store: LibraryStore): ZoteroSecretStore {
  const file = path.join(store.root, "secrets", `zotero-${libraryOwner().replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
  const read = async (): Promise<Record<string, string>> => {
    try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return {}; }
  };
  const write = async (value: Record<string, string>) => {
    await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await fs.rename(tmp, file);
    await fs.chmod(file, 0o600);
  };
  return {
    get: async (slot) => (await read())[slot],
    set: async (slot, value) => write({ ...(await read()), [slot]: value }),
    delete: async (slot) => { const v = await read(); delete v[slot]; await write(v); },
  };
}

export interface ZoteroServiceOptions {
  localBaseUrl?: string;
  webBaseUrl?: string;
  fetch?: typeof fetch;
}

export class ZoteroService {
  private local?: LocalZoteroClient;
  private web?: WebZoteroClient;
  private syncing?: Promise<void>;
  constructor(private store: LibraryStore, private options: ZoteroServiceOptions = {}) {}

  client(connection: "local" | "web"): ZoteroClient & (LocalZoteroClient | WebZoteroClient) {
    const secrets = fileSecretStore(this.store);
    const common = { secrets, ...(this.options.fetch ? { fetch: this.options.fetch } : {}) };
    if (connection === "local") return (this.local ??= new LocalZoteroClient({ ...common, ...(this.options.localBaseUrl ? { baseUrl: this.options.localBaseUrl } : {}) }));
    return (this.web ??= new WebZoteroClient({ ...common, ...(this.options.webBaseUrl ? { baseUrl: this.options.webBaseUrl } : {}) }));
  }

  async libraries(): Promise<ZoteroLibraryState[]> {
    return (await this.store.zotero()).libraries;
  }

  /** Follows the personal library of the Zotero running on this PC (Local API). */
  async connectLocal(): Promise<ZoteroLibraryState> {
    const draft: ZoteroLibraryState = { connection: "local", libraryType: "user", libraryId: "0", name: "Zotero", follow: "all", libraryVersion: 0, state: "ok" };
    const probed = await probeZoteroLibrary(this.client("local"), draft);
    if (probed.state !== "ok") return probed;
    await this.upsertLibrary(probed);
    await this.syncAll();
    return (await this.libraries()).find((l) => l.connection === "local") ?? probed;
  }

  /** Follows the personal library of a Zotero Web API key (institute server mode). */
  async connectWeb(key: string): Promise<ZoteroLibraryState[]> {
    if (!/^[A-Za-z0-9]{16,64}$/.test(key)) throw new LibraryError("Zotero 웹 키 형식이 아닙니다.");
    const web = this.client("web") as WebZoteroClient;
    await web.setKey(key);
    let found;
    try { found = await web.discoverLibraries(); }
    catch (error) { await web.clearKey(); throw error; }
    const personal = found.filter((l) => l.libraryType === "user");
    // A key without read access to the personal library would save nothing and leave the card unchanged.
    if (!personal.length) { await web.clearKey(); throw new ZoteroError("no-library-access", "no-personal-library-access"); }
    // One web key at a time: a personal library of a previous key can no longer be read, so it stops being followed
    // (its papers stay in the library). A library already followed keeps its sync cursor.
    const z = await this.store.zotero();
    const keep = (l: ZoteroLibraryState) => l.connection !== "web" || l.libraryType !== "user" || personal.some((p) => p.libraryId === l.libraryId);
    if (!z.libraries.every(keep)) await this.store.saveZotero({ ...z, libraries: z.libraries.filter(keep) });
    for (const lib of personal) {
      const known = (await this.libraries()).find((l) => l.connection === "web" && l.libraryType === "user" && l.libraryId === lib.libraryId);
      await this.upsertLibrary({ ...(known ?? { follow: "all" as const, libraryVersion: 0 }), connection: "web", libraryType: lib.libraryType, libraryId: lib.libraryId, name: lib.name, state: "ok", failedAt: undefined, detail: undefined });
    }
    await this.syncAll();
    return this.libraries();
  }

  private async upsertLibrary(state: ZoteroLibraryState): Promise<void> {
    const z = await this.store.zotero();
    const others = z.libraries.filter((l) => !(l.connection === state.connection && l.libraryType === state.libraryType && l.libraryId === state.libraryId));
    await this.store.saveZotero({ ...z, libraries: [...others, state] });
  }

  /** One sync at a time; a second caller waits for the running one. */
  syncAll(): Promise<void> {
    this.syncing ??= this.runSync().finally(() => { this.syncing = undefined; });
    return this.syncing;
  }

  /**
   * Background refresh when the last attempt is older than `maxAgeMs` (used by the library list). A failed attempt
   * counts too, so a refused key is not retried on every list load; "지금 갱신" retries at once.
   */
  refreshIfStale(maxAgeMs = 30_000): void {
    void this.libraries().then((libs) => {
      const last = (l: ZoteroLibraryState) => Math.max(l.lastSyncAt ? Date.parse(l.lastSyncAt) : 0, l.failedAt ? Date.parse(l.failedAt) : 0);
      if (libs.some((l) => Date.now() - last(l) > maxAgeMs)) void this.syncAll().catch(() => undefined);
    });
  }

  private async runSync(): Promise<void> {
    for (const prior of await this.libraries()) {
      const client = this.client(prior.connection);
      const all = await this.store.all();
      const byRef = new Map(all.filter((i) => i.zotero).map((i) => [zoteroRefKey(i.zotero!), i.id]));
      const now = new Date().toISOString();
      let result;
      try {
        result = await syncZoteroLibrary(client, prior, { owner: libraryOwner(), now, existingItems: all.filter((i) => i.source === "zotero"), idForItem: (ref) => byRef.get(zoteroRefKey(ref)) ?? newItemId() });
      } catch (error) {
        // Kept with the library so the header and the Zotero card show the same failure and its cause.
        await this.upsertLibrary({ ...prior, state: error instanceof ZoteroError ? error.state : "failed", failedAt: now, detail: zoteroErrorDetail(prior.connection, error) });
        continue;
      }
      const partition: Partition = { connection: result.state.connection, serverId: result.state.serverId, libraryType: result.state.libraryType, libraryId: result.state.libraryId };
      const inPartition = (item: LibraryItem) => item.zotero && zoteroLibraryKey(item.zotero) === zoteroLibraryKey(partition);

      // Folders first, so item memberships can be translated to GAID folder ids.
      const folders = reconcileFolders(await this.store.collections(), result, partition, all);
      await this.store.saveCollections(folders.collections);
      const finalIds = new Set(folders.collections.map((c) => c.id));

      // Items: upsert, then mark removed ones (and, on a full snapshot, the ones the snapshot no longer has).
      const upserted = new Set(result.upserts.map((i) => i.id));
      const previous = new Map(all.map((i) => [i.id, i]));
      // Zotero's own citation-key field is empty without Better BibTeX: give such items a stable GAID alias key
      // (kept across syncs) so research notes can still cite them. A key Zotero assigns later keeps the old one as alias.
      const taken = new Set(all.map((i) => i.citationKey).filter((k): k is string => Boolean(k)));
      for (const item of result.upserts) {
        const old = previous.get(item.id);
        const kept = keepGaidFiles(item, old);
        if (old?.aliases) kept.aliases = structuredClone(old.aliases);
        if (!kept.citationKey) {
          kept.citationKey = old?.citationKey ?? defaultCitationKey(kept.csl, taken);
          taken.add(kept.citationKey);
        } else if (old?.citationKey && old.citationKey !== kept.citationKey) {
          kept.aliases = { ...kept.aliases, citationKeys: [...new Set([...(kept.aliases?.citationKeys ?? []), old.citationKey])] };
        }
        // Zotero-sourced memberships (folders linked to this library) plus the GAID-kept ones.
        const fromZotero = kept.collectionIds.map((id) => folders.translate.get(id) ?? id);
        const local = (old?.collectionIds ?? []).filter((id) => !folders.linked.has(id));
        kept.collectionIds = [...new Set([...fromZotero, ...local])].filter((id) => finalIds.has(id));
        await this.store.put({ ...kept, removedFromSourceAt: undefined });
      }
      const removedKeys = new Set(result.removals.map((r) => r.itemKey));
      const manifest = result.sourceItemKeys ? new Set(result.sourceItemKeys) : undefined;
      for (const item of all) {
        if (upserted.has(item.id)) continue;
        const missingFolders = item.collectionIds.some((id) => !finalIds.has(id));
        let next = missingFolders ? { ...item, collectionIds: item.collectionIds.filter((id) => finalIds.has(id)) } : item;
        if (item.source === "zotero" && item.zotero && !item.removedFromSourceAt) {
          const key = item.zotero.itemKey;
          const sameLibrary = item.zotero.connection === prior.connection && item.zotero.libraryType === prior.libraryType && item.zotero.libraryId === prior.libraryId;
          const gone = (inPartition(item) && (removedKeys.has(key) || (manifest !== undefined && !manifest.has(key)))) || (result.reset && sameLibrary);
          if (gone) next = { ...next, removedFromSourceAt: now, updatedAt: now };
        }
        if (next !== item) await this.store.put(next);
      }
      await this.upsertLibrary({ ...result.state, name: prior.name });
    }
  }

  /** Downloads a Zotero item's PDF into GAID's page cache so the agent can read pages (on the researcher's PC). */
  async readZoteroPdf(item: LibraryItem): Promise<LibraryItem> {
    const pdf = item.attachments.find((a) => a.kind === "pdf" && a.zoteroAttachmentKey);
    if (!item.zotero || !pdf?.zoteroAttachmentKey) return item;
    const lib = (await this.libraries()).find((l) => zoteroLibraryKey(l) === zoteroLibraryKey(item.zotero!));
    if (!lib) return item;
    const bytes = await getAttachmentFile(this.client(lib.connection), { ...item.zotero, itemKey: pdf.zoteroAttachmentKey });
    const { sha256, size } = await this.store.storePdf(bytes);
    const read = await readStoredPdf(this.store, sha256);
    return this.store.mutate(item.id, (next) => {
      next.read = read;
      const a = next.attachments.find((x) => x.id === pdf.id);
      if (a) { a.stored = { sha256, size, mediaType: "application/pdf" }; if (read.pagesTotal) a.pages = read.pagesTotal; }
    });
  }

  /** The library a send or membership write goes to: the folder's linked library, else the first connected one (PC first). */
  private async targetLibrary(folder?: LibraryCollection): Promise<ZoteroLibraryState> {
    const libs = (await this.libraries()).filter((l) => l.state === "ok");
    const linked = folder?.zotero ? libs.find((l) => l.connection === folder.zotero!.connection && l.libraryType === folder.zotero!.libraryType && l.libraryId === folder.zotero!.libraryId) : undefined;
    const lib = linked ?? libs.find((l) => l.connection === "local") ?? libs[0];
    if (!lib) throw new LibraryError("Connect Zotero first", 409);
    return lib;
  }

  /**
   * Runs Zotero writes; a rejected Local key asks Zotero once for permission (its confirmation dialog), then retries.
   * A second rejection (a single-use key spent) stops the operation: earlier steps are kept and reported.
   */
  private writer(lib: ZoteroLibraryState) {
    const client = this.client(lib.connection);
    let authorized = false;
    return {
      client,
      async run<T>(step: () => Promise<T>): Promise<T> {
        try { return await step(); }
        catch (error) {
          if (!(error instanceof ZoteroError) || error.state !== "key-rejected" || !(client instanceof LocalZoteroClient) || authorized) throw error;
          authorized = true;
          await client.authorize("GAID");
          return step();
        }
      },
    };
  }

  /**
   * Adds or removes folder members. For a folder linked to a Zotero collection, adding a Zotero item of that library
   * writes "add to collection" to Zotero; removing such a membership is done in Zotero. Every other membership is GAID's.
   */
  async setMembership(folderId: string, itemIds: string[], action: "add" | "remove"): Promise<FolderMembershipResult> {
    const folder = await this.store.collection(folderId);
    const result: FolderMembershipResult = { changed: 0, writtenToZotero: 0, removeInZotero: [] };
    const zoteroOwned = (item: LibraryItem) => Boolean(folder.zotero && item.source === "zotero" && item.zotero && sameLibrary(item.zotero, folder.zotero));
    let w: ReturnType<ZoteroService["writer"]> | undefined;
    for (const id of [...new Set(itemIds)].slice(0, 2000)) {
      const item = await this.store.get(id);
      const member = item.collectionIds.includes(folder.id);
      if (action === "remove") {
        if (!member) continue;
        if (zoteroOwned(item)) { result.removeInZotero.push(item.id); continue; }
        await this.store.mutate(item.id, (next) => { next.collectionIds = next.collectionIds.filter((c) => c !== folder.id); });
        result.changed++;
        continue;
      }
      if (member) continue;
      if (zoteroOwned(item)) {
        w ??= this.writer(await this.targetLibrary(folder));
        const writer = w;
        const ref = await writer.run(() => addItemToCollections(writer.client, item.zotero!, [folder.zotero!.collectionKey]));
        await this.store.mutate(item.id, (next) => { next.zotero = { ...next.zotero!, version: ref.version }; next.collectionIds.push(folder.id); });
        result.writtenToZotero++;
      } else {
        await this.store.mutate(item.id, (next) => { next.collectionIds.push(folder.id); });
      }
      result.changed++;
    }
    return result;
  }

  /** "Zotero로 보내기" for one paper: into its linked folders, else into "GAID 수집함". */
  async sendToZotero(id: string): Promise<SendToZoteroResult> {
    const item = await this.store.get(id);
    if (item.source !== "gaid") throw new LibraryError("Already a Zotero item", 409);
    const result = await this.send([item.id], undefined);
    return { ...result, item: await this.store.get(item.id) };
  }

  /** "Zotero로 보내기" for a folder: links the folder and its subfolders to Zotero collections and sends their papers. */
  async sendFolderToZotero(folderId: string): Promise<SendToZoteroResult> {
    await this.store.collection(folderId);
    const subtree = folderSubtree(await this.store.collections(), folderId);
    const ids = (await this.store.all()).filter((i) => !i.removedFromSourceAt && i.collectionIds.some((c) => subtree.has(c))).map((i) => i.id);
    return this.send(ids, folderId);
  }

  private async send(itemIds: string[], folderId: string | undefined): Promise<SendToZoteroResult> {
    const result: SendToZoteroResult = { created: 0, merged: 0, addedToCollections: 0, attachments: 0, folders: 0, skipped: [] };
    const lib = await this.targetLibrary(folderId ? await this.store.collection(folderId) : undefined);
    // A fresh mirror first: duplicates are found against it, and an item created by an interrupted earlier send is
    // already mirrored, so a second send does not create it again.
    await this.syncAll();
    const fresh = (await this.libraries()).find((l) => zoteroLibraryKey(l) === zoteroLibraryKey(lib) || (l.connection === lib.connection && l.libraryType === lib.libraryType && l.libraryId === lib.libraryId));
    if (!fresh || fresh.state !== "ok") throw new ZoteroError(fresh?.state ?? "failed", "sync-before-send");
    const w = this.writer(fresh);
    const partition: Partition = { connection: fresh.connection, serverId: w.client.serverId ?? fresh.serverId, libraryType: fresh.libraryType, libraryId: fresh.libraryId };
    try {
      if (folderId) result.folders = await this.linkFolders(folderId, partition, w);
      const linkedKeys = async (item: LibraryItem) => {
        const cols = await this.store.collections();
        return item.collectionIds.flatMap((id) => { const c = cols.find((x) => x.id === id); return c?.zotero && sameLibrary(c.zotero, partition) ? [c.zotero.collectionKey] : []; });
      };
      for (const id of itemIds) {
        const item = await this.store.get(id);
        if (item.removedFromSourceAt) continue;
        if (item.source === "zotero") {
          if (!item.zotero || !sameLibrary(item.zotero, partition)) { result.skipped.push({ itemId: item.id, reason: "other-library" }); continue; }
          const keys = await linkedKeys(item);
          if (!keys.length) continue;
          const ref = await w.run(() => addItemToCollections(w.client, item.zotero!, keys));
          await this.store.mutate(item.id, (next) => { next.zotero = { ...next.zotero!, version: ref.version }; });
          if (ref.added.length) result.addedToCollections++;
          continue;
        }
        const mirror = (await this.store.all()).find((other) => other.id !== item.id && other.source === "zotero" && !other.removedFromSourceAt && other.zotero && sameLibrary(other.zotero, partition) && samePaper(other.csl, item.csl));
        if (mirror) { await this.mergeInto(item, mirror, w, result, await linkedKeys(item)); continue; }
        let keys = await linkedKeys(item);
        if (!keys.length) {
          const inbox = await w.run(() => ensureInboxCollection(w.client, fresh));
          const z = await this.store.zotero();
          await this.store.saveZotero({ ...z, inbox: { ...z.inbox, [zoteroLibraryKey(fresh)]: inbox.key } });
          keys = [inbox.key];
        }
        let ref;
        try { ref = await w.run(() => createItem(w.client, fresh, { csl: item.csl, collectionKeys: keys, tags: item.tags })); }
        catch (error) {
          if (!(error instanceof Error) || error instanceof ZoteroError || !error.message.startsWith("Unsupported CSL type")) throw error;
          result.skipped.push({ itemId: item.id, reason: "unsupported-type" });
          continue;
        }
        // Persist the transition before the PDF upload, so an interrupted send never creates the item twice.
        const at = new Date().toISOString();
        const converted = await this.store.put({ ...item, source: "zotero", zotero: ref, metadataOrigin: "zotero", sentToZoteroAt: at, updatedAt: at });
        result.created++;
        if (await this.uploadPdf(converted, converted, w, result)) result.attachments++;
      }
    } catch (error) {
      if (error instanceof ZoteroError && error.state === "key-rejected") result.stopped = "key-rejected";
      else throw error;
    }
    await this.syncAll().catch(() => undefined);
    return result;
  }

  /** Links a folder subtree to Zotero collections (reusing a same-name collection under the same parent). */
  private async linkFolders(folderId: string, partition: Partition, w: ReturnType<ZoteroService["writer"]>): Promise<number> {
    let count = 0;
    const order = [...folderSubtree(await this.store.collections(), folderId)];
    const depth = (cols: LibraryCollection[], id: string) => { let d = 0, c = cols.find((x) => x.id === id); while (c?.parentId && d < 100) { d++; c = cols.find((x) => x.id === c!.parentId); } return d; };
    const initial = await this.store.collections();
    order.sort((a, b) => depth(initial, a) - depth(initial, b));
    for (const id of order) {
      const cols = await this.store.collections();
      const folder = cols.find((c) => c.id === id);
      if (!folder || (folder.zotero && sameLibrary(folder.zotero, partition))) continue;
      if (folder.zotero) continue; // linked to another Zotero library: left as is
      const parent = folder.parentId ? cols.find((c) => c.id === folder.parentId) : undefined;
      const parentKey = parent?.zotero && sameLibrary(parent.zotero, partition) ? parent.zotero.collectionKey : undefined;
      const made = await w.run(() => ensureCollection(w.client, partition, { name: folder.name, ...(parentKey ? { parentKey } : {}) }));
      const linked: LibraryCollection = { ...folder, source: "zotero", zotero: { connection: partition.connection, ...(partition.serverId ? { serverId: partition.serverId } : {}), libraryType: partition.libraryType, libraryId: partition.libraryId, collectionKey: made.key } };
      // A mirrored copy of a reused collection is folded into this folder (its members move with it).
      const mirroredId = zoteroCollectionId(partition, made.key);
      const latest = await this.store.collections();
      await this.store.saveCollections(latest.filter((c) => c.id !== mirroredId).map((c) => (c.id === id ? linked : c.parentId === mirroredId ? { ...c, parentId: id } : c)));
      if (latest.some((c) => c.id === mirroredId)) {
        for (const item of await this.store.all()) if (item.collectionIds.includes(mirroredId)) await this.store.mutate(item.id, (next) => { next.collectionIds = [...new Set(next.collectionIds.map((c) => (c === mirroredId ? id : c)))]; });
      }
      count++;
    }
    return count;
  }

  /** A GAID paper already in Zotero: the Zotero copy gains its folders, tags and PDF; the GAID id and key stay as aliases. */
  private async mergeInto(item: LibraryItem, mirror: LibraryItem, w: ReturnType<ZoteroService["writer"]>, result: SendToZoteroResult, keys: string[]): Promise<void> {
    let ref = mirror.zotero!;
    if (keys.length) {
      const added = await w.run(() => addItemToCollections(w.client, ref, keys));
      ref = { ...ref, version: added.version };
      if (added.added.length) result.addedToCollections++;
    }
    if (item.tags.length) ref = await w.run(() => addTags(w.client, ref, item.tags));
    const at = new Date().toISOString();
    const merged = await this.store.put({
      ...mirror,
      zotero: ref,
      collectionIds: [...new Set([...mirror.collectionIds, ...item.collectionIds])],
      aliases: {
        ids: [...new Set([...(mirror.aliases?.ids ?? []), item.id, ...(item.aliases?.ids ?? [])])],
        citationKeys: [...new Set([...(mirror.aliases?.citationKeys ?? []), ...(item.citationKey && item.citationKey !== mirror.citationKey ? [item.citationKey] : []), ...(item.aliases?.citationKeys ?? [])])],
      },
      ...(mirror.read.coverage === "none" && item.read.coverage !== "none" ? { read: item.read } : {}),
      sentToZoteroAt: at,
      updatedAt: at,
    });
    await this.store.drop(item.id);
    result.merged++;
    if (!mirror.attachments.some((a) => a.kind === "pdf") && (await this.uploadPdf(item, merged, w, result))) result.attachments++;
  }

  /** Uploads the GAID-stored PDF of `from` as a Zotero attachment of `to` (with GAID's page text as Zotero full text). */
  private async uploadPdf(from: LibraryItem, to: LibraryItem, w: ReturnType<ZoteroService["writer"]>, result: SendToZoteroResult): Promise<boolean> {
    const pdf = from.attachments.find((a) => a.kind === "pdf" && a.stored && !a.zoteroAttachmentKey);
    if (!pdf?.stored || !to.zotero) return false;
    try {
      const bytes = await fs.readFile(this.store.filePath(pdf.stored.sha256));
      const fullText = await pdfFullText(this.store, from, pdf.stored.sha256);
      const up = await w.run(() => uploadAttachment(w.client, to.zotero!, to.zotero!.itemKey, { bytes, filename: `${to.citationKey ?? to.id}.pdf`, contentType: "application/pdf", title: "PDF", ...(fullText ? { fullText } : {}) }));
      await this.store.mutate(to.id, (next) => {
        const own = next.attachments.find((a) => a.id === pdf.id);
        if (own) own.zoteroAttachmentKey = up.attachmentKey;
        else next.attachments.push({ ...pdf, zoteroAttachmentKey: up.attachmentKey });
      });
      return true;
    } catch (error) {
      if (error instanceof ZoteroError && error.state === "key-rejected") throw error;
      result.skipped.push({ itemId: to.id, reason: "pdf-failed" });
      return false;
    }
  }
}

type Partition = { connection: "local" | "web"; serverId?: string; libraryType: "user" | "group"; libraryId: string };

/** Same Zotero library; Local partitions also need the same Zotero-Server-ID when both sides record one. */
function sameLibrary(a: { connection: string; serverId?: string; libraryType: string; libraryId: string }, b: { connection: string; serverId?: string; libraryType: string; libraryId: string }): boolean {
  return a.connection === b.connection && a.libraryType === b.libraryType && a.libraryId === b.libraryId && (a.connection !== "local" || !a.serverId || !b.serverId || a.serverId === b.serverId);
}

/** GAID's page text of a stored PDF, for Zotero's full-text index (Zotero does not index files uploaded locally). */
async function pdfFullText(store: LibraryStore, item: LibraryItem, sha: string): Promise<{ content: string; indexedPages: number; totalPages: number } | undefined> {
  const total = item.read.pagesTotal ?? 0;
  if (!total) return undefined;
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(total, 400); p++) pages.push(((await pageText(store, sha, p)) ?? "").trim());
  const content = pages.join("\n\n").trim();
  return content ? { content, indexedPages: pages.filter(Boolean).length, totalPages: total } : undefined;
}

/**
 * Folder reconciliation after one library sync. Mirrored collections (`zc-` ids) are upserted; a GAID folder sent to
 * Zotero (`lc-` id, linked) keeps its id and takes name/parent from Zotero. A collection deleted in Zotero disappears,
 * except when GAID items or GAID folders are in it, or it was a GAID folder: then it stays as an unlinked GAID folder.
 * `translate` maps mirrored ids to linked GAID folder ids; `linked` lists folders whose Zotero items' membership
 * Zotero owns.
 */
export function reconcileFolders(existing: LibraryCollection[], result: Pick<ZoteroSyncResult, "collections" | "removedCollectionKeys" | "sourceCollectionKeys" | "reset">, partition: Partition, items: LibraryItem[]): { collections: LibraryCollection[]; translate: Map<string, string>; linked: Set<string> } {
  const freshByKey = new Map(result.collections.map((c) => [c.zotero!.collectionKey, c]));
  const keyOf = (c: LibraryCollection): string | undefined => {
    if (!c.zotero) return undefined;
    if (c.id.startsWith("zc-")) return c.id === zoteroCollectionId(partition, c.zotero.collectionKey) ? c.zotero.collectionKey : undefined;
    const sameLib = c.zotero.connection === partition.connection && c.zotero.libraryType === partition.libraryType && c.zotero.libraryId === partition.libraryId;
    if (!sameLib) return undefined;
    // A changed Zotero-Server-ID (full snapshot): relink when the new snapshot still has the key.
    if (partition.connection === "local" && c.zotero.serverId && partition.serverId && c.zotero.serverId !== partition.serverId) return result.reset && freshByKey.has(c.zotero.collectionKey) ? c.zotero.collectionKey : undefined;
    return c.zotero.collectionKey;
  };
  const translate = new Map<string, string>();
  for (const c of existing) { const key = keyOf(c); if (key && !c.id.startsWith("zc-")) translate.set(zoteroCollectionId(partition, key), c.id); }
  const tr = (id: string | undefined) => (id ? translate.get(id) ?? id : undefined);
  const removed = new Set(result.removedCollectionKeys);
  const manifest = result.sourceCollectionKeys ? new Set(result.sourceCollectionKeys) : undefined;
  const gone = (key: string) => !freshByKey.has(key) && (removed.has(key) || (manifest !== undefined && !manifest.has(key)) || result.reset);
  const gaidHeld = (id: string) => items.some((i) => i.collectionIds.includes(id) && !(i.source === "zotero" && i.zotero && sameLibrary(i.zotero, partition))) || existing.some((c) => c.parentId === id && c.source === "gaid");
  const out: LibraryCollection[] = [];
  const seen = new Set<string>();
  for (const c of existing) {
    const key = keyOf(c);
    if (!key) {
      // A stale mirrored copy of another partition is dropped on a full snapshot of this library.
      if (c.id.startsWith("zc-") && result.reset && c.zotero && c.zotero.connection === partition.connection && c.zotero.libraryType === partition.libraryType && c.zotero.libraryId === partition.libraryId && !gaidHeld(c.id)) continue;
      out.push(c);
      continue;
    }
    const fresh = freshByKey.get(key);
    if (fresh) {
      seen.add(key);
      const parentId = tr(fresh.parentId);
      out.push({ ...c, name: fresh.name, source: "zotero", zotero: { ...fresh.zotero!, ...(partition.serverId ? { serverId: partition.serverId } : {}) }, ...(parentId ? { parentId } : { parentId: undefined }) });
    } else if (gone(key)) {
      if (!c.id.startsWith("zc-") || gaidHeld(c.id)) { const { zotero: _z, ...rest } = c; out.push({ ...rest, source: "gaid" }); }
    } else out.push(c);
  }
  for (const [key, fresh] of freshByKey) {
    if (seen.has(key)) continue;
    const parentId = tr(fresh.parentId);
    out.push({ ...fresh, zotero: { ...fresh.zotero!, ...(partition.serverId ? { serverId: partition.serverId } : {}) }, ...(parentId ? { parentId } : {}) });
  }
  const collections = out.map((c) => { if (c.parentId !== undefined) return c; const { parentId: _p, ...rest } = c; return rest; });
  const linked = new Set(collections.filter((c) => c.zotero && (c.id.startsWith("zc-") ? c.id === zoteroCollectionId(partition, c.zotero.collectionKey) : sameLibrary(c.zotero, partition))).map((c) => c.id));
  return { collections, translate, linked };
}

/**
 * The connector maps attachments from Zotero only. Keep what GAID holds itself: the cached PDF copy (`stored`) of a
 * Zotero attachment, and a PDF a GAID item had before it was sent to Zotero (the PDF is not uploaded).
 */
export function keepGaidFiles(next: LibraryItem, prior: LibraryItem | undefined): LibraryItem {
  if (!prior) return next;
  const attachments = next.attachments.map((a) => {
    const old = prior.attachments.find((p) => p.zoteroAttachmentKey && p.zoteroAttachmentKey === a.zoteroAttachmentKey);
    return old?.stored ? { ...a, stored: old.stored } : a;
  });
  for (const old of prior.attachments) if (old.stored && !old.zoteroAttachmentKey && !attachments.some((a) => a.id === old.id)) attachments.push(old);
  return { ...next, attachments, read: prior.read.coverage !== "none" ? prior.read : next.read };
}

let shared: { store: LibraryStore; service: ZoteroService } | undefined;
export function zoteroService(store: LibraryStore): ZoteroService {
  // GAID_ZOTERO_LOCAL_URL points the PC connection at another Local API (a test Zotero on its own port).
  if (!shared || shared.store !== store) shared = { store, service: new ZoteroService(store, process.env.GAID_ZOTERO_LOCAL_URL ? { localBaseUrl: process.env.GAID_ZOTERO_LOCAL_URL } : {}) };
  return shared.service;
}

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
import type { LibraryCollection, LibraryItem, ZoteroLibraryState } from "../../../../web/src/geo/contracts/library.ts";
import { LibraryError, libraryOwner, newItemId, zoteroLibraryKey, type LibraryStore } from "./store.ts";
import { readStoredPdf } from "./reader.ts";
import {
  LocalZoteroClient,
  WebZoteroClient,
  ZoteroError,
  addItemToInbox,
  ensureInboxCollection,
  getAttachmentFile,
  probeZoteroLibrary,
  syncZoteroLibrary,
  zoteroCollectionId,
  zoteroRefKey,
  type ZoteroClient,
  type ZoteroSecretStore,
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
    for (const lib of personal) await this.upsertLibrary({ connection: "web", libraryType: lib.libraryType, libraryId: lib.libraryId, name: lib.name, follow: "all", libraryVersion: 0, state: "ok" });
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

  /** Background refresh when the last sync is older than `maxAgeMs` (used by the library list). */
  refreshIfStale(maxAgeMs = 30_000): void {
    void this.libraries().then((libs) => {
      if (libs.some((l) => !l.lastSyncAt || Date.now() - Date.parse(l.lastSyncAt) > maxAgeMs)) void this.syncAll().catch(() => undefined);
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
        await this.upsertLibrary({ ...prior, state: error instanceof ZoteroError ? error.state : "unreachable" });
        continue;
      }
      const partition = { connection: result.state.connection, serverId: result.state.serverId, libraryType: result.state.libraryType, libraryId: result.state.libraryId };
      const inPartition = (item: LibraryItem) => item.zotero && zoteroLibraryKey(item.zotero) === zoteroLibraryKey(partition);
      // Items: upsert, then mark removed ones (and, on a full snapshot, the ones the snapshot no longer has).
      const upserted = new Set(result.upserts.map((i) => i.id));
      const previous = new Map(all.map((i) => [i.id, i]));
      for (const item of result.upserts) await this.store.put({ ...keepGaidFiles(item, previous.get(item.id)), removedFromSourceAt: undefined });
      const removedKeys = new Set(result.removals.map((r) => r.itemKey));
      const manifest = result.sourceItemKeys ? new Set(result.sourceItemKeys) : undefined;
      for (const item of all) {
        if (item.source !== "zotero" || !item.zotero || item.removedFromSourceAt || upserted.has(item.id)) continue;
        const key = item.zotero.itemKey;
        const sameLibrary = item.zotero.connection === prior.connection && item.zotero.libraryType === prior.libraryType && item.zotero.libraryId === prior.libraryId;
        const gone = (inPartition(item) && (removedKeys.has(key) || (manifest !== undefined && !manifest.has(key)))) || (result.reset && sameLibrary);
        if (gone) await this.store.put({ ...item, removedFromSourceAt: now, updatedAt: now });
      }
      // Collections: incremental upsert by id; reconcile removals and full snapshots.
      const collections = await this.store.collections();
      const fresh = new Map(result.collections.map((c) => [c.id, c]));
      const keep = (c: LibraryCollection) => {
        if (c.source !== "zotero" || !c.zotero) return true;
        const id = zoteroCollectionId(partition, c.zotero.collectionKey);
        if (c.id !== id) return !result.reset; // another partition (or an old one after a reset)
        if (fresh.has(c.id)) return false; // replaced below
        if (result.removedCollectionKeys.includes(c.zotero.collectionKey)) return false;
        if (result.sourceCollectionKeys && !result.sourceCollectionKeys.includes(c.zotero.collectionKey)) return false;
        return !result.reset;
      };
      await this.store.saveCollections([...collections.filter(keep), ...fresh.values()]);
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

  /**
   * "Zotero로 보내기": creates the item in Zotero inside "GAID 수집함" and turns the GAID item into a Zotero item in
   * place (same id, so citations and links keep working). The PDF stays in GAID storage; it is not uploaded.
   * The Local API needs a write key: the first call asks Zotero to show its confirmation dialog.
   */
  async sendToZotero(id: string): Promise<LibraryItem> {
    const item = await this.store.get(id);
    if (item.source !== "gaid") throw new LibraryError("Already a Zotero item", 409);
    const lib = (await this.libraries()).find((l) => l.state === "ok");
    if (!lib) throw new LibraryError("Connect Zotero first", 409);
    const client = this.client(lib.connection);
    const run = async () => {
      const inbox = await ensureInboxCollection(client, lib);
      const z = await this.store.zotero();
      await this.store.saveZotero({ ...z, inbox: { ...z.inbox, [zoteroLibraryKey(lib)]: inbox.key } });
      return addItemToInbox(client, lib, { csl: item.csl });
    };
    let ref;
    try { ref = await run(); }
    catch (error) {
      if (!(error instanceof ZoteroError) || error.state !== "key-rejected" || !(client instanceof LocalZoteroClient)) throw error;
      await client.authorize("GAID");
      ref = await run();
    }
    const at = new Date().toISOString();
    return this.store.put({ ...item, source: "zotero", zotero: ref, metadataOrigin: "zotero", sentToZoteroAt: at, updatedAt: at });
  }
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
  if (!shared || shared.store !== store) shared = { store, service: new ZoteroService(store) };
  return shared.service;
}

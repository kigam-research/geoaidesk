/**
 * Personal library store (ADR docs/adr/2026-10-21-research-hub-library.md). User-level, next to the hub authoring
 * store: `<agentDir>/research/library/` (`GAID_LIBRARY_DIR` overrides it for tests).
 *
 *   items/<id>.json        one LibraryItem per file (both sources)
 *   collections.json       LibraryCollection[] (GAID collections and mirrored Zotero collections)
 *   zotero.json            ZoteroLibraryState[] plus the remembered inbox collection keys
 *   files/<sha256>         PDFs of GAID-managed items, content-addressed (never copied to the shared hub)
 *
 * One process owns the directory; writes are serialized through one queue. Zotero items are written only by the
 * Zotero sync; the researcher edits GAID items only.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { KADY_PI_AGENT_DIR } from "../../config.ts";
import { citationKeyFor } from "./formats/index.ts";
import type {
  CslItem,
  LibraryCollection,
  LibraryItem,
  LibraryItemSummary,
  MetadataOrigin,
  ZoteroLibraryState,
} from "../../../../web/src/geo/contracts/library.ts";

export class LibraryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const libraryDir = () => resolve(process.env.GAID_LIBRARY_DIR || join(KADY_PI_AGENT_DIR, "research", "library"));
/** Owner of this GAID's library; an account id once the institute server has accounts. */
export const libraryOwner = () => process.env.GAID_LIBRARY_OWNER || "local";

export const LIBRARY_LIMITS = { items: 20_000, pdfBytes: 64 * 1024 * 1024, cslBytes: 256 * 1024 } as const;
const ITEM_ID = /^li-[a-z0-9]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const now = () => new Date().toISOString();
export const newItemId = () => `li-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
export const newCollectionId = () => `lc-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

interface ZoteroFile {
  libraries: ZoteroLibraryState[];
  /** Inbox ("GAID 수집함") collection key per Zotero library, keyed by `libraryKey()`. */
  inbox: Record<string, string>;
}

export function zoteroLibraryKey(ref: { connection: string; serverId?: string; libraryType: string; libraryId: string }): string {
  return [ref.connection, ref.serverId ?? "", ref.libraryType, ref.libraryId].join(":");
}

/** Short author line for lists: one name, "A · B" for two, "A 외" for more (Korean UI; English uses "et al."). */
export function shortAuthors(csl: CslItem, locale: "ko" | "en" = "ko"): string {
  const names = (csl.author ?? []).map((a) => a.family || a.literal || a.given || "").filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} · ${names[1]}`;
  return locale === "ko" ? `${names[0]} 외` : `${names[0]} et al.`;
}

export const cslYear = (csl: CslItem): number | undefined => {
  const y = csl.issued?.["date-parts"]?.[0]?.[0];
  return typeof y === "number" && Number.isFinite(y) ? y : undefined;
};

/** Lower-case DOI without resolver prefix, or undefined. */
export function normalizeDoi(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const m = /10\.\d{4,9}\/\S+/i.exec(value.trim());
  return m ? m[0].replace(/[.,;)\]]+$/, "").toLowerCase() : undefined;
}

function validCsl(value: unknown): CslItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LibraryError("csl must be an object");
  const csl = value as CslItem;
  if (typeof csl.title !== "string" || !csl.title.trim()) throw new LibraryError("csl.title is required");
  if (typeof csl.type !== "string" || !csl.type) throw new LibraryError("csl.type is required");
  if (Buffer.byteLength(JSON.stringify(csl)) > LIBRARY_LIMITS.cslBytes) throw new LibraryError("csl is too large", 413);
  return csl;
}

/** Citation key for an item without one: the formats unit's rule (first author family + year + a/b/c…), unique among `taken`. */
export function defaultCitationKey(csl: CslItem, taken: Set<string>): string {
  return citationKeyFor(csl, taken);
}

/** True when the update evidence says this paper itself was retracted (not a notice that retracts another paper). */
export function isRetracted(signals: LibraryItem["signals"]): boolean {
  return (signals ?? []).some((s) => s.kind === "retraction" && !s.relation.startsWith("update-to"));
}

export class LibraryStore {
  root: string;
  private queue: Promise<unknown> = Promise.resolve();
  private items = new Map<string, LibraryItem>();
  private loaded = false;
  constructor(root = libraryDir()) {
    this.root = root;
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    await mkdir(join(this.root, "items"), { recursive: true });
    await mkdir(join(this.root, "files"), { recursive: true });
    for (const name of await readdir(join(this.root, "items"))) {
      if (!name.endsWith(".json") || !ITEM_ID.test(name.slice(0, -5))) continue;
      try {
        const item = JSON.parse(await readFile(join(this.root, "items", name), "utf8")) as LibraryItem;
        if (item?.id && ITEM_ID.test(item.id)) this.items.set(item.id, item);
      } catch {
        // A damaged file is skipped, never rewritten.
      }
    }
    this.loaded = true;
  }

  private async writeJson(file: string, value: unknown): Promise<void> {
    const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + "\n");
    await rename(tmp, file);
  }

  async all(): Promise<LibraryItem[]> {
    await this.load();
    return [...this.items.values()];
  }

  async get(id: string): Promise<LibraryItem> {
    await this.load();
    const item = ITEM_ID.test(id) ? this.items.get(id) : undefined;
    if (!item) throw new LibraryError("Library item not found", 404);
    return item;
  }

  async byCitationKey(key: string): Promise<LibraryItem | undefined> {
    await this.load();
    for (const item of this.items.values()) if (item.citationKey === key) return item;
    return undefined;
  }

  /** Writes one item as given (used by the Zotero sync and by mutate). */
  async put(item: LibraryItem): Promise<LibraryItem> {
    await this.load();
    if (!ITEM_ID.test(item.id)) throw new LibraryError("Invalid item id");
    return this.serial(async () => {
      await this.writeJson(join(this.root, "items", `${item.id}.json`), item);
      this.items.set(item.id, item);
      return item;
    });
  }

  async mutate(id: string, change: (item: LibraryItem) => void): Promise<LibraryItem> {
    const current = structuredClone(await this.get(id));
    change(current);
    current.updatedAt = now();
    return this.put(current);
  }

  /** Adds a GAID-managed item whose metadata the researcher confirmed. Duplicate DOIs are refused (409). */
  async addGaidItem(input: { csl: unknown; metadataOrigin: MetadataOrigin; collectionIds?: string[]; tags?: string[]; pdfSha256?: string; signals?: LibraryItem["signals"] }): Promise<LibraryItem> {
    await this.load();
    const csl = validCsl(input.csl);
    if (this.items.size >= LIBRARY_LIMITS.items) throw new LibraryError("Library is full", 413);
    const doi = normalizeDoi(csl.DOI);
    if (doi) {
      const existing = [...this.items.values()].find((i) => !i.removedFromSourceAt && normalizeDoi(i.csl.DOI) === doi);
      if (existing) throw new LibraryError(`Already in the library: ${existing.id}`, 409);
    }
    const collections = await this.collections();
    const collectionIds = (input.collectionIds ?? []).filter((id) => collections.some((c) => c.id === id && c.source === "gaid"));
    const attachments: LibraryItem["attachments"] = [];
    if (input.pdfSha256 !== undefined) {
      if (!SHA.test(input.pdfSha256) || !existsSync(this.filePath(input.pdfSha256))) throw new LibraryError("Unknown uploaded file", 404);
      const size = (await stat(this.filePath(input.pdfSha256))).size;
      attachments.push({ id: `la-${input.pdfSha256.slice(0, 12)}`, kind: "pdf", stored: { sha256: input.pdfSha256, size, mediaType: "application/pdf" } });
    }
    const taken = new Set([...this.items.values()].map((i) => i.citationKey).filter((k): k is string => Boolean(k)));
    const at = now();
    const item: LibraryItem = {
      id: newItemId(),
      owner: libraryOwner(),
      source: "gaid",
      csl: doi ? { ...csl, DOI: doi } : csl,
      citationKey: defaultCitationKey(csl, taken),
      metadataOrigin: input.metadataOrigin,
      metadataConfirmed: true,
      collectionIds,
      tags: [...new Set((input.tags ?? []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 50),
      attachments,
      read: { coverage: "none" },
      addedAt: at,
      updatedAt: at,
      ...(Array.isArray(input.signals) && input.signals.length ? { signals: input.signals.slice(0, 20) } : {}),
    };
    return this.put(item);
  }

  /** Edits a GAID-managed item; Zotero items are edited in Zotero (409). */
  async editGaidItem(id: string, patch: { csl?: unknown; tags?: unknown; collectionIds?: unknown }): Promise<LibraryItem> {
    const item = await this.get(id);
    if (item.source !== "gaid") throw new LibraryError("Edit this item in Zotero", 409);
    const csl = patch.csl === undefined ? undefined : validCsl(patch.csl);
    const collections = await this.collections();
    return this.mutate(id, (next) => {
      if (csl) next.csl = csl;
      if (Array.isArray(patch.tags)) next.tags = [...new Set(patch.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 50);
      if (Array.isArray(patch.collectionIds)) next.collectionIds = patch.collectionIds.map(String).filter((cid) => collections.some((c) => c.id === cid && c.source === "gaid"));
    });
  }

  /** Removes a GAID-managed item; its file stays until no item refers to it. Zotero items are removed in Zotero. */
  async removeGaidItem(id: string): Promise<void> {
    const item = await this.get(id);
    if (item.source !== "gaid") throw new LibraryError("Remove this item in Zotero", 409);
    await this.serial(async () => {
      await rm(join(this.root, "items", `${id}.json`), { force: true });
      this.items.delete(id);
    });
  }

  filePath(sha256: string): string {
    if (!SHA.test(sha256)) throw new LibraryError("Invalid file id");
    return join(this.root, "files", sha256);
  }

  /** Stores a PDF by content hash (idempotent). */
  async storePdf(bytes: Buffer): Promise<{ sha256: string; size: number }> {
    await this.load();
    if (bytes.length > LIBRARY_LIMITS.pdfBytes) throw new LibraryError("PDF exceeds 64 MiB", 413);
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new LibraryError("Not a PDF file", 415);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const file = this.filePath(sha256);
    if (!existsSync(file)) await this.serial(() => this.writeBytes(file, bytes));
    return { sha256, size: bytes.length };
  }

  private async writeBytes(file: string, bytes: Buffer): Promise<void> {
    const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, file);
  }

  async collections(): Promise<LibraryCollection[]> {
    await this.load();
    try {
      const value = JSON.parse(await readFile(join(this.root, "collections.json"), "utf8"));
      return Array.isArray(value) ? (value as LibraryCollection[]) : [];
    } catch {
      return [];
    }
  }

  async saveCollections(collections: LibraryCollection[]): Promise<void> {
    await this.load();
    await this.serial(() => this.writeJson(join(this.root, "collections.json"), collections));
  }

  async addGaidCollection(name: unknown, parentId?: unknown): Promise<LibraryCollection> {
    const label = typeof name === "string" ? name.trim() : "";
    if (!label || [...label].length > 80) throw new LibraryError("Collection name must be 1-80 characters");
    const collections = await this.collections();
    const parent = typeof parentId === "string" ? collections.find((c) => c.id === parentId && c.source === "gaid") : undefined;
    const collection: LibraryCollection = { id: newCollectionId(), owner: libraryOwner(), name: label, source: "gaid", ...(parent ? { parentId: parent.id } : {}) };
    await this.saveCollections([...collections, collection]);
    return collection;
  }

  async zotero(): Promise<ZoteroFile> {
    await this.load();
    try {
      const value = JSON.parse(await readFile(join(this.root, "zotero.json"), "utf8")) as ZoteroFile;
      return { libraries: Array.isArray(value.libraries) ? value.libraries : [], inbox: value.inbox && typeof value.inbox === "object" ? value.inbox : {} };
    } catch {
      return { libraries: [], inbox: {} };
    }
  }

  async saveZotero(value: ZoteroFile): Promise<void> {
    await this.load();
    await this.serial(() => this.writeJson(join(this.root, "zotero.json"), value));
  }
}

let shared: LibraryStore | undefined;
/** Process-wide store for the configured directory (re-created when `GAID_LIBRARY_DIR` changes, as in tests). */
export function libraryStore(): LibraryStore {
  const root = libraryDir();
  if (!shared || shared.root !== root) shared = new LibraryStore(root);
  return shared;
}

export function summarize(item: LibraryItem, used: LibraryItemSummary["used"]): LibraryItemSummary {
  const year = cslYear(item.csl);
  return {
    id: item.id,
    source: item.source,
    title: item.csl.title,
    authors: shortAuthors(item.csl),
    ...(year !== undefined ? { year } : {}),
    ...(typeof item.csl["container-title"] === "string" ? { container: item.csl["container-title"] } : {}),
    ...(item.citationKey ? { citationKey: item.citationKey } : {}),
    coverage: item.read.coverage,
    hasPdf: item.attachments.some((a) => a.kind === "pdf"),
    collectionIds: item.collectionIds,
    tags: item.tags,
    used,
    metadataConfirmed: item.metadataConfirmed,
    addedAt: item.addedAt,
    ...(isRetracted(item.signals) ? { retracted: true } : {}),
  };
}

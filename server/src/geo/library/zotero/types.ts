import type { CslItem, LibraryItem, ZoteroItemRef, ZoteroLibraryState } from "../../../../../web/src/geo/contracts/library.ts";

export type { CslItem, LibraryItem, ZoteroItemRef, ZoteroLibraryState };
export type ZoteroLibrary = Pick<ZoteroItemRef, "libraryType" | "libraryId">;
export type ConnectionState = ZoteroLibraryState["state"];

/** Parent supplies an owner-scoped, 0600-backed store. Values must never enter reports or logs. */
export interface ZoteroSecretStore {
  get(slot: string): Promise<string | undefined>;
  set(slot: string, value: string): Promise<void>;
  delete(slot: string): Promise<void>;
}

export interface ZoteroObject {
  key: string;
  version: number;
  data: Record<string, unknown>;
  /** include=csljson is an export string containing a one-item array on the real Local API. */
  csljson?: CslItem | CslItem[] | string;
}

export interface ApiResult<T> { data: T; status: number; version?: number; serverId?: string }
export interface ReadOptions {
  query?: Record<string, string | number>;
  ifModifiedSince?: number;
  /** Discovery deliberately omits a cached server ID. */
  discover?: boolean;
}
export type NewZoteroObject = Record<string, unknown> & { itemType?: string; name?: string };

/** One interface shared by Local and Web API. No deletion or annotation-write operation. */
export interface ZoteroClient {
  readonly connection: "local" | "web";
  readonly serverId: string | undefined;
  read<T>(path: string, options?: ReadOptions): Promise<ApiResult<T>>;
  create(library: ZoteroLibrary, kind: "items" | "collections", objects: NewZoteroObject[], version: number): Promise<ApiResult<string[]>>;
  patchLinks(library: ZoteroLibrary, key: string, patch: { collections?: string[]; tags?: { tag: string; type?: number }[] }, version: number): Promise<ApiResult<null>>;
  download(path: string, maxBytes: number): Promise<Buffer>;
}

export class ZoteroError extends Error {
  constructor(public readonly state: ConnectionState, public readonly code: string, public readonly status?: number) {
    super(`Zotero ${code}`);
    this.name = "ZoteroError";
  }
}
export class ZoteroServerChangedError extends ZoteroError {
  constructor() { super("unreachable", "server-changed", 412); }
}
export class ZoteroConflictError extends ZoteroError {
  constructor(public readonly current: unknown) { super("ok", "version-conflict", 412); }
}

export function libraryPath(library: ZoteroLibrary): string {
  if (!/^\d+$/.test(library.libraryId)) throw new Error("Invalid Zotero library ID");
  return `${library.libraryType === "group" ? "groups" : "users"}/${library.libraryId}`;
}
export function itemKey(key: string): string {
  if (!/^[A-Z0-9]{8}$/.test(key)) throw new Error("Invalid Zotero item key");
  return key;
}

/** Version deliberately excluded: stable identity across incremental updates. */
export function zoteroRefKey(ref: Omit<ZoteroItemRef, "version">): string {
  return JSON.stringify([ref.connection, ref.serverId ?? "", ref.libraryType, ref.libraryId, ref.itemKey]);
}

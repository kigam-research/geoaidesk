/**
 * The record interface behind the shared hub (ADR docs/adr/2026-10-22-gaid-hub-server.md decision 3). Three stores implement
 * it: the local file store (`SharedHubStore`, development / single PC), the remote client of an institute GAID hub server
 * (`server/src/geo/hub-client/`) and the hub server's own SQLite store behind `/hub/v1`.
 *
 * Records keep the `gaid-hub-entry/v1` shape. A person acts as an `Actor`: on a hub server the account id and its display
 * name, in the local store the display name for both.
 */
import type { AuthoringInstall } from "../../../../web/src/geo/contracts/authoring.ts";
import type { HubComment, HubEntry, HubFolder } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { StoredEntry } from "./store.ts";

export interface Actor {
  /** Stable identity: account id on a hub server, the display name in the local store. */
  id: string;
  /** Display name shown with entries, revisions and comments. */
  name: string;
  /** A hub server administrator (removes any registered Workflow, restores removed ones). Never set in the local store. */
  admin?: boolean;
}

/** The local store's actor for an entered display name. */
export const displayNameActor = (name: string): Actor => ({ id: name, name });

/** Who an entry belongs to: the account id when the record has one, else (older/local records) the author name. */
export const entryOwnerId = (entry: Pick<HubEntry, "author" | "authorId">): string => entry.authorId ?? entry.author;
export const isEntryAuthor = (entry: Pick<HubEntry, "author" | "authorId">, actor: Actor | null): boolean =>
  actor !== null && entryOwnerId(entry) === actor.id;

export interface HubRecordStore {
  readonly kind: "local" | "remote" | "server";
  initialize(): Promise<void>;
  /** Process-local serialization per key (a remote store relies on the server's own checks across processes). */
  serial<T>(key: string, action: () => Promise<T>): Promise<T>;

  folders(): Promise<HubFolder[]>;
  addFolder(name: string, actor: Actor): Promise<HubFolder>;

  /** 404 AuthoringError when missing or removed; 409 when malformed. */
  read(id: string): Promise<StoredEntry>;
  find(id: string): Promise<StoredEntry | null>;
  /** Newest first (updatedAt desc, id asc); removed entries are left out. */
  list(): Promise<StoredEntry[]>;
  /**
   * Removes a registered Workflow from the hub (gaid-hub-versions decision 2): hidden from every list and read (404) until
   * restored; records, files, comments and stars are kept, copies installed in projects are untouched. The registrant or a
   * hub server administrator (403 otherwise); 409 when already removed. Further registrations and file uploads to a removed
   * entry are refused (409). Audited.
   */
  remove(id: string, actor: Actor, reason: string): Promise<void>;
  /** Removed entries `actor` may restore, each with `entry.removed`, latest removal first: an administrator all of them, in
   * the local store (no administrators) the registrant their own, anyone else none. */
  removed(actor: Actor | null): Promise<StoredEntry[]>;
  /** Puts a removed entry back as it was; 404 when it is not removed, 403 when `actor` may not restore it. Audited. */
  restore(id: string, actor: Actor): Promise<StoredEntry>;
  /**
   * Creates or replaces an entry record as `actor`. Stores other than the local one enforce: a new entry is owned by the
   * actor (author/authorId/registeredBy set from the actor); an existing one only by its author, who may append exactly the
   * next revision (earlier snapshots and revisions unchanged), change title/summary/tags/folder/cover/basedOn-less metadata
   * and `authoringProjectId`. `installs` in the given record are ignored outside the local store (see `recordInstall`).
   * Every file a snapshot names must already be stored.
   */
  write(record: StoredEntry, actor: Actor): Promise<void>;
  /** Records an install of the entry (by anyone who can read it; installs are not author-only). */
  recordInstall(id: string, install: AuthoringInstall, actor: Actor): Promise<void>;

  /** Bytes of an entry file (`packages/<rev>.tar.gz`, `visuals/<rev>/<sha>.<ext>`); 404 when missing. */
  bytes(id: string, file: string): Promise<Buffer>;
  /** Write-once: an identical retry succeeds, different bytes at the same path are refused (409). */
  immutableBytes(id: string, file: string, bytes: Buffer, actor: Actor): Promise<void>;

  comments(id: string): Promise<HubComment[]>;
  addComment(id: string, actor: Actor, body: string): Promise<HubComment>;
  /** Star holders keyed by actor id. */
  stars(id: string): Promise<Record<string, true>>;
  star(id: string, actor: Actor, on: boolean): Promise<{ stars: number; starredByMe: boolean }>;
}

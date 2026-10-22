/**
 * One Zotero status for the library header and the Zotero card, so both always say the same thing (IO-free).
 * A failed refresh outranks "connected": the card used to say 연결됨 while the last refresh had failed.
 */
import type { ZoteroLibraryState, ZoteroState } from "@/geo/contracts/library";

export type ZoteroConnection = ZoteroLibraryState["connection"];

export type ZoteroStatus =
  | { kind: "none" }
  | { kind: "failed"; connection: ZoteroConnection; state: Exclude<ZoteroState, "ok">; detail?: string; lastSyncAt?: string }
  | { kind: "synced"; connection: ZoteroConnection; at: string }
  | { kind: "not-synced"; connection: ZoteroConnection };

/** Web-key states the researcher fixes by saving another key. */
export const WEB_KEY_STATES: readonly ZoteroState[] = ["key-invalid", "no-library-access", "key-rejected", "library-not-found"];

export function zoteroStatus(libraries: readonly ZoteroLibraryState[]): ZoteroStatus {
  if (!libraries.length) return { kind: "none" };
  const broken = libraries.find((l) => l.state !== "ok");
  if (broken) {
    return {
      kind: "failed", connection: broken.connection, state: broken.state as Exclude<ZoteroState, "ok">,
      ...(broken.detail ? { detail: broken.detail } : {}), ...(broken.lastSyncAt ? { lastSyncAt: broken.lastSyncAt } : {}),
    };
  }
  const synced = libraries.filter((l) => l.lastSyncAt).sort((a, b) => a.lastSyncAt!.localeCompare(b.lastSyncAt!)).at(-1);
  if (synced) return { kind: "synced", connection: synced.connection, at: synced.lastSyncAt! };
  return { kind: "not-synced", connection: libraries[0].connection };
}

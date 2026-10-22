import { describe, expect, it } from "vitest";
import type { ZoteroLibraryState } from "@/geo/contracts/library";
import { zoteroStatus } from "./zotero-status";

const lib = (patch: Partial<ZoteroLibraryState>): ZoteroLibraryState => ({ connection: "web", libraryType: "user", libraryId: "1", name: "Me", follow: "all", libraryVersion: 0, state: "ok", ...patch });

describe("zoteroStatus (shared by the library header and the Zotero card)", () => {
  it("reports no connection, connected but not refreshed, and refreshed", () => {
    expect(zoteroStatus([])).toEqual({ kind: "none" });
    expect(zoteroStatus([lib({})])).toEqual({ kind: "not-synced", connection: "web" });
    expect(zoteroStatus([lib({ connection: "local", lastSyncAt: "2026-10-22T01:00:00Z" }), lib({ lastSyncAt: "2026-10-22T02:00:00Z" })]))
      .toEqual({ kind: "synced", connection: "web", at: "2026-10-22T02:00:00Z" });
  });

  it("puts a failed refresh above connected, with its cause, detail and last success (the review-app screen)", () => {
    const failed = lib({ state: "no-library-access", failedAt: "2026-10-22T03:00:00Z", detail: "web · access-denied · HTTP 403" });
    expect(zoteroStatus([failed])).toEqual({ kind: "failed", connection: "web", state: "no-library-access", detail: "web · access-denied · HTTP 403" });
    expect(zoteroStatus([lib({ connection: "local", lastSyncAt: "2026-10-22T01:00:00Z" }), { ...failed, lastSyncAt: "2026-10-21T01:00:00Z" }]))
      .toMatchObject({ kind: "failed", connection: "web", lastSyncAt: "2026-10-21T01:00:00Z" });
  });
});

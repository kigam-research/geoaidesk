/**
 * Institute GAID hub server, as the researcher's own GAID shows it (ADR docs/adr/2026-10-22-gaid-hub-server.md).
 * IO-free; the server side (server/src/geo/hub-client/) and the wire protocol to the hub server
 * (server/src/geo/hub-server/protocol.ts) import it.
 *
 * The browser never talks to the hub server: it calls its own GAID backend (`/geo/hub-server/*`, `/geo/library/sync`),
 * which holds the session token in its data directory and calls the hub server.
 */

export const HUB_SERVER_SCHEMA = "gaid-hub-server/v1";

export type HubRole = "member" | "admin";

export interface HubAccount {
  /** Stable account id (`acc-` + random); never changes. */
  id: string;
  email: string;
  displayName: string;
  role: HubRole;
  createdAt: string;
  /** Set when an admin disabled the account; a disabled account cannot log in and its sessions end. */
  disabledAt?: string;
}

/** Limits shared by the client checks and the server (server-side checks are authoritative). */
export const HUB_ACCOUNT_RULES = {
  displayName: { min: 1, max: 40 },
  email: { max: 254 },
  password: { min: 10, max: 200 },
  inviteDays: 7,
  sessionDays: 90,
} as const;

/** Connection state of this GAID. `url: null`: no hub server configured (the local hub store is used). */
export interface HubServerStatus {
  url: string | null;
  /** The address comes from `GAID_HUB_SERVER_URL` and cannot be changed in Settings. */
  fromEnv: boolean;
  account: HubAccount | null;
  /** Result of the last contact with the server (`GET /hub/v1/health` or an authenticated call). */
  reachable: boolean | null;
  /** Reason the server could not be used, for the Settings card ("연결하지 못했습니다" + this). */
  error?: string;
  /** Server identity, once reached. */
  server?: { name: string; version: string; serverId: string };
}

export interface HubServerConfigBody {
  /** `http://host:port` or `https://…`, no path; null removes the hub server (logs out). */
  url: string | null;
}

export interface HubLoginBody {
  email: string;
  password: string;
}

export interface HubAcceptInviteBody {
  code: string;
  displayName: string;
  password: string;
}

export interface HubUpdateMeBody {
  displayName?: string;
  password?: { current: string; next: string };
}

/** An invite as admins see it; `code` only in the response that created it (shown once). */
export interface HubInvite {
  id: string;
  email: string;
  role: HubRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  code?: string;
}

export interface HubInviteBody {
  email: string;
  role: HubRole;
}

export interface HubUpdateUserBody {
  role?: HubRole;
  disabled?: boolean;
}

/** Personal library sync state of this GAID for the logged-in account. */
export interface LibrarySyncStatus {
  /** False without a hub server account; the other fields are then empty. */
  available: boolean;
  running: boolean;
  lastSyncedAt?: string;
  /** Server library version seen by the last completed pull. */
  serverVersion?: number;
  /** Local objects changed since the last sync (items, folders, files). */
  pending: { items: number; folders: number; files: number };
  /** Local copies replaced by a newer server version, kept under the library's `sync/conflicts/`. */
  conflicts: number;
  lastError?: string;
}

export interface LibrarySyncResult {
  status: LibrarySyncStatus;
  pulled: { items: number; folders: number; files: number; deleted: number };
  pushed: { items: number; folders: number; files: number; deleted: number };
  conflicts: number;
}

// --- HTTP API of the researcher's GAID (not project-scoped) -----------------------------------------------------------
//
// GET    /geo/hub-server/status                     → HubServerStatus (contacts the server, bounded timeout)
// PUT    /geo/hub-server/config                     HubServerConfigBody → HubServerStatus (409 when fromEnv)
// POST   /geo/hub-server/login                      HubLoginBody → HubServerStatus (401 wrong email/password, 429)
// POST   /geo/hub-server/accept-invite              HubAcceptInviteBody → HubServerStatus (400/404/410 bad/used/expired)
// POST   /geo/hub-server/logout                     {} → HubServerStatus
// PATCH  /geo/hub-server/me                         HubUpdateMeBody → HubServerStatus
// GET    /geo/hub-server/admin/users                → { users: HubAccount[] }          (admin; 403 otherwise)
// PATCH  /geo/hub-server/admin/users/:id            HubUpdateUserBody → HubAccount   (admin; an admin cannot demote
//                                                                                     or disable the last admin: 409)
// GET    /geo/hub-server/admin/invites              → { invites: HubInvite[] }         (admin)
// POST   /geo/hub-server/admin/invites              HubInviteBody → HubInvite (with code) (admin)
// DELETE /geo/hub-server/admin/invites/:id          → 204                             (admin; unused invites only)
// GET    /geo/library/sync                          → LibrarySyncStatus
// POST   /geo/library/sync                          {} → LibrarySyncResult (409 while running; 401 when logged out)
//
// Errors: `{ error: string }` with a Korean sentence for the researcher; 502 `{ error }` when the hub server is unreachable.

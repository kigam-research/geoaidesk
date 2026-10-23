/**
 * Wire protocol between a researcher's GAID backend and the institute GAID hub server (`/hub/v1`, ADR
 * docs/adr/2026-10-22-gaid-hub-server.md). IO-free; the server (this folder) and the client (server/src/geo/hub-client/)
 * import it. JSON bodies unless noted; errors are `{ error: string }` (Korean sentence) with the status shown.
 *
 * Authentication: `Authorization: Bearer <session token>` on every route except health, login and invite acceptance.
 * Browser requests (any `Origin` or `Sec-Fetch-Site` header) are refused with 403 before routing.
 */
import type { AuthoringInstall } from "../../../../web/src/geo/contracts/authoring.ts";
import type { HubComment, HubFolder } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type {
  HubAccount,
  HubInvite,
  HubInviteBody,
  HubRole,
  HubUpdateMeBody,
  HubUpdateUserBody,
  HubOrcidLink,
  OrcidEnvironment,
} from "../../../../web/src/geo/contracts/hub-server.ts";
import type { StoredEntry } from "../hub-shared/store.ts";
import type { ReviewInput, StoredHubSkill } from "../hub-skills/records.ts";

export { HUB_SERVER_SCHEMA } from "../../../../web/src/geo/contracts/hub-server.ts";
export const HUB_API = "/hub/v1";

export interface HealthResponse {
  schema: "gaid-hub-server/v1";
  name: "gaid-hub-server";
  /** GAID product version (geo/distribution.json). */
  version: string;
  /** Random id fixed at the server's first start; a client notices a different server behind the same address. */
  serverId: string;
}

export interface SessionResponse {
  token: string;
  expiresAt: string;
  account: HubAccount;
}

// --- Accounts ----------------------------------------------------------------------------------------------------------
// GET    /hub/v1/health                              → HealthResponse (no auth)
// POST   /hub/v1/auth/login                          LoginRequest → SessionResponse   (401 wrong, 403 disabled, 429)
// POST   /hub/v1/auth/invites/accept                 AcceptInviteRequest → SessionResponse (404 unknown, 410 used/expired,
//                                                                                      409 email already has an account)
// POST   /hub/v1/auth/logout                         {} → 204 (ends this session)
// GET    /hub/v1/auth/me                             → { account: HubAccount }
// PATCH  /hub/v1/auth/me                             HubUpdateMeBody → { account }   (password change needs current: 403)
// GET    /hub/v1/admin/users                         → { users: HubAccount[] }        (admin)
// PATCH  /hub/v1/admin/users/:id                     HubUpdateUserBody → { account }  (admin; last admin stays: 409)
// GET    /hub/v1/admin/invites                       → { invites: HubInvite[] }       (admin; no codes)
// POST   /hub/v1/admin/invites                       HubInviteBody → { invite: HubInvite } (admin; code once)
// DELETE /hub/v1/admin/invites/:id                   → 204                            (admin; unused only, else 409)

export interface LoginRequest {
  email: string;
  password: string;
  /** Free label of the calling GAID (host name), shown in audit rows. */
  device?: string;
}
export interface AcceptInviteRequest {
  code: string;
  displayName: string;
  password: string;
  device?: string;
}
export type { HubAccount, HubInvite, HubInviteBody, HubRole, HubUpdateMeBody, HubUpdateUserBody };

// --- Authenticated ORCID iD (gaid-orcid phase 2, ADR docs/adr/2026-10-23-orcid-authenticated-link.md) ---------------
// GET    /hub/v1/orcid                               → OrcidHubStatus
// POST   /hub/v1/orcid/start                         {} → OrcidStartResponse   (409 no ORCID client on this hub)
// POST   /hub/v1/orcid/finish                        OrcidFinishRequest → { link: HubOrcidLink }
//                                                    (400 unknown state or another account's; 410 expired; 409 iD on another
//                                                    account; 502 ORCID refused the code or the ID token did not verify)
// DELETE /hub/v1/orcid                               → 204 (removes this account's iD)
// `HubAccount.orcid` and `StoredEntry.entry.authorOrcid` (the author's iD, joined at read time) carry the result.

export interface OrcidHubStatus {
  configured: boolean;
  environment?: OrcidEnvironment;
  link: HubOrcidLink | null;
}
export interface OrcidStartResponse {
  /** ORCID sign-in URL (client id, registered redirect URI, single-use state and nonce). */
  authorizeUrl: string;
  expiresAt: string;
}
export interface OrcidFinishRequest {
  code: string;
  state: string;
}
export type { HubOrcidLink, OrcidEnvironment };

// --- Hub records (HubRecordStore over HTTP) ----------------------------------------------------------------------------
// GET    /hub/v1/folders                             → { folders: HubFolder[] }
// POST   /hub/v1/folders                             { name } → HubFolder              (409 same name)
// GET    /hub/v1/entries                             → { entries: StoredEntry[] }       (newest first)
// GET    /hub/v1/entries/:id                         → StoredEntry                      (404)
// PUT    /hub/v1/entries/:id                         StoredEntry → StoredEntry (as stored; author fields from the
//                                                    account; 403 not the author; 409 revision rules or missing files)
// POST   /hub/v1/entries/:id/installs                { install: AuthoringInstall } → 204
// GET    /hub/v1/entries/:id/files/<path>            bytes (application/octet-stream)   (404)
// PUT    /hub/v1/entries/:id/files/<path>            raw bytes, header `X-Content-SHA256` → 204 (409 different bytes;
//                                                    403 entry owned by someone else; 413 over 20 MiB; 400 bad hash)
// GET    /hub/v1/entries/:id/comments                → { comments: HubComment[] }
// POST   /hub/v1/entries/:id/comments                { body } → HubComment
// GET    /hub/v1/entries/:id/stars                   → { stars: Record<accountId, true> }
// POST   /hub/v1/entries/:id/star                    { on: boolean } → { stars, starredByMe }
//
// `<path>` is the record-relative file name the local store uses (`packages/<rev>.tar.gz`, `visuals/<rev>/<sha>.<ext>`).

export const HUB_FILE_LIMIT = 20 * 1024 * 1024;
export interface EntriesResponse {
  entries: StoredEntry[];
}
export interface InstallRequest {
  install: AuthoringInstall;
}
export type { HubComment, HubFolder, StoredEntry };

// --- Hub skill shelf (HubSkillRecordStore over HTTP, server/src/geo/hub-skills/records.ts) ----------------------------
// GET    /hub/v1/skills                              → { skills: StoredHubSkill[] }    (visible to this account, newest first)
// GET    /hub/v1/skills/:id                          → StoredHubSkill                  (404 missing or not visible)
// PUT    /hub/v1/skills/:id                          StoredHubSkill → StoredHubSkill (as stored; author/registrant fields from
//                                                    the account; 403 not the author; 404 folder; 409 revision rules or
//                                                    archive missing / hash or size mismatch)
// GET    /hub/v1/skills/:id/revisions/:rev/archive   bytes (application/gzip)          (404 missing or not visible)
// PUT    /hub/v1/skills/:id/revisions/:rev/archive   raw bytes, header `X-Content-SHA256` → 204 (409 different bytes;
//                                                    403 skill owned or reserved by someone else; 413 over 20 MiB)
// POST   /hub/v1/skills/:id/revisions/:rev/reviews   ReviewInput → HubSkillRevision    (403 registrant marking `checked`;
//                                                    400 state/note/replacement; 404 revision not visible)
// GET    /hub/v1/skills/:id/comments                 → { comments: HubComment[] }      (`entryId` holds the skill id)
// POST   /hub/v1/skills/:id/comments                 { body } → HubComment             (403 latest revision not visible)
// GET    /hub/v1/skills/:id/stars                    → { stars: Record<accountId, true> }
// POST   /hub/v1/skills/:id/star                     { on: boolean } → { stars, starredByMe }
//
// `:id` is the skill name (`validName`). Review permissions go through one server check so a later reviewer role
// (gaid-hub-skills-2) can narrow who may mark `checked`/`deprecated`/`suspended` without changing the wire format.

export interface SkillsResponse {
  skills: StoredHubSkill[];
}
export type { ReviewInput, StoredHubSkill };

// --- Personal library sync -------------------------------------------------------------------------------------------
// GET    /hub/v1/library/changes?since=<n>           → LibraryChangesResponse (objects changed after version n, 0 = all)
// POST   /hub/v1/library/changes                     LibraryPushRequest → LibraryPushResponse
// HEAD   /hub/v1/library/files/:sha256               200 / 404
// GET    /hub/v1/library/files/:sha256               PDF bytes
// PUT    /hub/v1/library/files/:sha256               raw PDF bytes → 204 (400 hash mismatch or not a PDF; 413 over 64 MiB)
//
// Every route is scoped to the calling account; nobody, admins included, reads another account's library.

export type LibraryObjectKind = "item" | "folder";
export const LIBRARY_FILE_LIMIT = 64 * 1024 * 1024;

export interface LibraryObject {
  kind: LibraryObjectKind;
  /** `li-…` item id or `lc-`/`zc-` folder id. */
  id: string;
  /** Server version of this object (per-account counter value at its last change). */
  version: number;
  deleted: boolean;
  /** LibraryItem / LibraryCollection JSON; absent when deleted. */
  data?: unknown;
}
export interface LibraryChangesResponse {
  /** Current per-account library version; pass it as `since` next time. */
  version: number;
  changes: LibraryObject[];
}
export interface LibraryPushChange {
  kind: LibraryObjectKind;
  id: string;
  /** Version the client last saw for this object; 0 for an object the server has never had. */
  baseVersion: number;
  deleted: boolean;
  data?: unknown;
}
export interface LibraryPushRequest {
  changes: LibraryPushChange[];
}
export interface LibraryPushResponse {
  version: number;
  /** Accepted changes with their new versions. */
  applied: { kind: LibraryObjectKind; id: string; version: number }[];
  /** Refused because `baseVersion` is stale; the client pulls and retries. A pushed item must name only stored files. */
  conflicts: { kind: LibraryObjectKind; id: string; version: number; reason: "stale" | "missing-file" }[];
}

// --- Information feeds (gaid-hub-feeds, web/src/geo/contracts/hub-feeds.ts) ------------------------------------------
//   GET    /feeds?category=&field=&q=&limit=   → FeedListResponse (`connected: true`; approved sources only)
//   GET    /admin/feeds/sources                → FeedSourcesResponse (shipped proposals + additions, every state) [admin]
//   POST   /admin/feeds/sources                FeedSourceAddBody → 201 { source: FeedSource } (approved)      [admin]
//   PATCH  /admin/feeds/sources/:id            FeedSourceDecision → { source: FeedSource }                     [admin]
//   DELETE /admin/feeds/sources/:id            → 204; administrator additions only (shipped ones: 409)          [admin]
//   POST   /admin/feeds/fetch                  FeedFetchBody → FeedFetchResponse (collects now)                [admin]
// `serve` collects every approved source every FEED_LIMITS.intervalHours (GAID_HUB_FEEDS_INTERVAL_HOURS, 0 = off).
export type {
  FeedFetchBody,
  FeedFetchResponse,
  FeedListResponse,
  FeedSource,
  FeedSourceAddBody,
  FeedSourceDecision,
  FeedSourcesResponse,
} from "../../../../web/src/geo/contracts/hub-feeds.ts";

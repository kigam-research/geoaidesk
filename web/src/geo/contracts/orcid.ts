/**
 * ORCID link of the researcher's GAID (gaid-orcid, phase 1). IO-free; the server (`server/src/geo/orcid/`,
 * `server/src/geo/routes/orcid.ts`) and the library screens import it.
 *
 * Phase 1 reads only public ORCID data, anonymously (`https://pub.orcid.org/v3.0`). The iD is typed by the researcher
 * and is therefore unauthenticated: ORCID's display guidelines require the screen to say so
 * (https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/). Phase 2 adds an authenticated
 * link through OAuth (`authenticated: true`); until then the field is always false.
 *
 * Nothing is written to ORCID and nothing is polled: works are read only when the researcher asks
 * (ORCID Public API terms, https://info.orcid.org/public-client-terms-of-service/).
 */

import type { CslItem, MetadataOrigin, OwnWorkMark, UpdateSignal } from "./library.ts";
import type { HubOrcidLink, OrcidEnvironment } from "./hub-server.ts";

export type { HubOrcidLink, OrcidEnvironment };

export type { OwnWorkMark };

export const ORCID_SCHEMA = "gaid-orcid/v1";

/** `0000-0002-1825-0097` form: four groups of four, last character a digit or X (ISO 7064 11-2 check digit). */
export const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** ISO 7064 MOD 11-2 check of a hyphenated iD (`ORCID_ID_PATTERN`). */
export function orcidChecksumOk(id: string): boolean {
  if (!ORCID_ID_PATTERN.test(id)) return false;
  const digits = id.replace(/-/g, "");
  let total = 0;
  for (const ch of digits.slice(0, 15)) total = (total + Number(ch)) * 2;
  const result = (12 - (total % 11)) % 11;
  return digits[15] === (result === 10 ? "X" : String(result));
}

/**
 * Accepts an iD as researchers paste it (`https://orcid.org/…`, `orcid.org/…`, spaces, lower-case x, no hyphens) and
 * returns the canonical hyphenated form, or null when it is not a valid iD.
 */
export function normalizeOrcidId(input: string): string | null {
  const raw = input.trim().replace(/^https?:\/\/(www\.)?(sandbox\.)?orcid\.org\//i, "").replace(/^orcid\.org\//i, "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^\d{15}[\dX]$/.test(raw)) return null;
  const id = raw.match(/.{4}/g)!.join("-");
  return orcidChecksumOk(id) ? id : null;
}

/** The record page of an iD, the form ORCID asks integrations to display (sandbox iDs live on ORCID's test server). */
export const orcidUrl = (id: string, environment: OrcidEnvironment = "production") =>
  `https://${environment === "sandbox" ? "sandbox." : ""}orcid.org/${id}`;

/** The researcher's ORCID link, kept user-level next to the library (`<library>/orcid.json`, not synced). */
export interface OrcidProfile {
  schema: typeof ORCID_SCHEMA;
  orcid: string;
  /** True once the researcher proved the iD through ORCID sign-in via the hub server (phase 2); typed iDs are false. */
  authenticated: boolean;
  /** Environment of an authenticated iD (sandbox only in tests); typed iDs are production. */
  environment?: OrcidEnvironment;
  authenticatedAt?: string;
  /** Public name on the record when it was linked (credit name, else given + family); may be absent (private). */
  name?: string;
  linkedAt: string;
  /** Last time the researcher read their works (a preview), and last time they added or marked any. */
  lastReadAt?: string;
  lastImportAt?: string;
}

/** `PUT /geo/orcid` body. */
export interface OrcidLinkBody {
  orcid: string;
}

export interface OrcidStatus {
  profile: OrcidProfile | null;
  /** Items marked as the researcher's own works (`LibraryItem.ownWork`) for this iD. */
  ownWorks: number;
  /** Whether "ORCID로 본인 확인" is possible here (needs a hub server account and an ORCID client on that hub). */
  hub: OrcidHubState;
}

/**
 * `no-account`: no hub server or not logged in. `unreachable`: the hub did not answer. `not-configured`: the hub has no
 * ORCID client. `ready`: authentication can start. `linked`: the hub account has an authenticated iD.
 */
export type OrcidHubState =
  | { state: "no-account" }
  | { state: "unreachable" }
  | { state: "not-configured" }
  | { state: "ready"; environment: OrcidEnvironment }
  | { state: "linked"; environment: OrcidEnvironment; link: HubOrcidLink };

/** `POST /geo/orcid/auth/start`: open this URL in a new browser tab (ORCID sign-in). */
export interface OrcidAuthStart {
  authorizeUrl: string;
  expiresAt: string;
}

/** Where a work already is in the library, decided by DOI first, else by title + year (never merged automatically). */
export type OrcidWorkMatch =
  | { kind: "new" }
  /** Same DOI: the library item is the same paper. Confirming marks it as an own work; no second item is made. */
  | { kind: "in-library"; itemId: string; title: string; ownWork: boolean }
  /** Similar title and same year but no shared DOI: shown so the researcher decides; confirming adds a new item. */
  | { kind: "similar"; itemId: string; title: string };

/** One work group of the ORCID record (ORCID groups the same work added by several sources). */
export interface OrcidWork {
  /** `put-code` of the preferred summary (ORCID's display-index); used to read details and to record provenance. */
  putCode: number;
  title: string;
  /** Journal or other container, when the record has one. */
  container?: string;
  year?: number;
  /** ORCID work type (`journal-article`, `conference-paper`, `report`, …). */
  type: string;
  /** Normalized DOI of the group (`self` relationship), when there is one. */
  doi?: string;
  /** Who added the work to the record (ORCID source names, e.g. "Crossref", "Scopus - Elsevier", the researcher). */
  sources: string[];
  match: OrcidWorkMatch;
}

/** `POST /geo/orcid/works` (preview; nothing is stored, metadata is not looked up yet). */
export interface OrcidWorksPreview {
  orcid: string;
  /** Record name at read time (may differ from the profile's when the researcher changed it on ORCID). */
  name?: string;
  works: OrcidWork[];
  /** Work groups the record has beyond `ORCID_LIMITS.works` (not shown). */
  omitted: number;
  readAt: string;
}

/** `POST /geo/orcid/works/confirm` body: the works the researcher kept, by put-code from the preview. */
export interface OrcidConfirmBody {
  putCodes: number[];
  /** Optional GAID folder the new items go into. */
  collectionId?: string;
}

/** Outcome of one confirmed work. */
export type OrcidConfirmOutcome =
  | { putCode: number; kind: "added"; itemId: string; metadataOrigin: MetadataOrigin }
  | { putCode: number; kind: "marked"; itemId: string }
  | { putCode: number; kind: "failed"; reason: "not-found" | "library-full" | "invalid" };

export interface OrcidConfirmResult {
  outcomes: OrcidConfirmOutcome[];
  added: number;
  marked: number;
  failed: number;
  /** DOIs whose Crossref/OpenAlex lookup failed; those items were filled from the ORCID record instead. */
  lookupFailed: number;
}

/** Bounds of one preview / confirm. */
export const ORCID_LIMITS = {
  /** Work groups shown in one preview. */
  works: 500,
  /** Works confirmed in one request. */
  confirm: 200,
  /** ORCID's bulk work read takes at most 100 put-codes. */
  bulk: 100,
} as const;

/** A candidate's metadata as it will be stored (server-side helper result; exported for tests and the screen). */
export interface OrcidItemDraft {
  csl: CslItem;
  metadataOrigin: MetadataOrigin;
  signals: UpdateSignal[];
}

// --- HTTP API of the researcher's GAID (user-level, not project-scoped) ----------------------------------------------
//
// GET    /geo/orcid                 → OrcidStatus
// PUT    /geo/orcid                 OrcidLinkBody → OrcidStatus   (400 invalid iD; 404 no such public record;
//                                                                 502 ORCID unreachable)
// DELETE /geo/orcid                 → OrcidStatus                 (unlinks locally; items keep their ownWork mark;
//                                                                 an authenticated hub link stays until /auth DELETE)
// POST   /geo/orcid/auth/start      {} → OrcidAuthStart            (409 no hub account / not configured; 502 hub down)
// GET    /geo/orcid/callback        ?code&state | ?error           (ORCID redirect target; HTML result page)
// DELETE /geo/orcid/auth            → OrcidStatus                  (removes the authenticated iD from the hub account)
// POST   /geo/orcid/works           {} → OrcidWorksPreview        (409 no iD linked; 502 ORCID unreachable)
// POST   /geo/orcid/works/confirm   OrcidConfirmBody → OrcidConfirmResult
//                                   (409 no iD linked; unknown put-codes fail with reason not-found)
//
// Errors: `{ error: string }`; the screen words them from the status code.

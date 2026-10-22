/**
 * The record interface behind the hub skill shelf (gaid-hub-server-trial; same pattern as `HubRecordStore` for Workflows,
 * ADR docs/adr/2026-10-22-gaid-hub-server.md). Three stores implement it: the local file store (`HubSkillStore`, one PC),
 * the remote client of an institute GAID hub server (`server/src/geo/hub-client/remote-skills.ts`) and the hub server's own
 * SQLite store behind `/hub/v1/skills` (`server/src/geo/hub-server/skills.ts`).
 *
 * IO-free and free of workspace imports: the hub server imports this file. A person acts as an `Actor` (account id + display
 * name on a hub server, the display name for both in the local store); ownership compares ids, never display names.
 */
import type { HubComment } from "../../../../web/src/geo/contracts/hub-shared.ts";
import type { HubSkill, HubSkillLicence, HubSkillReview, HubSkillReviewState, HubSkillRevision, ReviewBody } from "../../../../web/src/geo/contracts/hub-skills.ts";
import type { Actor, HubRecordStore } from "../hub-shared/records.ts";

/** What a store keeps: the view without the computed fields. */
export type StoredHubSkill = Omit<HubSkill, "usedBy" | "stars" | "starredByMe" | "comments" | "mine">;

/** Skill ids are skill names: lowercase letters, digits and single hyphens, at most 64 characters. */
export const validName = (s: unknown): s is string => typeof s === "string" && s.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
export const revisionState = (r: Pick<HubSkillRevision, "reviews">): HubSkillReviewState => r.reviews.at(-1)?.state ?? "unreviewed";
/** Only `institute` and `declared` revisions are visible to researchers other than the skill's author. */
export const shareable = (licence: HubSkillLicence) => licence.state === "institute" || licence.state === "declared";

/** Who a skill belongs to: the account id when the record has one, else (older/local records) the author name. */
export const skillOwnerId = (skill: Pick<StoredHubSkill, "author" | "authorId">): string => skill.authorId ?? skill.author;
export const revisionRegistrantId = (r: Pick<HubSkillRevision, "registeredBy" | "registeredById">): string => r.registeredById ?? r.registeredBy;
export const isSkillAuthor = (skill: Pick<StoredHubSkill, "author" | "authorId">, actorId: string | null | undefined): boolean =>
  !!actorId && skillOwnerId(skill) === actorId;

/**
 * The record as `actorId` may see it, or null. Visibility applies per revision: a later licence must not expose earlier
 * restricted files. The author sees every revision.
 */
export function visibleSkill(skill: StoredHubSkill, actorId?: string | null): StoredHubSkill | null {
  const author = isSkillAuthor(skill, actorId);
  const latest = skill.revisions.find((r) => r.revision === skill.latestRevision);
  if (!latest || (!author && !shareable(latest.licence))) return null;
  const revisions = skill.revisions.filter((r) => author || shareable(r.licence));
  if (!revisions.length) return null;
  const shown = revisions.at(-1)!;
  return { ...skill, revisions, latestRevision: shown.revision, description: shown.description, state: revisionState(shown), visibility: shareable(shown.licence) ? "hub" : "author" };
}

/** Review fields a caller supplies; the store adds who, when and whether the name is an authenticated account. */
export type ReviewInput = Pick<HubSkillReview, "state" | "note" | "replacement">;
export type { ReviewBody };

export interface HubSkillRecordStore {
  readonly kind: "local" | "remote" | "server";
  /** The Workflow record store of the same hub (usedBy, registering from a Workflow). */
  readonly shared: HubRecordStore;
  initialize(): Promise<void>;
  /** Process-local serialization per key (a remote store relies on the server's own checks across processes). */
  serial<T>(key: string, action: () => Promise<T>): Promise<T>;

  /**
   * 404 when missing. Stores other than the local one return only what the calling account may see (`visibleSkill`), so a
   * skill whose latest revision is not shareable is 404 for everyone but its author.
   */
  read(id: string): Promise<StoredHubSkill>;
  find(id: string): Promise<StoredHubSkill | null>;
  /** Newest first (updatedAt desc, id asc), visibility as for `read`. */
  list(): Promise<StoredHubSkill[]>;

  /** Archive bytes of one revision (404 when missing or not visible). Callers verify size, hash and tree. */
  archive(id: string, revision: number): Promise<Buffer>;
  /**
   * Stores a revision archive before its record is written. Write-once: an identical retry succeeds, different bytes are
   * refused (409). Only the skill's author may upload for an existing skill; for a new id the first uploader reserves it
   * until the record exists (403 for others).
   */
  publish(id: string, revision: number, bytes: Buffer, actor: Actor): Promise<void>;
  /**
   * Creates a skill (revision 1) or appends exactly the next revision, as `actor`. Stores other than the local one enforce:
   * a new skill is owned by the actor (`author`/`authorId`, the revision's `registeredBy`/`registeredById`/`registeredAt`
   * set from the actor and the server clock); an existing one only by its author; earlier revisions are kept as stored
   * (their reviews included, whatever the request says); the new revision has no reviews; the archive with the declared
   * `archiveSha256` and `size` must already be stored; `folderId` must exist; `state` and `visibility` follow the latest
   * revision. Metadata (tags, formats, folderId, description) may change only together with a new revision.
   */
  write(skill: StoredHubSkill, actor: Actor): Promise<void>;
  /**
   * Appends a review to one revision and returns that revision. Anyone who can see the revision may review it, except that
   * the revision's registrant cannot mark it `checked` (403). `replacement` only with `deprecated`, naming another existing
   * skill. On a hub server the review carries the account (`byId`, `verified: true`).
   */
  review(id: string, revision: number, review: ReviewInput, actor: Actor): Promise<HubSkillRevision>;

  comments(id: string): Promise<HubComment[]>;
  /** Binds to the latest revision; 403 when the latest revision is not visible to the actor. */
  addComment(id: string, actor: Actor, body: string): Promise<HubComment>;
  /** Star holders keyed by actor id. */
  stars(id: string): Promise<Record<string, true>>;
  star(id: string, actor: Actor, on: boolean): Promise<{ stars: number; starredByMe: boolean }>;
}

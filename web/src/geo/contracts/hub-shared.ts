/**
 * Shared GAID hub contract (task gaid-hub, mockups approved 2026-10-16): the GAID hub runs on the institute's GAID
 * server; researchers register methods built in the hub, browse them in topic folders, star them and comment on them,
 * and bring them into their own research projects ("내 연구") to use or try. Personal GAID projects are the research
 * space; the hub is the sharing and discussion space.
 *
 * Identity (ADR docs/adr/2026-10-22-gaid-hub-server.md): with an institute GAID hub server configured, the researcher's
 * account (logged in through their own GAID, `web/src/geo/contracts/hub-server.ts`); without one, the local store and the
 * display name entered once (header `X-GAID-User`, URL-encoded UTF-8). Server side: server/src/geo/hub-shared/ imports
 * this IO-free file.
 */
import type { WorkflowDoc } from "./workflow-doc";
import type { DraftProfile, MethodText } from "./authoring";

export const HUB_USER_HEADER = "X-GAID-User";

export interface HubFolder {
  id: string;
  name: string;
  /** Who created it (folders are shared topic categories). */
  createdBy: string;
  createdAt: string;
}

export interface HubEntryRevision {
  revision: number;
  /** Authoring project and draft revision it came from (on this server). */
  authoringProjectId: string;
  draftRevision: number;
  packageRevision: number;
  packageSha256: string;
  packageDigest: string;
  registeredAt: string;
  /** Display name of who registered it. */
  registeredBy: string;
  /** Account id of who registered it (hub server records only). */
  registeredById?: string;
  /** The author's note to other researchers for this revision. */
  note: string;
}

/** A method registered in the hub (one per authoring project). */
export interface HubEntry {
  id: string;
  methodId: string;
  slug: string;
  title: string;
  /** One-line description from the registered draft (older servers may omit it). */
  tagline?: string;
  summary: string;
  kind: "skill" | "workflow";
  /** Code availability in the latest registered snapshot, not execution or review status. */
  implementation: "descriptive" | "implemented";
  /** The latest registered snapshot carries a Workflow with 레시피 defaults (start settings); older servers omit it. */
  recipe?: boolean;
  tags: string[];
  /** Display name of the author. */
  author: string;
  /** Account id of the author (hub server records); ownership uses it when present, else `author`. */
  authorId?: string;
  /** The requesting researcher is the author (edit vs. copy, "내 Workflow"). Older servers omit it. */
  mine?: boolean;
  /** The author account's authenticated ORCID iD at read time (institute hub server only; gaid-orcid phase 2). */
  authorOrcid?: { id: string; environment: "production" | "sandbox" };
  /** The registered method this one was copied from ("복사해서 고치기"). */
  basedOn?: { entryId: string; revision: number; title: string; author: string };
  folderId: string;
  /** Cover image URL (`/geo/hub/entries/:id/cover`), when the draft has one. */
  cover: string | null;
  /** The cover has a dark-mode picture (`?theme=dark`) and sits on the picture-well colour; absent: older white picture. */
  coverThemed?: boolean;
  latestRevision: number;
  revisions: HubEntryRevision[];
  stars: number;
  starredByMe: boolean;
  comments: number;
  /** Chats started from this entry's registered packages, not completed analyses or reviews. */
  trials: number;
  updatedAt: string;
}

export interface HubComment {
  id: string;
  entryId: string;
  /** Display name. */
  author: string;
  /** Account id (hub server records only). */
  authorId?: string;
  body: string;
  /** Entry revision the comment was written on. */
  revision: number;
  at: string;
}

/** A registered concept picture; `themed`: a dark-mode picture is served with `?theme=dark`. */
export interface HubPicture {
  src: string;
  caption: string;
  themed?: boolean;
}

/** What the shared page shows: the entry, its method (flow and IO from the registered draft), comments. */
export interface HubEntryDetail {
  entry: HubEntry;
  profile: DraftProfile;
  /** Concept images per procedure node id (URLs), when the draft has them. */
  visuals: Record<string, HubPicture>;
  outputImages: Record<string, HubPicture>;
  workflowTitle: MethodText | null;
  /** The Workflow 지침 the agent receives (gaid-workflow-model); null for an entry without a Workflow. */
  workflowDoc: WorkflowDoc | null;
  comments: HubComment[];
}

/** A card of the "추천 Workflow" row: a catalogue Workflow or a registered entry with many stars. */
export interface HubRecommendation {
  id: string;
  source: "catalogue" | "shared";
  title: string;
  line: string;
  /** Cover image URL or null. */
  image: string | null;
  /** The cover image has a dark-mode picture (see `HubEntry.coverThemed`). */
  imageThemed?: boolean;
  stars: number;
  author?: string;
  /** `shared`: hub entry id; `catalogue`: catalogue workflow id. */
  ref: string;
}

// --- HTTP API (`/geo/hub`, not project-scoped). With a hub server the researcher's own GAID answers these routes for
// the logged-in account (X-GAID-User is ignored); without one the user name comes from X-GAID-User. -------------
//
// GET    /geo/hub/me                                   → HubMe
// GET    /geo/hub/folders                              → { folders: (HubFolder & { entries: number })[] }
// POST   /geo/hub/folders                              { name } → HubFolder
// GET    /geo/hub/entries?folder=&q=                   → { entries: HubEntry[] }
// GET    /geo/hub/entries/:id                          → HubEntryDetail
// POST   /geo/hub/entries                              RegisterBody → HubEntry (409 when the draft fails checks)
// POST   /geo/hub/entries/:id/star                     { on: boolean } → { stars, starredByMe }
// GET    /geo/hub/entries/:id/comments                 → { comments: HubComment[] }
// POST   /geo/hub/entries/:id/comments                 { body } → HubComment
// GET    /geo/hub/entries/:id/cover                    image bytes (?theme=dark: the dark picture when there is one)
// GET    /geo/hub/entries/:id/package.tar.gz           latest package bytes (?revision=n)
// POST   /geo/hub/entries/:id/edit                     {} → EditEntryResult (author: edit; others: own copy)
// POST   /geo/hub/entries/:id/install                  SharedInstallBody → InstallResult (authoring.ts)
// GET    /geo/hub/recommended                          → { cards: HubRecommendation[] } (3-4 cards)

/** Who the hub sees: `account: true` when a hub server account is logged in (no display-name prompt then). */
export interface HubMe {
  name: string | null;
  account?: boolean;
}

/** Install a registered method; `revision` pins the revision the researcher looked at (default: latest). */
export interface SharedInstallBody {
  projectId: string;
  acknowledged: true;
  revision?: number;
}

export interface RegisterBody {
  authoringProjectId: string;
  /** Draft revision to register; default the latest. Packaged (once per draft revision) if needed. */
  draftRevision?: number;
  folderId: string;
  note: string;
}

/**
 * "방법 고치기" / "복사해서 고치기": the draft to open. The registering author (same account, or same display name without
 * a hub server) edits the entry: its
 * linked draft, or a draft seeded from the latest registered revision when that draft is not on this server; registering
 * it adds the next revision. Anyone else gets their own copy (reused on a repeat), registered as a separate entry with
 * `basedOn`. Without a hub server display names are not accounts: the latest revision stays with whoever registered the
 * method first.
 */
export interface EditEntryResult {
  authoringProjectId: string;
  mode: "edit" | "copy";
  /** A new draft was made now (false: an existing draft was reopened). */
  created: boolean;
}

/**
 * Hub-managed skills (gaid-hub-skills, ADR docs/adr/2026-10-22-hub-managed-skills.md; user decisions 2026-10-22: all three
 * recommended options). The GAID hub keeps a skill shelf next to its Workflows: each skill has immutable revisions
 * stored as one archive per revision (shown as "version N"; integers, unlike Workflow versions), with origin, licence, automatic findings and a per-revision review state. Workflows
 * pin a skill revision (`skills[].source: "hub"` in gaid-workflow/v1, see `HubSkillRef`); a new revision never changes a
 * Workflow that pinned an older one. Researchers install a revision into a project through the existing preview and
 * acknowledgement gate; installs never fetch GitHub.
 *
 * Identity follows the shared hub (gaid-hub-server-trial): with an institute hub server the researcher's account (reviews
 * carry `byId` and `verified: true`), otherwise the local store's display name (`X-GAID-User`, see hub-shared.ts) with
 * `verified: false`, which the UI shows as an unverified name. IO-free; the server imports this file.
 */
import type { HubComment } from "./hub-shared";

/** Archive: a gzip tar with exactly one root folder `<name>/` holding SKILL.md, i.e. the skill folder as installed. */
export const HUB_SKILL_SCHEMA = "gaid-hub-skill/v1";

/**
 * Where a revision came from. The origin stays external after the hub keeps a copy: a GitHub skill mirrored in the hub
 * is still `github`.
 * - `own`: written by a researcher (registered from a project skill with no recorded external source)
 * - `workflow`: taken out of a registered hub Workflow's bundled skill
 * - `github`: fetched from GitHub or another source the `skills` CLI reads (owner/repo, Git URL), directly or through
 *   a project skill installed from that source
 */
export interface HubSkillOrigin {
  kind: "own" | "workflow" | "github";
  /** `version`: the Workflow's registered version (gaid-hub-versions); older origins omit it (`hubRefVersion`). */
  workflow?: { entryId: string; revision: number; version?: string; title: string };
  /** `github`: the source as given (`owner/repo`, Git URL), the requested ref and skill path, the resolved commit when known. */
  source?: string;
  ref?: string;
  commit?: string;
  path?: string;
  /** When the bytes were fetched from the external source (not when they were registered). */
  fetchedAt?: string;
}

/**
 * Licence as found in the files, not a legal opinion.
 * - `institute`: own or Workflow origin; written inside the institute, no external licence applies
 * - `declared`: an SPDX id from the known list (SKILL.md `license:` or a LICENSE file)
 * - `restricted`: text that forbids copying or redistribution (e.g. "All rights reserved", "proprietary")
 * - `unknown`: nothing found or not recognised
 * Only `institute` and `declared` revisions are visible to other researchers; others stay visible to their registrant.
 */
export interface HubSkillLicence {
  state: "institute" | "declared" | "restricted" | "unknown";
  spdx?: string;
  /** Where it was read (`SKILL.md`, `LICENSE`, `LICENSE.txt` …), and up to 200 characters of what it says. */
  file?: string;
  excerpt?: string;
}

/**
 * An automatic finding that points a reviewer at something to read; never a safety verdict. `format`: SKILL.md problems;
 * `hidden-text`: HTML comments, invisible/bidi Unicode or long blank runs in Markdown; the others: matching code or
 * instructions in any file (network access, shell or process execution, package installation, credential or key paths,
 * writes outside the working folder).
 */
export interface HubSkillFinding {
  kind: "format" | "hidden-text" | "network" | "shell" | "package-install" | "credentials" | "outside-write";
  file: string;
  line?: number;
  /** Up to 160 characters of the matching line, with invisible characters shown as `<U+XXXX>`. */
  excerpt: string;
}

/**
 * Review state of one revision. Absent review = `unreviewed`.
 * - `checked`: someone other than the registrant read it (what they looked at is in `note`)
 * - `deprecated`: do not adopt in new Workflows; pinned Workflows keep working; `replacement` names the skill to use
 * - `suspended`: new installs of this revision are refused and Workflows pinning it show a blocking warning
 */
export type HubSkillReviewState = "unreviewed" | "checked" | "deprecated" | "suspended";

export interface HubSkillReview {
  state: Exclude<HubSkillReviewState, "unreviewed">;
  /** Display name of the reviewer. */
  by: string;
  /** Account id on a hub server; the display name in the local store (absent in older records). */
  byId?: string;
  /** True only when `by` is an authenticated hub server account; local display names are not verified. */
  verified: boolean;
  at: string;
  note: string;
  replacement?: string;
}

export interface HubSkillFile {
  path: string;
  sha256: string;
  size: number;
}

export interface HubSkillRevision {
  revision: number;
  /** SHA-256 and byte size of the stored archive. */
  archiveSha256: string;
  size: number;
  /** `hashDirectory` (kady-skill-tree-v1) of the skill folder: the value installs record as base hash. */
  treeHash: string;
  files: HubSkillFile[];
  /** SKILL.md `description` at this revision. */
  description: string;
  /** The registrant's note: what changed. */
  note: string;
  registeredAt: string;
  registeredBy: string;
  /** Account id of the registrant on a hub server (absent in local/older records: then `registeredBy` is the identity). */
  registeredById?: string;
  origin: HubSkillOrigin;
  licence: HubSkillLicence;
  findings: HubSkillFinding[];
  /** Review history, newest last; the last one is the current state. */
  reviews: HubSkillReview[];
}

export interface HubSkillUse {
  entryId: string;
  revision: number;
  /** That Workflow revision's registered version. */
  version: string;
  title: string;
  /** The skill revision that Workflow revision pins. */
  skillRevision: number;
}

/** A skill on the hub shelf. `id` equals `name`: skill names are unique across the hub and never a catalogue skill name. */
export interface HubSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Taxonomy format ids the skill reads (optional, from the registration form). */
  formats: string[];
  folderId: string;
  /** Display name of the registrant of revision 1; only this researcher adds revisions. */
  author: string;
  /** Account id of the author on a hub server (absent in local/older records: then `author` is the identity). */
  authorId?: string;
  /** View only: the calling researcher is the author. */
  mine?: boolean;
  latestRevision: number;
  /** Current review state of the latest revision. */
  state: HubSkillReviewState;
  /** `author`: the latest revision's licence is not shareable, so only the author sees it. */
  visibility: "hub" | "author";
  revisions: HubSkillRevision[];
  /** Registered Workflow revisions that pin a revision of this skill. */
  usedBy: HubSkillUse[];
  stars: number;
  starredByMe: boolean;
  comments: number;
  updatedAt: string;
}

export interface HubSkillDetail {
  skill: HubSkill;
  /** The revision shown (default latest). */
  revision: number;
  /** SKILL.md of that revision. */
  content: string;
  files: string[];
  comments: HubComment[];
}

/** How a Workflow (gaid-workflow/v1 `skills[]` row with `source: "hub"`) pins a hub skill. */
export interface HubSkillRef {
  skillId: string;
  revision: number;
  treeHash: string;
}

/** State of a pinned hub skill in a project, for Workflow readiness and the Settings → Skills row. */
export type HubSkillInstallState =
  | "installed" // same tree as the pinned revision
  | "missing"
  | "other-revision" // a different hub revision of the same skill is installed (unedited)
  | "edited" // installed from the hub, then changed in the project
  | "conflict" // a skill of the same name from somewhere else
  | "suspended"; // the pinned revision is suspended in the hub

/** Settings → Skills row annotation for a skill installed from the hub skill shelf (`GET /skills` `hubSkill`). */
export interface InstalledHubSkill {
  id: string;
  revision: number;
  latestRevision: number | null;
  edited: boolean;
  state: HubSkillReviewState;
}

// --- HTTP API (`/geo/hub/skills`, shared, not project-scoped; the hub server account when logged in, else X-GAID-User) ---
//
// GET    /geo/hub/skills?q=&folder=                    → { skills: HubSkill[] }   (author-only rows only for their author)
// GET    /geo/hub/skills/:id?revision=n                → HubSkillDetail
// GET    /geo/hub/skills/:id/file?revision=&path=      → text/plain (≤ 256 KiB, text files only; read-only view)
// GET    /geo/hub/skills/:id/package.tar.gz?revision=  archive bytes
// POST   /geo/hub/skills/preview                       RegisterSkillSource → RegisterSkillPreview (nothing stored)
// POST   /geo/hub/skills                               RegisterSkillBody → HubSkill (new skill or next revision)
// POST   /geo/hub/skills/:id/revisions/:rev/review     ReviewBody → HubSkillRevision
// POST   /geo/hub/skills/:id/star                      { on: boolean } → { stars, starredByMe }
// GET    /geo/hub/skills/:id/comments                  → { comments: HubComment[] }
// POST   /geo/hub/skills/:id/comments                  { body } → HubComment
// POST   /geo/hub/skills/:id/install-preview           { projectId, revision } → InstallSkillPreview
// POST   /geo/hub/skills/:id/install                   InstallSkillBody → InstallSkillResult

/** What to register. `source`: fetched with the bundled `skills` CLI into staging, never installed. */
export type RegisterSkillSource =
  | { from: "project"; projectId: string; name: string }
  | { from: "workflow"; entryId: string; revision: number }
  | { from: "source"; source: string; name?: string };

export interface RegisterSkillPreview {
  name: string;
  description: string;
  files: HubSkillFile[];
  treeHash: string;
  origin: HubSkillOrigin;
  licence: HubSkillLicence;
  findings: HubSkillFinding[];
  /** `source` with several skills: the names to choose from (preview again with `name`). */
  choices?: string[];
  /** A hub skill of this name exists: `next` = registering adds the next revision (same author); `taken` = refused. */
  existing?: { id: string; latestRevision: number; mode: "next" | "taken"; sameTree: boolean };
  /** Registration is refused (catalogue name, invalid SKILL.md, taken name, same tree as the latest revision). */
  blocked?: string;
}

export type RegisterSkillBody = RegisterSkillSource & {
  /** The tree previewed; registration refuses if the source changed since. */
  treeHash: string;
  note: string;
  folderId: string;
  tags?: string[];
  formats?: string[];
};

export interface ReviewBody {
  state: HubSkillReview["state"];
  note: string;
  replacement?: string;
}

export interface InstallSkillPreview {
  name: string;
  revision: number;
  files: string[];
  hasCode: boolean;
  licence: HubSkillLicence;
  findings: HubSkillFinding[];
  state: HubSkillReviewState;
  /** What installing does in this project. */
  project: HubSkillInstallState;
}

export interface InstallSkillBody {
  projectId: string;
  revision: number;
  acknowledged: true;
}

export interface InstallSkillResult {
  name: string;
  revision: number;
  /** false: the same tree was already installed, nothing written. */
  installed: boolean;
}

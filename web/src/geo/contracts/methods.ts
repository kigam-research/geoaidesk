/**
 * LocalMethod contracts (gaid-hub-integration; design docs/design/spatial-pu-pilot.md,
 * docs/design/hub-method-package.md). A hub-authored method package is a Pi skill
 * folder that may carry `gaid-method.json` (`gaid-method/v1`): the launch contract
 * (geo-workflow/v1-shaped workflows) and the lifecycle the hub recorded. GAID
 * installs it through the existing preview → acknowledgement → install gate and
 * lists it here as a LocalMethod; `geo-start/v1` recipes keep their meaning.
 *
 * Server side: server/src/geo/methods/ imports this IO-free file.
 */
import type { GeoWorkflowSummary, Localized } from "./workspace";

export const GAID_METHOD_SCHEMA = "gaid-method/v1";
export const GAID_METHOD_FILE = "gaid-method.json";
export const GAID_HUB_PACKAGE_SCHEMA = "gaid-hub-package/v1";
/** Prefix of a method's own skill in `workflows[].skillIds`. */
export const LOCAL_SKILL_PREFIX = "local:";

export type MethodLifecycle = "draft" | "submitted" | "published";
export type MethodImplementation = "descriptive" | "implemented";

export interface MethodSourceRef {
  kind: "doi" | "url" | "file";
  ref: string;
  title?: string;
  sha256?: string;
  documentKind?: string;
  pages?: string;
}

/** The hub's validation receipt (`checks`); a package is built only when nothing failed. */
export interface MethodHubChecks {
  checker: string;
  checkedAt: string;
  items: { id: string; status: "pass" | "warn"; detail?: string }[];
  warnings: { code: string; path: string; message: string }[];
}

/** 레시피 of a local method Workflow: an editable start setting, never run on open. */
export interface MethodRecipe {
  id: string;
  workflowId: string;
  title: Localized;
  choices: Record<string, string | number | boolean>;
  unresolvedChoices: string[];
}

/** What the hub recorded about authoring (counts and open questions, not the conversation). */
export interface MethodAuthoringRecord {
  hubUrl: string;
  projectId: string;
  draftRevision: number;
  decisions: number;
  openQuestions: { id: string; text: string }[];
  attempts: { route: string; model: string; at: string; outcome: string }[];
}

/** Where the installed package bytes came from. */
export interface MethodOrigin {
  /** `skill-hub`: fetched from a configured hub URL; `upload`: a `.tar.gz` the user chose; `gaid-hub`: built in this app's GAID hub; `other`: any other install. */
  kind: "skill-hub" | "upload" | "gaid-hub" | "gaid-hub-skill" | "other";
  packageSha256?: string;
  /** `gaid-hub-skill`: the hub skill revision installed (contracts/hub-skills.ts). */
  hubSkill?: { id: string; revision: number; treeHash: string };
  /** Shared-hub registration identity, independent of the draft/package revision. */
  hubEntry?: { id: string; revision: number };
  siteId?: string;
  pageUrl?: string;
  /** Hub descriptor (`gaid-hub-package/v1`) the package was fetched through, token removed. */
  descriptorUrl?: string;
  fetchedAt?: string;
}

export interface MethodIssue {
  subject: string;
  message: string;
}

/** A workflow of a local method, ready for the existing TaskSetup. `id` is the method-local workflow id. */
export interface LocalMethodWorkflow extends GeoWorkflowSummary {
  /** `method:<runtimeName>:<workflowId>`: the chat exposure and trial key. */
  exposure: string;
  /** GAID trial records of this Workflow (any revision) and the latest researcher assessment outcome. */
  trials: { count: number; lastOutcome: "useful" | "needs-revision" | "failed" | null };
  /** Packages the method declares that the Workflow's environment does not install (the agent installs them in the run). */
  extraPackages?: MethodExtraPackage[];
}

/** A Python distribution a method needs beyond its catalogue environment. */
export interface MethodExtraPackage {
  name: string;
  /** `false`: declared optional (used by an optional step). */
  required: boolean;
}

export interface LocalMethodSummary {
  /** App-owned identity: `<scope>:<runtimeName>`. */
  key: string;
  scope: "project" | "global";
  runtimeName: string;
  enabled: boolean;
  /** Hub identity and revision from `gaid-method.json` (null when the file is invalid). */
  methodId: string | null;
  revision: number | null;
  version: string | null;
  title: Localized;
  summary: Localized | null;
  /**
   * Effective lifecycle: the hub descriptor's value when the package was fetched
   * through one, otherwise `draft`. A package never promotes itself.
   */
  lifecycle: MethodLifecycle;
  /** What the package file claims, shown only when it differs. */
  lifecycleClaimed: MethodLifecycle | null;
  implementation: MethodImplementation | null;
  codeOrigin: "supplied" | "generated" | null;
  origin: MethodOrigin;
  /** The installed tree differs from what was installed (edited in GAID). */
  editedLocally: boolean;
  /** `kady-skill-tree-v1` hash of the installed folder: the trial's package revision. */
  treeHash: string;
  sources: MethodSourceRef[];
  hubChecks: MethodHubChecks | null;
  authoring: MethodAuthoringRecord | null;
  workflows: LocalMethodWorkflow[];
  recipes: MethodRecipe[];
  issues: MethodIssue[];
}

export interface LocalMethodsResponse {
  methods: LocalMethodSummary[];
}

// --- trials (ValidationAttempt) ---------------------------------------------

export interface MethodTrialFile {
  path: string;
  sha256?: string;
  size?: number;
}

export interface MethodTrialExpected {
  id: string;
  label: Localized;
  required: boolean;
  /** Declared file names and the session outputs that match them. */
  files: string[];
  found: string[];
  /** Outputs with a declared file name saved in another folder (no exact match); shown, counted as present. */
  foundElsewhere?: string[];
}

/**
 * One chat started from a local method workflow. The record is written when the
 * chat's session is created (its exposure names the method); observations are
 * derived from the session's provenance log when read, never from model prose.
 */
export interface MethodTrial {
  sessionId: string;
  methodKey: string;
  runtimeName: string;
  workflowId: string;
  methodId: string | null;
  revision: number | null;
  packageSha256: string | null;
  treeHash: string;
  startedAt: string;
  /** Tree hash now differs from the trial's: later edits are not covered by this trial. */
  methodChanged: boolean;
  observed: {
    toolCalls: number;
    failedToolCalls: number;
    models: string[];
    inputs: MethodTrialFile[];
    outputs: MethodTrialFile[];
    /** Steps whose file attribution is incomplete (opaque commands, scans skipped). */
    degradedSteps: number;
    lastStepAt: string | null;
  };
  expected: MethodTrialExpected[];
  /** Researcher's recorded assessment; absent until they write one. */
  assessment?: { outcome: "useful" | "needs-revision" | "failed"; note: string; recordedAt: string };
}

export interface MethodTrialsResponse {
  trials: MethodTrial[];
}

/**
 * GAID workspace contracts (WP07 gaid-korean-workspace): task catalogue with
 * readiness, file-aware task suggestions, `.geo-start.json` recipe checks,
 * the start-task hand-off and the geo-result reference card.
 *
 * Server side: server/src/geo/workspace/ (types.ts mirrors this file). The
 * workflow fields come from the pinned catalogue's `workflows.json`
 * (skill_hub geo-workflow/v1, docs/specs/gaid-interfaces.md §9); text stays
 * `{ko, en?}` and the UI picks the locale.
 */

export interface Localized {
  ko: string;
  en?: string;
}

// --- GET /geo/workflows -----------------------------------------------------

export interface WorkflowInputRole {
  id: string;
  label: Localized;
  /** Taxonomy format ids (`las-welllog`, `geotiff`, `csv`, …). */
  formats: string[];
  /** File extensions (lowercase, no dot) that the server maps to those formats. */
  extensions: string[];
  required: boolean;
  requiredWhen?: Localized;
}

export interface WorkflowChoice {
  /** The `.geo-start.json` choice key. */
  id: string;
  label: Localized;
  why?: Localized;
  options?: string[];
  requiredWhen?: Localized;
}

export interface WorkflowArtifact {
  id: string;
  label: Localized;
  required: boolean;
  requiredWhen?: Localized;
  files?: string[];
}

export interface WorkflowSkillState {
  /** Atlas id `publisher/slug`. */
  id: string;
  /** Runtime skill name; null when the pinned catalogue does not ship it. */
  runtimeName: string | null;
  title: Localized | null;
  /** A skill directory of that name exists in the project (enabled or disabled). */
  installed: boolean;
  /** Installed and not disabled, so a new chat can load it. */
  enabled: boolean;
}

export interface WorkflowEnvironmentState {
  id: string;
  title: Localized | null;
  /**
   * `ready`: every declared module imports in the project environment.
   * `missing`: at least one does not (`missing` lists them).
   * `unknown`: the probe could not run (`detail` says why).
   */
  state: "ready" | "missing" | "unknown";
  missing: string[];
  detail?: string;
}

/**
 * `ready` needs every skill enabled and the environment ready. A missing GAID
 * run record (`runRecord: "none"`) never blocks and is shown as 미시험, never as
 * verified (skill_hub gaid-product.md §4).
 */
export type WorkflowReadinessState = "ready" | "missing-skills" | "needs-environment" | "unavailable";

export interface WorkflowReadiness {
  state: WorkflowReadinessState;
  skills: WorkflowSkillState[];
  environment: WorkflowEnvironmentState;
  /** `recorded` when the workflow names an install-kind evidence record (`compatibilityRef`). */
  runRecord: "recorded" | "none";
  compatibilityRef: string | null;
}

export interface GeoWorkflowSummary {
  id: string;
  title: Localized;
  description: Localized | null;
  disciplines: string[];
  inputRoles: WorkflowInputRole[];
  requiredScientificChoices: WorkflowChoice[];
  /** Task prompt template; skill/environment binding is not in it. */
  prompt: Localized | null;
  /** Atlas ids, primary first: the workflow's exposure set. */
  skillIds: string[];
  environmentProfile: string;
  expectedArtifacts: WorkflowArtifact[];
  /** What the result does not claim. */
  boundary: Localized | null;
  exampleCaseIds: string[];
  readiness: WorkflowReadiness;
}

export interface GeoWorkflowsResponse {
  catalogue: {
    /** `ready` only when the pinned archive is verified and staged. */
    state: "ready" | "off" | "missing" | "invalid" | string;
    version: string | null;
    detail?: string;
  };
  workflows: GeoWorkflowSummary[];
}

// --- POST /geo/suggestions  { path } ---------------------------------------

export interface GeoSuggestion {
  workflowId: string;
  title: Localized;
  /** Input role the file matches and why. */
  match: { roleId: string; roleLabel: Localized; format: string; required: boolean };
  /** Scientific choices the user still has to make. */
  needs: Localized[];
  readiness: WorkflowReadiness;
}

export interface GeoSuggestionsResponse {
  path: string;
  /** Taxonomy format id detected for the file, or null when no workflow reads it. */
  format: string | null;
  /** At most three, ready ones first. */
  suggestions: GeoSuggestion[];
}

// --- POST /geo/recipes/check  { recipe } -----------------------------------

/** `geo-start/v1` (skill_hub schemas/geo-start.schema.json). */
export interface GeoStartRecipe {
  schemaVersion: "geo-start/v1";
  workflowId: string;
  catalogueVersion: string;
  skillIds: string[];
  exampleId?: string;
  choices: Record<string, unknown>;
  unresolvedChoices: string[];
}

export interface GeoRecipeIssue {
  /** e.g. `catalogue-version`, `unknown-workflow`, `unknown-skill`, `workflow-skill-missing`, `unknown-choice`,
   *  `choice-conflict`, `example-not-in-skills`, `schema`. */
  code: string;
  message: string;
}

export interface GeoRecipeCheckResponse {
  ok: boolean;
  issues: GeoRecipeIssue[];
  /** Present when `ok`: an editable task setup. Never executed by the check. */
  setup?: {
    workflowId: string;
    choices: Record<string, string>;
    unresolvedChoices: string[];
    skillIds: string[];
    exampleId: string | null;
  };
}

// --- Start-task hand-off (window event, handled by app/page.tsx) -------------

export type GeoExposureMode = "all" | "catalogue" | `workflow:${string}`;

export interface GeoStartTaskDetail {
  /** Tab title. */
  title: string;
  /** Composer draft for the new tab; never sent automatically. */
  text: string;
  /** Sandbox paths attached to the draft. */
  attachedFiles: string[];
  /** Skills pinned to the draft (`/skills` rows). */
  skills: { id: string; name: string; description: string }[];
  /** Exposure the chat's session is created with on its first send. */
  geoExposure: GeoExposureMode;
  /** Set synchronously by the workspace page while it handles the event. */
  result?: "opened" | "tab-limit";
}

export const GEO_START_TASK_EVENT = "gaid:start-task";

// --- geo-result reference (scientific_result kind "geo-result") -------------

export type GeoResultKind = "map-layer" | "depth-track" | "validation-curve";

export interface GeoResultReference {
  kind: "geo-result";
  title: string;
  /** Sandbox-relative `geo-result/v1` manifest (`*.geomap.json`, `*.depth.json`, …). */
  manifestPath: string;
  resultKind: GeoResultKind;
  /** Optional sandbox-relative PNG preview. */
  thumbnailPath?: string;
  summary?: string;
}

/**
 * GAID workspace contracts (WP07 gaid-korean-workspace): task catalogue with
 * readiness, file-aware task suggestions, `.geo-start.json` recipe checks,
 * the start-task hand-off and the geo-result reference card.
 *
 * Server side: server/src/geo/workspace/ imports this IO-free file. The
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
  /** Display labels of `options` (gaid-method/v1 packages); an option without one shows its id. */
  optionLabels?: Record<string, Localized>;
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
    /** `ready` only when the pinned archive is verified and staged; `error` carries `detail`. */
    state: "ready" | "off" | "error";
    version: string | null;
    detail?: string;
  };
  workflows: GeoWorkflowSummary[];
}

// --- POST /geo/suggestions  { path } ---------------------------------------

/**
 * Content evidence behind a suggestion, from the inspected columns or layers.
 * Catalogue workflows using generic formats (CSV, XLSX, JSON, Markdown, PNG)
 * are suggested only with one; installed methods use declared formats.
 */
export interface GeoSuggestionSignal {
  kind: "element-columns" | "time-drawdown-columns" | "xy-label-columns" | "categorical-field";
  /** Column or field names that matched (at most six). */
  columns: string[];
}

export interface GeoSuggestion {
  workflowId: string;
  /** Installed method identity; absent for catalogue suggestions. */
  exposure?: string;
  /** The matching installed Workflow, used directly by TaskSetup. */
  workflow?: GeoWorkflowSummary;
  title: Localized;
  /** Input role the file matches and why. */
  match: { roleId: string; roleLabel: Localized; format: string; required: boolean; signal?: GeoSuggestionSignal };
  /** Scientific choices the user still has to make. */
  needs: Localized[];
  readiness: WorkflowReadiness;
}

export interface GeoSuggestionsResponse {
  path: string;
  /** Taxonomy format id detected for the file, or null when no workflow reads it. */
  format: string | null;
  /** At most three, matching installed methods first, then readiness. */
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

/** The checks of skill_hub `checkGeoStart` (web/shared/atlas/byok-export.ts) plus schema and catalogue state. */
export type GeoRecipeIssueCode =
  | "schema"
  | "catalogue-off"
  | "catalogue-version"
  | "unknown-workflow"
  | "workflow-skill"
  | "unknown-choice"
  | "unknown-skill"
  | "unknown-example"
  | "choice-state";

export interface GeoRecipeIssue {
  code: GeoRecipeIssueCode;
  /** The offending value (skill id, choice key, version, schema path), for the UI message. */
  subject?: string;
  /** English technical detail; the UI shows its own catalogue message per code. */
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

// --- GET/POST /geo/recipes, DELETE /geo/recipes/:id ------------------------

/**
 * Saved recipes (gaid-workflow-catalog): checked `.geo-start.json` recipes the
 * user filed under a category of the workflow panel, per project in
 * `.kady/geo/recipes.json`. `geoscience` and the upstream workflow category
 * ids are built in; the user adds categories by label (`user-<n>` ids).
 */
export const GEO_RECIPE_CATEGORY = "geoscience";

export interface GeoRecipeCategory {
  id: string;
  label: string;
}

export interface GeoSavedRecipe {
  id: string;
  title: string;
  category: string;
  recipe: GeoStartRecipe;
  savedAt: string;
  /** Re-run against the current catalogue on every list; a stale recipe is kept and reported, not dropped. */
  check: GeoRecipeCheckResponse;
}

export interface GeoSavedRecipesResponse {
  /** User-added categories, in creation order. */
  categories: GeoRecipeCategory[];
  recipes: GeoSavedRecipe[];
}

/** POST /geo/recipes: `category` names an existing id, or `newCategory` adds one. */
export interface GeoSaveRecipeRequest {
  recipe: unknown;
  title: string;
  category?: string;
  newCategory?: string;
}

// --- Start-task hand-off (window event, handled by app/page.tsx) -------------

/** `method:<name>:<workflow>`: a chat started from a LocalMethod Workflow (gaid-hub-integration). */
export type GeoExposureMode = "all" | "catalogue" | `workflow:${string}` | `method:${string}`;

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

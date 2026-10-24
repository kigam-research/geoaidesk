/**
 * GAID hub authoring contract (task gaid-hub): a researcher turns sources (paper PDF,
 * code archive, notes, a GAID analysis bundle) into a skill and Workflow with a
 * coauthor agent, answers its questions, reviews the draft and tries it in a
 * project. Ported from skill_hub `web/shared/authoring/records.ts` (main 54fe477)
 * with GAID changes: the model runs through GAID's own runtime, questions carry a
 * recommended option id and short option hints, answers are submitted together,
 * and a package is installed through GAID's own install gate.
 *
 * Design: docs/design/source-authoring-agents.md, docs/design/spatial-pu-pilot.md.
 * Server side: server/src/geo/authoring/ imports this IO-free file. The application
 * owns these records; model output becomes a record only after server validation.
 */

// --- Atlas profile subset (skill_hub web/shared/atlas/types.ts, atlas-profile/v1) ---

import type { HubSkillInstallState } from "./hub-skills";
import type { GaidWorkflowStep, WorkflowDocSkill } from "./workflow-doc";
import type { WorkflowExampleFile, WorkflowInputExample } from "./workflow-examples";
export interface AtlasText {
  ko: string;
  en?: string;
}
/** Source YAML may write a bare string, which means `{ ko: <string> }`. */
export type AtlasTextInput = string | AtlasText;

export type SkillKind = "workflow" | "package-guide" | "data-access" | "reporting" | "foundation";
export type NodeType = "input" | "qa" | "analysis" | "decision" | "human-gate" | "output";
export type EdgeRelation = "next" | "alternative" | "feedback";
export type OutputKind =
  | "map-raster"
  | "map-vector"
  | "figure"
  | "table"
  | "report"
  | "model"
  | "document"
  | "dataset"
  | "log";

export interface ProfileTaxonomy {
  disciplines: string[];
  tasks: string[];
  methods?: string[];
  dataTypes?: string[];
  formats?: string[];
  scales?: string[];
  regions?: { applicability?: AtlasTextInput; examples?: string[] };
  keywords?: AtlasTextInput[];
}

export interface InputConstraints {
  crs?: string;
  verticalDatum?: string;
  depthConvention?: string;
  units?: string;
  columns?: string[];
  missingValues?: string;
  resolution?: string;
  time?: string;
}

export interface InputPort {
  id: string;
  label: AtlasTextInput;
  semanticType: string;
  formats: string[];
  required: boolean;
  requiredWhen?: AtlasTextInput;
  constraints?: InputConstraints;
  exampleRef?: string;
  description?: AtlasTextInput;
}

/** One step of the method; the draft screen draws `procedure` as the flow diagram. */
export interface ProcedureNode {
  id: string;
  code?: string;
  label: AtlasTextInput;
  type: NodeType;
  /** One or two plain sentences; shown under the step in the flow diagram. */
  summary: AtlasTextInput;
  inputs?: string[];
  outputs?: string[];
  reads?: string[];
  prompt?: AtlasTextInput;
  checks?: AtlasTextInput[];
  decisionIds?: string[];
  visual?: string;
}

export interface ProcedureEdge {
  from: string;
  to: string;
  relation: EdgeRelation;
  label?: AtlasTextInput;
}

/** Decision table row of the method (cue → alternatives → basis → verify). */
export interface AtlasDecisionRow {
  id: string;
  cue: AtlasTextInput;
  alternatives: AtlasTextInput[];
  choiceBasis: AtlasTextInput;
  verify: AtlasTextInput;
  exceptions?: AtlasTextInput;
}

/** A choice the researcher makes while running the method; `at` is the procedure node. */
export interface UserDecision {
  id: string;
  question: AtlasTextInput;
  at?: string;
  options?: AtlasTextInput[];
}

export interface OutputPort {
  id: string;
  label: AtlasTextInput;
  kind: OutputKind;
  formats?: string[];
  interpretation?: AtlasTextInput;
}

export interface Limitation {
  kind: "not-for" | "condition";
  text: AtlasTextInput;
  consequence?: AtlasTextInput;
  alternative?: AtlasTextInput;
}

export interface Dependency {
  name: string;
  version?: string;
  appliesTo?: string[];
  kind: "required" | "optional" | "runtime";
  purpose?: AtlasTextInput;
  verificationOrigin?: "upstream-declared" | "atlas-checked" | "author-declared";
}

/** The profile fields an authoring draft fills; the package builder adds the server-owned rest. */
export interface DraftProfile {
  title: AtlasTextInput;
  tagline: AtlasTextInput;
  summary: AtlasTextInput;
  kind: SkillKind;
  taxonomy: ProfileTaxonomy;
  inputs?: InputPort[];
  procedure: { nodes: ProcedureNode[]; edges: ProcedureEdge[] };
  decisions?: AtlasDecisionRow[];
  userDecisions?: UserDecision[];
  outputs: OutputPort[];
  limitations: Limitation[];
  dependencies?: Dependency[];
}

// --- gaid-method/v1 workflow and recipe as the draft carries them ------------

export interface MethodText {
  ko: string;
  en?: string;
}

/** geo-workflow/v1 with the gaid-method/v1 relaxations (skill_hub docs/specs/gaid-method-package.md §3). */
export interface LocalWorkflow {
  /** gaid-workflow/v1 adds `skills` and `steps` (gaid-workflow-model, ADR 2026-10-20-workflow-runtime-form). */
  schemaVersion: "geo-workflow/v1" | "gaid-workflow/v1";
  id: string;
  title: MethodText;
  description: MethodText;
  disciplines: string[];
  inputRoles: {
    id: string;
    label: MethodText;
    formats: string[];
    required: boolean;
    requiredWhen?: MethodText;
    /** The input takes several files (gaid-workflow-stages). */
    multiple?: boolean;
    /** Default example data; attached by the researcher, never by the coauthor model (gaid-workflow-example). */
    example?: DraftInputExample;
  }[];
  requiredScientificChoices: {
    id: string;
    label: MethodText;
    why: MethodText;
    options?: string[];
    /** Display labels of `options` (additive, gaid-method/v1). */
    optionLabels?: Record<string, MethodText>;
    requiredWhen?: MethodText;
    /** Value used unless the researcher changes it (option id or text); not counted as a required choice (gaid-workflow-stages). */
    default?: string;
  }[];
  /** The researcher's request to the agent (not a method description). */
  prompt: MethodText;
  /** First entry is `local:<slug>`; others are catalogue skill ids. */
  skillIds: string[];
  environmentProfile: string;
  expectedArtifacts: {
    id: string;
    label: MethodText;
    skill?: string;
    output?: string;
    files?: string[];
    required: boolean;
    requiredWhen?: MethodText;
  }[];
  boundary: MethodText;
  exampleCaseIds: string[];
  /** gaid-workflow/v1: every skill the Workflow uses, with its source. */
  skills?: WorkflowDocSkill[];
  /** gaid-workflow/v1: the procedure the Workflow 지침 lists (single written source). */
  steps?: GaidWorkflowStep[];
}

/**
 * A draft's example file: the package entry plus, for a bundled file, where its bytes are in the authoring store. The
 * package carries `WorkflowExampleFile` only (`from` is dropped when packaging).
 */
export interface DraftExampleFile extends WorkflowExampleFile {
  /** A data source file (`sources/<sourceId>/files/<sourcePath>`, unit C) or an upload kept at `examples/<sha256>`. */
  from?: { sourceId: string; sourcePath: string } | { upload: true };
}

export interface DraftInputExample extends Omit<WorkflowInputExample, "files"> {
  files: DraftExampleFile[];
}

export interface DraftRecipe {
  choices: Record<string, string | number | boolean>;
  unresolvedChoices: string[];
}

// --- records -----------------------------------------------------------------

export const AUTHORING_PROJECT_SCHEMA = "gaid-authoring-project/v1";

/**
 * `data`: data files (CSV, shapefile set, GeoTIFF, LAS …), one file or a set read together; `note`: a GAID research note
 * (index.md and its figures) from a project or from 서재.
 */
export type SourceKind = "pdf" | "code" | "text" | "gaid-analysis" | "web" | "data" | "note";
export type SourceStatus = "received" | "extracted" | "partial" | "failed";

/** A supplied file or fetched URL. Original bytes stay private and never enter a package. */
export interface SourceDocument {
  id: string;
  kind: SourceKind;
  name: string;
  mediaType: string;
  sha256: string;
  size: number;
  addedAt: string;
  status: SourceStatus;
  documentKind?: string;
  doi?: string;
  title?: string;
  url?: string;
  fetch?: { requestedUrl: string; finalUrl?: string; fetchedAt: string; status?: number; contentHash?: string };
  /** Added from 서재: the library item (a paper or a research note). */
  library?: { itemId: string; citationKey?: string; category: "paper" | "note" };
  /** A research note: its project and note folder; `snapshot` when read from the library copy, not the project file. */
  note?: { projectId: string; noteId: string; title?: string; snapshot?: boolean };
}

/**
 * Compact geo inspection of one data file (`geo-inspection/v1` from the shared dispatcher, server/src/geo/inspection.ts).
 * The coauthor reads this summary, never the file bytes.
 */
export interface DataFileSummary {
  format: string;
  family: string;
  /** Companion files read with this one (shapefile .shx/.dbf/.prj, world files). */
  companions?: string[];
  /** Declared CRS (authority or name), or "unknown". */
  crs?: string;
  /** Start of the declared WKT when the CRS has no authority code. */
  crsWkt?: string;
  bbox?: [number, number, number, number];
  coordinateSpace?: "crs" | "pixel" | "native";
  layers?: { name: string; geometryType?: string; featureCount?: number; fields?: string[] }[];
  bands?: { index: number; dtype?: string; nodata?: number | null; min?: number; max?: number; unit?: string; description?: string }[];
  dimensions?: { name: string; size: number; unit?: string }[];
  depth?: { basis: string; unit?: string; start?: number; stop?: number; step?: number };
  columns?: { name: string; type?: string; unit?: string; nullCount?: number }[];
  curves?: { mnemonic: string; unit?: string; description?: string; nullCount?: number }[];
  /** Data rows in the file when the inspector counted them. */
  rows?: number;
  /** `rows` is estimated from the first bytes of a large file. */
  rowsEstimated?: boolean;
  /** First rows (at most 5), as the inspector read them. */
  preview?: (string | number | null)[][];
  issues?: { code: string; severity: "info" | "warning" | "error"; message: string }[];
  inspector: string;
}

export interface ExtractedFigure {
  page: number;
  label: string;
  caption: string;
}

export interface CodeFileEntry {
  path: string;
  size: number;
  sha256: string;
  text: boolean;
  /** Geo data file: what the inspection dispatcher read from it. */
  data?: DataFileSummary;
  /** A companion file (e.g. `.dbf` of a shapefile): the primary file it belongs to. */
  companionOf?: string;
}

/** What the program actually read from a source. Pages without text stay listed as empty. */
export interface ExtractionRecord {
  sourceId: string;
  sourceSha256: string;
  tool: string;
  pages?: number;
  coveredPages: number[];
  emptyPages: number[];
  figures: ExtractedFigure[];
  files?: CodeFileEntry[];
  characters: number;
  error?: string;
  at: string;
}

/**
 * A pointer into a source. `verified`: the server found the quote on that page or in that file. Question and option
 * evidence may also carry `verified: false`: the coauthor cited the source but the server did not find the quote (or
 * the page/file does not exist, then `page`/`path` is absent); screens show it as unconfirmed, never as a passage.
 */
export interface Anchor {
  sourceId: string;
  page?: number;
  path?: string;
  quote: string;
  verified: boolean;
}

export type FindingKind =
  | "question"
  | "data"
  | "method"
  | "parameter"
  | "result"
  | "limitation"
  | "figure"
  | "code";

export interface GroundedFinding {
  id: string;
  kind: FindingKind;
  /** What the source states (Korean). */
  statement: string;
  /** The coauthor's interpretation, kept apart from the source statement. */
  interpretation?: string;
  anchors: Anchor[];
  attemptId: string;
  sourceRevision: number;
}

export interface QuestionOption {
  /** kebab-case, unique within the question. */
  id: string;
  /** Short label (one line). */
  label: string;
  /** Optional one-line consequence of choosing it. */
  hint?: string;
  /** Passages this option rests on (at most 2); the side viewer moves to them when the option is chosen. */
  evidence?: Anchor[];
}

export type QuestionStatus = "open" | "answered" | "deferred" | "superseded";

/**
 * One material question. The screen shows one question at a time: `text`, the options
 * (the recommended one marked) and a free-text "기타" field. `reason`/`affects` are
 * short and shown on demand.
 */
export interface Question {
  /** Server-assigned, stable across restarts. */
  id: string;
  /** Stable decision key (e.g. `scope`, `code-path`); one live question per key. */
  key: string;
  revision: number;
  /** One sentence. */
  text: string;
  /** Why the answer changes the result (one sentence). */
  reason: string;
  /** Which generation step depends on it (short). */
  affects: string;
  /** `choice-or-text`: options plus the "기타" free-text field (default). */
  answerType: "choice" | "text" | "choice-or-text";
  options: QuestionOption[];
  materiality: "required" | "optional";
  /** Id of the recommended option; never stored as an answer. */
  recommendedOptionId?: string;
  /** One-line basis of the recommendation. */
  recommendedWhy?: string;
  evidence: Anchor[];
  status: QuestionStatus;
  attemptId: string;
  draftRevision: number;
  createdAt: string;
}

export interface Decision {
  id: string;
  questionId: string;
  questionRevision: number;
  key: string;
  /** The researcher's exact words or the chosen option label. */
  response: string;
  optionId?: string;
  status: "answered" | "deferred";
  by: string;
  at: string;
  supersededBy?: string;
}

export interface DraftReference {
  path: string;
  content: string;
}

/** A file copied from a supplied code source into the skill (`scripts/...`). */
export interface DraftCodeFile {
  path: string;
  sourceId: string;
  sourcePath: string;
}

export type DraftOrigin = "model" | "researcher";

/** One accepted revision of the method. Failed proposals never replace the last accepted revision. */
export interface MethodDraft {
  revision: number;
  baseRevision: number;
  origin: DraftOrigin;
  attemptId?: string;
  createdAt: string;
  sourceRevision: number;
  decisionIds: string[];
  slug: string;
  /** SKILL.md frontmatter description: when to use the skill (trigger). */
  description: string;
  scope: "reproduction" | "generalization" | "both" | "unknown";
  profile: DraftProfile;
  /** SKILL.md body (Markdown, Korean). */
  instructions: string;
  references: DraftReference[];
  codeFiles: DraftCodeFile[];
  workflow?: LocalWorkflow;
  recipe?: DraftRecipe;
  /** Finding ids each part relies on, for review. */
  evidence: { field: string; findingIds: string[] }[];
  /** Fields the server overrode or dropped, with reasons. */
  notes: string[];
}

export type AttemptOp = "analyze" | "draft" | "revise";
export type AttemptOutcome = "running" | "accepted" | "repaired" | "rejected" | "failed" | "interrupted";

/** One coauthor model call (and its bounded repair). Agent detail: hidden from the main researcher view. */
export interface AuthoringAttempt {
  id: string;
  op: AttemptOp;
  opId: string;
  /** Canonical GAID model ref used (e.g. `kigam-qwen/qwen3.8-flash-next`). */
  model: string;
  thinkingLevel?: string;
  promptVersion: string;
  sourceRevision: number;
  baseDraftRevision: number;
  startedAt: string;
  endedAt?: string;
  outcome: AttemptOutcome;
  /** Validation errors of each response, in order (first response, then the repair). */
  validationErrors: string[][];
  /** Summed over the attempt's calls; `input` excludes cache reads and writes (whole input = input + cacheRead + cacheWrite). */
  usage?: { input?: number; cacheRead?: number; cacheWrite?: number; output?: number; costUsd?: number };
  /** Each model call of the attempt (first response, then the repair); the record file holds the full call records. */
  calls?: { purpose?: "prewarm"; startedAt: string; ms: number; input: number; cacheRead: number; cacheWrite: number; output: number }[];
  /** File under the project's attempts/ folder with the request and raw responses (no hidden reasoning). */
  record?: string;
  /** Researcher-readable failure sentence (Korean); technical detail stays in `record`. */
  error?: string;
  feedback?: string;
  result?: { findings?: number; questions?: number; draftRevision?: number; scope?: string };
}

export type CheckId = "schema" | "atlas" | "taxonomy" | "portability" | "workflow" | "claims";

export interface CheckFinding {
  level: "error" | "warning";
  code: string;
  path: string;
  /** Technical message (agent detail). */
  message: string;
  /** Plain one-line Korean statement for the researcher, when the check can give one. */
  plain?: string;
  check: CheckId;
}

export interface CheckResult {
  draftRevision: number;
  findings: CheckFinding[];
  passed: boolean;
}

export interface MethodPackageRecord {
  revision: number;
  draftRevision: number;
  methodId: string;
  slug: string;
  sha256: string;
  size: number;
  packageDigest: string;
  createdAt: string;
  /** The package's `gaid-method.json` (gaid-method/v1). */
  manifest: unknown;
  /** Archive path relative to the project folder. */
  archive: string;
}

/** A package installed into a GAID project from this authoring project. */
export interface AuthoringInstall {
  packageRevision: number;
  projectId: string;
  /** LocalMethod key in that project (`<scope>:<runtimeName>`). */
  methodKey: string;
  installedAt: string;
}

export type ProjectStage = "sources" | "analysis" | "questions" | "draft" | "package";

export interface AuthoringProject {
  schemaVersion: typeof AUTHORING_PROJECT_SCHEMA;
  id: string;
  owner: string;
  /** Hub display name of the researcher who started it (X-GAID-User at creation); absent on older projects. */
  author?: string;
  title: string;
  goal?: string;
  /** What the researcher wants to make; `auto` lets the coauthor propose. */
  target?: "skill" | "workflow" | "auto";
  /** Model ref chosen for this project; absent = the app default at call time. */
  model?: string;
  /** Reasoning level chosen for this project's model calls; absent = medium. */
  thinkingLevel?: AuthoringThinkingLevel;
  /** Hub topic folder the researcher filed this method under (my methods on the hub home). */
  folderId?: string;
  /** A registered hub method this draft edits (`edit`: registering adds its next revision) or was copied from (`copy`). */
  hubEntry?: HubEntryLink;
  /**
   * Concept images keyed by procedure node id, cover, or output:<outputId> (files under visuals/). `file` is drawn on the
   * light picture-well colour, `dark` (when present) is the same picture edited for dark mode; pictures without `dark`
   * are older white-background pictures, shown on a paper mat (gaid-concept-pictures).
   */
  visuals?: Record<string, ConceptVisual>;
  visualOperations?: Record<string, VisualOperation>;
  createdAt: string;
  updatedAt: string;
  /** Increments on every source change; findings record the revision they read. */
  sourceRevision: number;
  sources: SourceDocument[];
  extractions: Record<string, ExtractionRecord>;
  findings: GroundedFinding[];
  questions: Question[];
  decisions: Decision[];
  drafts: MethodDraft[];
  attempts: AuthoringAttempt[];
  packages: MethodPackageRecord[];
  installs: AuthoringInstall[];
  /** Idempotency: operation id -> attempt id or package revision. */
  ops: Record<string, string>;
}

/** Link from a draft to the registered hub method it was opened from (gaid-hub-editing). */
export interface HubEntryLink {
  entryId: string;
  /** The registered revision the draft started from. */
  revision: number;
  /** Its version (gaid-hub-versions); older links omit it (`legacyHubVersion(revision)`). */
  version?: string;
  mode: "edit" | "copy";
  /** Title and author of that entry when the draft was opened (shown on the draft). */
  title: string;
  author: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  owner: string;
  author?: string;
  hubEntry?: HubEntryLink;
  updatedAt: string;
  stage: ProjectStage;
  /** An attempt is running now. */
  busy: AttemptOp | null;
  sources: number;
  openQuestions: number;
  latestDraft?: number;
  latestPackage?: number;
  /** Short draft title when a draft exists. */
  methodTitle?: string;
}

export function projectStage(p: AuthoringProject): ProjectStage {
  if (p.packages.length) return "package";
  if (p.drafts.length) return "draft";
  if (p.questions.some((q) => q.status === "open")) return "questions";
  if (p.findings.length) return "analysis";
  return "sources";
}

export const latestDraft = (p: AuthoringProject): MethodDraft | undefined => p.drafts.at(-1);
export const runningAttempt = (p: AuthoringProject): AuthoringAttempt | undefined =>
  p.attempts.find((a) => a.outcome === "running");
/** Questions the researcher still sees in the tab strip (open or answered/deferred in this round). */
export const liveQuestions = (p: AuthoringProject): Question[] =>
  p.questions.filter((q) => q.status !== "superseded");

// --- HTTP API (`/geo/authoring`, user-level, not project-scoped) ------------
//
// GET    /geo/authoring/health                         → AuthoringHealth
// GET    /geo/authoring/projects                       → { projects: ProjectSummary[] }
// POST   /geo/authoring/projects                       CreateProjectBody → AuthoringProject
// GET    /geo/authoring/projects/:id                   → AuthoringProject
// DELETE /geo/authoring/projects/:id                   → 204 (moves the folder to an archive, never in-place delete)
// POST   /geo/authoring/projects/:id/sources           AddSourceBody → { source, extraction }
// POST   /geo/authoring/projects/:id/sources/url       AddUrlSourceBody → { source, extraction }
// POST   /geo/authoring/projects/:id/drafts/:rev/visuals GenerateVisualsBody → 202 VisualOperation
// GET    /geo/authoring/projects/:id/visuals/:key       PNG/WebP/JPEG bytes (?theme=dark: the dark picture when there is one)
// GET    /geo/authoring/visual-source                   → VisualSourceInfo
// GET    /geo/authoring/projects/:id/sources/:sid/original      original bytes (PDF inline)
// GET    /geo/authoring/projects/:id/sources/:sid/pages/:page   → { page, text }
// GET    /geo/authoring/projects/:id/sources/:sid/files/*       → { path, text }
// POST   /geo/authoring/projects/:id/analyze           OperationBody → 202 AuthoringAttempt
// POST   /geo/authoring/projects/:id/answers           AnswersBody → { decisions, attempt? } (202 when a draft starts)
// POST   /geo/authoring/projects/:id/draft             OperationBody → 202 AuthoringAttempt
// POST   /geo/authoring/projects/:id/revise            OperationBody (feedback required) → 202 AuthoringAttempt
// POST   /geo/authoring/projects/:id/drafts            EditDraftBody → MethodDraft
// GET    /geo/authoring/projects/:id/drafts/:rev/files → { files: DraftFileView[] }
// GET    /geo/authoring/projects/:id/drafts/:rev/check → CheckResult
// POST   /geo/authoring/projects/:id/packages          PackageBody → MethodPackageRecord | 422 CheckResult
// GET    /geo/authoring/projects/:id/packages/:rev.tar.gz      package bytes
// POST   /geo/authoring/projects/:id/packages/:rev/install     InstallBody → InstallResult
//
// Long operations return 202 and run in the background; the client polls the project.
// A restart marks running attempts `interrupted` (never inferred as success).

export interface AuthoringHealth {
  enabled: boolean;
  /** Model ref used when a project names none (app default), or null when no model is connected. */
  defaultModel: string | null;
  /** Page-text extraction tool is available (poppler `pdftotext`). */
  pdfText: boolean;
}

export interface CreateProjectBody {
  /** The researcher's hub display name; used to list "my" methods, not an access control. */
  author?: string;
  title?: string;
  goal?: string;
  target?: "skill" | "workflow" | "auto";
  model?: string;
  thinkingLevel?: AuthoringThinkingLevel;
}

export interface AddUrlSourceBody {
  url: string;
  kind: "paper" | "blog" | "search";
}

export interface VisualOperation {
  opId: string;
  draftRevision: number;
  model: string;
  keys: string[];
  /** Researcher's revision request, preserved verbatim (up to 500 characters). */
  instruction?: string;
  /** Fitting older pictures to the screen themes (two edits per picture, content unchanged). */
  adapt?: true;
  /** Keys whose light and dark-mode pictures are both done. */
  completed: string[];
  status: "running" | "complete" | "failed" | "interrupted";
  startedAt: string;
  endedAt?: string;
  error?: string;
  /** Set when the subscription's image quota stopped the batch; resetsAt when the backend said. */
  usageLimit?: { resetsAt?: string };
}

/** The concept-picture source: only the OpenAI Codex login (user direction 2026-10-16, no fallback). */
export type VisualSource = "chatgpt";
export interface VisualSourceInfo {
  id: VisualSource;
  available: boolean;
  /** Model ref used, e.g. "openai-codex/gpt-image-2". */
  model: string | null;
}

export interface ConceptVisual {
  file: string;
  dark?: string;
  caption: string;
  model: string;
  draftRevision: number;
}

export interface GenerateVisualsBody {
  opId: string;
  /** Exact pictures to generate: cover, procedure node id, output:<outputId>; 1–6 unique keys. */
  keys?: string[];
  /** Revise the selected existing pictures with this request (up to 500 characters). */
  instruction?: string;
  /** Optional step ids; eligible output ports reserve slots within the six-image shared cap. */
  steps?: string[];
  /**
   * Fit the selected existing pictures to the screen themes without changing what they show: the light picture is
   * edited onto the picture-well colour and a dark-mode picture is edited from it. Not combined with `instruction`.
   */
  adapt?: boolean;
}

export interface AddSourceBody {
  name: string;
  mediaType: string;
  kind?: SourceKind;
  /** Base64 bytes, 30 MiB decoded max. Empty when `files` carries the content. */
  contentBase64: string;
  /**
   * Several files forming one source (a shapefile set, a raster with its world file): kind `data`, `name` names the
   * set. 30 MiB decoded in total.
   */
  files?: { name: string; contentBase64: string }[];
  documentKind?: string;
  doi?: string;
}

/** Limits of what one authoring project takes in. */
export const AUTHORING_SOURCE_LIMITS = {
  sourceBytes: 30 * 1024 * 1024,
  projectBytes: 300 * 1024 * 1024,
  sources: 30,
  setFiles: 50,
  inspectedFiles: 40,
} as const;

/** Research notes from GAID projects to add as sources. */
export interface AddNoteSourcesBody {
  notes: { projectId: string; noteId: string }[];
}

/** Papers and research notes from 서재; without `authoringId` a new authoring project starts with them. */
export interface AddLibrarySourcesBody {
  itemIds: string[];
  authoringId?: string;
}

export interface AddLibrarySourcesResult {
  authoringId: string;
  added: { itemId: string; sourceId: string; kind: SourceKind }[];
  /** Items not added, with the reason (no readable content, unavailable note …). */
  skipped: { itemId: string; reason: string }[];
}

export interface OperationBody {
  opId: string;
  /** `revise` only: observations the revision must address (kept verbatim). */
  feedback?: string;
  /** `analyze` only: the researcher's goal and target, saved on the project before reading. */
  goal?: string;
  target?: "skill" | "workflow" | "auto";
  /** Override the project's model for this call. */
  model?: string;
  thinkingLevel?: AuthoringThinkingLevel;
}

/** Reasoning levels a researcher can choose for the authoring agent (the server default is medium). */
export const AUTHORING_THINKING_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export type AuthoringThinkingLevel = (typeof AUTHORING_THINKING_LEVELS)[number];

export interface AnswerItem {
  questionId: string;
  questionRevision: number;
  /** A chosen option; `response` may add words to it. */
  optionId?: string;
  /** Free text ("기타") or words added to the option. */
  response?: string;
  defer?: boolean;
}

/** All answers of a round, applied together; `draft` then starts the draft (or revision) attempt. */
export interface AnswersBody {
  opId: string;
  answers: AnswerItem[];
  draft: boolean;
  model?: string;
  thinkingLevel?: OperationBody["thinkingLevel"];
}

export interface EditDraftBody {
  baseRevision: number;
  title?: string;
  description?: string;
  summary?: string;
  instructions?: string;
  codeFiles?: DraftCodeFile[];
}

export interface DraftFileView {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
}

export interface PackageBody {
  opId: string;
  draftRevision: number;
}

export interface InstallBody {
  /** Target GAID project. */
  projectId: string;
  /** The researcher confirmed the install notice (same acknowledgement as the skill install gate). */
  acknowledged: true;
}

export interface InstallResult {
  install: AuthoringInstall;
  /** Workflow/recipe to open in TaskSetup in that project. */
  workflowId: string | null;
  recipeId: string | null;
  /** Hub skills the Workflow pins (gaid-hub-skills): installed now, already present, or blocked (readiness explains). */
  hubSkills?: { name: string; revision: number; state: HubSkillInstallState; outcome?: "installed" | "present" | "blocked" }[];
}

// --- Example data of Workflow inputs (gaid-workflow-example) ------------------
//
// POST /geo/authoring/projects/:id/examples                    AttachExampleBody → MethodDraft (new researcher revision)
// POST /geo/authoring/projects/:id/examples/:roleId            EditExampleBody → MethodDraft
// POST /geo/authoring/projects/:id/examples/:roleId/remove     { baseRevision } → MethodDraft
//
// The researcher attaches, edits and removes examples; the coauthor model never writes them. Uploads and data-source
// files are bundled in the package (`examples/<roleId>/<name>`); a public URL is fetched once to record sha256 and size,
// its bytes are not kept.

/** Where the example's files come from. */
export type AttachExampleFrom =
  /** Files chosen on the researcher's PC (base64; each ≤ EXAMPLE_LIMITS.bundledFile). */
  | { kind: "upload"; files: { name: string; contentBase64: string }[] }
  /** Files of a project source whose extraction lists them (`extractions[sourceId].files[].path`). */
  | { kind: "source"; sourceId: string; paths: string[] }
  /** Public https URLs; `name` defaults to the URL's last path segment. */
  | { kind: "url"; files: { url: string; name?: string }[] };

/** The researcher's description of an example (Korean text). */
export interface ExampleText {
  title: string;
  source: string;
  /** Empty string removes it. */
  license?: string;
  synthetic?: boolean;
}

export interface AttachExampleBody extends ExampleText {
  /** The latest draft revision the researcher saw. */
  baseRevision: number;
  /** Workflow input role id; an existing example of that role is replaced. */
  roleId: string;
  from: AttachExampleFrom;
}

export interface EditExampleBody extends Partial<ExampleText> {
  baseRevision: number;
}

/** A starting title and source for the form, from the chosen source document or URL; the researcher edits them. */
export function suggestExampleText(
  project: Pick<AuthoringProject, "sources">,
  from: { kind: "upload" } | { kind: "source"; sourceId: string } | { kind: "url"; url: string },
): { title: string; source: string } {
  if (from.kind === "source") {
    const source = project.sources.find((s) => s.id === from.sourceId);
    if (!source) return { title: "", source: "" };
    const title = source.title?.trim() || source.name;
    return { title, source: [title, source.doi ? `doi:${source.doi}` : source.url].filter(Boolean).join(", ") };
  }
  if (from.kind === "url") {
    try {
      const url = new URL(from.url);
      const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
      return { title: name, source: url.host };
    } catch {
      return { title: "", source: "" };
    }
  }
  return { title: "", source: "" };
}

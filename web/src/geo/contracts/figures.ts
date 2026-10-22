/**
 * Figure records (gaid-research-visuals, ADR docs/adr/2026-10-22-figure-records-and-connection-map.md). A figure record
 * is a derived view of one image in a project: what kind of figure it is, which chat, script and data produced it, whether
 * those changed since, the latest check against a target journal, and what to disclose when an AI image tool made it.
 * Nothing here is a master store: the note file and the provenance log are the sources; the only stored data are the
 * researcher's kind override (`.kady/geo/figures.json`), the project's target journal (`.kady/geo/figure-target.json`)
 * and check results keyed by content hash (`.kady/geo/figure-checks/<sha256>.json`, written by the gaid-figures skill).
 *
 * IO-free: imported by server/src/geo/figures/ and web/src/geo/figures/.
 */

export const FIGURE_CHECK_SCHEMA = "gaid-figure-check/v1";
export const JOURNAL_FIGURES_SCHEMA = "gaid-journal-figures/v1";
export const FIGURE_OVERRIDES_FILE = ".kady/geo/figures.json";
export const FIGURE_TARGET_FILE = ".kady/geo/figure-target.json";
export const FIGURE_CHECKS_DIR = ".kady/geo/figure-checks";
/** The shipped skill that draws, exports and checks figures (geo/skills/gaid-figures/). */
export const FIGURES_SKILL = "gaid-figures";

/** Image files a figure record covers (raster and vector). */
export const FIGURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".tif", ".tiff", ".svg", ".pdf", ".eps", ".webp", ".gif"] as const;

/**
 * How the figure was made. Derived from the producing step (ADR decision 3); the researcher may override it.
 * - `data-figure`: drawn by a script or command from data files.
 * - `code-diagram`: a diagram written as code (SVG, Mermaid, draw.io, DOT, TikZ) or rendered from such a source.
 * - `ai-picture`: drawn by an image-generation model.
 * - `ai-graphical-abstract`: an AI picture the researcher uses as a graphical abstract (override only).
 * - `image-edit`: an existing image changed by an AI image tool.
 * - `unknown`: not enough record to tell.
 */
export type FigureKind = "data-figure" | "code-diagram" | "ai-picture" | "ai-graphical-abstract" | "image-edit" | "unknown";
export const FIGURE_KINDS: readonly FigureKind[] = ["data-figure", "code-diagram", "ai-picture", "ai-graphical-abstract", "image-edit", "unknown"];

/** Where the kind came from. */
export type FigureKindSource = "derived" | "researcher";

/** A journal's stance on a figure kind. `null` facts in profiles are unverified and shown as 확인 안 됨. */
export type JournalAiPolicy = "allowed" | "disclose" | "forbidden" | "permission" | "unknown";

/** One upstream input of the figure, as the provenance walk found it. */
export interface FigureInput {
  /** Sandbox-relative path. */
  path: string;
  role: "script" | "data" | "image" | "other";
  /** observed = the step named the file; inferred = found from the command line or a scan. */
  confidence: "observed" | "inferred";
  /** The file changed after the figure used it. Null when either side has no hash. */
  changedSinceUse: boolean | null;
  exists: boolean;
}

/** The step that produced the figure (or the source the note figure was copied from). */
export interface FigureOrigin {
  /** Chat that ran the step; open it with the chat id, never shown as text (UI guide R1). */
  sessionId: string | null;
  /** Wall-clock of the producing step, ISO 8601. */
  producedAt: string | null;
  /** The figure the note shows is a copy of this file (sandbox-relative), found by provenance edge or identical hash. */
  copiedFrom: string | null;
  copyMatch: "edge" | "hash" | null;
  /** The script that drew it, when one was found among the inputs. */
  script: string | null;
  inputs: FigureInput[];
  /** True when the walk hit its budget or the record degraded; the list may be incomplete. */
  incomplete: boolean;
  /** Record-view facts (UI guide R4; shown only behind 기록 보기). */
  record: {
    toolName: string | null;
    model: string | null;
    environmentId: string | null;
  };
}

/** Staleness of the figure itself against its newest producing step. */
export type FigureStaleness = "current" | "stale" | "unknown";

/** The project's target for journal-sized figures. */
export interface FigureTarget {
  /** Profile id in journals.json (`elsevier`, `copernicus`, `agu`, `springer`, `gsa`, `jgsk`, `eeg` …). */
  journalId: string;
  /** Width class id of that profile (`single`, `one-half`, `double` …). */
  width: string;
  updatedAt: string;
}

/** One result line of a figure check. */
export interface FigureCheckItem {
  id:
    | "pixel-size"
    | "dpi"
    | "min-font"
    | "fonts-embedded"
    | "format"
    | "colour-map"
    | "cvd"
    | "axis-units"
    | "panel-labels"
    | "ai-policy";
  status: "ok" | "warn" | "fail" | "not-measured";
  /** Measured value with unit as written for the researcher (`1,063 px`, `6.5 pt`), when one exists. */
  measured?: string;
  /** Required value from the journal profile, when the profile has one. */
  required?: string;
  /** Language-neutral qualifiers the UI words for the researcher (FIGURE_CHECK_NOTES); never free text. */
  notes?: FigureCheckNote[];
}

/** Codes the check script attaches to an item; the web locale `figures.checkNote.<code>` words each one. */
export const FIGURE_CHECK_NOTES = [
  "artwork-unclassified", "artwork-photo", "artwork-combination", "artwork-lineArt", "vector-container",
  "plot-metadata", "partial", "fonts-embedded", "fonts-not-embedded", "rainbow-like", "no-hue-ramp",
  "cvd-previews", "cvd-vector", "policy-allowed", "policy-disclose", "policy-forbidden", "policy-permission",
  "policy-unknown", "where-caption", "where-methods", "where-acknowledgements", "where-statement",
] as const;
export type FigureCheckNote = (typeof FIGURE_CHECK_NOTES)[number];

/** `.kady/geo/figure-checks/<sha256>.json`, written by the gaid-figures check script. */
export interface FigureCheck {
  schema: typeof FIGURE_CHECK_SCHEMA;
  /** sha256 of the checked file; a changed figure never reuses an old check. */
  sha256: string;
  /** Sandbox-relative path at check time. */
  path: string;
  checkedAt: string;
  target: { journalId: string; width: string; widthMm: number | null } | null;
  /** Date the journal profile values were last checked against the journal's pages. */
  rulesCheckedAt: string | null;
  kind: FigureKind;
  items: FigureCheckItem[];
  /** Sandbox-relative paths of colour-vision simulation previews, when made. */
  cvdPreviews: string[];
  /** Model-based critique, advisory only; never changes `items`. */
  advice?: string[];
}

/** One figure as the researcher sees it. */
export interface FigureRecord {
  /** Sandbox-relative path of the image. */
  path: string;
  /** Caption text from the note (`그림 1. …`), when the figure is in a note. */
  caption: string | null;
  /** Research note id that shows the figure, when any. */
  noteId: string | null;
  exists: boolean;
  sha256: string | null;
  kind: FigureKind;
  kindSource: FigureKindSource;
  staleness: FigureStaleness;
  /** Any input changed since the figure used it. */
  inputsChanged: boolean;
  origin: FigureOrigin | null;
  /** Latest check for exactly these bytes, if any. */
  check: FigureCheck | null;
  /** The target journal's stance for this kind; null without a target. */
  policy: { journalId: string; policy: JournalAiPolicy; sourceUrl: string | null } | null;
  /**
   * Disclosure draft for AI-made figures (tool, model, date, purpose), for the caption and the AI-use statement.
   * Record view only (it may name the model). Null for other kinds.
   */
  disclosure: string | null;
}

/** GET /geo/figures?note=<noteId> (one note) or without a note (figures referenced by every note, bounded). */
export interface FigureListResponse {
  figures: FigureRecord[];
  target: FigureTarget | null;
  /** True when the list hit its bound (200 figures). */
  truncated: boolean;
}

/** GET /geo/figures/record?path=<sandbox-relative path> */
export interface FigureRecordResponse {
  figure: FigureRecord;
}

/** PUT /geo/figures/kind  { path, sha256, kind | null } — null clears the researcher's override. */
export interface FigureKindBody {
  path: string;
  sha256: string;
  kind: FigureKind | null;
}

/** PUT /geo/figures/target  { journalId, width } — `null` body fields clear the target. */
export interface FigureTargetBody {
  journalId: string | null;
  width: string | null;
}

/**
 * One journal in `geo/skills/gaid-figures/assets/journals.json` (`{ schema: JOURNAL_FIGURES_SCHEMA, profiles: [...] }`).
 * Every value comes from the journal's own pages; a value not verified there is `null`, never a guess.
 */
export interface JournalProfile {
  id: string;
  name: string;
  /** Publisher or society, for grouping (`Elsevier`, `Copernicus`, `AGU`, `Springer Nature`, `GSA`, `대한지질학회` …). */
  publisher: string;
  /** Journals the profile covers when it is a publisher-wide rule (e.g. Geosciences Journal under Springer). */
  covers: string[];
  widths: { id: string; label: string; mm: number | null }[];
  /** Minimum text size at final print size, in pt. */
  minFontPt: number | null;
  maxHeightMm: number | null;
  /** Minimum resolution at final size by figure type. */
  dpi: { photo: number | null; combination: number | null; lineArt: number | null };
  formats: { vector: string[]; raster: string[] };
  colour: { mode: "RGB" | "CMYK" | "either" | null; cvdRequired: boolean | null; colourMapAdvice: string | null };
  panelsInOneFile: boolean | null;
  aiPolicy: Record<Exclude<FigureKind, "unknown">, JournalAiPolicy>;
  /** Where to disclose AI use (`caption`, `methods`, `acknowledgements`, `statement`). */
  aiDisclosure: string[];
  sources: { url: string; title: string; checkedAt: string }[];
  /** Newest `checkedAt` among sources. */
  rulesCheckedAt: string;
  notes: string[];
}

/**
 * POST /geo/figures/check  { path, journalId?, width? } — runs the gaid-figures check script with the helper Python
 * (no model call) against the given or the project's target journal, stores the result under FIGURE_CHECKS_DIR and
 * returns the refreshed record. The agent may run the same script from the skill; the stored result is identical.
 */
export interface FigureCheckBody {
  path: string;
  journalId?: string;
  width?: string;
  /** Declared use, so an AI picture meant as a graphical abstract is checked as one. */
  use?: "figure" | "graphical-abstract";
}

/** GET /geo/figures/journals — the shipped profiles, trimmed to what the picker and record show. */
export interface JournalSummary {
  id: string;
  name: string;
  widths: { id: string; label: string; mm: number | null }[];
  rulesCheckedAt: string | null;
  sourceUrl: string | null;
}
export interface JournalListResponse {
  journals: JournalSummary[];
}

/** Locale-free decision: does a figure kind need disclosure text? */
export function kindIsAiMade(kind: FigureKind): boolean {
  return kind === "ai-picture" || kind === "ai-graphical-abstract" || kind === "image-edit";
}

export function isFigurePath(path: string): boolean {
  const lower = path.toLowerCase();
  return FIGURE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

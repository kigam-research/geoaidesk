import { notebookExportText } from "../geo/notebook/export-text";
/** Shared, IO-free analysis-plan protocol. Local records are not external preregistrations. */
import type { NotebookArtifactSnapshot } from "./notebook-evidence-core";

export const PLAN_TEXT_FIELDS = {
  hypothesis: "Hypothesis / research question",
  primaryOutcome: "Primary outcome and measurement",
  exclusions: "Inclusion and exclusion rules",
  model: "Statistical model / analysis procedure",
  multiplicity: "Multiple-testing approach",
  qc: "QC and success criteria",
  stopping: "Stopping / sample-size rule",
  exposureNotes: "Prior data access and exposure details",
} as const;
export type PlanTextField = keyof typeof PLAN_TEXT_FIELDS;
export interface AnalysisPlanInput extends Record<PlanTextField, string> {
  datasets: string[];
  intent: "exploratory" | "confirmatory";
  priorExposure: "none" | "metadata-only" | "outcomes-inspected" | "unknown";
}
export type PlanField = PlanTextField | "datasets" | "intent" | "priorExposure";
export interface PlanSource { sessionId: string; entryId: string }
export type PlanDatasetIdentity = Omit<NotebookArtifactSnapshot, "timing">;
export interface AnalysisPlanPreview {
  id: string;
  source: PlanSource;
  sourceDigest: string;
  expectedHead: string | null;
  plan: AnalysisPlanInput;
  datasets: PlanDatasetIdentity[];
  revisionReason: string;
  createdAt: number;
  expiresAt: number;
}
interface PlanEventBase {
  version: 1;
  id: string;
  sequence: number;
  previousDigest: string | null;
  digest: string;
  source: PlanSource;
  recordedAt: number;
  actor: "user";
}
export interface FrozenPlanEvent extends PlanEventBase {
  kind: "freeze";
  revision: number;
  previewId: string;
  plan: AnalysisPlanInput;
  datasets: PlanDatasetIdentity[];
  revisionReason: string;
  acknowledgedUnverified: boolean;
  /** Hash of the saved notebook entry anchoring this revision. */
  sourceDigest: string;
}
export interface PlanDeviationInput {
  planId: string;
  field: PlanField;
  actual: string;
  reason: string;
  timing: "before-results" | "after-results" | "unknown";
  corrects?: string;
}
export interface PlanDeviationEvent extends PlanEventBase, PlanDeviationInput {
  kind: "deviation";
  /** Obtained from the immutable plan, never supplied by the caller. */
  planned: string;
}
export type AnalysisPlanEvent = FrozenPlanEvent | PlanDeviationEvent;
export interface AnalysisPlanHistory {
  source: PlanSource;
  head: string | null;
  events: AnalysisPlanEvent[];
}

/** Strip attribution/approval fields and reject incomplete or oversized drafts. */
export function normalizeAnalysisPlan(input: unknown): AnalysisPlanInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Plan must be an object");
  const raw = input as Record<string, unknown>;
  const text = {} as Record<PlanTextField, string>;
  for (const key of Object.keys(PLAN_TEXT_FIELDS) as PlanTextField[]) {
    if (typeof raw[key] !== "string" || !raw[key].trim() || raw[key].length > 4000) {
      throw new Error(`${PLAN_TEXT_FIELDS[key]} is required (maximum 4,000 characters; state explicitly when unknown/not applicable)`);
    }
    text[key] = raw[key].trim();
  }
  if (!Array.isArray(raw.datasets) || raw.datasets.length < 1 || raw.datasets.length > 8 || raw.datasets.some((p) => typeof p !== "string" || !p.trim() || p.length > 1000)) throw new Error("Specify 1–8 sandbox dataset paths");
  if (raw.intent !== "exploratory" && raw.intent !== "confirmatory") throw new Error("Select the analysis intent");
  if (!["none", "metadata-only", "outcomes-inspected", "unknown"].includes(String(raw.priorExposure))) throw new Error("Select prior data exposure");
  return { ...text, datasets: [...new Set((raw.datasets as string[]).map((p) => p.trim()))], intent: raw.intent, priorExposure: raw.priorExposure as AnalysisPlanInput["priorExposure"] };
}

export function planFieldValue(plan: AnalysisPlanInput, field: PlanField): string {
  return field === "datasets" ? plan.datasets.join("\n") : plan[field];
}
export function latestFrozenPlan(history: AnalysisPlanHistory): FrozenPlanEvent | undefined {
  return [...history.events].reverse().find((e): e is FrozenPlanEvent => e.kind === "freeze");
}
// Form fields are plain text, not a way to inject markup into a frozen record.
const planText = (value: string) => value.replace(/[\\`*_{}\[\]<>()#+.!|~\-]/g, "\\$&").replace(/\n/g, "  \n");

export function planHistoryText(history: AnalysisPlanHistory, lang?: string): string {
  const text = notebookExportText(lang);
  const label = (key: string) => text("export." + key);
  const value = (v: string) => lang === "ko" ? text("export.value." + v) : v;
  if (!history.events.length) return label("plan_empty");
  const lines = [`### ${label("plan_title")}`, label("plan_notice")];
  for (const event of history.events) {
    lines.push(`\n#### ${event.kind === "freeze" ? text("export.frozen", { revision: event.revision }) : label("deviation")} — ${event.id}`, text("export.plan_recorded", { when: new Date(event.recordedAt).toISOString(), digest: event.digest }));
    if (event.kind === "freeze") {
      lines.push(`${label("intent")}: ${value(event.plan.intent)} (${label("declared")}) · ${label("exposure")}: ${value(event.plan.priorExposure)}`, `${label("revision_reason")}: ${planText(event.revisionReason || label("initial"))}`);
      for (const field of Object.keys(PLAN_TEXT_FIELDS) as PlanTextField[]) lines.push(`**${label("plan_field." + field)}:** ${planText(event.plan[field])}`);
      lines.push(`**${label("datasets")}:**`);
      for (const data of event.datasets) lines.push(`- ${planText(data.path)}: ${data.sha256 ? `sha256 ${data.sha256}` : `${label("unverified")} (${data.reason ? value(data.reason) : label("no_hash")})`} (${text("export.measured", { when: new Date(data.capturedAt).toISOString() })})`);
    } else {
      lines.push(`${label("plan")}: ${event.planId} · ${label("field")}: ${lang === "ko" ? label("plan_field." + event.field) : event.field} · ${label("timing")}: ${value(event.timing)} (${label("self_reported")})`, `${label("planned")}: ${planText(event.planned)}`, `${label("actual")}: ${planText(event.actual)}`, `${label("reason")}: ${planText(event.reason)}`);
      if (event.corrects) lines.push(text("export.corrects", { id: event.corrects }));
    }
  }
  return lines.join("\n\n");
}

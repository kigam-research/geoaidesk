"use client";
/**
 * Workflow 소개, the first step of the start window (gaid-workflow-start-ui): what the Workflow does before any data is
 * asked for. Built only from what the Workflow records (WorkflowDoc / summary fields); a missing part is left out, never
 * filled in. The full read-only Workflow view stays one disclosure away.
 */
import { useState, type ReactNode } from "react";
import type { GeoWorkflowSummary } from "@/geo/contracts/workspace";
import { t } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { WorkflowView } from "@/geo/workflow/workflow-view";
import { localText } from "@/geo/hub/text";
import { text } from "./api";
import { hasDefault } from "@/geo/contracts/workflow-stages";

export interface IntroRow { label: string; content: ReactNode }

/** Label/value rows separated by hairlines (one fact per row). */
export function IntroFacts({ rows }: { rows: IntroRow[] }) {
  return <dl className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-4 text-sm leading-[21px]">
    {rows.map((row, i) => <div key={row.label} className={cn("contents", i > 0 && "[&>*]:border-t [&>*]:border-gaid-edge [&>*]:pt-2")}>
      <dt className="pb-2 text-[13px] text-gaid-ink-2">{row.label}</dt>
      <dd className="min-w-0 pb-2 break-words">{row.content}</dd>
    </div>)}
  </dl>;
}

export const IntroNote = ({ children }: { children: ReactNode }) => <span className="mt-1 block text-[13px] leading-[18px] text-gaid-ink-2">{children}</span>;
export const IntroQual = ({ children }: { children: ReactNode }) => <span className="ml-2 text-[13px] text-gaid-ink-2">{children}</span>;
export const IntroFormat = ({ children }: { children: ReactNode }) => <span className="ml-2 font-mono text-xs text-gaid-ink-2">{children}</span>;

/** A long text on two lines with a toggle (UI guide P3). */
export function ClampedText({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const long = value.length > 110;
  return <>
    <span className={cn(long && !open && "line-clamp-2")}>{value}</span>
    {long && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 text-[13px] text-gaid-signal-ink underline-offset-4 hover:underline">
      {t(open ? "workspace.start.less" : "workspace.start.more")}
    </button>}
  </>;
}

/** A closed disclosure row under the facts (Workflow 자세히 보기, AI agent가 받는 지침). */
export function IntroDisclosure({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <details className="group mt-4 rounded-md border border-gaid-edge text-sm">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium select-none [&::-webkit-details-marker]:hidden">
      <span aria-hidden className="text-gaid-ink-2 transition-transform group-open:rotate-90">›</span>
      {title}
      {hint && <span className="ml-auto text-[13px] font-normal text-gaid-ink-2">{hint}</span>}
    </summary>
    <div className="border-t border-gaid-edge px-3 py-3">{children}</div>
  </details>;
}

/** The introduction of a GAID Workflow (catalogue or hub). */
export function GeoIntro({ workflow, projectId, notice }: { workflow: GeoWorkflowSummary; projectId: string; notice?: ReactNode }) {
  const doc = workflow.doc;
  const purpose = localText(doc?.purpose) || text(workflow.description);
  const roles = workflow.inputRoles;
  const examples = roles.filter((role) => role.example && role.example.state !== "broken").map((role) => text(role.example!.title));
  // Conditions the researcher answers; those with a default are counted, not listed (gaid-workflow-stages).
  const choices = workflow.requiredScientificChoices.filter((choice) => !hasDefault(choice)).map((choice) => text(choice.label));
  const defaults = workflow.requiredScientificChoices.filter(hasDefault).length;
  const outputs = workflow.expectedArtifacts.map((artifact) => text(artifact.label));
  const steps = doc?.steps ?? [];
  const boundary = localText(doc?.boundary) || text(workflow.boundary);
  const rows: IntroRow[] = [];
  if (purpose) rows.push({ label: t("workspace.start.fact.purpose"), content: <ClampedText value={purpose} /> });
  if (roles.length) rows.push({ label: t("workspace.start.fact.inputs"), content: <>
    {roles.map((role) => <span key={role.id} className="block">{text(role.label)}<IntroQual>{t(role.required ? "workspace.setup.required" : "workspace.setup.optional")}</IntroQual>{role.extensions.length > 0 && <IntroFormat>{role.extensions.join(", ")}</IntroFormat>}</span>)}
    <IntroNote>{examples.length ? t("workspace.start.exampleSome", { titles: [...new Set(examples)].join(", ") }) : t("workspace.start.exampleNone")}</IntroNote>
  </> });
  if (choices.length || defaults) rows.push({ label: t("workspace.start.fact.choices"), content: <>
    {choices.length > 3 ? t("workspace.start.choicesMany", { count: choices.length, names: choices.slice(0, 3).join(", "), rest: choices.length - 3 }) : choices.join(", ")}
    {defaults > 0 && <IntroNote>{t("workspace.start.choicesDefaults", { count: defaults })}</IntroNote>}
    {choices.length > 0 && <IntroNote>{t("workspace.start.choicesDefer")}</IntroNote>}
  </> });
  if (outputs.length) rows.push({ label: t("workspace.start.fact.outputs"), content: outputs.join(", ") });
  if (steps.length) rows.push({ label: t("workspace.start.fact.steps"), content:
    <ol className="grid grid-flow-col grid-cols-2 gap-x-5 text-[13.5px]" style={{ gridTemplateRows: `repeat(${Math.ceil(steps.length / 2)}, auto)` }}>
      {steps.map((step, i) => <li key={step.id} className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)]">
        <span className="text-[13px] text-gaid-ink-3 tabular-nums">{i + 1}</span>
        <span className="truncate" title={localText(step.title)}>{localText(step.title)}{step.choiceIds.length > 0 && <span className="ml-1.5 text-xs text-gaid-warning">{t("workspace.start.decision")}</span>}</span>
      </li>)}
    </ol> });
  if (boundary) rows.push({ label: t("workspace.start.fact.boundary"), content: <ClampedText value={boundary} /> });
  return <section aria-label={t("workspace.start.intro")}>
    {notice}
    <IntroFacts rows={rows} />
    {doc && <IntroDisclosure title={t("workspace.start.detail")} hint={t("workspace.start.detailHint")}>
      <WorkflowView doc={doc} projectId={projectId} readiness={workflow.readiness} />
    </IntroDisclosure>}
  </section>;
}

"use client";
/**
 * Parts of the Workflow start settings (UI guide Q1–Q6): the grouped step rail, option cards, one step per input
 * file or analysis condition, and the summary. State lives in TaskSetup; these components only render it.
 */
import { useId, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeoWorkflowSummary, WorkflowChoice, WorkflowInputRole } from "@/geo/contracts/workspace";
import { hasGeoText, t } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { StepScale } from "@/geo/shell/step-scale";
import { accepts, text } from "./api";

/** An input role answer: a fitting file, another project file, or (optional roles only) not used. */
export type InputAnswer = { mode: "file" | "other"; path: string } | { mode: "none" };
/** An analysis condition answer: a listed option, own text, or decided in the chat (`defer`). */
export type ChoiceAnswer = { mode: "option" | "other"; value: string } | { mode: "defer" };

export type SetupStep =
  | { kind: "input"; role: WorkflowInputRole }
  | { kind: "choice"; choice: WorkflowChoice }
  | { kind: "summary" };

export function setupSteps(workflow: GeoWorkflowSummary): SetupStep[] {
  return [
    ...workflow.inputRoles.map((role): SetupStep => ({ kind: "input", role })),
    ...workflow.requiredScientificChoices.map((choice): SetupStep => ({ kind: "choice", choice })),
    { kind: "summary" },
  ];
}

export function stepName(step: SetupStep): string {
  return step.kind === "input" ? text(step.role.label) : step.kind === "choice" ? text(step.choice.label) : t("workspace.setup.summaryTab");
}

/** A required input needs a file; an "other" answer needs its text. Unanswered conditions are decided in the chat. */
export function inputDone(answer: InputAnswer | undefined): boolean {
  return Boolean(answer && (answer.mode === "none" || answer.path));
}
export function choiceDone(answer: ChoiceAnswer | undefined): boolean {
  return Boolean(answer && (answer.mode === "defer" || answer.value.trim()));
}

/** Option label: the package's own, else GAID's label for a known catalogue option id, else the id. */
export function optionLabel(choice: WorkflowChoice, option: string): string {
  if (choice.optionLabels?.[option]) return text(choice.optionLabels[option]);
  return hasGeoText(`workspace.setup.options.${option}`) ? t(`workspace.setup.options.${option}`) : option;
}

const baseName = (path: string) => path.split("/").pop() || path;
const folderName = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : t("workspace.setup.input.root");

/** The step scale of the start settings: every input and condition named in order, then the summary (UI guide v2 Q4, Q5). */
export function StepRail({ steps, index, done, onSelect }: { steps: SetupStep[]; index: number; done: (i: number) => boolean; onSelect: (i: number) => void }) {
  const last = steps.length - 1;
  return <StepScale
    tabs
    label={t("workspace.setup.steps")}
    current={index}
    onStep={onSelect}
    itemLabel={(i) => t("workspace.setup.stepLabel", { n: i + 1, name: stepName(steps[i]) })}
    steps={steps.map((step, i) => ({ label: stepName(step), done: i !== last && done(i) }))}
  />;
}

/** One selectable row of a radio group (Q2 radio card). */
function OptionCard({ selected, onSelect, title, hint, badge, children }: { selected: boolean; onSelect: () => void; title: ReactNode; hint?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return <div className={cn("rounded-md border border-gaid-edge bg-gaid-face transition-colors", selected ? "border-gaid-signal bg-gaid-signal-tint/40" : "hover:border-gaid-control-edge")}>
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className="flex w-full min-w-0 items-start gap-3 rounded-md px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gaid-control-edge bg-gaid-face", selected && "border-gaid-signal")}>
        {selected && <span className="size-2 rounded-full bg-gaid-signal" />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium break-words">{title}{badge}</span>
        {hint && <span className="text-xs text-gaid-ink-2 break-words">{hint}</span>}
      </span>
    </button>
    {selected && children && <div className="px-4 pb-3 pl-11">{children}</div>}
  </div>;
}

const fieldClass = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Package-authored reasons can run long: two lines first, the rest on request (UI guide Q1, P3). */
function ClampedLine({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const long = value.length > 90;
  return <p className="text-sm text-muted-foreground break-words">
    <span className={cn(long && !open && "line-clamp-2")}>{value}</span>
    {long && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 text-xs text-primary underline-offset-4 hover:underline">
      {t(open ? "workspace.setup.reasonLess" : "workspace.setup.reasonMore")}
    </button>}
  </p>;
}

function StepHeading({ id, title, lines }: { id: string; title: string; lines: (string | null | undefined)[] }) {
  return <div className="space-y-1">
    <h3 id={id} className="text-base font-semibold leading-snug break-words">{title}</h3>
    {lines.filter((line): line is string => Boolean(line)).map((line) => <ClampedLine key={line} value={line} />)}
  </div>;
}

export function InputStep({ role, files, answer, onAnswer }: { role: WorkflowInputRole; files: string[]; answer: InputAnswer | undefined; onAnswer: (answer: InputAnswer) => void }) {
  const id = useId();
  const fitting = files.filter((path) => accepts(path, role.extensions));
  const others = files.filter((path) => !accepts(path, role.extensions));
  const formats = role.extensions.join(", ");
  const otherPath = answer?.mode === "other" ? answer.path : "";
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} title={text(role.label)} lines={[t(role.required ? "workspace.setup.input.required" : "workspace.setup.input.optional", { formats }), role.requiredWhen ? t("workspace.setup.when", { condition: text(role.requiredWhen) }) : null]} />
    {fitting.length === 0 && <p className="rounded-md bg-gaid-face-2 px-3 py-2 text-sm">{t("workspace.setup.input.empty")}</p>}
    <div role="radiogroup" aria-labelledby={id} className="space-y-2">
      {fitting.map((path) => <OptionCard key={path} selected={answer?.mode === "file" && answer.path === path} onSelect={() => onAnswer({ mode: "file", path })}
          title={baseName(path)} hint={folderName(path)} />)}
      {others.length > 0 && <OptionCard selected={answer?.mode === "other"} onSelect={() => onAnswer({ mode: "other", path: otherPath })} title={t("workspace.setup.input.other")}>
        <select aria-label={t("workspace.setup.input.otherField")} className={fieldClass} value={otherPath} onChange={(event) => onAnswer({ mode: "other", path: event.target.value })}>
          <option value="">{t("workspace.setup.input.pick")}</option>
          {others.map((path) => <option key={path} value={path}>{path}</option>)}
        </select>
      </OptionCard>}
      {!role.required && <OptionCard selected={answer?.mode === "none"} onSelect={() => onAnswer({ mode: "none" })} title={t("workspace.setup.input.none")} />}
    </div>
  </section>;
}

export function ChoiceStep({ choice, answer, recipeValue, onAnswer }: { choice: WorkflowChoice; answer: ChoiceAnswer | undefined; recipeValue?: string; onAnswer: (answer: ChoiceAnswer) => void }) {
  const id = useId();
  const options = choice.options ?? [];
  const otherValue = answer?.mode === "other" ? answer.value : "";
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} title={text(choice.label)} lines={[text(choice.why), choice.requiredWhen ? t("workspace.setup.when", { condition: text(choice.requiredWhen) }) : null]} />
    <div role="radiogroup" aria-labelledby={id} className="space-y-2">
      {options.map((option) => <OptionCard key={option} selected={answer?.mode === "option" && answer.value === option} onSelect={() => onAnswer({ mode: "option", value: option })}
        title={optionLabel(choice, option)}
        badge={recipeValue === option ? <Badge variant="outline">{t("workspace.setup.choice.recipe")}</Badge> : undefined} />)}
      <OptionCard selected={answer?.mode === "other"} onSelect={() => onAnswer({ mode: "other", value: otherValue })}
        title={t(options.length ? "workspace.setup.choice.other" : "workspace.setup.choice.free")}
        badge={recipeValue && !options.includes(recipeValue) && otherValue === recipeValue ? <Badge variant="outline">{t("workspace.setup.choice.recipe")}</Badge> : undefined}>
        <input autoFocus aria-label={text(choice.label)} className={fieldClass} value={otherValue} placeholder={t("workspace.setup.choice.placeholder")}
          onChange={(event) => onAnswer({ mode: "other", value: event.target.value })} />
      </OptionCard>
      <OptionCard selected={answer?.mode === "defer"} onSelect={() => onAnswer({ mode: "defer" })} title={t("workspace.setup.decideLater")} hint={t("workspace.setup.choice.deferHint")} />
    </div>
  </section>;
}

export function inputValue(answer: InputAnswer | undefined): string | null {
  if (!answer) return null;
  return answer.mode === "none" ? t("workspace.setup.input.none") : answer.path ? baseName(answer.path) : null;
}
export function choiceValue(choice: WorkflowChoice, answer: ChoiceAnswer | undefined): string {
  if (!answer || answer.mode === "defer" || !answer.value.trim()) return t("workspace.setup.decideLater");
  return answer.mode === "option" ? optionLabel(choice, answer.value) : answer.value.trim();
}

/** Summary rows with Edit links (Q5); the parent adds the limit line, disclosures and the one primary action. */
export type SummaryRow = { step: number; label: string; value: string | null; muted?: boolean; title?: string };

export function SummaryRows({ rows, onEdit }: { rows: SummaryRow[]; onEdit: (step: number) => void }) {
  return <dl className="divide-y rounded-lg border">
    {rows.map((row) => <div key={row.step} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 px-3 py-2 text-sm">
      <dt className="truncate text-muted-foreground" title={row.label}>{row.label}</dt>
      <dd className={cn("min-w-0 truncate", row.value === null ? "text-destructive" : row.muted ? "text-muted-foreground" : "font-medium")} title={row.title ?? row.value ?? undefined}>
        {row.value ?? t("workspace.setup.notChosen")}
      </dd>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-primary" aria-label={t("workspace.setup.editLabel", { label: row.label })} onClick={() => onEdit(row.step)}>
        {t("workspace.setup.edit")}
      </Button>
    </div>)}
  </dl>;
}

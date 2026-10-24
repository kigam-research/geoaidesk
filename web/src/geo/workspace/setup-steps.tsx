"use client";
/**
 * Parts of the Workflow start settings (UI guide Q1–Q6): option cards, one page per analysis-flow stage holding its input
 * files and conditions (gaid-workflow-stages), and the summary. State lives in TaskSetup and the window in StartWindow; these components only render a step.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeoWorkflowSummary, WorkflowChoice, WorkflowInputRole } from "@/geo/contracts/workspace";
import { hasGeoText, t } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { isExamplePath, sizeText } from "@/geo/contracts/workflow-examples";
import { workflowStages } from "@/geo/contracts/workflow-stages";
import { INPUT_FALLBACK_KINDS, type InputFallbackKind } from "@/geo/contracts/workflow-doc";
import { accepts, text } from "./api";
import { ClampedText } from "./start-intro";

/**
 * An input role answer: a fitting file, another project file, several files (a `multiple` input), the Workflow's example
 * data, no data with how the AI agent fills it (`fallback`, gaid-input-fallback), or (optional roles only) not used.
 */
export type InputAnswer = { mode: "file" | "other"; path: string } | { mode: "files"; paths: string[] } | { mode: "example" }
  | { mode: "fallback"; kind: InputFallbackKind; note: string } | { mode: "none" };
/** An analysis condition answer: a listed option, own text, or decided in the chat (`defer`). */
export type ChoiceAnswer = { mode: "option" | "other"; value: string } | { mode: "defer" };

/** Choices of a stage page under the title of the Workflow step that uses them (null: no step names them). */
export interface ChoiceGroup { title: string | null; choices: WorkflowChoice[] }

/**
 * One page of the start window (gaid-workflow-stages): a stage of the analysis flow with every input and condition it
 * uses, or, for Workflows whose steps do not map them (`grouped`), "입력 자료" and "분석 조건".
 */
export interface StagePageModel {
  id: string;
  kind: "flow" | "grouped";
  title: string;
  /** What the Workflow step does (flow pages). */
  does: string | null;
  roles: WorkflowInputRole[];
  /** Conditions without a default, grouped by the step that names them. */
  groups: ChoiceGroup[];
  /** Conditions with a default (parameters), folded on the page. */
  defaults: WorkflowChoice[];
}

export type SetupStep = { kind: "intro" } | { kind: "stage"; page: StagePageModel } | { kind: "summary" };

export function setupSteps(workflow: GeoWorkflowSummary): SetupStep[] {
  const docSteps = workflow.doc?.steps ?? [];
  const shape = workflowStages({ inputRoles: workflow.inputRoles, choices: workflow.requiredScientificChoices, steps: docSteps });
  const roles = new Map(workflow.inputRoles.map((role) => [role.id, role]));
  const choices = new Map(workflow.requiredScientificChoices.map((choice) => [choice.id, choice]));
  const pick = <T,>(ids: string[], map: Map<string, T>) => ids.flatMap((id) => map.has(id) ? [map.get(id)!] : []);
  const pages = shape.stages.map((stage): StagePageModel => {
    const step = docSteps.find((item) => item.id === stage.id);
    const required = pick(stage.choiceIds, choices);
    // A long "분석 조건" page of an older Workflow is sub-headed by the step that first names each condition.
    let groups: ChoiceGroup[] = [{ title: null, choices: required }];
    if (shape.kind === "grouped" && required.length > 3 && docSteps.some((item) => item.choiceIds.some((id) => stage.choiceIds.includes(id)))) {
      const placed = new Set<string>();
      groups = docSteps.flatMap((item) => {
        const own = required.filter((choice) => item.choiceIds.includes(choice.id) && !placed.has(choice.id));
        own.forEach((choice) => placed.add(choice.id));
        return own.length ? [{ title: text(item.title), choices: own }] : [];
      });
      const rest = required.filter((choice) => !placed.has(choice.id));
      if (rest.length) groups.push({ title: t("workspace.start.otherChoices"), choices: rest });
    }
    return {
      id: stage.id, kind: shape.kind,
      title: stage.title ? text(stage.title) : t(`workspace.start.group.${stage.id === "inputs" ? "input" : "choice"}`),
      does: shape.kind === "flow" && step ? text(step.does) || null : null,
      roles: pick(stage.inputIds, roles), groups: groups.filter((group) => group.choices.length), defaults: pick(stage.defaultIds, choices),
    };
  });
  return [{ kind: "intro" }, ...pages.map((page): SetupStep => ({ kind: "stage", page })), { kind: "summary" }];
}

export const pageChoices = (page: StagePageModel) => [...page.groups.flatMap((group) => group.choices), ...page.defaults];

export function stepName(step: SetupStep): string {
  if (step.kind === "intro") return t("workspace.start.intro");
  return step.kind === "stage" ? step.page.title : t("workspace.setup.summaryTab");
}

/** Short contents line of a stage in the step list ("자료 2개 · 조건 3개 · 기본값 4개"). */
export function stageHint(counts: { inputs: number; choices: number; defaults: number }): string {
  return [
    counts.inputs ? t("workspace.start.hint.inputs", { count: counts.inputs }) : null,
    counts.choices ? t("workspace.start.hint.choices", { count: counts.choices }) : null,
    counts.defaults ? t("workspace.start.hint.defaults", { count: counts.defaults }) : null,
  ].filter(Boolean).join(" · ");
}

/**
 * A required input needs a file; an "other" answer needs its text, a separate instruction its instruction. Unanswered
 * conditions are decided in the chat.
 */
export function inputDone(answer: InputAnswer | undefined): boolean {
  if (answer?.mode === "files") return answer.paths.length > 0;
  if (answer?.mode === "fallback") return answer.kind !== "instruction" || answer.note.trim().length > 0;
  return Boolean(answer && (answer.mode === "none" || answer.mode === "example" || answer.path));
}

/** The project paths an answer binds (none for example data, which the server writes at start). */
export function answerPaths(answer: InputAnswer | undefined): string[] {
  if (!answer) return [];
  if (answer.mode === "files") return answer.paths;
  return (answer.mode === "file" || answer.mode === "other") && answer.path ? [answer.path] : [];
}

/** Example data that can be selected (a broken bundled example cannot). */
export function exampleUsable(role: WorkflowInputRole): boolean {
  return Boolean(role.example && role.example.state !== "broken");
}

export { sizeText };

export function exampleTitle(role: WorkflowInputRole): string {
  return role.example ? text(role.example.title) : "";
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

/**
 * Project files are grouped by folder (user decision gaid-workflow-start-ui #3): files under `user_data/` are the
 * researcher's own data and come first; everything else (outputs/, 연구노트/, …) is an earlier result.
 */
export const isOwnData = (path: string) => path === "user_data" || path.startsWith("user_data/");

const STOP_TOKENS = new Set(["data", "file", "files", "input", "inputs", "table", "the", "and", "raw", "layer", "map"]);
const tokens = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));

/**
 * How well a file name matches an input (F17, gaid-pocheon-trial): the input id's words (`aeromag-lines`) and its English
 * label's words found in the file name (`aeromag_lines.csv`). Names only; file contents are not read.
 */
export function nameScore(role: WorkflowInputRole, path: string): number {
  const words = new Set([...tokens(role.id), ...tokens(role.label.en ?? "")]);
  const name = tokens(baseName(path).replace(/\.[^.]+$/, ""));
  let score = 0;
  for (const word of words) if (name.some((part) => part === word || (word.length >= 4 && part.length >= 4 && (part.startsWith(word) || word.startsWith(part))))) score += 1;
  return score;
}

const depth = (path: string) => path.split("/").length;
/** Fitting files of an input: best name match first, then files nearer the folder top (raw data), then by path. */
export function rankFiles(role: WorkflowInputRole, files: string[]): string[] {
  return [...files].sort((a, b) => nameScore(role, b) - nameScore(role, a) || depth(a) - depth(b) || a.localeCompare(b));
}

/**
 * One file per input whose name matches it better than any other fitting file (F17): the strongest pairs are taken
 * first and a file is used once.
 */
export function nameMatches(roles: WorkflowInputRole[], files: string[]): Record<string, string> {
  const pairs = roles.flatMap((role) => {
    const scored = files.filter((path) => accepts(path, role.extensions)).map((path) => ({ path, score: nameScore(role, path) })).filter((pair) => pair.score > 0);
    const top = Math.max(0, ...scored.map((pair) => pair.score));
    // A tie is settled only by the researcher's own data (user_data/) against earlier results; otherwise not guessed.
    const tied = scored.filter((pair) => pair.score === top);
    const best = tied.length > 1 ? tied.filter((pair) => isOwnData(pair.path)) : tied;
    return best.length === 1 ? [{ role: role.id, path: best[0].path, score: top }] : [];
  }).sort((a, b) => b.score - a.score);
  const chosen: Record<string, string> = {};
  const used = new Set<string>();
  for (const pair of pairs) if (!used.has(pair.path)) { chosen[pair.role] = pair.path; used.add(pair.path); }
  return chosen;
}

/** One selectable row of a radio group (Q2 radio card). */
export function OptionCard({ selected, onSelect, title, hint, badge, children, multiple = false }: { selected: boolean; onSelect: () => void; title: ReactNode; hint?: ReactNode; badge?: ReactNode; children?: ReactNode; multiple?: boolean }) {
  return <div className={cn("rounded-md border border-gaid-edge bg-gaid-face transition-colors", selected ? "border-gaid-signal bg-gaid-signal-tint/40" : "hover:border-gaid-control-edge")}>
    <button type="button" role={multiple ? "checkbox" : "radio"} aria-checked={selected} onClick={onSelect}
      className="flex w-full min-w-0 items-start gap-3 rounded-md px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {multiple
        ? <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-gaid-control-edge bg-gaid-face text-white", selected && "border-gaid-signal bg-gaid-signal")}>
          {selected && <CheckIcon className="size-3" strokeWidth={2.5} />}
        </span>
        : <span aria-hidden className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-gaid-control-edge bg-gaid-face", selected && "border-gaid-signal")}>
          {selected && <span className="size-2 rounded-full bg-gaid-signal" />}
        </span>}
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

export function StepHeading({ id, title, lines, level = 3 }: { id: string; title: string; lines: (string | null | undefined)[]; level?: 3 | 4 }) {
  const Heading = level === 3 ? "h3" : "h4";
  return <div className="space-y-1">
    <Heading id={id} className={cn("font-semibold leading-snug break-words", level === 3 ? "text-base" : "text-[15px]")}>{title}</Heading>
    {lines.filter((line): line is string => Boolean(line)).map((line) => <ClampedLine key={line} value={line} />)}
  </div>;
}

function ExampleHint({ role }: { role: WorkflowInputRole }) {
  const example = role.example!;
  const lines = [
    t("workspace.setup.example.source", { source: text(example.source) }),
    example.license ? t("workspace.setup.example.license", { license: example.license }) : null,
    example.state === "broken" ? t("workspace.setup.example.broken")
      : example.state === "remote" ? t("workspace.setup.example.download", { size: sizeText(example.download) })
      : example.state === "present" ? t("workspace.setup.example.present", { size: sizeText(example.size) })
      : t("workspace.setup.example.bundled", { size: sizeText(example.size) }),
  ].filter((line): line is string => Boolean(line));
  return <span className="flex flex-col gap-0.5">{lines.map((line) => <span key={line}>{line}</span>)}</span>;
}

/**
 * "내 자료가 없을 때" (gaid-input-fallback): the AI agent finds similar public data, generates synthetic data, or follows
 * the researcher's instruction; it asks at the start before acting. Open when the project has no fitting file and the
 * Workflow no example, else folded. Nothing is pre-selected (UI guide Q2: no reason to recommend one).
 */
function FallbackOptions({ answer, onAnswer, open }: { answer: InputAnswer | undefined; onAnswer: (answer: InputAnswer) => void; open: boolean }) {
  const chosen = answer?.mode === "fallback" ? answer : null;
  const [picked, setPicked] = useState(false);
  const cards = INPUT_FALLBACK_KINDS.map((kind) => {
    const selected = chosen?.kind === kind;
    const note = selected ? chosen!.note : "";
    return <OptionCard key={kind} selected={selected} onSelect={() => { setPicked(true); onAnswer({ mode: "fallback", kind, note: chosen?.note ?? "" }); }}
      title={t(`workspace.setup.fallback.${kind}.title`)} hint={t(`workspace.setup.fallback.${kind}.hint`)}>
      {kind === "instruction"
        ? <textarea autoFocus={picked} rows={2} aria-label={t("workspace.setup.fallback.instruction.title")} className={fieldClass} value={note}
          placeholder={t("workspace.setup.fallback.instruction.placeholder")} onChange={(event) => onAnswer({ mode: "fallback", kind, note: event.target.value })} />
        : <input autoFocus={picked} aria-label={t(`workspace.setup.fallback.${kind}.noteLabel`)} className={fieldClass} value={note}
          placeholder={t(`workspace.setup.fallback.${kind}.placeholder`)} onChange={(event) => onAnswer({ mode: "fallback", kind, note: event.target.value })} />}
    </OptionCard>;
  });
  const heading = t("workspace.setup.fallback.heading");
  if (open) return <>
    <p className="flex items-baseline gap-1.5 pt-1 text-[13px] font-semibold text-gaid-ink-2">{heading}</p>
    {cards}
  </>;
  return <details open={Boolean(chosen)} className="group">
    <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-dashed border-gaid-edge px-3 py-2 text-sm text-gaid-ink-2 select-none [&::-webkit-details-marker]:hidden">
      <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
      {heading}
    </summary>
    <div className="mt-2 space-y-2">{cards}</div>
  </details>;
}

export function InputStep({ role, files, answer, onAnswer, onUpload, level = 3, compact = false }: {
  role: WorkflowInputRole; files: string[]; answer: InputAnswer | undefined; onAnswer: (answer: InputAnswer) => void;
  /** Upload the researcher's own files into the project; resolves to the saved project paths. */
  onUpload?: (files: FileList) => Promise<string[]>;
  /** Heading level: 4 when the input is part of a stage page. */
  level?: 3 | 4;
  /** One of several inputs on a page: a chosen file is shown alone, the other candidates one click away. */
  compact?: boolean;
}) {
  const id = useId();
  const picker = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const many = role.multiple === true;
  // Files the server wrote from a Workflow's example data are offered as the example, not as the researcher's own file.
  const own = files.filter((path) => !isExamplePath(path));
  const fitting = rankFiles(role, own.filter((path) => accepts(path, role.extensions)));
  const mine = fitting.filter(isOwnData);
  const earlier = fitting.filter((path) => !isOwnData(path));
  const others = own.filter((path) => !accepts(path, role.extensions));
  const matched = (path: string) => nameScore(role, path) > 0;
  // A `multiple` input (gaid-workflow-stages) takes several files: its file cards are checkboxes.
  const picked = many ? answerPaths(answer) : [];
  const toggle = (path: string) => {
    const paths = picked.includes(path) ? picked.filter((value) => value !== path) : [...picked, path];
    onAnswer(paths.length ? { mode: "files", paths } : role.required ? { mode: "files", paths: [] } : { mode: "none" });
  };
  const chosen = (path: string) => many ? picked.includes(path) : answer?.mode === "file" && answer.path === path;
  const card = (path: string) => <OptionCard key={path} multiple={many} selected={chosen(path)} onSelect={() => many ? toggle(path) : onAnswer({ mode: "file", path })}
    title={baseName(path)} hint={folderName(path)} badge={matched(path) ? <Badge variant="outline" title={t("workspace.start.nameMatchTip")}>{t("workspace.start.nameMatch")}</Badge> : undefined} />;
  const earlierChosen = earlier.some(chosen);
  const formats = role.extensions.join(", ");
  const otherPath = answer?.mode === "other" ? answer.path : "";
  const otherPicked = picked.filter((path) => others.includes(path));
  // On a stage page with several inputs, an input with its file already chosen shows only that file; the other
  // candidates are one click away, so the page stays short (gaid-workflow-stages).
  const chosenFiles = fitting.filter(chosen);
  const [expanded, setExpanded] = useState(() => !compact || chosenFiles.length === 0);
  const upload = async (list: FileList | null) => {
    if (!list?.length || !onUpload) return;
    setUploading(true); setUploadError(false);
    try {
      const saved = await onUpload(list);
      const fit = saved.filter((path) => accepts(path, role.extensions));
      if (many && fit.length) onAnswer({ mode: "files", paths: [...new Set([...picked, ...fit])] });
      else if (fit.length) onAnswer({ mode: "file", path: fit[0] });
    } catch { setUploadError(true); }
    finally { setUploading(false); }
  };
  const need = t(role.required ? "workspace.setup.input.required" : "workspace.setup.input.optional", { formats });
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} level={level} title={text(role.label)} lines={[many ? `${need} · ${t("workspace.setup.input.many")}` : need, role.requiredWhen ? t("workspace.setup.when", { condition: text(role.requiredWhen) }) : null]} />
    {fitting.length === 0 && <p className="rounded-md bg-gaid-face-2 px-3 py-2 text-sm">{t(role.example ? "workspace.setup.input.emptyExample" : "workspace.setup.input.empty")}</p>}
    {onUpload && <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => picker.current?.click()}>
        {t(uploading ? "workspace.setup.input.uploading" : "workspace.setup.input.upload")}
      </Button>
      <input ref={picker} type="file" hidden multiple accept={role.extensions.map((extension) => `.${extension}`).join(",")}
        aria-label={t("workspace.setup.input.upload")}
        onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
      {uploadError && <span role="alert" className="text-sm text-destructive">{t("workspace.setup.input.uploadFailed")}</span>}
    </div>}
    <div role={many ? "group" : "radiogroup"} aria-labelledby={id} className="space-y-2">
      {!expanded && <>
        {chosenFiles.map(card)}
        <button type="button" aria-expanded={false} onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-gaid-edge px-3 py-2 text-left text-sm text-gaid-ink-2 hover:bg-gaid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRightIcon className="size-3.5" aria-hidden />
          {t("workspace.setup.input.showAll")}<span className="text-gaid-ink-3 tabular-nums">{fitting.length - chosenFiles.length + others.length}</span>
        </button>
      </>}
      {expanded && <>
      {mine.length > 0 && <p className="flex items-baseline gap-1.5 text-[13px] font-semibold text-gaid-ink-2">{t("workspace.start.mine")}<span className="font-medium text-gaid-ink-3 tabular-nums">{mine.length}</span></p>}
      {mine.map(card)}
      {earlier.length > 0 && <details open={earlierChosen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-dashed border-gaid-edge px-3 py-2 text-sm text-gaid-ink-2 select-none [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
          {t("workspace.start.earlier")}<span className="text-gaid-ink-3 tabular-nums">{earlier.length}</span>
        </summary>
        <div className="mt-2 space-y-2">{earlier.map(card)}</div>
      </details>}
      {otherPicked.map(card)}
      {role.example && <OptionCard selected={answer?.mode === "example"} onSelect={() => exampleUsable(role) && onAnswer({ mode: "example" })}
        title={t("workspace.setup.example.use", { title: exampleTitle(role) })}
        badge={<><Badge variant="outline">{t("workspace.setup.example.badge")}</Badge>{role.example.synthetic && <Badge variant="outline">{t("workspace.setup.example.synthetic")}</Badge>}</>}
        hint={<ExampleHint role={role} />} />}
      {others.length > 0 && !many && <OptionCard selected={answer?.mode === "other"} onSelect={() => onAnswer({ mode: "other", path: otherPath })} title={t("workspace.setup.input.other")}>
        <select aria-label={t("workspace.setup.input.otherField")} className={fieldClass} value={otherPath} onChange={(event) => onAnswer({ mode: "other", path: event.target.value })}>
          <option value="">{t("workspace.setup.input.pick")}</option>
          {others.map((path) => <option key={path} value={path}>{path}</option>)}
        </select>
      </OptionCard>}
      {others.length > otherPicked.length && many && <select aria-label={t("workspace.setup.input.addOther")} className={fieldClass} value=""
        onChange={(event) => event.target.value && onAnswer({ mode: "files", paths: [...picked, event.target.value] })}>
        <option value="">{t("workspace.setup.input.addOther")}</option>
        {others.filter((path) => !picked.includes(path)).map((path) => <option key={path} value={path}>{path}</option>)}
      </select>}
      <FallbackOptions answer={answer} onAnswer={onAnswer} open={fitting.length === 0 && !role.example} />
      {!role.required && <OptionCard selected={answer?.mode === "none"} onSelect={() => onAnswer({ mode: "none" })} title={t("workspace.setup.input.none")} />}
      </>}
    </div>
  </section>;
}

export function ChoiceStep({ choice, answer, recipeValue, onAnswer, level = 3 }: { choice: WorkflowChoice; answer: ChoiceAnswer | undefined; recipeValue?: string; onAnswer: (answer: ChoiceAnswer) => void; level?: 3 | 4 }) {
  const id = useId();
  const options = choice.options ?? [];
  const otherValue = answer?.mode === "other" ? answer.value : "";
  // Focus the text field only when the researcher picks it, not for a value set before (a default, a saved setting):
  // a stage page holds several conditions.
  const [picked, setPicked] = useState(false);
  const fallback = choice.default?.trim();
  const tag = (value: string) => recipeValue === value ? <Badge variant="outline">{t("workspace.setup.choice.recipe")}</Badge>
    : fallback === value ? <Badge variant="outline">{t("workspace.setup.choice.default")}</Badge> : undefined;
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} level={level} title={text(choice.label)} lines={[text(choice.why), choice.requiredWhen ? t("workspace.setup.when", { condition: text(choice.requiredWhen) }) : null]} />
    <div role="radiogroup" aria-labelledby={id} className="space-y-2">
      {options.map((option) => <OptionCard key={option} selected={answer?.mode === "option" && answer.value === option} onSelect={() => onAnswer({ mode: "option", value: option })}
        title={optionLabel(choice, option)} badge={tag(option)} />)}
      <OptionCard selected={answer?.mode === "other"} onSelect={() => { setPicked(true); onAnswer({ mode: "other", value: otherValue }); }}
        title={t(options.length ? "workspace.setup.choice.other" : "workspace.setup.choice.free")}
        badge={otherValue && !options.includes(otherValue) ? tag(otherValue) : undefined}>
        <input autoFocus={picked} aria-label={text(choice.label)} className={fieldClass} value={otherValue} placeholder={t("workspace.setup.choice.placeholder")}
          onChange={(event) => onAnswer({ mode: "other", value: event.target.value })} />
      </OptionCard>
      <OptionCard selected={answer?.mode === "defer"} onSelect={() => onAnswer({ mode: "defer" })} title={t("workspace.setup.decideLater")} hint={t("workspace.setup.choice.deferHint")} />
    </div>
  </section>;
}

/** Element id of an input or condition on a stage page (the summary's Edit scrolls to it). */
export const itemAnchor = (id: string) => `gaid-setup-item-${id}`;

/**
 * One stage page (gaid-workflow-stages): every input file and condition of one analysis-flow stage, conditions with a
 * default folded under "기본값 n개" (open when the summary's Edit leads to one of them).
 */
export function StagePage({ page, files, inputs, choices, recipeChoices, onInput, onChoice, onUpload, defaultsOpen, onDefaultsOpen, focus }: {
  page: StagePageModel; files: string[];
  inputs: Record<string, InputAnswer>; choices: Record<string, ChoiceAnswer>; recipeChoices?: Record<string, string>;
  onInput: (id: string, answer: InputAnswer) => void; onChoice: (id: string, answer: ChoiceAnswer) => void;
  onUpload?: (files: FileList) => Promise<string[]>;
  defaultsOpen: boolean; onDefaultsOpen: (open: boolean) => void;
  /** Input or condition id to scroll to (from the summary's Edit). */
  focus?: string | null;
}) {
  const id = useId();
  useEffect(() => {
    if (focus) document.getElementById(itemAnchor(focus))?.scrollIntoView?.({ block: "start" });
  }, [focus, defaultsOpen]);
  const choice = (item: WorkflowChoice) => <div key={item.id} id={itemAnchor(item.id)} className="scroll-mt-4 border-t border-gaid-edge pt-5">
    <ChoiceStep level={4} choice={item} answer={choices[item.id]} recipeValue={recipeChoices?.[item.id]} onAnswer={(answer) => onChoice(item.id, answer)} />
  </div>;
  const changed = page.defaults.filter((item) => {
    const answer = choices[item.id];
    return !(answer && answer.mode !== "defer" && answer.value.trim() === item.default?.trim());
  }).length;
  return <section aria-labelledby={id} className="space-y-6">
    <div className="space-y-1">
      <h3 id={id} className="text-base font-semibold leading-snug break-words">{page.title}</h3>
      {page.does && <p className="text-sm text-muted-foreground break-words"><ClampedText value={page.does} /></p>}
    </div>
    {page.roles.map((role) => <div key={role.id} id={itemAnchor(role.id)} className="scroll-mt-4 border-t border-gaid-edge pt-5">
      <InputStep level={4} compact={page.roles.length > 1} role={role} files={files} answer={inputs[role.id]} onAnswer={(answer) => onInput(role.id, answer)} onUpload={onUpload} />
    </div>)}
    {page.groups.map((group, g) => <div key={group.title ?? `group-${g}`} className="space-y-5">
      {group.title && <p className="-mb-2 text-[13px] font-semibold text-gaid-ink-2">{group.title}</p>}
      {group.choices.map(choice)}
    </div>)}
    {page.defaults.length > 0 && <details open={defaultsOpen} onToggle={(event) => onDefaultsOpen(event.currentTarget.open)} className="group rounded-md border border-gaid-edge">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm select-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-3.5 self-center transition-transform group-open:rotate-90" aria-hidden />
        <span className="font-medium">{t("workspace.start.defaults", { count: page.defaults.length })}</span>
        <span className="text-[13px] text-gaid-ink-2">{changed ? t("workspace.start.defaultsChanged", { count: changed }) : t("workspace.start.defaultsHint")}</span>
      </summary>
      <div className="space-y-5 px-3 pb-4">{page.defaults.map(choice)}</div>
    </details>}
  </section>;
}

export function inputValue(answer: InputAnswer | undefined, role?: WorkflowInputRole): string | null {
  if (!answer) return null;
  if (answer.mode === "example") return t("workspace.setup.example.value", { title: role ? exampleTitle(role) : "" });
  if (answer.mode === "fallback") return answer.kind === "instruction" && answer.note.trim()
    ? t("workspace.setup.fallback.instruction.value", { note: answer.note.trim() }) : t(`workspace.setup.fallback.${answer.kind}.value`);
  if (answer.mode === "files") return answer.paths.length > 1 ? t("workspace.setup.input.files", { first: baseName(answer.paths[0]), rest: answer.paths.length - 1 }) : answer.paths.length ? baseName(answer.paths[0]) : null;
  return answer.mode === "none" ? t("workspace.setup.input.none") : answer.path ? baseName(answer.path) : null;
}
export function choiceValue(choice: WorkflowChoice, answer: ChoiceAnswer | undefined): string {
  if (!answer || answer.mode === "defer" || !answer.value.trim()) return t("workspace.setup.decideLater");
  return answer.mode === "option" ? optionLabel(choice, answer.value) : answer.value.trim();
}

/** Summary rows with Edit links (Q5); the parent adds the limit line, disclosures and the one primary action. */
export type SummaryRow = {
  step: number; label: string; value: string | null; muted?: boolean; title?: string; group?: string; note?: string;
  /** A neutral line under the value (e.g. 기본값 for an unchanged parameter). */
  hint?: string;
  /** The input or condition the Edit link leads to on its stage page. */
  target?: string;
};

export function SummaryRows({ rows, onEdit }: { rows: SummaryRow[]; onEdit: (step: number, target?: string) => void }) {
  return <div className="divide-y rounded-lg border">
    {rows.map((row, i) => <div key={row.target ?? `${row.step}:${i}`}>
      {row.group && row.group !== rows[i - 1]?.group && <p className="px-3 pt-2 text-xs font-semibold text-gaid-ink-3">{row.group}</p>}
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 px-3 py-1.5 text-sm">
      <dt className="truncate text-muted-foreground" title={row.label}>{row.label}</dt>
      <dd className={cn("min-w-0", row.value === null ? "text-destructive" : row.muted ? "text-muted-foreground" : "font-medium")} title={row.title ?? row.value ?? undefined}>
        <span className="block truncate">{row.value ?? t("workspace.setup.notChosen")}</span>
        {row.hint && <span className="block text-xs font-normal text-gaid-ink-3">{row.hint}</span>}
        {row.note && <span className="block text-xs font-normal text-gaid-warning">{row.note}</span>}
      </dd>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-primary" aria-label={t("workspace.setup.editLabel", { label: row.label })} onClick={() => onEdit(row.step, row.target)}>
        {t("workspace.setup.edit")}
      </Button>
      </dl>
    </div>)}
  </div>;
}

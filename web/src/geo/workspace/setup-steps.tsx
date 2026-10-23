"use client";
/**
 * Parts of the Workflow start settings (UI guide Q1–Q6): option cards, one step per input file or analysis condition,
 * and the summary. State lives in TaskSetup and the window in StartWindow; these components only render a step.
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GeoWorkflowSummary, WorkflowChoice, WorkflowInputRole } from "@/geo/contracts/workspace";
import { hasGeoText, t } from "@/geo/i18n";
import { cn } from "@/lib/utils";
import { isExamplePath, sizeText } from "@/geo/contracts/workflow-examples";
import { accepts, text } from "./api";

/** An input role answer: a fitting file, another project file, the Workflow's example data, or (optional roles only) not used. */
export type InputAnswer = { mode: "file" | "other"; path: string } | { mode: "example" } | { mode: "none" };
/** An analysis condition answer: a listed option, own text, or decided in the chat (`defer`). */
export type ChoiceAnswer = { mode: "option" | "other"; value: string } | { mode: "defer" };

export type SetupStep =
  | { kind: "intro" }
  | { kind: "input"; role: WorkflowInputRole }
  | { kind: "choice"; choice: WorkflowChoice }
  | { kind: "summary" };

export function setupSteps(workflow: GeoWorkflowSummary): SetupStep[] {
  return [
    { kind: "intro" },
    ...workflow.inputRoles.map((role): SetupStep => ({ kind: "input", role })),
    ...workflow.requiredScientificChoices.map((choice): SetupStep => ({ kind: "choice", choice })),
    { kind: "summary" },
  ];
}

export function stepName(step: SetupStep): string {
  if (step.kind === "intro") return t("workspace.start.intro");
  return step.kind === "input" ? text(step.role.label) : step.kind === "choice" ? text(step.choice.label) : t("workspace.setup.summaryTab");
}

/** A required input needs a file; an "other" answer needs its text. Unanswered conditions are decided in the chat. */
export function inputDone(answer: InputAnswer | undefined): boolean {
  return Boolean(answer && (answer.mode === "none" || answer.mode === "example" || answer.path));
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

export function StepHeading({ id, title, lines }: { id: string; title: string; lines: (string | null | undefined)[] }) {
  return <div className="space-y-1">
    <h3 id={id} className="text-base font-semibold leading-snug break-words">{title}</h3>
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

export function InputStep({ role, files, answer, onAnswer, onUpload }: {
  role: WorkflowInputRole; files: string[]; answer: InputAnswer | undefined; onAnswer: (answer: InputAnswer) => void;
  /** Upload the researcher's own files into the project; resolves to the saved project paths. */
  onUpload?: (files: FileList) => Promise<string[]>;
}) {
  const id = useId();
  const picker = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  // Files the server wrote from a Workflow's example data are offered as the example, not as the researcher's own file.
  const own = files.filter((path) => !isExamplePath(path));
  const fitting = rankFiles(role, own.filter((path) => accepts(path, role.extensions)));
  const mine = fitting.filter(isOwnData);
  const earlier = fitting.filter((path) => !isOwnData(path));
  const others = own.filter((path) => !accepts(path, role.extensions));
  const matched = (path: string) => nameScore(role, path) > 0;
  const card = (path: string) => <OptionCard key={path} selected={answer?.mode === "file" && answer.path === path} onSelect={() => onAnswer({ mode: "file", path })}
    title={baseName(path)} hint={folderName(path)} badge={matched(path) ? <Badge variant="outline" title={t("workspace.start.nameMatchTip")}>{t("workspace.start.nameMatch")}</Badge> : undefined} />;
  const earlierChosen = answer?.mode === "file" && earlier.includes(answer.path);
  const formats = role.extensions.join(", ");
  const otherPath = answer?.mode === "other" ? answer.path : "";
  const upload = async (list: FileList | null) => {
    if (!list?.length || !onUpload) return;
    setUploading(true); setUploadError(false);
    try {
      const saved = await onUpload(list);
      const fit = saved.find((path) => accepts(path, role.extensions));
      if (fit) onAnswer({ mode: "file", path: fit });
    } catch { setUploadError(true); }
    finally { setUploading(false); }
  };
  return <section aria-labelledby={id} className="space-y-4">
    <StepHeading id={id} title={text(role.label)} lines={[t(role.required ? "workspace.setup.input.required" : "workspace.setup.input.optional", { formats }), role.requiredWhen ? t("workspace.setup.when", { condition: text(role.requiredWhen) }) : null]} />
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
    <div role="radiogroup" aria-labelledby={id} className="space-y-2">
      {mine.length > 0 && <p className="flex items-baseline gap-1.5 text-[13px] font-semibold text-gaid-ink-2">{t("workspace.start.mine")}<span className="font-medium text-gaid-ink-3 tabular-nums">{mine.length}</span></p>}
      {mine.map(card)}
      {earlier.length > 0 && <details open={earlierChosen} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-dashed border-gaid-edge px-3 py-2 text-sm text-gaid-ink-2 select-none [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
          {t("workspace.start.earlier")}<span className="text-gaid-ink-3 tabular-nums">{earlier.length}</span>
        </summary>
        <div className="mt-2 space-y-2">{earlier.map(card)}</div>
      </details>}
      {role.example && <OptionCard selected={answer?.mode === "example"} onSelect={() => exampleUsable(role) && onAnswer({ mode: "example" })}
        title={t("workspace.setup.example.use", { title: exampleTitle(role) })}
        badge={<><Badge variant="outline">{t("workspace.setup.example.badge")}</Badge>{role.example.synthetic && <Badge variant="outline">{t("workspace.setup.example.synthetic")}</Badge>}</>}
        hint={<ExampleHint role={role} />} />}
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

export function inputValue(answer: InputAnswer | undefined, role?: WorkflowInputRole): string | null {
  if (!answer) return null;
  if (answer.mode === "example") return t("workspace.setup.example.value", { title: role ? exampleTitle(role) : "" });
  return answer.mode === "none" ? t("workspace.setup.input.none") : answer.path ? baseName(answer.path) : null;
}
export function choiceValue(choice: WorkflowChoice, answer: ChoiceAnswer | undefined): string {
  if (!answer || answer.mode === "defer" || !answer.value.trim()) return t("workspace.setup.decideLater");
  return answer.mode === "option" ? optionLabel(choice, answer.value) : answer.value.trim();
}

/** Summary rows with Edit links (Q5); the parent adds the limit line, disclosures and the one primary action. */
export type SummaryRow = { step: number; label: string; value: string | null; muted?: boolean; title?: string; group?: string; note?: string };

export function SummaryRows({ rows, onEdit }: { rows: SummaryRow[]; onEdit: (step: number) => void }) {
  return <div className="divide-y rounded-lg border">
    {rows.map((row, i) => <div key={row.step}>
      {row.group && row.group !== rows[i - 1]?.group && <p className="px-3 pt-2 text-xs font-semibold text-gaid-ink-3">{row.group}</p>}
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 px-3 py-1.5 text-sm">
      <dt className="truncate text-muted-foreground" title={row.label}>{row.label}</dt>
      <dd className={cn("min-w-0", row.value === null ? "text-destructive" : row.muted ? "text-muted-foreground" : "font-medium")} title={row.title ?? row.value ?? undefined}>
        <span className="block truncate">{row.value ?? t("workspace.setup.notChosen")}</span>
        {row.note && <span className="block text-xs font-normal text-gaid-warning">{row.note}</span>}
      </dd>
      <Button variant="ghost" size="sm" className="h-7 px-2 text-primary" aria-label={t("workspace.setup.editLabel", { label: row.label })} onClick={() => onEdit(row.step)}>
        {t("workspace.setup.edit")}
      </Button>
      </dl>
    </div>)}
  </div>;
}

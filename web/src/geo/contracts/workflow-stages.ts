/**
 * Analysis-flow stages of a Workflow (gaid-workflow-stages; user decision 2026-10-23). A Workflow is split by the
 * research or data-analysis flow (자료 준비 → 처리·모델링 → 평가 → 해석·결과), never one stage per input or choice:
 * 3-5 `steps`, each naming the input roles (`inputIds`) and the choices (`choiceIds`) it first uses, at most
 * `MAX_REQUIRED_CHOICES` choices the researcher must answer; every other parameter is a choice with a `default`, shown
 * and editable in the start summary.
 *
 * The start window shows 소개 → one page per stage that has something to set → 요약 (at most `MAX_RAIL` entries).
 * Workflows stored before stages are grouped for display only (`workflowStages`); stored data is never rewritten.
 *
 * IO-free and shared by server (package/registration checks, authoring repair) and web (start window).
 */
import type { Localized } from "./workspace";

export const MIN_STAGES = 3;
export const MAX_STAGES = 5;
/** Choices without a `default` that the researcher answers on the stage pages. */
export const MAX_REQUIRED_CHOICES = 6;
/** Start window rail: 소개 + stages + 요약. */
export const MAX_RAIL = MAX_STAGES + 2;

export interface StageInputRole { id: string; label?: Localized }
export interface StageChoice { id: string; label?: Localized; default?: string | null }
export interface StageStep { id: string; title: Localized; inputIds?: string[]; choiceIds?: string[] }

export interface WorkflowStageShape {
  inputRoles: StageInputRole[];
  choices: StageChoice[];
  steps: StageStep[];
}

export interface WorkflowStage {
  /** The step id (`flow`), or `inputs` / `choices` for the two display pages of an ungrouped Workflow. */
  id: string;
  /** The step title; null for `inputs` / `choices` (the screen names those pages). */
  title: Localized | null;
  inputIds: string[];
  /** Choices without a default first asked here. */
  choiceIds: string[];
  /** Choices with a default that belong here (shown folded on the page and listed in the summary). */
  defaultIds: string[];
}

export interface WorkflowStages {
  /**
   * `flow`: one page per Workflow step that has something to set. `grouped`: the Workflow's steps do not map its
   * inputs and choices into at most `MAX_STAGES` pages (older Workflows), so it shows "입력 자료" and "분석 조건".
   */
  kind: "flow" | "grouped";
  stages: WorkflowStage[];
}

export const hasDefault = (choice: StageChoice) => typeof choice.default === "string" && choice.default.trim() !== "";

/**
 * Group a Workflow's inputs and choices into start-window pages. Steps keep their order; an input or choice no step
 * names goes to the first page that has inputs (inputs) or to the first page (choices). Steps with nothing to set get
 * no page. When the steps name nothing, or more than `MAX_STAGES` pages remain, the Workflow is `grouped`.
 */
export function workflowStages(shape: WorkflowStageShape): WorkflowStages {
  const inputIds = shape.inputRoles.map((role) => role.id);
  const defaults = new Set(shape.choices.filter(hasDefault).map((choice) => choice.id));
  const choiceIds = shape.choices.map((choice) => choice.id);
  const knownInput = new Set(inputIds);
  const knownChoice = new Set(choiceIds);
  const mapped = shape.steps.some((step) => (step.inputIds ?? []).some((id) => knownInput.has(id)) || (step.choiceIds ?? []).some((id) => knownChoice.has(id)));

  const grouped = (): WorkflowStages => ({
    kind: "grouped",
    stages: [
      ...(inputIds.length ? [{ id: "inputs", title: null, inputIds, choiceIds: [], defaultIds: [] }] : []),
      ...(choiceIds.length ? [{ id: "choices", title: null, inputIds: [], choiceIds: choiceIds.filter((id) => !defaults.has(id)), defaultIds: choiceIds.filter((id) => defaults.has(id)) }] : []),
    ],
  });
  if (!mapped) return grouped();

  const seenInput = new Set<string>();
  const seenChoice = new Set<string>();
  const stages: WorkflowStage[] = shape.steps.map((step) => {
    const inputs = (step.inputIds ?? []).filter((id) => knownInput.has(id) && !seenInput.has(id));
    inputs.forEach((id) => seenInput.add(id));
    const choices = (step.choiceIds ?? []).filter((id) => knownChoice.has(id) && !seenChoice.has(id));
    choices.forEach((id) => seenChoice.add(id));
    return { id: step.id, title: step.title, inputIds: inputs, choiceIds: choices.filter((id) => !defaults.has(id)), defaultIds: choices.filter((id) => defaults.has(id)) };
  });
  const restInputs = inputIds.filter((id) => !seenInput.has(id));
  const restChoices = choiceIds.filter((id) => !seenChoice.has(id));
  if (restInputs.length) {
    const target = stages.find((stage) => stage.inputIds.length) ?? stages[0];
    // Keep the Workflow's input order on that page.
    target.inputIds = inputIds.filter((id) => target.inputIds.includes(id) || restInputs.includes(id));
  }
  if (restChoices.length) {
    const target = stages[0];
    target.choiceIds.push(...restChoices.filter((id) => !defaults.has(id)));
    target.defaultIds.push(...restChoices.filter((id) => defaults.has(id)));
  }
  const pages = stages.filter((stage) => stage.inputIds.length || stage.choiceIds.length || stage.defaultIds.length);
  return pages.length > MAX_STAGES ? grouped() : { kind: "flow", stages: pages };
}

export type StageWarningCode =
  /** More than `MAX_STAGES` steps, or fewer than `MIN_STAGES`. */
  | "stage-count"
  /** More than `MAX_REQUIRED_CHOICES` choices without a default. */
  | "required-choices"
  /** Steps split item by item (most steps carry exactly one input or one choice and are named after it). */
  | "item-split"
  /** An input role no step names in `inputIds`. */
  | "unmapped-input"
  /** A step names an unknown input role. */
  | "unknown-input";

export interface StageWarning { code: StageWarningCode; detail: string }

const norm = (value: Localized | undefined | null) => (value?.ko ?? "").replace(/\s+/g, "").toLowerCase();

/**
 * Shape warnings for a Workflow written for stages (authoring repair, package and registration checks). Older
 * Workflows get the same warnings; they only change what the researcher is told, never stored data.
 */
export function stageWarnings(shape: WorkflowStageShape): StageWarning[] {
  const warnings: StageWarning[] = [];
  const steps = shape.steps;
  if (steps.length < MIN_STAGES || steps.length > MAX_STAGES)
    warnings.push({ code: "stage-count", detail: `workflow.steps has ${steps.length} steps; use ${MIN_STAGES}-${MAX_STAGES} analysis-flow stages` });
  const required = shape.choices.filter((choice) => !hasDefault(choice));
  if (required.length > MAX_REQUIRED_CHOICES)
    warnings.push({ code: "required-choices", detail: `${required.length} choices without a default; at most ${MAX_REQUIRED_CHOICES} — give the others a default` });
  const known = new Set(shape.inputRoles.map((role) => role.id));
  const named = new Set(steps.flatMap((step) => step.inputIds ?? []));
  for (const step of steps)
    for (const id of step.inputIds ?? []) if (!known.has(id)) warnings.push({ code: "unknown-input", detail: `workflow.steps.${step.id}.inputIds: unknown input ${id}` });
  for (const role of shape.inputRoles)
    if (!named.has(role.id)) warnings.push({ code: "unmapped-input", detail: `input ${role.id} is not named in any step's inputIds` });
  // Item-by-item: at least three steps that each hold exactly one input or choice and are titled after it.
  const labels = new Map<string, string>([
    ...shape.inputRoles.map((role) => [role.id, norm(role.label)] as [string, string]),
    ...shape.choices.map((choice) => [choice.id, norm(choice.label)] as [string, string]),
  ]);
  const itemSteps = steps.filter((step) => {
    const items = [...(step.inputIds ?? []), ...(step.choiceIds ?? [])];
    if (items.length !== 1) return false;
    const title = norm(step.title);
    const label = labels.get(items[0]) ?? "";
    return Boolean(title && label && (title.includes(label) || label.includes(title)));
  });
  if (itemSteps.length >= 3)
    warnings.push({ code: "item-split", detail: `steps ${itemSteps.map((step) => step.id).join(", ")} are one input or choice each; group steps by the analysis flow` });
  return warnings;
}

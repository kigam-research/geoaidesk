"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { t } from "@/geo/i18n";
import type { GeoWorkflowSummary, GeoRecipeCheckResponse, GeoExposureMode } from "@/geo/contracts/workspace";
import type { SkillInfo } from "@/lib/capabilities";
import { accepts, request, taskDraft, text } from "./api";
import { startGeoTask } from "./events";
import { WorkflowInstructions } from "@/geo/workflow/workflow-view";
import { workflowStartMessage } from "@/geo/workflow/render";
import { ReadinessNotice } from "./readiness";
import { DeleteRecipe } from "./recipe-add";
import { ChoiceStep, InputStep, StepRail, SummaryRows, choiceDone, choiceValue, inputDone, inputValue, setupSteps, stepName, type ChoiceAnswer, type InputAnswer, type SummaryRow } from "./setup-steps";

export const fieldClass = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkflowOutputs({ workflow }: { workflow: GeoWorkflowSummary }) {
  return <div className="space-y-2 text-xs break-words">
    <p>{t("workspace.catalogue.outputs", { outputs: workflow.expectedArtifacts.map((artifact) => text(artifact.label)).join(", ") })}</p>
    {workflow.boundary && <p>{t("workspace.catalogue.boundary", { boundary: text(workflow.boundary) })}</p>}
  </div>;
}

function initialInputs(workflow: GeoWorkflowSummary, files: string[], initialBindings: Record<string, string>): Record<string, InputAnswer> {
  const answers: Record<string, InputAnswer> = {};
  for (const role of workflow.inputRoles) {
    const bound = initialBindings[role.id];
    // A required input with exactly one fitting file in the project starts bound to it (gaid-hub trial: one CSV, still
    // had to be picked by hand). An optional input starts unused; it is not a scientific parameter (UI guide Q2).
    const fitting = files.filter((path) => accepts(path, role.extensions));
    if (bound) answers[role.id] = { mode: accepts(bound, role.extensions) ? "file" : "other", path: bound };
    else if (role.required && fitting.length === 1) answers[role.id] = { mode: "file", path: fitting[0] };
    else if (!role.required) answers[role.id] = { mode: "none" };
  }
  return answers;
}

function initialChoices(workflow: GeoWorkflowSummary, setup: GeoRecipeCheckResponse["setup"] | undefined): Record<string, ChoiceAnswer> {
  const answers: Record<string, ChoiceAnswer> = {};
  for (const choice of workflow.requiredScientificChoices) {
    // A choice the recipe left unresolved stays open even when it also carries a value (geo-start/v1 `choice-state`).
    const value = setup?.choices[choice.id];
    if (setup?.unresolvedChoices.includes(choice.id)) answers[choice.id] = { mode: "defer" };
    else if (value) answers[choice.id] = { mode: choice.options?.includes(value) ? "option" : "other", value };
  }
  return answers;
}

/**
 * Workflow start settings (UI guide Q1–Q6): one input file or analysis condition per step, a grouped step rail,
 * a summary with Edit links and one primary action that puts a start draft into a new chat (never sent).
 */
export function TaskSetup({ workflow, projectId, availableFiles, open, onOpenChange, onRefresh, initialBindings = {}, initialSetup, recipe, exposure }: {
  workflow: GeoWorkflowSummary; projectId: string; availableFiles: string[]; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void | Promise<void>;
  initialBindings?: Record<string, string>; initialSetup?: GeoRecipeCheckResponse["setup"];
  exposure?: string;
  /** Set when the setup comes from a saved recipe (gaid-workflow-catalog). */
  recipe?: { title: string; onDelete: () => Promise<void> };
}) {
  const files = [...new Set([...availableFiles, ...Object.values(initialBindings)])].sort();
  const steps = setupSteps(workflow);
  const summary = steps.length - 1;
  const [inputs, setInputs] = useState(() => initialInputs(workflow, files, initialBindings));
  const [choices, setChoices] = useState(() => initialChoices(workflow, initialSetup));
  const done = (i: number) => {
    const step = steps[i];
    return step.kind === "input" ? inputDone(inputs[step.role.id]) : step.kind === "choice" ? choiceDone(choices[step.choice.id]) : false;
  };
  // A setup opened with earlier answers (recipe, method defaults, file suggestion) starts at the first open required
  // input, else the summary (Q4); a fresh setup starts at step 1.
  const [index, setIndex] = useState(() => {
    if (!recipe && !initialSetup) return 0;
    const open = steps.findIndex((step, i) => step.kind === "input" && step.role.required && !done(i));
    return open < 0 ? summary : open;
  });
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Keep the readiness notice on step 1 after its fix succeeded, so the researcher sees the result (F1).
  const [wasBlocked] = useState(workflow.readiness.state !== "ready");

  const missingInputs = workflow.inputRoles.filter((role) => role.required && !inputDone(inputs[role.id]));
  const state = workflow.readiness.state;
  const blocked = state === "needs-environment" ? t("workspace.setup.blockedEnvironment")
    : state === "missing-skills" ? t("workspace.setup.blockedSkills")
    : state === "unavailable" ? t("workspace.setup.blockedUnavailable")
    : missingInputs.length ? t("workspace.setup.blockedInput", { roles: missingInputs.map((role) => text(role.label)).join(", ") })
    : null;
  const step = steps[index];
  const nextBlocked = step.kind === "input" && step.role.required && !inputDone(inputs[step.role.id]) ? t("workspace.setup.nextBlocked") : null;

  const bindings: Record<string, string> = Object.fromEntries(Object.entries(inputs).flatMap(([id, answer]) => answer.mode !== "none" && answer.path ? [[id, answer.path]] : []));
  const values: Record<string, string> = Object.fromEntries(Object.entries(choices).flatMap(([id, answer]) => answer.mode !== "defer" && answer.value.trim() ? [[id, answer.value.trim()]] : []));

  const start = async () => {
    setBusy(true); setError(null);
    try {
      // gaid-workflow-model: the first message is the Workflow 지침 in a <workflow> block; each step names its skill,
      // so no skill is pinned. A Workflow summary without a document (older server) keeps the previous draft.
      let draft = "";
      let workflowBlock: string | undefined;
      let skills: { id: string; name: string; description: string }[] = [];
      if (workflow.doc) {
        workflowBlock = workflowStartMessage(workflow.doc, bindings, values);
      } else {
        // /skills is the merged list the composer's picker uses, not /skills/all.
        const response = await request<SkillInfo[]>("/skills", projectId);
        const primary = workflow.readiness.skills.find((skill) => skill.id === workflow.skillIds[0]);
        const skill = primary?.enabled ? response.find((row) => row.name === primary.runtimeName) : undefined;
        if (skill) skills = [{ id: skill.id, name: skill.name, description: skill.description }];
        draft = taskDraft(workflow, bindings, values);
      }
      const result = startGeoTask({ title: text(workflow.title), text: draft, ...(workflowBlock ? { workflowBlock } : {}),
        attachedFiles: [...new Set(Object.values(bindings))], skills, geoExposure: (exposure ?? `workflow:${workflow.id}`) as GeoExposureMode });
      if (result !== "opened") { setError({ message: t(`workspace.setup.${result === "tab-limit" ? "tabLimit" : "noWorkspace"}`) }); return; }
      setInputs(initialInputs(workflow, files, {})); setChoices({}); setIndex(0); onOpenChange(false);
    } catch (error) { setError({ message: t("workspace.setup.error"), detail: (error as Error).message }); }
    finally { setBusy(false); }
  };

  const rows: SummaryRow[] = steps.flatMap((row, i): SummaryRow[] => {
    if (row.kind === "input") {
      const answer = inputs[row.role.id];
      return [{ step: i, label: text(row.role.label), value: inputValue(answer), muted: answer?.mode === "none", title: answer && answer.mode !== "none" ? answer.path : undefined }];
    }
    return row.kind === "choice" ? [{ step: i, label: text(row.choice.label), value: choiceValue(row.choice, choices[row.choice.id]), muted: !(row.choice.id in values) }] : [];
  });
  const untested = workflow.readiness.runRecord === "none";
  const undecided = workflow.requiredScientificChoices.filter((choice) => !(choice.id in values)).length;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[min(680px,85dvh)] flex-col gap-0 p-0 sm:max-w-[720px]">
      <div className="space-y-4 border-b px-6 pt-5 pb-4">
        <div className="space-y-1 pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl leading-snug break-words">{recipe?.title ?? text(workflow.title)}</DialogTitle>
            {untested && <Badge variant="outline" title={t("workspace.readiness.untested")}>{t("workspace.badge.untested")}</Badge>}
          </div>
          <DialogDescription className="break-words">{recipe ? t("workspace.saved.based", { title: text(workflow.title) }) : t("workspace.setup.description")}</DialogDescription>
        </div>
        <StepRail steps={steps} index={index} done={done} onSelect={setIndex} />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <p className="sr-only" aria-live="polite">{t("workspace.setup.stepLabel", { n: index + 1, name: stepName(step) })}</p>
        {index === 0 && (state !== "ready" || wasBlocked) && <ReadinessNotice value={workflow.readiness} projectId={projectId} onPrepared={onRefresh} />}
        {step.kind === "input" && <InputStep key={step.role.id} role={step.role} files={files} answer={inputs[step.role.id]} onAnswer={(answer) => setInputs({ ...inputs, [step.role.id]: answer })} />}
        {step.kind === "choice" && <ChoiceStep key={step.choice.id} choice={step.choice} answer={choices[step.choice.id]} recipeValue={initialSetup?.choices[step.choice.id]} onAnswer={(answer) => setChoices({ ...choices, [step.choice.id]: answer })} />}
        {step.kind === "summary" && <section aria-labelledby="gaid-setup-summary" className="space-y-4">
          <div className="space-y-1">
            <h3 id="gaid-setup-summary" className="text-base font-semibold">{t("workspace.setup.summaryTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("workspace.setup.summaryBody")}</p>
          </div>
          {index !== 0 && state !== "ready" && <ReadinessNotice value={workflow.readiness} projectId={projectId} onPrepared={onRefresh} />}
          {rows.length > 0 && <SummaryRows rows={rows} onEdit={setIndex} />}
          {undecided > 0 && <p className="text-sm text-muted-foreground">{t("workspace.setup.undecided", { count: undecided })}</p>}
          <p className="text-sm">{t(untested ? "workspace.setup.limitUntested" : "workspace.setup.limit")}</p>
          {workflow.doc && <WorkflowInstructions doc={workflow.doc} target="chat" settings={{ inputs: bindings, choices: values }} />}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground select-none">{t("workspace.setup.moreResults")}</summary>
            <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2"><WorkflowOutputs workflow={workflow} /></div>
          </details>
        </section>}
        {index === 0 && <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground select-none">{t("workspace.setup.moreAbout")}</summary>
          <div className="mt-2 space-y-2 rounded-lg bg-muted/60 px-3 py-2 text-xs break-words">
            {workflow.description && <p>{text(workflow.description)}</p>}
            <p>{t("workspace.catalogue.inputs", { formats: [...new Set(workflow.inputRoles.flatMap((role) => role.extensions))].join(", ") })}</p>
          </div>
        </details>}
      </div>

      <div className="space-y-2 border-t px-6 py-3">
        {error && <div role="alert" className="space-y-1 text-sm text-destructive"><p>{error.message}</p><TechnicalDetail detail={error.detail} /></div>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{t("workspace.setup.counter", { n: index + 1, total: steps.length })}</span>
          {recipe && index === summary && <DeleteRecipe onDelete={recipe.onDelete} />}
          <span className="ml-auto max-w-[50%] text-right text-xs text-muted-foreground break-words">{index === summary ? blocked : nextBlocked}</span>
          {index > 0 && <Button variant="outline" onClick={() => setIndex(index - 1)}>{t("workspace.setup.prev")}</Button>}
          {index < summary
            ? <Button disabled={Boolean(nextBlocked)} onClick={() => setIndex(index + 1)}>{t(index === summary - 1 ? "workspace.setup.toSummary" : "workspace.setup.next")}</Button>
            : <Button disabled={busy || Boolean(blocked)} onClick={() => void start()}>{t(busy ? "workspace.setup.creating" : "workspace.setup.create")}</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}


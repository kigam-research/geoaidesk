"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import type { GeoWorkflowSummary, GeoRecipeCheckResponse, GeoExposureMode } from "@/geo/contracts/workspace";
import type { SkillInfo } from "@/lib/capabilities";
import { accepts, request, taskDraft, text } from "./api";
import { startGeoTask } from "./events";
import { apiFetch } from "@/lib/projects";
import { WorkflowInstructions } from "@/geo/workflow/workflow-view";
import { workflowStartMessage } from "@/geo/workflow/render";
import { ReadinessNotice } from "./readiness";
import { DeleteRecipe } from "./recipe-add";
import { ChoiceStep, InputStep, SummaryRows, choiceDone, choiceValue, exampleUsable, inputDone, inputValue, nameMatches, setupSteps, sizeText, stepName, type ChoiceAnswer, type InputAnswer, type SummaryRow } from "./setup-steps";
import { StartWindow, introNextLabel, type StartStep } from "./start-window";
import { GeoIntro } from "./start-intro";
import { citablePapers, useWorkflowPapers } from "./source-papers";
import { localText } from "@/geo/hub/text";
import { isExamplePath, type PrepareExamplesResponse } from "@/geo/contracts/workflow-examples";

export const fieldClass = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkflowOutputs({ workflow }: { workflow: GeoWorkflowSummary }) {
  return <div className="space-y-2 text-xs break-words">
    <p>{t("workspace.catalogue.outputs", { outputs: workflow.expectedArtifacts.map((artifact) => text(artifact.label)).join(", ") })}</p>
    {workflow.boundary && <p>{t("workspace.catalogue.boundary", { boundary: text(workflow.boundary) })}</p>}
  </div>;
}

export function initialInputs(workflow: GeoWorkflowSummary, files: string[], initialBindings: Record<string, string>): Record<string, InputAnswer> {
  const answers: Record<string, InputAnswer> = {};
  const own = files.filter((path) => !isExamplePath(path));
  // F17 (gaid-pocheon-trial): a project file whose name matches one input better than any other starts bound to it, so
  // an optional input with the researcher's file is not silently left out of the run.
  const matched = nameMatches(workflow.inputRoles.filter((role) => !initialBindings[role.id]), own);
  for (const role of workflow.inputRoles) {
    const bound = initialBindings[role.id];
    // A required input with exactly one fitting file in the project starts bound to it (gaid-hub trial: one CSV, still
    // had to be picked by hand). An optional input starts unused; it is not a scientific parameter (UI guide Q2).
    // gaid-workflow-example: with no file of the researcher's own, an input with example data starts on the example.
    const fitting = own.filter((path) => accepts(path, role.extensions));
    if (bound && role.example && bound === role.example.path && exampleUsable(role)) answers[role.id] = { mode: "example" };
    else if (bound) answers[role.id] = { mode: accepts(bound, role.extensions) ? "file" : "other", path: bound };
    else if (role.required && fitting.length === 1) answers[role.id] = { mode: "file", path: fitting[0] };
    else if (matched[role.id]) answers[role.id] = { mode: "file", path: matched[role.id] };
    else if (role.required && exampleUsable(role)) answers[role.id] = { mode: "example" };
    else if (!role.required) answers[role.id] = { mode: "none" };
  }
  // Example data of different inputs belongs together (one example area). An optional input follows the run: on its
  // example when no input uses the researcher's own file.
  const ownData = Object.values(answers).some((answer) => answer.mode === "file" || answer.mode === "other");
  for (const role of workflow.inputRoles)
    if (!role.required && !initialBindings[role.id] && exampleUsable(role) && !ownData) answers[role.id] = { mode: "example" };
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
export function TaskSetup({ workflow, projectId, availableFiles, open, onOpenChange, onRefresh, initialBindings = {}, initialSetup, recipe, exposure, source, resume = false }: {
  workflow: GeoWorkflowSummary; projectId: string; availableFiles: string[]; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void | Promise<void>;
  initialBindings?: Record<string, string>; initialSetup?: GeoRecipeCheckResponse["setup"];
  exposure?: string;
  /** Set when the setup comes from a saved recipe (gaid-workflow-catalog). */
  recipe?: { title: string; onDelete: () => Promise<void> };
  /** Where the Workflow comes from, shown above the title (기본 Workflow, 허브 Workflow, 허브 초안 …). */
  source?: string;
  /** Opened from the researcher's own saved start settings (a `.geo-start.json` file): skip the introduction. */
  resume?: boolean;
}) {
  const [uploaded, setUploaded] = useState<string[]>([]);
  const files = [...new Set([...availableFiles, ...uploaded, ...Object.values(initialBindings)])].sort();
  const steps = setupSteps(workflow);
  const summary = steps.length - 1;
  const [inputs, setInputs] = useState(() => initialInputs(workflow, files, initialBindings));
  const [choices, setChoices] = useState(() => initialChoices(workflow, initialSetup));
  const done = (i: number) => {
    const step = steps[i];
    if (step.kind === "intro") return i < index;
    return step.kind === "input" ? inputDone(inputs[step.role.id]) : step.kind === "choice" ? choiceDone(choices[step.choice.id]) : false;
  };
  // Every Workflow opens on what it does (gaid-workflow-start-ui), also with a Workflow's own default settings. Only the
  // researcher's saved start settings resume at the first open required input, else the summary (Q4).
  const [index, setIndex] = useState(() => {
    if (!recipe && !resume) return 0;
    const open = steps.findIndex((step) => step.kind === "input" && step.role.required && !inputDone(inputs[step.role.id]));
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

  // Example inputs are bound to the project path the server writes them to (known before it is written).
  const exampleRoles = workflow.inputRoles.filter((role) => inputs[role.id]?.mode === "example" && role.example);
  const bindings: Record<string, string> = Object.fromEntries(workflow.inputRoles.flatMap((role) => {
    const answer = inputs[role.id];
    if (answer?.mode === "example") return role.example ? [[role.id, role.example.path]] : [];
    return answer && (answer.mode === "file" || answer.mode === "other") && answer.path ? [[role.id, answer.path]] : [];
  }));
  const examples = exampleRoles.map((role) => role.id);
  const mixed = examples.length > 0 && Object.values(inputs).some((answer) => answer.mode === "file" || answer.mode === "other");
  const download = exampleRoles.reduce((sum, role) => sum + (role.example?.download ?? 0), 0);
  const method = exposure?.startsWith("method:") ? exposure.split(":")[1] : null;
  const papers = useWorkflowPapers(projectId, method);
  const unattachedPapers = (papers.papers ?? []).filter((p) => p.state === "in-library").length;

  const uploadFiles = async (list: FileList): Promise<string[]> => {
    const body = new FormData();
    for (const file of Array.from(list)) { body.append("files", file); body.append("paths", ""); }
    const res = await apiFetch("/sandbox/upload", { method: "POST", body }, projectId);
    const result = (await res.json().catch(() => ({}))) as { uploaded?: string[]; detail?: string };
    if (!res.ok || !result.uploaded) throw new Error(result.detail ?? `HTTP ${res.status}`);
    setUploaded((previous) => [...previous, ...result.uploaded!]);
    return result.uploaded!;
  };
  const values: Record<string, string> = Object.fromEntries(Object.entries(choices).flatMap(([id, answer]) => answer.mode !== "defer" && answer.value.trim() ? [[id, answer.value.trim()]] : []));

  const start = async () => {
    setBusy(true); setError(null);
    try {
      // gaid-workflow-model: the first message is the Workflow 지침 in a <workflow> block; each step names its skill,
      // so no skill is pinned. A Workflow summary without a document (older server) keeps the previous draft.
      let draft = "";
      let workflowBlock: string | undefined;
      let skills: { id: string; name: string; description: string }[] = [];
      // gaid-workflow-example: write the chosen example data into the project first (copy or download, hash checked).
      if (examples.length) {
        if (!method) throw new Error("Example data is offered only for installed Workflows");
        const prepared = await request<PrepareExamplesResponse>("/geo/methods/examples", projectId, { method, workflowId: workflow.id, roleIds: examples });
        Object.assign(bindings, prepared.inputs);
      }
      if (workflow.doc) {
        workflowBlock = workflowStartMessage(workflow.doc, bindings, values, examples, citablePapers(papers));
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
      if (examples.length) void onRefresh();
      setInputs(initialInputs(workflow, files, {})); setChoices({}); setIndex(0); onOpenChange(false);
    } catch (error) { setError({ message: t(examples.length ? "workspace.setup.example.failed" : "workspace.setup.error"), detail: (error as Error).message }); }
    finally { setBusy(false); }
  };

  const ownFiles = files.filter((path) => !isExamplePath(path));
  const rows: SummaryRow[] = steps.flatMap((row, i): SummaryRow[] => {
    if (row.kind === "input") {
      const answer = inputs[row.role.id];
      // F17: an optional input left unused while the project holds a fitting file is pointed out, not hidden.
      const unusedFit = answer?.mode === "none" && ownFiles.some((path) => accepts(path, row.role.extensions));
      return [{ step: i, group: t("workspace.start.group.input"), label: text(row.role.label), value: inputValue(answer, row.role), muted: answer?.mode === "none", title: bindings[row.role.id], note: unusedFit ? t("workspace.start.unusedFit") : undefined }];
    }
    return row.kind === "choice" ? [{ step: i, group: t("workspace.start.group.choice"), label: text(row.choice.label), value: choiceValue(row.choice, choices[row.choice.id]), muted: !(row.choice.id in values) }] : [];
  });
  const untested = workflow.readiness.runRecord === "none";
  const undecided = workflow.requiredScientificChoices.filter((choice) => !(choice.id in values)).length;

  const startSteps: StartStep[] = steps.map((row, i) => ({
    group: row.kind,
    label: stepName(row),
    done: row.kind === "intro" ? index > 0 : row.kind === "summary" ? false : done(i),
  }));
  const purpose = localText(workflow.doc?.purpose) || text(workflow.description);
  const meta = <>
    {source && <span>{source}</span>}
    {workflow.doc?.version ? <><span aria-hidden>·</span><span className="tabular-nums">{t("workspace.start.version", { version: workflow.doc.version })}</span></> : null}
    {untested && <Badge variant="outline" title={t("workspace.readiness.untested")}>{t("workspace.badge.untested")}</Badge>}
  </>;
  const notice = (state !== "ready" || wasBlocked) ? <div className="mb-4"><ReadinessNotice value={workflow.readiness} projectId={projectId} onPrepared={onRefresh} /></div> : null;

  return <StartWindow open={open} onOpenChange={onOpenChange} title={recipe?.title ?? text(workflow.title)} meta={meta}
    purpose={recipe ? t("workspace.saved.based", { title: text(workflow.title) }) : purpose}
    steps={startSteps} index={index} onIndex={setIndex} error={error}
    reason={index === summary ? blocked : nextBlocked}
    leading={recipe && index === summary ? <DeleteRecipe onDelete={recipe.onDelete} /> : null}
    actions={<>
      {index > 0 && <Button variant="outline" onClick={() => setIndex(index - 1)}>{t("workspace.setup.prev")}</Button>}
      {index < summary
        ? <Button disabled={Boolean(nextBlocked)} onClick={() => setIndex(index + 1)}>{index === 0 ? introNextLabel(startSteps) : t(index === summary - 1 ? "workspace.setup.toSummary" : "workspace.setup.next")}</Button>
        : <Button disabled={busy || Boolean(blocked)} onClick={() => void start()}>{t(busy ? (examples.length ? "workspace.setup.example.preparing" : "workspace.setup.creating") : "workspace.setup.create")}</Button>}
    </>}>
    {step.kind === "intro" && <GeoIntro workflow={workflow} projectId={projectId} notice={notice} papers={papers} />}
    {step.kind === "input" && <InputStep key={step.role.id} role={step.role} files={files} answer={inputs[step.role.id]} onAnswer={(answer) => setInputs({ ...inputs, [step.role.id]: answer })} onUpload={uploadFiles} />}
    {step.kind === "choice" && <ChoiceStep key={step.choice.id} choice={step.choice} answer={choices[step.choice.id]} recipeValue={initialSetup?.choices[step.choice.id]} onAnswer={(answer) => setChoices({ ...choices, [step.choice.id]: answer })} />}
    {step.kind === "summary" && <section aria-labelledby="gaid-setup-summary" className="space-y-4">
      <div className="space-y-1">
        <h3 id="gaid-setup-summary" className="text-base font-semibold">{t("workspace.setup.summaryTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("workspace.setup.summaryBody")}</p>
      </div>
      {state !== "ready" && <ReadinessNotice value={workflow.readiness} projectId={projectId} onPrepared={onRefresh} />}
      {rows.length > 0 && <SummaryRows rows={rows} onEdit={setIndex} />}
      {undecided > 0 && <p className="text-sm text-muted-foreground">{t("workspace.setup.undecided", { count: undecided })}</p>}
      {examples.length > 0 && <p className="rounded-md bg-gaid-face-2 px-3 py-2 text-sm">{t("workspace.setup.example.summary", { count: examples.length })}{download > 0 ? ` ${t("workspace.setup.example.summaryDownload", { size: sizeText(download) })}` : ""}</p>}
      {mixed && <p className="text-sm text-gaid-ink-2">{t("workspace.setup.example.mixed")}</p>}
      {unattachedPapers > 0 && <p className="text-sm text-gaid-ink-2">{t("workspace.start.papers.summary", { count: unattachedPapers })} <button type="button" onClick={() => setIndex(0)} className="text-gaid-signal-ink underline-offset-4 hover:underline">{t("workspace.start.papers.review")}</button></p>}
      <p className="text-sm">{t(untested ? "workspace.setup.limitUntested" : "workspace.setup.limit")}</p>
      {workflow.doc && <WorkflowInstructions doc={workflow.doc} target="chat" settings={{ inputs: bindings, choices: values, examples }} />}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none">{t("workspace.setup.moreResults")}</summary>
        <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2"><WorkflowOutputs workflow={workflow} /></div>
      </details>
    </section>}
  </StartWindow>;
}

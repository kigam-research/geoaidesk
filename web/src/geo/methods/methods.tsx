"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BookmarkIcon, PackageIcon } from "lucide-react";
import type { WorkflowPanelCategory, WorkflowPanelRow } from "@/components/workflows-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { geoLocale, t } from "@/geo/i18n";
import type { LocalMethodSummary, LocalMethodsResponse, LocalMethodWorkflow, MethodRecipe, MethodTrial, MethodTrialsResponse } from "@/geo/contracts/methods";
import { request, text } from "@/geo/workspace/api";
import { TaskSetup, WorkflowOutputs, fieldClass } from "@/geo/workspace/task-setup";
import { WorkflowView } from "@/geo/workflow/workflow-view";
import { Readiness } from "@/geo/workspace/readiness";
import { onMethodSetupRequest, takeMethodSetup } from "@/geo/hub/handoff";

export const METHOD_CATEGORY = "hub-methods";
const pill = "inline-flex rounded-full border px-1.5 py-px text-xs font-medium";

/*
 * Every badge says what it describes (gaid-system-ui-followups, novice review round 3: "레시피 준비됨 미시험 사용자 자료 필요
 * 초안" could not be told apart): readiness is this project's environment, trials are GAID trials in this project, the
 * stage is the hub package's ("허브 초안"), code/edit are package facts. "사용자 자료 필요" is no badge: it is a fixed
 * package property that read as a project state after the data was uploaded; the inputs line lists required inputs.
 */
const readinessBadge = (workflow: LocalMethodWorkflow) =>
  <span key="ready" className={pill} title={t("methods.badge.readinessTip")}>{t("workspace.badge.readiness", { state: workflow.readiness.state })}</span>;
// A local method's evidence is GAID's own trial records, not a catalogue install record.
const trialsBadge = (workflow: LocalMethodWorkflow) => workflow.trials.count === 0
  ? <span key="trials" className={pill} title={t("methods.badge.noTrials")}>{t("workspace.badge.untested")}</span>
  : <span key="trials" className={pill} title={t("methods.badge.trialsTip")}>{t("methods.badge.trials", { count: workflow.trials.count, outcome: workflow.trials.lastOutcome ?? "none" })}</span>;
const stageBadge = (method: LocalMethodSummary, withCode: boolean) =>
  <span key="stage" className={pill} title={t("methods.badge.stageTip")}>{method.origin.hubEntry ? t("methods.registered", { revision: method.origin.hubEntry.revision }) : t("methods.badge.stage", { stage: method.lifecycle })}{withCode && method.implementation === "descriptive" ? ` · ${t("methods.implementation.descriptive")}` : ""}</span>;

/** Method details: the package badges. Each Workflow card states its readiness and record in its readiness line. */
export function MethodBadges({ method }: { method: LocalMethodSummary }) {
  return <>
    {stageBadge(method, false)}
    {method.implementation && <span className={pill} title={t("methods.badge.codeTip")}>{t(`methods.implementation.${method.implementation}`)}</span>}
    {method.editedLocally && <span className={pill}>{t("methods.edited")}</span>}
  </>;
}

/**
 * A list row shows at most three badges (UI guide G2, W5), in this order: readiness when not ready, GAID trials or
 * 미시험, the hub stage (with "분석 지침만" for a method without code), a local edit, "코드 포함". The method details show
 * all of them.
 */
function RowBadges({ method, workflow }: { method: LocalMethodSummary; workflow?: LocalMethodWorkflow }) {
  const badges: ReactNode[] = [];
  if (workflow && workflow.readiness.state !== "ready") badges.push(readinessBadge(workflow));
  if (workflow) badges.push(trialsBadge(workflow));
  // A method without code says so on its row (novice review): stage and "분석 지침만" share one badge.
  badges.push(stageBadge(method, true));
  if (method.editedLocally) badges.push(<span key="edit" className={pill}>{t("methods.edited")}</span>);
  if (method.implementation === "implemented") badges.push(<span key="impl" className={pill} title={t("methods.badge.codeTip")}>{t("methods.implementation.implemented")}</span>);
  return <>{badges.slice(0, 3)}</>;
}

export function methodRows(methods: LocalMethodSummary[], select: (method: LocalMethodSummary, workflow?: LocalMethodWorkflow, recipe?: MethodRecipe) => void, showDetail?: (method: LocalMethodSummary) => void): WorkflowPanelRow[] {
  return methods.flatMap((method) => {
    const base = { category: METHOD_CATEGORY, description: text(method.summary), searchText: `${method.runtimeName} ${method.methodId ?? ""} ${text(method.title)}` };
    const row = (id: string, name: string, workflow?: LocalMethodWorkflow, recipe?: MethodRecipe): WorkflowPanelRow => ({
      ...base, id: `method:${method.key}:${id}`, name, icon: recipe ? BookmarkIcon : PackageIcon,
      badges: <RowBadges method={method} workflow={workflow} />,
      onSelect: () => select(method, workflow, recipe),
      detail: showDetail && workflow ? { label: `${t("methods.detail")}: ${text(method.title)}`, onSelect: () => showDetail(method) } : undefined,
    });
    // A Workflow with a single 레시피 is one row that opens with that 레시피's start settings: two rows of the same name,
    // one without the researcher's defaults, misled the re-trial researcher (gaid-hub-followups).
    const single = (workflow: LocalMethodWorkflow) => {
      const own = method.recipes.filter((recipe) => recipe.workflowId === workflow.id);
      return own.length === 1 ? own[0] : undefined;
    };
    return [
      ...method.workflows.map((workflow) => row(`workflow:${workflow.id}`, text(workflow.title), workflow, single(workflow))),
      ...method.recipes
        .filter((recipe) => { const workflow = method.workflows.find((w) => w.id === recipe.workflowId); return !workflow || single(workflow) !== recipe; })
        .map((recipe) => row(`recipe:${recipe.id}`, text(recipe.title), method.workflows.find((w) => w.id === recipe.workflowId), recipe)),
      ...(method.workflows.length === 0 ? [row("detail", text(method.title))] : []),
    ];
  });
}

type Setup = { methodKey: string; workflowId: string; recipeId?: string };

/** Parent adds category first, rows to its extension and dialogs beside its TaskSetup instances. */
export function useMethodRows(projectId: string, availableFiles: string[] = []) {
  const [data, setData] = useState<LocalMethodsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const ticket = ++generation.current;
    try {
      const result = await request<LocalMethodsResponse>("/geo/methods", projectId);
      if (generation.current === ticket) { setData(result); setError(null); }
    } catch (err) {
      if (generation.current === ticket) setError(t("methods.error", { detail: (err as Error).message }));
    }
  }, [projectId]);
  useEffect(() => {
    // Fetching is the effect's external synchronization; writes happen after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => { generation.current++; };
  }, [reload]);
  // GAID hub: a draft just installed into this project opens its start settings (or its detail without a Workflow).
  useEffect(() => {
    const take = () => {
      const request = takeMethodSetup(projectId);
      if (!request) return;
      void reload().then(() => {
        if (request.workflowId) setSetup({ methodKey: request.methodKey, workflowId: request.workflowId, recipeId: request.recipeId ?? undefined });
        else setDetailKey(request.methodKey);
      });
    };
    take();
    return onMethodSetupRequest(take);
  }, [projectId, reload]);
  const methods = data?.methods ?? [];
  const selectSetup = (method: LocalMethodSummary, workflow: LocalMethodWorkflow, recipe?: MethodRecipe) => {
    setDetailKey(null); setSetup({ methodKey: method.key, workflowId: workflow.id, recipeId: recipe?.id });
  };
  // A row opens its editable setup; the row's info button opens the method details.
  const rows = methodRows(methods, (method, workflow, recipe) => {
    if (workflow) selectSetup(method, workflow, recipe); else setDetailKey(method.key);
  }, (method) => setDetailKey(method.key));
  const selectedMethod = methods.find((method) => method.key === setup?.methodKey);
  const selectedWorkflow = selectedMethod?.workflows.find((workflow) => workflow.id === setup?.workflowId);
  const selectedRecipe = selectedMethod?.recipes.find((recipe) => recipe.id === setup?.recipeId);
  const detailMethod = methods.find((method) => method.key === detailKey);
  const category: WorkflowPanelCategory = { id: METHOD_CATEGORY, label: t("methods.category"), color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-700/10 hover:bg-sky-700/15 border-sky-700/25" };
  // Status only when it says something (loading, error, none installed); a full list needs no notice (UI guide P3).
  const notice = (error || !data || methods.length === 0) && <div className="flex flex-wrap items-center gap-2">
    {error ? <p role="alert" className="text-xs text-destructive break-words">{error}</p> : !data ? <p role="status" className="text-xs">{t("methods.loading")}</p> : <p className="text-xs text-muted-foreground">{t("methods.empty")}</p>}
    {data && <Button size="sm" variant="ghost" onClick={() => void reload()}>{t("methods.reload")}</Button>}
  </div>;
  const dialogs: ReactNode = <>
    {detailMethod && <MethodDetail key={`${projectId}:${detailMethod.key}`} method={detailMethod} projectId={projectId} onClose={() => setDetailKey(null)} onSetup={(workflow, recipe) => selectSetup(detailMethod, workflow, recipe)} />}
    {selectedMethod && selectedWorkflow && <TaskSetup key={`${projectId}:${selectedMethod.key}:${selectedWorkflow.id}:${selectedRecipe?.id ?? ""}`} workflow={selectedWorkflow} exposure={selectedWorkflow.exposure} projectId={projectId} availableFiles={availableFiles} open onOpenChange={(open) => { if (!open) setSetup(null); }} onRefresh={reload}
      initialSetup={selectedRecipe ? { workflowId: selectedWorkflow.id, choices: Object.fromEntries(Object.entries(selectedRecipe.choices).map(([id, value]) => [id, String(value)])), unresolvedChoices: selectedRecipe.unresolvedChoices, skillIds: selectedWorkflow.skillIds, exampleId: null } : undefined} />}
  </>;
  return { category, rows, dialogs, notice, reload };
}

/** Reject non-web URL schemes from package-authored metadata. */
export function webLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
const when = (value: string) => Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleString(geoLocale() === "ko" ? "ko-KR" : "en");

export function MethodDetail({ method, projectId, onClose, onSetup, exportAction }: { exportAction?: (workflow: LocalMethodWorkflow) => ReactNode; method: LocalMethodSummary; projectId: string; onClose: () => void; onSetup: (workflow: LocalMethodWorkflow, recipe?: MethodRecipe) => void }) {
  const page = webLink(method.origin.pageUrl);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto overflow-x-hidden break-words [overflow-wrap:anywhere] sm:max-w-4xl">
      <DialogTitle>{text(method.title)}</DialogTitle>
      <DialogDescription>{text(method.summary) || method.runtimeName}</DialogDescription>
      <div className="flex flex-wrap gap-1"><MethodBadges method={method} /></div>
      <p className="text-xs">{t("methods.origin", { origin: t(`methods.origin.${method.origin.kind === "skill-hub" ? "hub" : method.origin.kind}`) })}</p>
      <p className="text-xs">{t("methods.revision", { revision: method.origin.hubEntry?.revision ?? method.revision ?? t("methods.unknown") })}</p>
      {page && <a className="text-xs text-primary underline" href={page} target="_blank" rel="noopener noreferrer">{t("methods.page")}</a>}
      {method.issues.length > 0 && <section role="alert"><h3 className="text-sm font-medium">{t("methods.issues")}</h3><ul className="list-disc pl-5 text-xs">{method.issues.map((issue, i) => <li key={i}>{issue.subject}: {issue.message}</li>)}</ul></section>}
      {method.hubChecks && <details className="space-y-1 text-xs">
        <summary className="cursor-pointer text-sm font-medium">{t("methods.checks")}</summary>
        <p>{t("methods.checkSummary", { checker: method.hubChecks.checker, at: when(method.hubChecks.checkedAt), count: method.hubChecks.warnings.length })}</p>
        <ul className="list-disc pl-5">{method.hubChecks.items.map((item) => <li key={item.id}>{item.id}: {t(`methods.check.${item.status}`)}{item.detail ? ` · ${item.detail}` : ""}</li>)}</ul>
        <ul className="list-disc pl-5">{method.hubChecks.warnings.map((warning, i) => <li key={i}>{warning.path}: {warning.message}</li>)}</ul>
      </details>}
      {!!method.authoring?.openQuestions.length && <section><h3 className="text-sm font-medium">{t("methods.questions")}</h3><ul className="list-disc pl-5 text-xs">{method.authoring.openQuestions.map((question) => <li key={question.id}>{question.text}</li>)}</ul></section>}
      {method.sources.length > 0 && <section><h3 className="text-sm font-medium">{t("methods.sources")}</h3><ul className="list-disc pl-5 text-xs">{method.sources.map((source, i) => {
        const href = webLink(source.kind === "doi" ? `https://doi.org/${source.ref.replace(/^https?:\/\/doi.org\//, "")}` : source.kind === "url" ? source.ref : undefined);
        return <li key={i}>{href ? <a className="text-primary underline" href={href} target="_blank" rel="noopener noreferrer">{source.title ?? source.ref}</a> : source.title ? `${source.title} · ${source.ref}` : source.ref}</li>;
      })}</ul></section>}
      {method.workflows.length > 0 && <section className="space-y-2"><h3 className="text-sm font-medium">{t("methods.workflows")}</h3>{method.workflows.map((workflow) => <div key={workflow.id} className="space-y-1 rounded-md border p-2 text-xs">
        <p>{text(workflow.title)}</p>
        {workflow.description && <p className="text-muted-foreground">{text(workflow.description)}</p>}
        <Readiness value={workflow.readiness} />
        {!workflow.doc && workflow.inputRoles.length > 0 && <p>{t("methods.inputRoles", { roles: workflow.inputRoles.map((role) => `${text(role.label)} (${t(role.required ? "workspace.setup.required" : "workspace.setup.optional")})`).join(", ") })}</p>}
        {!workflow.doc && workflow.requiredScientificChoices.length > 0 && <p>{t("methods.choices", { choices: workflow.requiredScientificChoices.map((choice) => text(choice.label)).join(", ") })}</p>}
        {workflow.doc ? <WorkflowView doc={workflow.doc} projectId={projectId} readiness={workflow.readiness} exportAction={exportAction?.(workflow)} /> : <WorkflowOutputs workflow={workflow} />}
        <Button size="sm" variant="outline" onClick={() => onSetup(workflow)}>{t("methods.setup")}</Button>
      </div>)}</section>}
      {method.recipes.length > 0 && <section className="space-y-2"><h3 className="text-sm font-medium">{t("methods.recipes")}</h3>{method.recipes.map((recipe) => {
        const workflow = method.workflows.find((row) => row.id === recipe.workflowId);
        return <div className="rounded-md border p-2 text-xs" key={recipe.id}><p>{text(recipe.title)}</p><Button size="sm" variant="outline" disabled={!workflow} onClick={() => { if (workflow) onSetup(workflow, recipe); }}>{t("methods.setup")}</Button></div>;
      })}</section>}
      <MethodTrials projectId={projectId} runtimeName={method.runtimeName} methodKey={method.key} />
      <Button variant="outline" onClick={onClose}>{t("methods.close")}</Button>
    </DialogContent>
  </Dialog>;
}

export function MethodTrials({ projectId, runtimeName, methodKey }: { projectId: string; runtimeName: string; methodKey: string }) {
  const [trials, setTrials] = useState<MethodTrial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    void request<MethodTrialsResponse>(`/geo/methods/trials?skill=${encodeURIComponent(runtimeName)}`, projectId).then((result) => {
      if (alive) { setTrials(result.trials.filter((trial) => trial.methodKey === methodKey)); setError(null); }
    }).catch((err) => { if (alive) setError(t("methods.trials.error", { detail: (err as Error).message })); });
    return () => { alive = false; };
  }, [projectId, runtimeName, methodKey, reload]);
  return <section className="space-y-2 text-xs">
    <h3 className="text-sm font-medium">{t("methods.trials.title")}</h3>
    <p className="text-muted-foreground">{t("methods.trials.limit")}</p>
    <Button variant="ghost" size="sm" onClick={() => setReload((value) => value + 1)}>{t("methods.reload")}</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!trials && !error && <p role="status">{t("methods.trials.loading")}</p>}
    {trials?.length === 0 && <p>{t("methods.trials.empty")}</p>}
    {trials?.map((trial) => <TrialCard key={trial.sessionId} trial={trial} projectId={projectId} />)}
  </section>;
}

export function TrialCard({ trial, projectId }: { trial: MethodTrial; projectId: string }) {
  return <article className="space-y-2 rounded-md border p-3">
    <p>{t("methods.trials.started", { at: when(trial.startedAt) })}</p>
    <p>{t("methods.trials.workflow", { id: trial.workflowId, revision: trial.revision ?? t("methods.unknown") })}</p>
    {trial.methodChanged && <p className="text-amber-700 dark:text-amber-400">{t("methods.trials.changed")}</p>}
    <p>{t("methods.trials.calls", { calls: trial.observed.toolCalls, failed: trial.observed.failedToolCalls })}</p>
    <p>{t("methods.trials.models", { models: trial.observed.models.join(", ") || t("methods.trials.none") })}</p>
    {trial.observed.degradedSteps > 0 && <p>{t("methods.trials.degraded", { count: trial.observed.degradedSteps })}</p>}
    <p className="font-mono" title={trial.sessionId}>{t("methods.trials.session", { id: trial.sessionId })}</p>
    <h4 className="font-medium">{t("methods.trials.outputs")}</h4>
    {trial.observed.outputs.length ? <>
      <ul className="list-disc pl-5">{trial.observed.outputs.slice(0, 8).map((file) => <li key={file.path}>{file.path}</li>)}</ul>
      {/* gaid-hub: long output lists fold so the assessment stays near the top. */}
      {trial.observed.outputs.length > 8 && <details><summary className="cursor-pointer text-xs">{t("methods.trials.moreOutputs", { count: trial.observed.outputs.length - 8 })}</summary>
        <ul className="list-disc pl-5">{trial.observed.outputs.slice(8).map((file) => <li key={file.path}>{file.path}</li>)}</ul>
      </details>}
    </> : <p>{t("methods.trials.none")}</p>}
    <h4 className="font-medium">{t("methods.trials.expected")}</h4>
    {trial.expected.map((expected) => <div key={expected.id} className="rounded border p-2">
      <p>{text(expected.label)} · {t(`methods.trials.${expected.required ? "required" : "optional"}`)}</p>
      <p>{expected.files.length === 0 ? t("methods.trials.notDeclared")
        : expected.found.length ? t("methods.trials.found", { files: expected.found.join(", ") })
        : expected.foundElsewhere?.length ? t("methods.trials.elsewhere", { files: expected.foundElsewhere.join(", "), expected: expected.files.join(", ") })
        : t("methods.trials.missing", { files: expected.files.join(", ") })}</p>
    </div>)}
    <TrialAssessment trial={trial} projectId={projectId} />
  </article>;
}

function TrialAssessment({ trial, projectId }: { trial: MethodTrial; projectId: string }) {
  const [outcome, setOutcome] = useState(trial.assessment?.outcome ?? "");
  const [note, setNote] = useState(trial.assessment?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setStatus(null); setError(null);
    try {
      const response = await apiFetch(`/geo/methods/trials/${encodeURIComponent(trial.sessionId)}/assessment`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, note }) }, projectId);
      if (!response.ok) { const body = await response.json(); throw new Error(body.detail ?? response.statusText); }
      setStatus(t("methods.assessment.saved"));
    } catch (err) { setError(t("methods.assessment.error", { detail: (err as Error).message })); }
    finally { setBusy(false); }
  };
  return <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <h4 className="font-medium">{t("methods.assessment.title")}</h4>
    <label className="block space-y-1"><span>{t("methods.assessment.outcome")}</span><select className={fieldClass} value={outcome} disabled={busy} onChange={(event) => { setOutcome(event.target.value as typeof outcome); setStatus(null); }}>
      <option value="">{t("methods.assessment.choose")}</option>
      {(["useful", "needs-revision", "failed"] as const).map((value) => <option key={value} value={value}>{t(`methods.assessment.${value}`)}</option>)}
    </select></label>
    <label className="block space-y-1"><span>{t("methods.assessment.note")}</span><textarea className={fieldClass} value={note} maxLength={4000} disabled={busy} onChange={(event) => { setNote(event.target.value); setStatus(null); }} /></label>
    <Button size="sm" type="submit" disabled={busy || !outcome}>{t(busy ? "methods.assessment.saving" : "methods.assessment.save")}</Button>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </form>;
}

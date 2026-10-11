"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import type { GeoWorkflowsResponse, GeoRecipeCheckResponse } from "@/geo/contracts/workspace";
import { request, text } from "./api";
import { PrepareEnvironment, Readiness } from "./readiness";
import { TaskSetup, WorkflowOutputs } from "./task-setup";
import { RecipeImport } from "./recipe-import";

export function GeoTaskCatalogue(props: { projectId: string; availableFiles: string[]; children: ReactNode }) {
  return <TaskCatalogue key={props.projectId} {...props} />;
}

function TaskCatalogue({ projectId, availableFiles, children }: { projectId: string; availableFiles: string[]; children: ReactNode }) {
  const [data, setData] = useState<GeoWorkflowsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upstream, setUpstream] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Record<string, { revision: number; setup: GeoRecipeCheckResponse["setup"] }>>({});
  const load = async () => {
    try { setData(await request<GeoWorkflowsResponse>("/geo/workflows", projectId)); setError(null); }
    catch (error) { setError(t("workspace.catalogue.error", { detail: (error as Error).message })); }
  };
  useEffect(() => {
    let live = true;
    request<GeoWorkflowsResponse>("/geo/workflows", projectId).then((value) => { if (live) setData(value); }).catch((error) => { if (live) setError(t("workspace.catalogue.error", { detail: error.message })); });
    return () => { live = false; };
  }, [projectId]);
  const importSetup = (setup: NonNullable<GeoRecipeCheckResponse["setup"]>) => {
    if (!data?.workflows.some((workflow) => workflow.id === setup.workflowId)) { setError(t("workspace.recipe.noWorkflow")); return; }
    setRecipes((previous) => ({ ...previous, [setup.workflowId]: { revision: (previous[setup.workflowId]?.revision ?? 0) + 1, setup } }));
    setSelected(setup.workflowId);
  };
  if (!data || data.catalogue.state !== "ready") return <div className="min-w-0 space-y-3">
    <p role="status" className="text-xs break-words">{error || (!data ? t("workspace.catalogue.loading") : t("workspace.catalogue.status", { state: data.catalogue.state, detail: data.catalogue.detail || t("workspace.catalogue.noDetail") }))}</p>
    {children}
  </div>;
  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-medium">{t("workspace.catalogue.title")}</h2>
      <RecipeImport projectId={projectId} onSetup={importSetup} />
    </div>
    {error && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.workflows.map((workflow) => <article key={workflow.id} className="min-w-0 space-y-3 rounded-lg border p-3 break-words">
        <h3 className="font-medium">{text(workflow.title)}</h3>
        {workflow.description && <p className="text-xs text-muted-foreground">{text(workflow.description)}</p>}
        <p className="text-xs">{t("workspace.catalogue.inputs", { formats: [...new Set(workflow.inputRoles.flatMap((role) => role.extensions))].join(", ") })}</p>
        <WorkflowOutputs workflow={workflow} />
        <Readiness value={workflow.readiness} />
        <PrepareEnvironment value={workflow.readiness} projectId={projectId} onPrepared={load} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(workflow.id)}>{t("workspace.setup.open")}</Button>
          <RecipeImport projectId={projectId} onSetup={importSetup} />
        </div>
        <TaskSetup key={`${workflow.id}:${recipes[workflow.id]?.revision ?? 0}`} workflow={workflow} projectId={projectId} availableFiles={availableFiles} open={selected === workflow.id} onOpenChange={(open) => setSelected(open ? workflow.id : null)} onRefresh={load} initialSetup={recipes[workflow.id]?.setup} />
      </article>)}
    </div>
    {data.workflows.length === 0 && <p className="text-xs">{t("workspace.catalogue.empty")}</p>}
    <Button size="sm" variant="ghost" aria-expanded={upstream} onClick={() => setUpstream(!upstream)}>{t(upstream ? "workspace.catalogue.hideUpstream" : "workspace.catalogue.showUpstream")}</Button>
    {upstream && children}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { flattenFiles, type TreeNode } from "@/lib/use-sandbox";
import type { GeoSuggestionsResponse, GeoWorkflowsResponse, GeoRecipeCheckResponse } from "@/geo/contracts/workspace";
import { request, text } from "./api";
import { Readiness } from "./readiness";
import { TaskSetup } from "./task-setup";
import { RecipeImport } from "./recipe-import";

export function GeoFileActions(props: { path: string; projectId: string }) { return <FileActions key={`${props.projectId}:${props.path}`} {...props} />; }

function FileActions({ path, projectId }: { path: string; projectId: string }) {
  const [suggestions, setSuggestions] = useState<GeoSuggestionsResponse["suggestions"]>([]);
  const [catalogue, setCatalogue] = useState<GeoWorkflowsResponse | null>(null);
  const [files, setFiles] = useState<string[]>([path]);
  const [selected, setSelected] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<GeoRecipeCheckResponse["setup"]>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([request<GeoSuggestionsResponse>("/geo/suggestions", projectId, { path }), request<GeoWorkflowsResponse>("/geo/workflows", projectId)])
      .then(([result, data]) => { if (live) { setSuggestions(result.suggestions.slice(0, 3)); setCatalogue(data); } }).catch(() => { /* No geo strip when unavailable. */ });
    return () => { live = false; };
  }, [path, projectId]);
  const refresh = async () => {
    const [data, result] = await Promise.all([request<GeoWorkflowsResponse>("/geo/workflows", projectId), request<GeoSuggestionsResponse>("/geo/suggestions", projectId, { path })]);
    setCatalogue(data); setSuggestions(result.suggestions.slice(0, 3));
  };
  const open = async (id: string) => {
    setSelected(id);
    try { setFiles([...new Set([path, ...flattenFiles(await request<TreeNode>("/sandbox/tree", projectId))])]); }
    catch (error) { setError(t("workspace.files.error", { detail: (error as Error).message })); }
  };
  if (catalogue?.catalogue.state !== "ready" || (!suggestions.length && !path.toLowerCase().endsWith(".geo-start.json"))) return null;
  return <section className="min-w-0 space-y-2 border-b p-2">
    {path.toLowerCase().endsWith(".geo-start.json") && <RecipeImport projectId={projectId} path={path} onSetup={(setup) => { setRecipe(setup); setRevision((value) => value + 1); void open(setup.workflowId); }} />}
    <div className="flex min-w-0 flex-wrap gap-2">
      {suggestions.map((suggestion) => <article key={suggestion.workflowId} className="min-w-0 max-w-full flex-1 basis-56 space-y-2 rounded border p-2 break-words text-xs">
        <h3 className="font-medium">{text(suggestion.title)}</h3>
        <p>{t("workspace.files.match", { role: text(suggestion.match.roleLabel), format: suggestion.match.format })}</p>
        {suggestion.match.signal && <p>{t("workspace.files.signal", { kind: suggestion.match.signal.kind, columns: suggestion.match.signal.columns.join(", ") })}</p>}
        <p>{t("workspace.files.needs", { choices: suggestion.needs.map(text).join(", ") || t("workspace.setup.none") })}</p>
        <Readiness value={suggestion.readiness} />
        <Button size="sm" variant="outline" onClick={() => void open(suggestion.workflowId)}>{t("workspace.setup.open")}</Button>
      </article>)}
    </div>
    {error && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
    {catalogue.workflows.map((workflow) => {
      const role = suggestions.find((suggestion) => suggestion.workflowId === workflow.id)?.match.roleId;
      return <TaskSetup key={`${workflow.id}:${recipe?.workflowId === workflow.id ? revision : 0}`} workflow={workflow} projectId={projectId} availableFiles={files} initialBindings={role ? { [role]: path } : {}} initialSetup={recipe?.workflowId === workflow.id ? recipe : undefined} open={selected === workflow.id} onOpenChange={(open) => setSelected(open ? workflow.id : null)} onRefresh={refresh} />;
    })}
  </section>;
}

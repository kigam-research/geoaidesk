"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { fileCategory, flattenFiles, type FileCategory, type TreeNode } from "@/lib/use-sandbox";
import type { GeoSuggestionsResponse, GeoWorkflowsResponse, GeoRecipeCheckResponse } from "@/geo/contracts/workspace";
import { request, text } from "./api";
import { ReadinessBadges } from "./task-catalogue";
import { TaskSetup } from "./task-setup";
import { RecipeImport } from "./recipe-import";

export function GeoFileActions(props: { path: string; projectId: string }) { return <FileActions key={`${props.projectId}:${props.path}`} {...props} />; }

// Maps, depth tracks and tables need the pane's height, so the suggestion strip above them starts as one line
// (user decision 2026-10-22, gaid-ui-v2-debts#1). Other files keep the strip open.
const TALL_CATEGORIES = new Set<FileCategory>(["geo-vector", "geo-raster", "geo-map", "geo-welllog", "geo-depth-result", "csv", "biotable", "datatable", "arraydata"]);
export function fileNeedsHeight(path: string): boolean {
  return TALL_CATEGORIES.has(fileCategory(path)) || path.toLowerCase().endsWith(".xlsx");
}

/** The researcher's last expand/collapse choice for tall files, kept per browser (UI guide L9). */
export const WORKFLOW_STRIP_KEY = "gaid:workflow-strip";
function savedExpanded(): boolean {
  try { return window.localStorage.getItem(WORKFLOW_STRIP_KEY) === "open"; } catch { return false; }
}
function saveExpanded(open: boolean) {
  try { window.localStorage.setItem(WORKFLOW_STRIP_KEY, open ? "open" : "line"); } catch { /* the choice then lasts for this file only */ }
}

function FileActions({ path, projectId }: { path: string; projectId: string }) {
  const [suggestions, setSuggestions] = useState<GeoSuggestionsResponse["suggestions"]>([]);
  const [catalogue, setCatalogue] = useState<GeoWorkflowsResponse | null>(null);
  const [files, setFiles] = useState<string[]>([path]);
  const [selected, setSelected] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<GeoRecipeCheckResponse["setup"]>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tall = fileNeedsHeight(path);
  const [expanded, setExpanded] = useState(() => !tall || savedExpanded());
  const listId = useId();
  const toggle = () => { const next = !expanded; setExpanded(next); saveExpanded(next); };
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
    catch { setError(t("workspace.files.error")); }
  };
  // Catalogue suggestions need an active catalogue; installed methods remain
  // available on their own (their readiness still states any missing setup).
  const visibleSuggestions = catalogue?.catalogue.state === "ready" ? suggestions : suggestions.filter((suggestion) => suggestion.exposure);
  if (!visibleSuggestions.length && !(catalogue?.catalogue.state === "ready" && path.toLowerCase().endsWith(".geo-start.json"))) return null;
  const workflowKey = (id: string, exposure?: string) => exposure ?? id;
  return <section className={tall && !expanded ? "min-w-0 space-y-2 border-b px-2 py-1" : "min-w-0 space-y-2 border-b p-2"}>
    {path.toLowerCase().endsWith(".geo-start.json") && <RecipeImport projectId={projectId} path={path} onSetup={(setup) => { setRecipe(setup); setRevision((value) => value + 1); void open(setup.workflowId); }} />}
    {/* One row per suggestion: title, at most two badges, one line of evidence and the action (UI guide G1, G2, P3).
        The analysis conditions still to decide are asked in the start settings, not listed here. */}
    {visibleSuggestions.length > 0 && <div className="min-w-0 space-y-1">
      {tall
        ? <button type="button" aria-expanded={expanded} aria-controls={listId} onClick={toggle}
            className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-1 text-left text-xs font-medium text-muted-foreground hover:bg-gaid-face-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {expanded ? <ChevronDownIcon className="size-4 shrink-0" aria-hidden /> : <ChevronRightIcon className="size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">{t("workspace.files.summary", { count: visibleSuggestions.length })}</span>
            <span aria-hidden className="shrink-0 font-normal">{t(expanded ? "workspace.files.collapse" : "workspace.files.expand")}</span>
          </button>
        : <h3 className="px-1 text-xs font-medium text-muted-foreground">{t("workspace.files.title")}</h3>}
      {expanded && <ul id={listId} className="divide-y rounded-md border">
        {visibleSuggestions.map((suggestion) => {
          const match = t("workspace.files.match", { role: text(suggestion.match.roleLabel) });
          const signal = suggestion.match.signal && t("workspace.files.signal", { kind: suggestion.match.signal.kind, columns: suggestion.match.signal.columns.join(", ") });
          return <li key={workflowKey(suggestion.workflowId, suggestion.exposure)} className="flex min-w-0 items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium" title={text(suggestion.title)}>{text(suggestion.title)}</span>
                <ReadinessBadges readiness={suggestion.readiness} />
              </div>
              <p className="truncate text-xs text-muted-foreground" title={signal ? `${match} · ${signal}` : match}>
                <span>{match}</span>{signal && <> · <span>{signal}</span></>}
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => void open(workflowKey(suggestion.workflowId, suggestion.exposure))}>{t("workspace.setup.open")}</Button>
          </li>;
        })}
      </ul>}
    </div>}
    {error && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
    {[...(catalogue?.workflows ?? []), ...visibleSuggestions.flatMap((suggestion) => suggestion.workflow ? [{ ...suggestion.workflow, exposure: suggestion.exposure }] : [])].map((workflow) => {
      const exposure = "exposure" in workflow ? workflow.exposure as string : undefined;
      const key = workflowKey(workflow.id, exposure);
      const suggested = visibleSuggestions.find((suggestion) => workflowKey(suggestion.workflowId, suggestion.exposure) === key);
      const role = suggested?.match.roleId;
      return <TaskSetup key={`${key}:${recipe?.workflowId === workflow.id ? revision : 0}`} workflow={workflow} exposure={exposure} projectId={projectId} availableFiles={files} initialBindings={role ? { [role]: path } : {}} initialSetup={recipe?.workflowId === workflow.id ? recipe : suggested?.setup} resume={recipe?.workflowId === workflow.id} open={selected === key} onOpenChange={(open) => setSelected(open ? key : null)} onRefresh={refresh} />;
    })}
  </section>;
}

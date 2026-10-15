"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIcon,
  BookmarkIcon,
  DropletIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GemIcon,
  LayersIcon,
  MapIcon,
  MountainIcon,
  RadarIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_CATEGORIES,
  type WorkflowPanelCategory,
  type WorkflowPanelExtension,
  type WorkflowPanelRow,
} from "@/components/workflows-panel";
import { t } from "@/geo/i18n";
import {
  GEO_RECIPE_CATEGORY,
  type GeoRecipeCheckResponse,
  type GeoSavedRecipe,
  type GeoSavedRecipesResponse,
  type GeoWorkflowSummary,
  type GeoWorkflowsResponse,
} from "@/geo/contracts/workspace";
import { request, text } from "./api";
import { RecipeAdd, RecipeProblem } from "./recipe-add";
import { TaskSetup } from "./task-setup";

/**
 * The Geoscience part of the workflow panel (gaid-workflow-catalog): the
 * pinned catalogue's workflows and the project's saved recipes become rows of
 * the upstream panel (`WorkflowPanelExtension`), so both lists share one
 * search box, category pills and row design. A row opens the task setup.
 */
export function GeoTaskCatalogue(props: { projectId: string; availableFiles: string[]; children: (extension: WorkflowPanelExtension) => ReactNode }) {
  return <TaskCatalogue key={props.projectId} {...props} />;
}

const GEO_CATEGORY_TONE = { color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-700/10 hover:bg-amber-700/15 border-amber-700/25" };
const USER_CATEGORY_TONE = { color: "text-foreground", bg: "bg-muted/40 hover:bg-muted/70 border-border" };

/** Row icon from the workflow's first discipline (skill_hub taxonomy ids). */
const DISCIPLINE_ICON: Record<string, LucideIcon> = {
  geochemistry: FlaskConicalIcon,
  hydrogeology: DropletIcon,
  "remote-sensing-gis": MapIcon,
  geophysics: RadarIcon,
  "petroleum-reservoir": ActivityIcon,
  "mineral-exploration-mpm": GemIcon,
  "geology-3d": LayersIcon,
  foundation: FileTextIcon,
};
const iconFor = (workflow: GeoWorkflowSummary): LucideIcon => DISCIPLINE_ICON[workflow.disciplines[0] ?? ""] ?? MountainIcon;

const PILL = "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-medium";
const TONE = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/50 text-muted-foreground",
};

export function WorkflowBadges({ workflow }: { workflow: GeoWorkflowSummary }) {
  const state = workflow.readiness.state;
  const tone = state === "ready" ? TONE.ok : state === "unavailable" ? TONE.bad : TONE.warn;
  // First view keeps only what changes a decision (gaid-qwen-authoring-trial): readiness when it is not ready,
  // and the untested limit. "Needs your data" was on nearly every row; the setup dialog lists the inputs.
  return <>
    {state !== "ready" && <span className={cn(PILL, tone)}>{t("workspace.badge.readiness", { state })}</span>}
    {workflow.readiness.runRecord === "none" && <span className={cn(PILL, TONE.muted)} title={t("workspace.readiness.untested")}>{t("workspace.badge.untested")}</span>}
  </>;
}

type Selection = { workflowId: string; recipe?: GeoSavedRecipe };

function TaskCatalogue({ projectId, availableFiles, children }: { projectId: string; availableFiles: string[]; children: (extension: WorkflowPanelExtension) => ReactNode }) {
  const [data, setData] = useState<GeoWorkflowsResponse | null>(null);
  const [saved, setSaved] = useState<GeoSavedRecipesResponse>({ categories: [], recipes: [] });
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [problem, setProblem] = useState<GeoSavedRecipe | null>(null);
  const [opened, setOpened] = useState<{ revision: number; setup: NonNullable<GeoRecipeCheckResponse["setup"]> } | null>(null);

  const load = useCallback(async () => {
    const [workflows, recipes] = await Promise.allSettled([
      request<GeoWorkflowsResponse>("/geo/workflows", projectId),
      request<GeoSavedRecipesResponse>("/geo/recipes", projectId),
    ]);
    if (workflows.status === "fulfilled") setData(workflows.value);
    if (recipes.status === "fulfilled" && Array.isArray(recipes.value?.recipes)) setSaved(recipes.value);
    const failed = [workflows, recipes].find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
    setError(failed ? t("workspace.catalogue.error", { detail: (failed.reason as Error).message }) : null);
  }, [projectId]);
  useEffect(() => {
    // Initial fetch for this project; load() only sets state after its awaits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const ready = data?.catalogue.state === "ready";
  const workflows = useMemo(() => (ready ? data!.workflows : []), [data, ready]);
  const byId = useMemo(() => new Map(workflows.map((workflow) => [workflow.id, workflow])), [workflows]);

  // Geoscience first, then the user's own categories, then upstream's.
  const leadingCategories = useMemo<WorkflowPanelCategory[]>(() => [
    { id: GEO_RECIPE_CATEGORY, label: t("workspace.catalogue.category"), ...GEO_CATEGORY_TONE },
    ...saved.categories.map((category) => ({ ...category, ...USER_CATEGORY_TONE })),
  ], [saved.categories]);

  const rows = useMemo<WorkflowPanelRow[]>(() => {
    const known = new Set([GEO_RECIPE_CATEGORY, ...WORKFLOW_CATEGORIES.map((category) => category.id), ...saved.categories.map((category) => category.id)]);
    const geo = workflows.map((workflow): WorkflowPanelRow => ({
      id: `geo:${workflow.id}`,
      category: GEO_RECIPE_CATEGORY,
      name: text(workflow.title),
      description: text(workflow.description),
      icon: iconFor(workflow),
      badges: <WorkflowBadges workflow={workflow} />,
      searchText: [workflow.id, ...workflow.disciplines, ...workflow.inputRoles.flatMap((role) => role.extensions)].join(" "),
      onSelect: () => setSelected({ workflowId: workflow.id }),
    }));
    const recipes = saved.recipes.map((recipe): WorkflowPanelRow => {
      const workflow = recipe.check.ok ? byId.get(recipe.recipe.workflowId) : undefined;
      return {
        id: `recipe:${recipe.id}`,
        category: known.has(recipe.category) ? recipe.category : GEO_RECIPE_CATEGORY,
        name: recipe.title,
        description: workflow ? t("workspace.saved.based", { title: text(workflow.title) }) : t("workspace.saved.cannotOpen"),
        icon: BookmarkIcon,
        badges: <>
          <span className={cn(PILL, TONE.muted)}>{t("workspace.badge.recipe")}</span>
          {workflow ? <WorkflowBadges workflow={workflow} /> : <span className={cn(PILL, TONE.bad)}>{t("workspace.badge.readiness", { state: "unavailable" })}</span>}
        </>,
        searchText: recipe.recipe.workflowId,
        onSelect: () => (workflow ? setSelected({ workflowId: workflow.id, recipe }) : setProblem(recipe)),
      };
    });
    return [...geo, ...recipes];
  }, [byId, saved, workflows]);

  const removeRecipe = async (recipe: GeoSavedRecipe) => {
    setSaved(await request<GeoSavedRecipesResponse>(`/geo/recipes/${encodeURIComponent(recipe.id)}`, projectId, undefined, "DELETE"));
  };

  const status = !data
    ? (error ?? t("workspace.catalogue.loading"))
    : !ready
      ? t("workspace.catalogue.status", { state: data.catalogue.state, detail: data.catalogue.detail || t("workspace.catalogue.noDetail") })
      : workflows.length === 0 ? t("workspace.catalogue.empty") : null;

  const extension: WorkflowPanelExtension = {
    leadingCategories,
    rows,
    searchPlaceholder: t("workspace.catalogue.search"),
    collapseUpstream: ready ? { showLabel: (count) => t("workspace.catalogue.showOther", { count }), hideLabel: t("workspace.catalogue.hideOther") } : undefined,
    headerAction: ready ? <RecipeAdd projectId={projectId} workflows={workflows} categories={saved.categories} onSaved={setSaved}
      onOpen={(setup) => { setOpened((previous) => ({ revision: (previous?.revision ?? 0) + 1, setup })); setSelected({ workflowId: setup.workflowId }); }} /> : null,
    notice: <>
      {status && <p role="status" className="text-xs text-muted-foreground break-words">{status}</p>}
      {error && data && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
    </>,
  };

  const recipe = selected?.recipe;
  const recipeWorkflow = recipe ? byId.get(recipe.recipe.workflowId) : undefined;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    {children(extension)}
    {/* One setup per workflow stays mounted so a closed form keeps its values. */}
    {workflows.map((workflow) => {
      const once = opened?.setup.workflowId === workflow.id ? opened : null;
      return <TaskSetup
        key={`${workflow.id}:${once?.revision ?? 0}`}
        workflow={workflow}
        projectId={projectId}
        availableFiles={availableFiles}
        open={!recipe && selected?.workflowId === workflow.id}
        onOpenChange={(open) => setSelected(open ? { workflowId: workflow.id } : null)}
        onRefresh={load}
        initialSetup={once?.setup}
      />;
    })}
    {recipe && recipeWorkflow && <TaskSetup
      key={`recipe:${recipe.id}`}
      workflow={recipeWorkflow}
      projectId={projectId}
      availableFiles={availableFiles}
      open
      onOpenChange={(open) => { if (!open) setSelected(null); }}
      onRefresh={load}
      initialSetup={recipe.check.setup}
      recipe={{ title: recipe.title, onDelete: async () => { await removeRecipe(recipe); setSelected(null); } }}
    />}
    {problem && <RecipeProblem recipe={problem} onClose={() => setProblem(null)} onDelete={async () => { await removeRecipe(problem); setProblem(null); }} />}
  </div>;
}

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WORKFLOW_CATEGORIES } from "@/components/workflows-panel";
import { t } from "@/geo/i18n";
import {
  GEO_RECIPE_CATEGORY,
  type GeoRecipeCategory,
  type GeoRecipeCheckResponse,
  type GeoRecipeIssue,
  type GeoSavedRecipe,
  type GeoSavedRecipesResponse,
  type GeoWorkflowSummary,
} from "@/geo/contracts/workspace";
import { request, RequestError, text } from "./api";
import { fieldClass } from "./task-setup";
import { RecipeHub } from "@/geo/hub-picker/recipe-hub";

type Setup = NonNullable<GeoRecipeCheckResponse["setup"]>;
const NEW_CATEGORY = "__new__";

function Issues({ issues }: { issues: GeoRecipeIssue[] }) {
  if (!issues.length) return null;
  return <ul role="alert" className="space-y-1 text-xs break-words">
    {issues.map((issue, index) => <li key={index}>{t("workspace.recipe.issue", { code: issue.code, subject: issue.subject ?? "" })}</li>)}
  </ul>;
}

/**
 * "레시피 가져오기": check a `.geo-start.json`, then file it under a category
 * the user picks (Geoscience, an upstream category, one of the project's own,
 * or a new one) or open it once without saving.
 */
export function RecipeAdd({ projectId, workflows, categories, onSaved, onOpen }: {
  projectId: string;
  workflows: GeoWorkflowSummary[];
  categories: GeoRecipeCategory[];
  onSaved: (value: GeoSavedRecipesResponse) => void;
  onOpen: (setup: Setup) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"hub" | "file">("hub");
  const [busy, setBusy] = useState(false);
  const [recipe, setRecipe] = useState<{ value: unknown; setup: Setup; file: string } | null>(null);
  const [issues, setIssues] = useState<GeoRecipeIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(GEO_RECIPE_CATEGORY);
  const [newCategory, setNewCategory] = useState("");

  const reset = () => { setRecipe(null); setIssues([]); setError(null); setTitle(""); setCategory(GEO_RECIPE_CATEGORY); setNewCategory(""); };
  const workflow = recipe ? workflows.find((candidate) => candidate.id === recipe.setup.workflowId) : undefined;

  const check = async (file: File) => {
    setBusy(true); setIssues([]); setError(null); setRecipe(null);
    try {
      const value = JSON.parse(await file.text());
      const result = await request<GeoRecipeCheckResponse>("/geo/recipes/check", projectId, { recipe: value });
      setIssues(result.issues);
      if (result.ok && result.setup) {
        const target = workflows.find((candidate) => candidate.id === result.setup!.workflowId);
        if (!target) { setError(t("workspace.recipe.noWorkflow")); return; }
        setRecipe({ value, setup: result.setup, file: file.name });
        setTitle((previous) => previous || text(target.title));
      }
    } catch (err) { setError(t("workspace.recipe.error", { detail: (err as Error).message })); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!recipe) return;
    setBusy(true); setError(null); setIssues([]);
    try {
      const body = category === NEW_CATEGORY ? { recipe: recipe.value, title, newCategory } : { recipe: recipe.value, title, category };
      onSaved(await request<GeoSavedRecipesResponse>("/geo/recipes", projectId, body));
      reset(); setOpen(false);
    } catch (err) {
      const found = err instanceof RequestError && Array.isArray(err.body.issues) ? err.body.issues as GeoRecipeIssue[] : [];
      setIssues(found);
      if (!found.length) setError(t("workspace.saved.error", { detail: (err as Error).message }));
    } finally { setBusy(false); }
  };

  const canSave = !!recipe && !busy && title.trim().length > 0 && (category !== NEW_CATEGORY || newCategory.trim().length > 0);
  return <>
    <Button size="sm" variant="outline" className="shrink-0" onClick={() => setOpen(true)}>{t("workspace.recipe.import")}</Button>
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { reset(); setSource("hub"); } }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto break-words sm:max-w-xl">
        <DialogTitle>{t("workspace.recipe.import")}</DialogTitle>
        <DialogDescription>{t(source === "hub" ? "hubPicker.description" : "workspace.recipe.description")}</DialogDescription>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("workspace.recipe.import")}>
          <Button variant="outline" size="sm" className="aria-pressed:border-primary aria-pressed:bg-muted" aria-pressed={source === "hub"} disabled={busy} onClick={() => setSource("hub")}>{t("hubPicker.browse.button")}</Button>
          <Button variant="outline" size="sm" className="aria-pressed:border-primary aria-pressed:bg-muted" aria-pressed={source === "file"} disabled={busy} onClick={() => setSource("file")}>{t("hubPicker.file.button")}</Button>
        </div>
        {source === "hub" ? <RecipeHub key={projectId} projectId={projectId} onDone={() => { reset(); setOpen(false); }} /> : <>
        <div className="space-y-3 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{t(busy && !recipe ? "workspace.recipe.checking" : "workspace.recipe.choose")}</Button>
            {recipe && <span className="min-w-0 text-xs text-muted-foreground break-all">{recipe.file}</span>}
            <input ref={input} className="sr-only" tabIndex={-1} type="file" accept=".geo-start.json,application/json" aria-label={t("workspace.recipe.file")} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void check(file);
              event.target.value = "";
            }} />
          </div>
          {recipe && workflow && <p className="text-xs">{t("workspace.saved.based", { title: text(workflow.title) })}</p>}
          {recipe && <>
            <label className="block min-w-0 space-y-1">
              <span>{t("workspace.recipe.title")}</span>
              <input className={fieldClass} value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block min-w-0 space-y-1">
              <span>{t("workspace.recipe.category")}</span>
              <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value={GEO_RECIPE_CATEGORY}>{t("workspace.catalogue.category")}</option>
                {categories.length > 0 && <optgroup label={t("workspace.recipe.userCategories")}>
                  {categories.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </optgroup>}
                <optgroup label={t("workspace.recipe.upstreamCategories")}>
                  {WORKFLOW_CATEGORIES.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
                </optgroup>
                <option value={NEW_CATEGORY}>{t("workspace.recipe.newCategory")}</option>
              </select>
            </label>
            {category === NEW_CATEGORY && <label className="block min-w-0 space-y-1">
              <span>{t("workspace.recipe.newCategoryName")}</span>
              <input className={fieldClass} value={newCategory} maxLength={40} onChange={(event) => setNewCategory(event.target.value)} />
            </label>}
          </>}
          <Issues issues={issues} />
          {error && <p role="alert" className="text-xs text-destructive break-words">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild><Button variant="outline">{t("workspace.recipe.close")}</Button></DialogClose>
          <Button variant="outline" disabled={!recipe || busy} onClick={() => { const setup = recipe!.setup; reset(); setOpen(false); onOpen(setup); }}>{t("workspace.recipe.openOnce")}</Button>
          <Button disabled={!canSave} onClick={() => void save()}>{t(busy && recipe ? "workspace.recipe.saving" : "workspace.recipe.save")}</Button>
        </div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}

/** A saved recipe the current catalogue rejects: say why, and offer to remove it. */
export function RecipeProblem({ recipe, onClose, onDelete }: { recipe: GeoSavedRecipe; onClose: () => void; onDelete: () => Promise<void> }) {
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto break-words">
      <DialogTitle>{recipe.title}</DialogTitle>
      <DialogDescription>{t("workspace.saved.cannotOpen")}</DialogDescription>
      <Issues issues={recipe.check.issues} />
      <div className="flex flex-wrap justify-end gap-2">
        <DeleteRecipe onDelete={onDelete} />
        <DialogClose asChild><Button variant="outline">{t("workspace.recipe.close")}</Button></DialogClose>
      </div>
    </DialogContent>
  </Dialog>;
}

/** Two-step removal: the first click asks, the second removes. */
export function DeleteRecipe({ onDelete }: { onDelete: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <>
    {error && <p role="alert" className="basis-full text-xs text-destructive break-words">{error}</p>}
    <Button variant={armed ? "destructive" : "ghost"} disabled={busy} onClick={async () => {
      if (!armed) { setArmed(true); return; }
      setBusy(true); setError(null);
      try { await onDelete(); }
      catch (err) { setError(t("workspace.saved.deleteError", { detail: (err as Error).message })); setBusy(false); setArmed(false); }
    }}>{t(armed ? "workspace.saved.confirmDelete" : "workspace.saved.delete")}</Button>
  </>;
}

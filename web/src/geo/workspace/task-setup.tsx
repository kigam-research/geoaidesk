"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { t } from "@/geo/i18n";
import type { GeoWorkflowSummary, GeoRecipeCheckResponse, GeoExposureMode } from "@/geo/contracts/workspace";
import type { SkillInfo } from "@/lib/capabilities";
import { accepts, request, taskDraft, text } from "./api";
import { startGeoTask } from "./events";
import { PrepareEnvironment, Readiness } from "./readiness";
import { DeleteRecipe } from "./recipe-add";

export const fieldClass = "w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WorkflowOutputs({ workflow }: { workflow: GeoWorkflowSummary }) {
  return <div className="space-y-2 text-xs break-words">
    <p>{t("workspace.catalogue.outputs", { outputs: workflow.expectedArtifacts.map((artifact) => text(artifact.label)).join(", ") })}</p>
    {workflow.boundary && <p>{t("workspace.catalogue.boundary", { boundary: text(workflow.boundary) })}</p>}
  </div>;
}

export function TaskSetup({ workflow, projectId, availableFiles, open, onOpenChange, onRefresh, initialBindings = {}, initialSetup, recipe, exposure }: {
  workflow: GeoWorkflowSummary; projectId: string; availableFiles: string[]; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void | Promise<void>;
  initialBindings?: Record<string, string>; initialSetup?: GeoRecipeCheckResponse["setup"];
  exposure?: string;
  /** Set when the setup comes from a saved recipe (gaid-workflow-catalog). */
  recipe?: { title: string; onDelete: () => Promise<void> };
}) {
  const [bindings, setBindings] = useState(initialBindings);
  const [choices, setChoices] = useState<Record<string, string>>(() => {
    const values = { ...initialSetup?.choices };
    initialSetup?.unresolvedChoices.forEach((id) => { values[id] = ""; });
    return values;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missingInput = workflow.inputRoles.some((role) => role.required && !bindings[role.id]);
  // Say why "Create task draft" is disabled instead of leaving a silent grey button (gaid-hub-integration trial).
  const state = workflow.readiness.state;
  const blocked = state === "needs-environment" ? t("workspace.setup.blockedEnvironment")
    : state === "missing-skills" ? t("workspace.setup.blockedSkills")
    : state === "unavailable" ? t("workspace.setup.blockedUnavailable")
    : missingInput ? t("workspace.setup.blockedInput", { roles: workflow.inputRoles.filter((role) => role.required && !bindings[role.id]).map((role) => text(role.label)).join(", ") })
    : null;
  const start = async () => {
    setBusy(true); setError(null);
    try {
      // /skills is the merged list the composer's picker uses, not /skills/all.
      const response = await request<SkillInfo[]>("/skills", projectId);
      const primary = workflow.readiness.skills.find((skill) => skill.id === workflow.skillIds[0]);
      const skill = primary?.enabled ? response.find((row) => row.name === primary.runtimeName) : undefined;
      const result = startGeoTask({ title: text(workflow.title), text: taskDraft(workflow, bindings, choices),
        attachedFiles: [...new Set(Object.values(bindings).filter(Boolean))], skills: skill ? [{ id: skill.id, name: skill.name, description: skill.description }] : [], geoExposure: (exposure ?? `workflow:${workflow.id}`) as GeoExposureMode });
      if (result !== "opened") { setError(t(`workspace.setup.${result === "tab-limit" ? "tabLimit" : "noWorkspace"}`)); return; }
      setBindings({}); setChoices({}); onOpenChange(false);
    } catch (error) { setError(t("workspace.setup.error", { detail: (error as Error).message })); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto break-words">
      <DialogTitle>{t("workspace.setup.title", { title: recipe?.title ?? text(workflow.title) })}</DialogTitle>
      <DialogDescription>{t("workspace.setup.description")}</DialogDescription>
      {recipe && <p className="text-xs">{t("workspace.saved.based", { title: text(workflow.title) })}</p>}
      {workflow.description && <p className="text-xs text-muted-foreground">{text(workflow.description)}</p>}
      <p className="text-xs">{t("workspace.catalogue.inputs", { formats: [...new Set(workflow.inputRoles.flatMap((role) => role.extensions))].join(", ") })}</p>
      <Readiness value={workflow.readiness} />
      {workflow.inputRoles.map((role) => <label key={role.id} className="block min-w-0 space-y-1">
        <span className="text-sm">{t("workspace.setup.role", { label: text(role.label), required: role.required ? t("workspace.setup.required") : t("workspace.setup.optional") })}</span>
        <select className={fieldClass} value={bindings[role.id] ?? ""} onChange={(event) => setBindings({ ...bindings, [role.id]: event.target.value })}>
          <option value="">{t("workspace.setup.selectFile")}</option>
          {[...new Set([...availableFiles, ...Object.values(initialBindings)])].filter((path) => accepts(path, role.extensions)).map((path) => <option key={path} value={path}>{path}</option>)}
        </select>
        {role.requiredWhen && <span className="block text-xs text-muted-foreground">{text(role.requiredWhen)}</span>}
      </label>)}
      {workflow.requiredScientificChoices.map((choice) => <label key={choice.id} className="block min-w-0 space-y-1">
        <span className="text-sm">{text(choice.label)}</span>
        {choice.options ? <select className={fieldClass} value={choices[choice.id] ?? ""} onChange={(event) => setChoices({ ...choices, [choice.id]: event.target.value })}>
          <option value="">{t("workspace.setup.decideLater")}</option>
          {choice.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select> : <input className={fieldClass} value={choices[choice.id] ?? ""} placeholder={t("workspace.setup.decideLater")} onChange={(event) => setChoices({ ...choices, [choice.id]: event.target.value })} />}
        {choice.why && <span className="block text-xs text-muted-foreground">{text(choice.why)}</span>}
        {choice.requiredWhen && <span className="block text-xs text-muted-foreground">{text(choice.requiredWhen)}</span>}
      </label>)}
      <WorkflowOutputs workflow={workflow} />
      <PrepareEnvironment value={workflow.readiness} projectId={projectId} onPrepared={onRefresh} />
      {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {recipe && <DeleteRecipe onDelete={recipe.onDelete} />}
        <DialogClose asChild><Button variant="outline">{t("workspace.setup.close")}</Button></DialogClose>
        <Button disabled={busy || workflow.readiness.state !== "ready" || missingInput} onClick={() => void start()}>{t(busy ? "workspace.setup.creating" : "workspace.setup.create")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

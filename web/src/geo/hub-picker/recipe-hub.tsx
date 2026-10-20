"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import type { LocalMethodsResponse } from "@/geo/contracts/methods";
import { openMethodSetup } from "@/geo/hub/handoff";
import { sharedHub } from "@/geo/hub/shared-api";
import { t } from "@/geo/i18n";
import { request } from "@/geo/workspace/api";
import { HubPicker } from "./hub-picker";

/** Installation is pinned to the row the researcher chose; no chat starts here. */
export function RecipeHub({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [entry, setEntry] = useState<HubEntry | null>(null);
  const [methods, setMethods] = useState<LocalMethodsResponse | null>(null);
  const [methodsFailed, setMethodsFailed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void request<LocalMethodsResponse>("/geo/methods", projectId).then((result) => { if (alive) setMethods(result); })
      .catch(() => { if (alive) setMethodsFailed(true); });
    return () => { alive = false; };
  }, [projectId]);
  const installed = entry && methods?.methods.find((method) => method.methodId === entry.methodId);
  const installedRecipe = installed?.recipes.find((recipe) => installed.workflows.some((workflow) => workflow.id === recipe.workflowId));
  const canOpenRecipe = installed?.enabled && installedRecipe;
  const open = async () => {
    if (!entry) return;
    if (installed) {
      onDone();
      openMethodSetup({ projectId, methodKey: installed.key, workflowId: canOpenRecipe ? installedRecipe.workflowId : null, recipeId: canOpenRecipe ? installedRecipe.id : null });
      return;
    }
    setBusy(true); setFailed(false);
    try {
      const result = await sharedHub.install(entry.id, projectId, entry.latestRevision);
      onDone();
      openMethodSetup({ projectId, methodKey: result.install.methodKey, workflowId: result.workflowId, recipeId: result.recipeId });
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  if (!entry) return <HubPicker recipesOnly onSelect={(row) => { setEntry(row); setConsent(false); setFailed(false); }} />;
  return <div className="space-y-4 text-sm">
    <div className="space-y-1">
      <h3 className="font-medium break-words">{entry.title}</h3>
      <p className="text-xs text-muted-foreground">{entry.author} · {t("hubPicker.revision", { count: entry.latestRevision })}</p>
    </div>
    {methodsFailed ? <p role="alert">{t("hubPicker.methodsError")}</p> : !methods ? <p role="status">{t("hubPicker.loading")}</p> : <>
      <p>{t(installed ? canOpenRecipe ? "hubPicker.installed" : "hubPicker.installedNeedsCheck" : "hubPicker.installHelp")}</p>
      {!installed && <>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consent} disabled={busy} className="mt-1 h-4 w-4 shrink-0" onChange={(event) => setConsent(event.target.checked)} /><span>{t("hubPicker.consent")}</span></label>
      </>}
    </>}
    {failed && <p role="alert" className="text-destructive">{t("hubPicker.installError")}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" disabled={busy} onClick={() => setEntry(null)}>{t("hubPicker.back.button")}</Button>
      <Button disabled={busy || !methods || (!installed && !consent)} onClick={() => void open()}>{t(busy ? "hubPicker.installing" : installed ? canOpenRecipe ? "hubPicker.open.button" : "hubPicker.method.button" : "hubPicker.install.button")}</Button>
    </div>
  </div>;
}

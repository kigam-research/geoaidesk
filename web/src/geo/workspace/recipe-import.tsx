"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { apiFetch } from "@/lib/projects";
import type { GeoRecipeCheckResponse } from "@/geo/contracts/workspace";
import { request } from "./api";

export function RecipeImport({ projectId, path, onSetup }: { projectId: string; path?: string; onSetup: (setup: NonNullable<GeoRecipeCheckResponse["setup"]>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<GeoRecipeCheckResponse["issues"]>([]);
  const [error, setError] = useState<string | null>(null);
  const check = async (read: () => Promise<string>) => {
    setBusy(true); setIssues([]); setError(null);
    try {
      const recipe = JSON.parse(await read());
      const result = await request<GeoRecipeCheckResponse>("/geo/recipes/check", projectId, { recipe });
      setIssues(result.issues);
      if (result.ok && result.setup) onSetup(result.setup);
    } catch (error) { setError(t("workspace.recipe.error", { detail: (error as Error).message })); }
    finally { setBusy(false); }
  };
  const readOpenFile = async () => {
    const res = await apiFetch(`/sandbox/file?path=${encodeURIComponent(path!)}`, {}, projectId);
    if (!res.ok) throw new Error(t("workspace.error.status", { status: res.status }));
    return res.text();
  };
  return <div className="min-w-0 space-y-2 text-xs">
    <Button size="sm" variant="outline" disabled={busy} onClick={() => path ? void check(readOpenFile) : input.current?.click()}>{t(busy ? "workspace.recipe.checking" : "workspace.recipe.import")}</Button>
    {!path && <input ref={input} className="sr-only" tabIndex={-1} type="file" accept=".geo-start.json,application/json" aria-label={t("workspace.recipe.file")} onChange={(event) => {
      const file = event.target.files?.[0];
      if (file) void check(() => file.text());
      event.target.value = "";
    }} />}
    {issues.length > 0 && <ul role="alert" className="space-y-1 break-words">{issues.map((issue, index) => <li key={index}>{t("workspace.recipe.issue", { code: issue.code, subject: issue.subject ?? "" })}</li>)}</ul>}
    {error && <p role="alert" className="break-words text-destructive">{error}</p>}
  </div>;
}

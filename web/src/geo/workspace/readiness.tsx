"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import type { WorkflowReadiness } from "@/geo/contracts/workspace";
import { apiFetch } from "@/lib/projects";
import { request, text } from "./api";

/** Skills the pinned catalogue does not ship make a workflow unavailable; name them. */
function unavailableReason(value: WorkflowReadiness): string {
  const missing = value.skills.filter((skill) => !skill.runtimeName).map((skill) => skill.id);
  if (missing.length) return t("workspace.readiness.notShipped", { names: missing.join(", ") });
  return value.environment.detail || t("workspace.readiness.unknown");
}

export function Readiness({ value }: { value: WorkflowReadiness }) {
  const environment = text(value.environment.title) || value.environment.id;
  const label = value.state === "ready" ? t("workspace.readiness.ready")
    : value.state === "missing-skills" ? t("workspace.readiness.skills", { names: value.skills.filter((skill) => !skill.enabled).map((skill) => text(skill.title) || skill.runtimeName || skill.id).join(", ") })
    : value.state === "needs-environment" ? t("workspace.readiness.environment", { name: environment })
    : t("workspace.readiness.unavailable", { reason: unavailableReason(value) });
  return <div className="flex flex-wrap gap-1 text-xs">
    <span className="rounded border px-2 py-1 break-words">{label}</span>
    {value.runRecord === "none" && <span className="rounded border px-2 py-1">{t("workspace.readiness.untested")}</span>}
  </div>;
}

export function PrepareEnvironment({ value, projectId, onPrepared }: { value: WorkflowReadiness; projectId: string; onPrepared: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const needsPreparation = value.state === "needs-environment";
  if (value.state === "missing-skills") return <EnableSkills value={value} projectId={projectId} onEnabled={onPrepared} />;
  if (!needsPreparation && !output) return null;
  const prepare = async () => {
    setBusy(true); setOutput(null);
    try {
      const result = await request<{ ready: boolean; imports?: { module: string; error?: string }[]; distributions?: { name: string; error?: string }[]; tools?: { name: string; output?: string }[] }>(`/geo/environments/${encodeURIComponent(value.environment.id)}/prepare`, projectId, { target: "project" });
      await onPrepared();
      setOutput(result.ready ? t("workspace.environment.done") : t("workspace.environment.incomplete", {
        detail: [...(result.imports ?? []).filter((row) => row.error).map((row) => `${row.module}: ${row.error}`), ...(result.distributions ?? []).filter((row) => row.error).map((row) => `${row.name}: ${row.error}`), ...(result.tools ?? []).filter((row) => row.output).map((row) => `${row.name}: ${row.output}`)].join("\n"),
      }));
    } catch (error) { setOutput(t("workspace.environment.error", { detail: (error as Error).message })); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    {needsPreparation && <Button size="sm" variant="outline" disabled={busy} onClick={() => void prepare()}>{t(busy ? "workspace.environment.preparing" : "workspace.environment.prepare")}</Button>}
    {busy && <p role="status" className="text-xs">{t("workspace.environment.progress")}</p>}
    {output && <pre role="status" className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{output}</pre>}
  </div>;
}

/**
 * A workflow skill that is installed but disabled can be turned on here (the
 * same move as Settings → Skills). A skill that is not installed is named, not
 * installed silently.
 */
function EnableSkills({ value, projectId, onEnabled }: { value: WorkflowReadiness; projectId: string; onEnabled: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = value.skills.filter((skill) => skill.installed && !skill.enabled && skill.runtimeName);
  const absent = value.skills.filter((skill) => !skill.installed);
  const enable = async () => {
    setBusy(true); setError(null);
    try {
      for (const skill of disabled) {
        const res = await apiFetch(`/skills/${encodeURIComponent(skill.runtimeName!)}/enable`, { method: "POST" }, projectId);
        if (!res.ok) throw new Error(t("workspace.error.status", { status: res.status }));
      }
      await onEnabled();
    } catch (err) { setError(t("workspace.skills.error", { detail: (err as Error).message })); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 text-xs">
    {disabled.length > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void enable()}>{t(busy ? "workspace.skills.enabling" : "workspace.skills.enable")}</Button>}
    {absent.length > 0 && <p className="break-words">{t("workspace.skills.notInstalled", { names: absent.map((skill) => skill.runtimeName ?? skill.id).join(", ") })}</p>}
    {error && <p role="alert" className="break-words text-destructive">{error}</p>}
  </div>;
}

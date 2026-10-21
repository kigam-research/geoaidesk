"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TechnicalDetail } from "@/geo/hub/technical";
import { requestSkillImport } from "@/geo/skills/import-request";
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
    <span className={value.state === "needs-environment" || value.state === "missing-skills" ? "rounded-sm border border-gaid-warning/30 bg-gaid-warning-bg px-2 py-1 text-gaid-warning break-words" : "rounded-sm border bg-gaid-pending-bg px-2 py-1 break-words"}>{label}</span>
    {value.runRecord === "none" && <span className="rounded-sm border bg-gaid-pending-bg px-2 py-1 text-muted-foreground">{t("workspace.readiness.untested")}</span>}
  </div>;
}

export function PrepareEnvironment({ value, projectId, onPrepared }: { value: WorkflowReadiness; projectId: string; onPrepared: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  // The visible line is a research-facing result; raw import/install output stays behind 기술 정보 (UI guide R2).
  const [output, setOutput] = useState<{ message: string; detail?: string; failed?: boolean } | null>(null);
  const needsPreparation = value.state === "needs-environment";
  if (value.state === "missing-skills") return <EnableSkills value={value} projectId={projectId} onEnabled={onPrepared} />;
  if (!needsPreparation && !output) return null;
  const prepare = async () => {
    setBusy(true); setOutput(null);
    try {
      const result = await request<{ ready: boolean; imports?: { module: string; error?: string }[]; distributions?: { name: string; error?: string }[]; tools?: { name: string; output?: string }[] }>(`/geo/environments/${encodeURIComponent(value.environment.id)}/prepare`, projectId, { target: "project" });
      await onPrepared();
      setOutput(result.ready ? { message: t("workspace.environment.done") } : {
        message: t("workspace.environment.incomplete"), failed: true,
        detail: [...(result.imports ?? []).filter((row) => row.error).map((row) => `${row.module}: ${row.error}`), ...(result.distributions ?? []).filter((row) => row.error).map((row) => `${row.name}: ${row.error}`), ...(result.tools ?? []).filter((row) => row.output).map((row) => `${row.name}: ${row.output}`)].join("\n"),
      });
    } catch (error) { setOutput({ message: t("workspace.environment.error"), detail: (error as Error).message, failed: true }); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    {needsPreparation && <Button size="sm" variant="outline" disabled={busy} onClick={() => void prepare()}>{t(busy ? "workspace.environment.preparing" : "workspace.environment.prepare")}</Button>}
    {busy && <p role="status" className="text-xs">{t("workspace.environment.progress")}</p>}
    {output && <div role="status" className="space-y-1 text-xs break-words">
      <p className={output.failed ? "text-destructive" : undefined}>{output.message}</p>
      <TechnicalDetail detail={output.detail} />
    </div>}
  </div>;
}

/**
 * The setup's readiness blocker with the action that fixes it, shown on the first step and the summary (UI guide Q4).
 * Ready workflows show nothing here.
 */
export function ReadinessNotice({ value, projectId, onPrepared }: { value: WorkflowReadiness; projectId: string; onPrepared: () => void | Promise<void> }) {
  const environment = text(value.environment.title) || value.environment.id;
  // Skills that are installed but off are named here; ones not installed are named by EnableSkills below.
  const off = value.skills.filter((skill) => skill.installed && !skill.enabled);
  const message = value.state === "missing-skills" ? (off.length ? t("workspace.setup.ready.skills", { names: off.map((skill) => text(skill.title) || skill.runtimeName || skill.id).join(", ") }) : null)
    : value.state === "needs-environment" ? t("workspace.setup.ready.environment", { name: environment })
    : value.state === "unavailable" ? t("workspace.setup.ready.unavailable")
    : t("workspace.setup.ready.done");
  // One row: the blocker and the action that fixes it (UI guide Q4); results wrap below.
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/50 px-4 py-2.5 text-sm">
    {message && <p className="min-w-0 flex-1 break-words">{message}</p>}
    {value.state === "unavailable" ? <TechnicalDetail detail={unavailableReason(value)} /> : <PrepareEnvironment value={value} projectId={projectId} onPrepared={onPrepared} />}
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
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2 text-xs">
    {disabled.length > 0 && <Button size="sm" variant="outline" disabled={busy} onClick={() => void enable()}>{t(busy ? "workspace.skills.enabling" : "workspace.skills.enable")}</Button>}
    {absent.length > 0 && <p className="break-words">{t("workspace.skills.notInstalled", { names: absent.map((skill) => text(skill.title) || skill.runtimeName || skill.id).join(", ") })}</p>}
    {absent.filter((skill) => skill.source === "imported" && skill.ref).map((skill) => <div key={skill.id} className="space-y-1">
      <p>{t("workflowView.importRef", { ref: skill.ref! })}</p>
      <Button size="sm" variant="outline" onClick={() => requestSkillImport(projectId, skill.ref!)}>{t("workflowView.import.button")}</Button>
    </div>)}
    {error && <div role="alert" className="space-y-1"><p className="text-destructive">{t("workspace.skills.error")}</p><TechnicalDetail detail={error} /></div>}
  </div>;
}

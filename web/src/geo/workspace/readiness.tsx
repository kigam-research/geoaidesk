"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import type { WorkflowReadiness } from "@/geo/contracts/workspace";
import { request, text } from "./api";

export function Readiness({ value }: { value: WorkflowReadiness }) {
  const environment = text(value.environment.title) || value.environment.id;
  const label = value.state === "ready" ? t("workspace.readiness.ready")
    : value.state === "missing-skills" ? t("workspace.readiness.skills", { names: value.skills.filter((skill) => !skill.enabled).map((skill) => text(skill.title) || skill.runtimeName || skill.id).join(", ") })
    : value.state === "needs-environment" ? t("workspace.readiness.environment", { name: environment })
    : t("workspace.readiness.unavailable", { reason: value.environment.detail || t("workspace.readiness.unknown") });
  return <div className="flex flex-wrap gap-1 text-xs">
    <span className="rounded border px-2 py-1 break-words">{label}</span>
    {value.runRecord === "none" && <span className="rounded border px-2 py-1">{t("workspace.readiness.untested")}</span>}
  </div>;
}

export function PrepareEnvironment({ value, projectId, onPrepared }: { value: WorkflowReadiness; projectId: string; onPrepared: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const needsPreparation = value.state === "needs-environment";
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

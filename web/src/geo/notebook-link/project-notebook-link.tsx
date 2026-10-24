"use client";

import { useEffect, useState } from "react";
import { apiFetch, useProjectScopeId } from "@/lib/projects";
import type { ProjectNotebookLink as LinkRecord } from "@/geo/contracts/notebook-link";
import { t } from "@/geo/i18n";
import { NotebookLinkControl } from "./notebook-link-control";

export function ProjectNotebookLink() {
  const projectId = useProjectScopeId();
  // Remount the loader on a project change: an old GET/PUT cannot paint another project's link.
  return <ProjectLink key={projectId} projectId={projectId} />;
}

function ProjectLink({ projectId }: { projectId: string }) {
  const [record, setRecord] = useState<LinkRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void apiFetch("/geo/notebook-link", { signal: controller.signal }, projectId).then(async (response) => {
      if (!response.ok) throw new Error("Notebook link load failed");
      const next: LinkRecord = await response.json();
      if (!controller.signal.aborted) setRecord(next);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [projectId, attempt]);

  if (failed) return <div className="flex items-center gap-2 text-sm"><span role="alert">{t("notebookLink.loadFailed")}</span><button type="button" className="min-h-7 text-primary hover:underline" onClick={() => setAttempt((value) => value + 1)}>{t("notebookLink.retry.action")}</button></div>;
  if (!record) return <span className="text-sm text-muted-foreground" role="status">{t("notebookLink.loading")}</span>;
  return <NotebookLinkControl context="project" url={record.url} onSave={async (url) => {
    const response = await apiFetch("/geo/notebook-link", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }, projectId);
    if (!response.ok) throw new Error("Notebook link save failed");
    setRecord(await response.json());
  }} />;
}

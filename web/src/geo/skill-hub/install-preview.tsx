"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/geo/i18n";
import { text } from "@/geo/workspace/api";
import type { Localized } from "@/geo/contracts/workspace";
import { apiFetch } from "@/lib/projects";
import { hubApi } from "@/geo/hub/api";

export interface InstallPreviewData {
  skills: { name: string; files: number }[];
  contents: { name: string; files: string[]; hasCode: boolean; prompts: Localized[] }[];
}

/** The three install routes share one bounded preview, above the consent checkbox. */
export function InstallPreview({ projectId, entryId, revision, authoringId, onReady }: {
  projectId: string; entryId?: string; authoringId?: string; revision: number; onReady: (ready: boolean) => void;
}) {
  const [data, setData] = useState<InstallPreviewData | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    onReady(false);
    if (!projectId) return;
    const load = async () => {
      let url = "/geo/skill-hub/preview";
      let body: unknown = { hubEntry: { id: entryId, revision }, scope: "project" };
      if (authoringId) {
        const pkg = await hubApi.pack(authoringId, revision);
        url = `/geo/authoring/projects/${encodeURIComponent(authoringId)}/packages/${pkg.revision}/preview`;
        body = { projectId };
      }
      const response = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, projectId);
      if (!response.ok) throw new Error();
      const preview = await response.json() as InstallPreviewData;
      if (!preview.skills?.length || !preview.contents?.length) throw new Error();
      if (alive) { setData(preview); onReady(true); }
    };
    void load().catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [projectId, entryId, authoringId, revision, retry, onReady]);
  return <section className="min-w-0 space-y-2 rounded-md border p-3 text-sm" aria-label={t("skillHub.installPreview")}>
    <h4 className="font-medium">{t("skillHub.installPreview")}</h4>
    {failed ? <><p role="alert">{t("skillHub.previewError")}</p><Button variant="outline" size="sm" onClick={() => { setFailed(false); setData(null); setRetry((n) => n + 1); }}>{t("skillHub.previewRetry")}</Button></> : !data ? <p role="status">{t("skillHub.previewLoading")}</p> : <>
      {data.contents.map((skill) => <div key={skill.name} className="space-y-2">
        <p>{t("skillHub.previewSkill", { name: skill.name, count: skill.files.length })}</p>
        <p>{t("skillHub.previewCode", { code: skill.hasCode ? "yes" : "no" })}</p>
        <details><summary className="cursor-pointer text-xs">{t("skillHub.fileList", { count: skill.files.length })}</summary><ul className="mt-2 max-h-36 overflow-auto break-all font-mono text-xs">{skill.files.map((f) => <li key={f}>{f}</li>)}</ul></details>
        <p className="text-xs text-muted-foreground">{t("skillHub.previewRun")}</p>
        <details><summary className="cursor-pointer text-xs">{t("skillHub.previewPrompt")}</summary>{skill.prompts.map((p, i) => <pre key={i} className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-xs">{text(p)}</pre>)}</details>
      </div>)}
    </>}
  </section>;
}

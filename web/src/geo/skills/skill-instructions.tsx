"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/projects";
import type { SkillScope } from "@/lib/capabilities";
import { t } from "@/geo/i18n";

/** Inline read-only view: settings already lives in a dialog, so do not stack another modal. */
export function SkillInstructions({ name, scope, projectId, onBack }: { name: string; scope: SkillScope; projectId: string; onBack: () => void }) {
  const [data, setData] = useState<{ content: string; files: string[]; truncated: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void apiFetch(`/skills/${encodeURIComponent(name)}/source?scope=${scope}`, {}, projectId).then(async (r) => {
      if (!r.ok) throw new Error();
      const value = await r.json();
      if (alive) setData(value);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [name, scope, projectId]);
  return <section className="flex min-w-0 flex-col gap-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold">{t("skillHub.readSkill", { name })}</h3><Button size="sm" variant="outline" onClick={onBack}>{t("skillHub.backSkills")}</Button></div>
    {failed ? <p role="alert">{t("skillHub.readError")}</p> : !data ? <p role="status">{t("skillHub.readLoading")}</p> : <>
      <details><summary className="cursor-pointer text-sm">{t("skillHub.fileList", { count: data.files?.length ?? 0 })}</summary><ul className="mt-2 max-h-48 overflow-auto text-xs font-mono">{data.files?.map((f) => <li key={f}>{f}</li>)}</ul>{data.truncated && <p className="text-xs">{t("skillHub.filesTruncated")}</p>}</details>
      <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-md border p-4 text-sm" aria-label="SKILL.md">{data.content}</pre>
    </>}
  </section>;
}

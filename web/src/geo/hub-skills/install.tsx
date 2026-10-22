"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { InstallSkillPreview, InstallSkillResult } from "@/geo/contracts/hub-skills";
import { hubSkills } from "./api";
import { Failure, FileList, Findings, Instructions, Licence, text } from "./parts";

/** Reusable inline gate, also used by Workflow readiness. Never installs without preview + explicit consent. */
export function HubSkillInstall({ skillId, revision, projectId, onInstalled }: {
  skillId: string; revision: number; projectId: string; onInstalled?: (result: InstallSkillResult) => void;
}) {
  const [retry, setRetry] = useState(0);
  // A keyed child makes project/revision changes revoke consent immediately, including before effects run.
  return <InstallGate key={`${skillId}:${revision}:${projectId}:${retry}`} {...{skillId, revision, projectId, onInstalled}} retry={() => setRetry((n) => n + 1)} />;
}
function InstallGate({ skillId, revision, projectId, onInstalled, retry }: {
  skillId: string; revision: number; projectId: string; onInstalled?: (result: InstallSkillResult) => void; retry: () => void;
}) {
  const [preview, setPreview] = useState<InstallSkillPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InstallSkillResult | null>(null);
  useEffect(() => {
    let alive = true;
    if (projectId) void hubSkills.installPreview(skillId, projectId, revision).then((value) => { if (alive) setPreview(value); }).catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [skillId, projectId, revision]);
  const blocked = !preview || preview.state === "suspended" || ["edited", "conflict", "suspended"].includes(preview.project);
  async function install() {
    if (blocked || !ack || busy) return;
    setBusy(true); setError(null);
    try { const value = await hubSkills.install(skillId, projectId, revision); setResult(value); onInstalled?.(value); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <section className="space-y-4 text-sm" aria-label={text("preview")}>
    <h3 className="text-lg font-semibold">{text("preview")}</h3>
    {error && <Failure error={error} retry={retry} />}
    {result ? <p role="status">{text(result.installed ? "installed" : "unchanged", { name: result.name, revision: result.revision })}</p> : !projectId ? <p>{text("chooseProject")}</p> : !preview ? !error && <div role="status" className="h-24 animate-pulse rounded bg-gaid-face-2 p-4">{text("loading")}</div> : <>
      <p className="font-medium">{text("installedRevision", { revision: preview.revision })}</p>
      <p className={blocked ? "text-gaid-warning" : "text-gaid-ink-2"}>{text(`installState.${preview.state === "suspended" ? "suspended" : preview.project}`)}</p>
      <SkillInstructions skillId={skillId} revision={revision} />
      <FileList files={preview.files} load={(path) => hubSkills.file(skillId, revision, path)} />
      <p>{text("code", { code: preview.hasCode ? "yes" : "no" })}</p>
      <details><summary className="cursor-pointer">{text("sourceTitle")}</summary><div className="mt-3"><Licence licence={preview.licence} visibility={false} /></div></details>
      <details><summary className="cursor-pointer">{text("findings")}</summary><div className="mt-3"><Findings findings={preview.findings} /></div></details>
      <p className="text-gaid-ink-2">{text("runNotice")}</p>
      <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={ack} disabled={blocked || busy} onChange={(e) => setAck(e.target.checked)} /><span>{text("consent")}</span></label>
      <Button disabled={blocked || !ack || busy} onClick={() => void install()}>{text(busy ? "loading" : "install")}</Button>
    </>}
  </section>;
}

function SkillInstructions({ skillId, revision }: { skillId: string; revision: number }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return <details onToggle={(e) => {
    if (!e.currentTarget.open || content !== null || loading) return;
    setLoading(true); setError(null);
    void hubSkills.detail(skillId, revision).then((value) => setContent(value.content)).catch((e) => setError(String(e))).finally(() => setLoading(false));
  }}><summary className="cursor-pointer font-medium">{text("instructions")}</summary><div className="mt-4">{error ? <Failure error={error} /> : content !== null ? <Instructions content={content} /> : <p role="status">{text("loading")}</p>}</div></details>;
}

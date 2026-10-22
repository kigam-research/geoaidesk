"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { HubSkill, RegisterSkillPreview, RegisterSkillSource } from "@/geo/contracts/hub-skills";
import type { HubEntry, HubFolder } from "@/geo/contracts/hub-shared";
import { sharedHub } from "@/geo/hub/shared-api";
import { useNamedAction } from "@/geo/hub/shared-entry";
import { TechnicalDetail } from "@/geo/hub/technical";
import { StepScale } from "@/geo/shell/step-scale";
import { apiFetch } from "@/lib/projects";
import { hubSkills } from "./api";
import { Failure, FileList, Findings, Licence, Origin, text } from "./parts";
import { selectClass } from "./shelf";

export function RegistrationPreview({ preview }: { preview: RegisterSkillPreview }) {
  const block = preview.blocked || preview.existing?.mode === "taken" || preview.existing?.sameTree;
  return <section className="space-y-5" aria-label={text("registerPreview")}>
    <h2 className="text-lg font-semibold">{preview.name || text("registerPreview")}</h2><p className="text-sm text-gaid-ink-2">{preview.description}</p>
    {preview.existing && <p className={block ? "text-sm text-gaid-warning" : "text-sm"}>{text(preview.existing.mode === "taken" ? "taken" : preview.existing.sameTree ? "sameTree" : "nextRevision", { revision: preview.existing.latestRevision + 1 })}</p>}
    {preview.blocked && <div><p role="alert" className="text-sm text-gaid-warning">{text("blocked")}</p><TechnicalDetail detail={preview.blocked} /></div>}
    <FileList files={preview.files.map((f) => f.path)} /><Origin origin={preview.origin} /><Licence licence={preview.licence} /><Findings findings={preview.findings} />
  </section>;
}
export function canRegister(preview: RegisterSkillPreview | null): boolean {
  return !!preview && !preview.choices?.length && !preview.blocked && preview.existing?.mode !== "taken" && !preview.existing?.sameTree;
}
const split = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);
export function RegisterSkill({ projects, folders, onBack, onRegistered }: {
  projects: { id: string; name: string }[]; folders: HubFolder[]; onBack: () => void; onRegistered: (skill: HubSkill) => void;
}) {
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState<RegisterSkillSource["from"]>("project");
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [entries, setEntries] = useState<HubEntry[]>([]);
  const [entryId, setEntryId] = useState("");
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<RegisterSkillPreview | null>(null);
  const [note, setNote] = useState("");
  const [folderId, setFolderId] = useState("");
  const [tags, setTags] = useState("");
  const [formats, setFormats] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const named = useNamedAction();
  useEffect(() => {
    let alive = true;
    if (from !== "workflow") return;
    setLoading(true); setError(null);
    void sharedHub.entries().then((v) => { if (alive) setEntries(v.entries); }).catch((e) => { if (alive) setError(String(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [from]);
  useEffect(() => {
    let alive = true;
    if (!projectId || from !== "project") return;
    setNames([]); setName(""); setLoading(true); setError(null);
    void apiFetch("/skills/all?scope=project", {}, projectId).then(async (response) => {
      if (!response.ok) throw new Error(await response.text());
      const v = await response.json() as { enabled: { name: string }[]; disabled: { name: string }[] };
      if (alive) setNames([...v.enabled, ...v.disabled].map((s) => s.name));
    }).catch((e) => { if (alive) setError(String(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId, from]);
  const selection: RegisterSkillSource | null = from === "project" ? projectId && name ? { from, projectId, name } : null : from === "workflow" ? entryId && revision ? { from, entryId, revision } : null : source.trim() ? { from, source: source.trim(), ...(name ? { name } : {}) } : null;
  function invalidate() { setPreview(null); setError(null); }
  async function read() {
    if (!selection || busy) return;
    setBusy(true); setError(null); setPreview(null);
    try { const value = await hubSkills.preview(selection); setPreview(value); if (!value.choices?.length) setStep(2); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  function register() {
    if (!selection || !preview || !canRegister(preview) || !note.trim() || !folderId || busy) return;
    named.run(() => {
      setBusy(true); setError(null);
      void hubSkills.register({ ...selection, treeHash: preview.treeHash, note: note.trim(), folderId, tags: split(tags), formats: split(formats) }).then(onRegistered).catch((e) => setError(String(e))).finally(() => setBusy(false));
    });
  }
  return <section className="flex min-h-0 flex-1 flex-col text-gaid-ink">
    <header className="flex shrink-0 items-center justify-between border-b border-gaid-edge bg-gaid-chrome px-6 py-4"><h1 className="text-2xl font-bold">{text("register")}</h1><Button variant="ghost" disabled={busy} onClick={onBack}>{text("cancel")}</Button></header>
    <div className="shrink-0 px-6 py-5"><StepScale label={text("stepsLabel")} current={step} steps={["source", "select", "preview", "register"].map((s, i) => ({ label: text(`steps.${s}`), done: i < step, disabled: i > step || busy }))} onStep={setStep} /></div>
    <div className="min-h-0 flex-1 overflow-auto bg-gaid-face px-6 pb-6"><div className="max-w-[680px] space-y-5">
      {error && <Failure error={error} />}
      {step === 0 && <fieldset className="space-y-3"><legend className="mb-4 text-lg font-semibold">{text("steps.source")}</legend>{(["project", "workflow", "source"] as const).map((s) => <label key={s} className="flex cursor-pointer items-start gap-3 rounded-md border border-gaid-control-edge p-4 has-[:checked]:bg-gaid-signal-tint"><input disabled={busy} type="radio" className="mt-1 size-4 accent-primary" name="skill-source" checked={s === from} onChange={() => { setFrom(s); setName(""); invalidate(); }} /><span className="space-y-1"><span className="block text-sm font-medium">{text(`source.${s}`)}{s === "project" && <span className="ml-2 text-xs text-gaid-ink-2">{text("recommended")}</span>}</span>{s === "project" && <span className="block text-sm text-gaid-ink-2">{text("projectReason")}</span>}</span></label>)}</fieldset>}
      {step === 1 && <section className="space-y-5"><h2 className="text-lg font-semibold">{text("steps.select")}</h2>
        {from === "project" && <><label className="block space-y-2 text-sm"><span>{text("project")}</span><select disabled={busy} className={`${selectClass} block w-full`} value={projectId} onChange={(e) => { setProjectId(e.target.value); setName(""); invalidate(); }}><option value="">{text("chooseProject")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{projectId && <label className="block space-y-2 text-sm"><span>{text("skillName")}</span><select disabled={busy} className={`${selectClass} block w-full`} value={name} onChange={(e) => { setName(e.target.value); invalidate(); }}><option value="">{text("steps.select")}</option>{names.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}{projectId && !loading && !names.length && <p className="text-sm">{text("noSourceSkills")}</p>}</>}
        {from === "workflow" && <><label className="block space-y-2 text-sm"><span>{text("workflow")}</span><select disabled={busy} className={`${selectClass} block w-full`} value={entryId} onChange={(e) => { setEntryId(e.target.value); setRevision(entries.find((v) => v.id === e.target.value)?.latestRevision ?? 0); invalidate(); }}><option value="">{text("steps.select")}</option>{entries.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>{entryId && <label className="block space-y-2 text-sm"><span>{text("history")}</span><select disabled={busy} className={selectClass} value={revision} onChange={(e) => { setRevision(Number(e.target.value)); invalidate(); }}>{entries.find((v) => v.id === entryId)?.revisions.map((r) => <option key={r.revision} value={r.revision}>{text("revision", { revision: r.revision })}</option>)}</select></label>}{!loading && !entries.length && <p className="text-sm">{text("noSourceSkills")}</p>}</>}
        {from === "source" && <><label className="block space-y-2 text-sm"><span>{text("sourceInput")}</span><Input disabled={busy} value={source} onChange={(e) => { setSource(e.target.value); setName(""); invalidate(); }} /></label>{preview?.choices?.length ? <label className="block space-y-2 text-sm"><span>{text("skillName")}</span><select disabled={busy} className={selectClass} value={name} onChange={(e) => setName(e.target.value)}><option value="">{text("steps.select")}</option>{preview.choices.map((n) => <option key={n} value={n}>{n}</option>)}</select></label> : null}</>}
        {loading && <p role="status" className="text-sm">{text("loading")}</p>}
      </section>}
      {step === 2 && preview && <RegistrationPreview preview={preview} />}
      {step === 3 && preview && <section className="space-y-5"><h2 className="text-lg font-semibold">{preview.name}</h2><p className="text-sm">{text("revision", { revision: (preview.existing?.latestRevision ?? 0) + 1 })}</p><Licence licence={preview.licence} /><label className="block space-y-2 text-sm"><span>{text("note")}</span><Textarea disabled={busy} required maxLength={2000} value={note} placeholder={text("registerNote")} onChange={(e) => setNote(e.target.value)} /></label><label className="block space-y-2 text-sm"><span>{text("folder")}</span><select disabled={busy} className={`${selectClass} block w-full`} value={folderId} onChange={(e) => setFolderId(e.target.value)}><option value="">{text("folder")}</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><details><summary className="cursor-pointer text-sm">{text("tags")}</summary><div className="mt-3 space-y-4"><Input disabled={busy} aria-label={text("tags")} value={tags} onChange={(e) => setTags(e.target.value)} /><label className="block space-y-2 text-sm"><span>{text("formats")}</span><Input disabled={busy} value={formats} onChange={(e) => setFormats(e.target.value)} /></label></div></details></section>}
    </div></div>
    <footer className="flex shrink-0 justify-end gap-3 border-t border-gaid-edge bg-gaid-chrome px-6 py-4">{step > 0 && <Button variant="outline" disabled={busy} onClick={() => setStep(step - 1)}>{text("previous")}</Button>}{step === 3 ? <Button disabled={busy || !note.trim() || !folderId || !canRegister(preview)} onClick={register}>{text(busy ? "loading" : "register")}</Button> : <Button disabled={busy || loading || step === 1 && (!selection || !!preview?.choices?.length && !name) || step === 2 && !canRegister(preview)} onClick={() => step === 1 ? void read() : setStep(step + 1)}>{text(busy ? "loading" : step === 1 ? "previewAction" : "next")}</Button>}</footer>{named.dialog}
  </section>;
}

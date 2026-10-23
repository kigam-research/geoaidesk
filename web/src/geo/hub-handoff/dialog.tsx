"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/projects";
import { t } from "@/geo/i18n";
import { authoringUrl, canSendDirect, checked, directHandoff, downloadHandoff, handoffExtras, previewHandoff, saveDownload, sendToHub, type HandoffExtras, type HandoffPreview, type HubSite } from "./client";

/** At most this many notes and papers go along (server limit). */
const EXTRA_LIMIT = 20;

/** Preview text without Markdown markers (re-trial: "## 최종 보고" and "**…**" showed as raw text). The bundle keeps the original. */
export function plainMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ");
}

export function HandoffDialog({ projectId, sessionId, isStreaming, onClose }: { projectId: string; sessionId: string; isStreaming: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<HandoffPreview | null>(null);
  const [sites, setSites] = useState<HubSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [extras, setExtras] = useState<HandoffExtras>({ notes: [], papers: [] });
  const [notes, setNotes] = useState<string[]>([]);
  const [papers, setPapers] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [transferPath, setTransferPath] = useState<"hub" | "download" | "direct" | "download-fallback" | null>(null);
  const [hubDraft, setHubDraft] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void Promise.all([
      previewHandoff(projectId, sessionId),
      apiFetch("/geo/skill-hub", {}, projectId).then(checked).then(res => res.json() as Promise<{ sites: HubSite[] }>),
    ]).then(([data, hub]) => {
      if (!active) return;
      setPreview(data); setSelected(data.files.filter(f => f.role !== "user-data").map(f => f.path));
      const preferred = hub.sites.find(s => s.id === data.methodTrial?.siteId) ?? hub.sites.find(s => s.authoring) ?? hub.sites[0];
      setSites(hub.sites); setSiteId(preferred?.id ?? ""); setDownloaded(false);
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : t("hubHandoff.errors.request")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, sessionId, attempt]);
  // The chat's research notes and the project's papers are offered for the GAID hub draft; a failed read offers none.
  useEffect(() => {
    let active = true;
    void handoffExtras(projectId).then(found => {
      if (!active) return;
      setExtras(found);
      setNotes(found.notes.filter(n => n.sessions.includes(sessionId)).map(n => n.id).slice(0, EXTRA_LIMIT));
      setPapers(found.papers.map(p => p.id).slice(0, EXTRA_LIMIT));
    });
    return () => { active = false; };
  }, [projectId, sessionId]);
  const size = preview?.files.filter(f => selected.includes(f.path)).reduce((sum, f) => sum + f.size, 0) ?? 0;
  const clearTransfer = () => { setDownloaded(false); setTransferPath(null); setDraftUrl(""); setHubDraft(""); };
  // The GAID hub is a place of this page (#hub/<draft>): the new draft opens there with the bundle attached.
  const sendHub = async () => {
    if (busy || loading || isStreaming || !preview) return;
    setBusy(true); setError(""); clearTransfer();
    try {
      const result = await sendToHub(projectId, sessionId, selected, note, { notes, libraryItemIds: papers });
      if (!live.current) return;
      setHubDraft(result.projectId); setTransferPath("hub");
    } catch (err) { if (live.current) setError(err instanceof Error ? err.message : t("hubHandoff.errors.request")); }
    finally { if (live.current) setBusy(false); }
  };
  const openHubDraft = () => { onClose(); window.location.hash = `#hub/${hubDraft}`; };
  const download = async (direct = false) => {
    if (busy || loading || isStreaming || !preview) return;
    setBusy(true); setError(""); setDownloaded(false); setTransferPath(null); setDraftUrl("");
    try {
      if (direct && site && canSendDirect(site)) {
        try {
          const result = await directHandoff(projectId, sessionId, selected, note, site.id);
          if (!live.current) return;
          if (result.path === "direct") {
            setDraftUrl(result.url); setTransferPath("direct"); window.open(result.url, "_blank", "noopener,noreferrer");
          } else { saveDownload(result.blob, result.filename); setDownloaded(true); setTransferPath("download-fallback"); }
          return;
        } catch {
          // A transport error can occur before the server's gzip fallback arrives.
          if (!live.current) return;
        }
      }
      const result = await downloadHandoff(projectId, sessionId, selected, note);
      if (!live.current) return;
      saveDownload(result.blob, result.filename); setDownloaded(true);
      setTransferPath(direct ? "download-fallback" : "download");
    } catch (err) { if (live.current) setError(err instanceof Error ? err.message : t("hubHandoff.errors.request")); }
    finally { if (live.current) { setBusy(false); } }
  };
  const site = sites.find(s => s.id === siteId);
  const excluded = Object.values(preview?.excluded ?? {}).reduce((sum, count) => sum + count, 0);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto break-words sm:max-w-2xl">
      <DialogTitle>{t("hubHandoff.title")}</DialogTitle>
      <DialogDescription>{t("hubHandoff.description")}</DialogDescription>
      <p className="text-sm">{t("hubHandoff.rawData")}</p>
      {loading && <p role="status">{t("hubHandoff.loading")}</p>}
      {preview && !loading && <div className="min-w-0 space-y-3 pb-2 text-sm">
        <section><h3 className="font-medium">{t("hubHandoff.request")}</h3><p className="max-h-32 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.request || t("hubHandoff.emptyText")}</p></section>
        {!!preview.followUps?.length && <section><h3 className="font-medium">{t("hubHandoff.followUps", { count: preview.followUps.length })}</h3><ol className="max-h-32 list-decimal space-y-1 overflow-y-auto pl-5 whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.followUps.map((text, i) => <li key={i}>{text}</li>)}</ol></section>}
        {preview.methodTrial && <section><h3 className="font-medium">{t("hubHandoff.methodTrial")}</h3>
          <p>{t("hubHandoff.methodTrialLine", { method: preview.methodTrial.methodId ?? "-", revision: preview.methodTrial.revision ?? "-", workflow: preview.methodTrial.workflowId })}</p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.methodTrial.assessment ? t("hubHandoff.assessment", { outcome: preview.methodTrial.assessment.outcome, note: preview.methodTrial.assessment.note || "-" }) : t("hubHandoff.noAssessment")}</p>
        </section>}
        <section><h3 className="font-medium">{t("hubHandoff.finalAnswer")}</h3><p className="max-h-40 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{plainMarkdown(preview.finalAnswer) || t("hubHandoff.emptyText")}</p></section>
        <p>{t("hubHandoff.model", { model: preview.modelRef ?? t("hubHandoff.unknownModel") })}</p>
        {Object.values(preview.truncated).some(Boolean) && <p>{t("hubHandoff.truncated")}</p>}
        <fieldset disabled={busy || isStreaming} className="min-w-0 space-y-2">
          <legend className="font-medium">{t("hubHandoff.files")}</legend>
          {!preview.files.length && <p>{t("hubHandoff.emptyFiles")}</p>}
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {preview.files.map(file => <label key={file.path} className="flex min-w-0 items-start gap-2">
              <input type="checkbox" className="mt-1" checked={selected.includes(file.path)} onChange={e => { setSelected(old => e.target.checked ? [...old, file.path] : old.filter(p => p !== file.path)); clearTransfer(); }} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{file.path}<span className="block text-xs text-muted-foreground">{t(`hubHandoff.role.${file.role}`)} · {file.size.toLocaleString()} B</span></span>
            </label>)}
          </div>
        </fieldset>
        {(extras.notes.length > 0 || extras.papers.length > 0) && <fieldset disabled={busy || isStreaming} className="min-w-0 space-y-2">
          <legend className="font-medium">{t("hubHandoff.extras")}</legend>
          <p className="text-xs text-muted-foreground">{t("hubHandoff.extrasHelp", { limit: EXTRA_LIMIT })}</p>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {extras.notes.map(n => <ExtraRow key={`n-${n.id}`} checked={notes.includes(n.id)} disabled={!notes.includes(n.id) && notes.length >= EXTRA_LIMIT}
              onChange={on => { setNotes(old => on ? [...old, n.id] : old.filter(x => x !== n.id)); clearTransfer(); }}
              title={n.title} detail={t("hubHandoff.noteLine", { date: n.date })} />)}
            {extras.papers.map(p => <ExtraRow key={`p-${p.id}`} checked={papers.includes(p.id)} disabled={!papers.includes(p.id) && papers.length >= EXTRA_LIMIT}
              onChange={on => { setPapers(old => on ? [...old, p.id] : old.filter(x => x !== p.id)); clearTransfer(); }}
              title={p.title} detail={t("hubHandoff.paperLine", { authors: p.authors || "-", year: p.year ?? "-" })} />)}
          </div>
        </fieldset>}
        {!!excluded && <p>{t("hubHandoff.excluded", { count: excluded })}</p>}
        {!!preview.excludedFiles?.length && <ul className="list-disc pl-5 text-xs [overflow-wrap:anywhere]">{preview.excludedFiles.map(file => <li key={file.path}>{t("hubHandoff.excludedFile", { path: file.path, reason: file.reason })}</li>)}</ul>}
        <p>{t("hubHandoff.selection", { count: selected.length, size: (size / 1024 / 1024).toFixed(2) })}</p>
        <p className="text-xs text-muted-foreground">{t("hubHandoff.sizeHelp")}</p>
        <label className="block space-y-1"><span>{t("hubHandoff.note")}</span><textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={4000} disabled={busy || isStreaming} value={note} onChange={e => { setNote(e.target.value); clearTransfer(); }} /></label>
        {sites.length > 1 && <label className="block space-y-1"><span>{t("hubHandoff.site")}</span><select className="w-full rounded-md border bg-background p-2" disabled={busy || isStreaming} value={siteId} onChange={e => { setSiteId(e.target.value); clearTransfer(); }}>{sites.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>}
        {/* The analysis goes to this app's GAID hub; an external hub is named only where it can take a direct send. */}
        {site && canSendDirect(site) && <p className="text-xs [overflow-wrap:anywhere]">{t("hubHandoff.site")}: {authoringUrl(site)}</p>}
        {site && canSendDirect(site) && <p className="text-xs">{t("hubHandoff.directHelp")}</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !preview && <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>{t("hubHandoff.retry")}</Button>}
      {transferPath && <p role="status" className="text-sm">{t(`hubHandoff.path.${transferPath}`)}</p>}
      {draftUrl && <a href={draftUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{t("hubHandoff.openDraft")}</a>}
      {hubDraft && <Button variant="outline" onClick={openHubDraft}>{t("hubHandoff.openHubDraft")}</Button>}
      {downloaded && site && <div className="space-y-1 text-sm" role="status">
        <p>{t("hubHandoff.attach")}</p>
        <a href={authoringUrl(site)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("hubHandoff.startDraft")}</a>
      </div>}
      <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap justify-end gap-2 border-t bg-background px-6 py-3">
        <Button variant="outline" disabled={busy} onClick={onClose}>{t("hubHandoff.close")}</Button>
        {site && canSendDirect(site) && <Button variant="outline" disabled={loading || busy || isStreaming || !preview || size > 20 * 1024 * 1024} onClick={() => void download(true)}>{t("hubHandoff.sendDirect")}</Button>}
        <Button variant="outline" disabled={loading || busy || isStreaming || !preview || size > 20 * 1024 * 1024} onClick={() => void download()}>{t("hubHandoff.download")}</Button>
        <Button disabled={loading || busy || isStreaming || !preview || size > 20 * 1024 * 1024 || !!hubDraft} onClick={() => void sendHub()}>{t(busy ? "hubHandoff.sendingHub" : "hubHandoff.sendHub")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function ExtraRow({ checked, disabled, onChange, title, detail }: { checked: boolean; disabled: boolean; onChange: (on: boolean) => void; title: string; detail: string }) {
  return <label className="flex min-w-0 items-start gap-2">
    <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    <span className="min-w-0 [overflow-wrap:anywhere]">{title}<span className="block text-xs text-muted-foreground">{detail}</span></span>
  </label>;
}

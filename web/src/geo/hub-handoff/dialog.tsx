"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/projects";
import { t } from "@/geo/i18n";
import { authoringUrl, checked, downloadHandoff, previewHandoff, saveDownload, type HandoffPreview, type HubSite } from "./client";

export function HandoffDialog({ projectId, sessionId, isStreaming, onClose }: { projectId: string; sessionId: string; isStreaming: boolean; onClose: () => void }) {
  const [preview, setPreview] = useState<HandoffPreview | null>(null);
  const [sites, setSites] = useState<HubSite[]>([]);
  const [siteId, setSiteId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
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
      setSites(hub.sites); setSiteId(hub.sites[0]?.id ?? ""); setDownloaded(false);
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : t("hubHandoff.errors.request")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, sessionId, attempt]);
  const size = preview?.files.filter(f => selected.includes(f.path)).reduce((sum, f) => sum + f.size, 0) ?? 0;
  const download = async () => {
    if (busy || loading || isStreaming || !preview) return;
    setBusy(true); setError(""); setDownloaded(false);
    try {
      const result = await downloadHandoff(projectId, sessionId, selected, note);
      if (!live.current) return;
      saveDownload(result.blob, result.filename); setDownloaded(true);
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
      {preview && !loading && <div className="min-w-0 space-y-3 text-sm">
        <section><h3 className="font-medium">{t("hubHandoff.request")}</h3><p className="max-h-32 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.request || t("hubHandoff.emptyText")}</p></section>
        <section><h3 className="font-medium">{t("hubHandoff.finalAnswer")}</h3><p className="max-h-40 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.finalAnswer || t("hubHandoff.emptyText")}</p></section>
        <p>{t("hubHandoff.model", { model: preview.modelRef ?? t("hubHandoff.unknownModel") })}</p>
        {Object.values(preview.truncated).some(Boolean) && <p>{t("hubHandoff.truncated")}</p>}
        <fieldset disabled={busy || isStreaming} className="min-w-0 space-y-2">
          <legend className="font-medium">{t("hubHandoff.files")}</legend>
          {!preview.files.length && <p>{t("hubHandoff.emptyFiles")}</p>}
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {preview.files.map(file => <label key={file.path} className="flex min-w-0 items-start gap-2">
              <input type="checkbox" className="mt-1" checked={selected.includes(file.path)} onChange={e => { setSelected(old => e.target.checked ? [...old, file.path] : old.filter(p => p !== file.path)); setDownloaded(false); }} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{file.path}<span className="block text-xs text-muted-foreground">{t(`hubHandoff.role.${file.role}`)} · {file.size.toLocaleString()} B</span></span>
            </label>)}
          </div>
        </fieldset>
        {!!excluded && <p>{t("hubHandoff.excluded", { count: excluded })}</p>}
        <p>{t("hubHandoff.selection", { count: selected.length, size: (size / 1024 / 1024).toFixed(2) })}</p>
        <p className="text-xs text-muted-foreground">{t("hubHandoff.sizeHelp")}</p>
        <label className="block space-y-1"><span>{t("hubHandoff.note")}</span><textarea className="w-full rounded-md border bg-background p-2" rows={3} maxLength={4000} disabled={busy || isStreaming} value={note} onChange={e => { setNote(e.target.value); setDownloaded(false); }} /></label>
        {sites.length > 1 && <label className="block space-y-1"><span>{t("hubHandoff.site")}</span><select className="w-full rounded-md border bg-background p-2" value={siteId} onChange={e => setSiteId(e.target.value)}>{sites.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}</select></label>}
        {site ? <p className="text-xs [overflow-wrap:anywhere]">{t("hubHandoff.site")}: {authoringUrl(site)}</p> : <p>{t("hubHandoff.noSite")}</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !preview && <Button variant="outline" onClick={() => setAttempt(n => n + 1)}>{t("hubHandoff.retry")}</Button>}
      {downloaded && site && <div className="space-y-1 text-sm" role="status">
        <p>{t("hubHandoff.attach")}</p>
        <a href={authoringUrl(site)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t("hubHandoff.startDraft")}</a>
      </div>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={onClose}>{t("hubHandoff.close")}</Button>
        <Button disabled={loading || busy || isStreaming || !preview || size > 20 * 1024 * 1024} onClick={() => void download()}>{t(busy ? "hubHandoff.downloading" : "hubHandoff.download")}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}

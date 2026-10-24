"use client";

/**
 * Research-note exports (gaid-note-bundle-export; contract @/geo/contracts/note-export): the result bundle for
 * reviewers and the public material export for manual upload to Gemini Notebook. Each opens from the note's 더 보기 menu
 * as a 640 px sheet (UI guide D2): preview first, one filled action, completion confirmed in the sheet (F7). The public
 * export asks for a per-file confirmation that the file may leave the institute (D1: consent before data leaves the PC).
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { geoLocale, t } from "@/geo/i18n";
import { TechnicalDetail } from "@/geo/hub/technical";
import {
  NOTE_BUNDLE_PART_ORDER,
  type NoteBundlePart, type NoteBundlePreview, type PublicExportCandidate, type PublicExportPreview,
} from "@/geo/contracts/note-export";

const L = (key: string, values?: Record<string, string | number>) => t(`noteExport.${key}`, values);
/** Data rows shown in the sheet; the rest are in the bundle's list. */
const DATA_ROWS = 8;

export function formatSize(bytes: number, locale = geoLocale()): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(locale === "en" ? "en-US" : "ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}

class ExportFailure extends Error {
  constructor(readonly kind: "load" | "changed" | "tooLarge" | "download" | "integrity", readonly detail: string) { super(detail); }
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST, check the server's fingerprint against the received bytes, then save. Nothing is saved on a mismatch. */
async function downloadZip(url: string, body: unknown, projectId: string, fallbackName: string): Promise<void> {
  const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }, projectId);
  if (!res.ok) {
    const detail = `${res.status} ${await res.text().catch(() => "")}`.trim();
    throw new ExportFailure(res.status === 409 ? "changed" : res.status === 413 ? "tooLarge" : "download", detail);
  }
  const expected = res.headers.get("X-Content-SHA256");
  const blob = await res.blob();
  if (!expected || !globalThis.crypto?.subtle || (await sha256Hex(blob)) !== expected) throw new ExportFailure("integrity", `expected ${expected ?? "none"}`);
  const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href; a.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(href);
}

function usePreview<T>(url: string | null, projectId: string) {
  const [preview, setPreview] = useState<T | null>(null);
  const [failure, setFailure] = useState<ExportFailure | null>(null);
  const load = useCallback(async () => {
    if (!url) return;
    setPreview(null); setFailure(null);
    try {
      const res = await apiFetch(url, { cache: "no-store" }, projectId);
      if (!res.ok) throw new ExportFailure(res.status === 413 ? "tooLarge" : "load", `${res.status} ${await res.text().catch(() => "")}`.trim());
      setPreview((await res.json()) as T);
    } catch (err) {
      setFailure(err instanceof ExportFailure ? err : new ExportFailure("load", String(err)));
    }
  }, [url, projectId]);
  useEffect(() => { void load(); }, [load]);
  return { preview, failure, reload: load };
}

function Failure({ failure, scope, onRetry }: { failure: ExportFailure; scope: "bundle" | "public"; onRetry?: () => void }) {
  const key = scope === "public" && failure.kind === "tooLarge" ? "download" : failure.kind;
  return (
    <div role="alert" className="space-y-2 rounded-md border border-[var(--gaid-danger)]/40 bg-[var(--gaid-danger-tint)] p-3 text-sm">
      <p>{L(`${scope}.error.${key}`)}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{L("bundle.error.retry.button")}</Button>}
      <TechnicalDetail detail={failure.detail} />
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-md bg-muted/60" />)}
    </div>
  );
}

function Done({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-start gap-2 text-sm text-[var(--gaid-success)]">
      <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden />{text}
    </p>
  );
}

// --- Result bundle ------------------------------------------------------------------------------------------------

export function NoteBundleDialog({ projectId, noteId, open, onOpenChange }: { projectId: string; noteId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const locale = geoLocale();
  const { preview, failure, reload } = usePreview<NoteBundlePreview>(open ? `/geo/notes/${encodeURIComponent(noteId)}/bundle?locale=${locale}` : null, projectId);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [downloadFailure, setDownloadFailure] = useState<ExportFailure | null>(null);
  useEffect(() => { if (open) { setDone(false); setDownloadFailure(null); } }, [open]);

  const download = async () => {
    if (!preview) return;
    setBusy(true); setDownloadFailure(null); setDone(false);
    try {
      await downloadZip(`/geo/notes/${encodeURIComponent(noteId)}/bundle`, { digest: preview.digest, locale }, projectId, `${noteId}-bundle.zip`);
      setDone(true);
    } catch (err) {
      setDownloadFailure(err instanceof ExportFailure ? err : new ExportFailure("download", String(err)));
    } finally { setBusy(false); }
  };

  const parts = preview ? NOTE_BUNDLE_PART_ORDER.map((part) => {
    const files = preview.files.filter((f) => f.part === part);
    return { part, count: files.length, bytes: files.reduce((s, f) => s + f.bytes, 0) };
  }).filter((p) => p.count) : [];
  const workflowLine = preview?.workflow
    ? L(preview.workflow.version ? "bundle.workflow.version" : "bundle.workflow.draft", { title: preview.workflow.title ?? preview.workflow.methodId, version: preview.workflow.version ?? "" })
    : L("bundle.workflow.none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{L("bundle.title")}</DialogTitle>
          <DialogDescription>{L("bundle.intro")}</DialogDescription>
        </DialogHeader>
        {failure ? <Failure failure={failure} scope="bundle" onRetry={() => void reload()} />
          : !preview ? <Skeleton label={L("bundle.loading")} />
          : (
            <div className="space-y-4 text-sm">
              <p className="tabular-nums text-muted-foreground">{L("bundle.summary", { count: preview.files.length, size: formatSize(preview.totalBytes, locale) })}</p>
              <ul className="divide-y rounded-md border">
                {parts.map(({ part, count, bytes }) => (
                  <li key={part} className="flex min-h-10 items-center justify-between gap-3 px-3 py-2">
                    <span>{L(`bundle.part.${part as NoteBundlePart}`)}</span>
                    <span className="tabular-nums text-muted-foreground">{L("bundle.files", { count })} · {formatSize(bytes, locale)}</span>
                  </li>
                ))}
              </ul>
              <section aria-labelledby="note-bundle-data" className="space-y-1.5">
                <h3 id="note-bundle-data" className="font-medium">{L("bundle.data.heading", { count: preview.data.length })}</h3>
                {preview.data.length === 0 ? <p className="text-muted-foreground">{L("bundle.data.none")}</p> : (
                  <ul className="space-y-1">
                    {preview.data.slice(0, DATA_ROWS).map((row) => (
                      <li key={row.path} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-mono text-xs" title={row.path}>{row.path}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {L(`bundle.data.use.${row.use}`)} · <span className={row.now === "changed" || row.now === "missing" ? "text-[var(--gaid-warning)]" : undefined}>{L(`bundle.data.now.${row.now}`)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {preview.data.length > DATA_ROWS && <p className="text-xs text-muted-foreground">{L("bundle.data.more", { count: preview.data.length - DATA_ROWS })}</p>}
              </section>
              <ul className="space-y-1 text-muted-foreground">
                <li>{workflowLine}</li>
                <li>{L("bundle.environment", { count: preview.environments })}</li>
                <li>{L("bundle.references", { count: preview.references.length })}</li>
              </ul>
              {preview.gaps.length > 0 && (
                <section aria-labelledby="note-bundle-gaps" className="space-y-1.5">
                  <h3 id="note-bundle-gaps" className="flex items-center gap-1.5 font-medium">
                    <AlertTriangleIcon className="size-4 text-[var(--gaid-warning)]" aria-hidden />{L("bundle.gaps.heading")}
                  </h3>
                  <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {preview.gaps.map((gap) => <li key={gap}>{L(`gap.${gap}`)}</li>)}
                  </ul>
                </section>
              )}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">{L("bundle.showFiles")}</summary>
                <ul className="mt-2 space-y-0.5 font-mono">
                  {preview.files.map((f) => <li key={f.name} className="flex justify-between gap-3"><span className="truncate">{f.name}</span><span className="shrink-0 tabular-nums">{formatSize(f.bytes, locale)}</span></li>)}
                </ul>
              </details>
              <p className="text-xs text-muted-foreground">{L("bundle.boundary")}</p>
              {done && <Done text={L("bundle.download.done")} />}
              {downloadFailure && <Failure failure={downloadFailure} scope="bundle" onRetry={downloadFailure.kind === "changed" ? () => void reload() : undefined} />}
            </div>
          )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L("bundle.close.button")}</Button>
          <Button disabled={!preview || busy} onClick={() => void download()}>{busy ? L("bundle.download.busy") : L("bundle.download.button")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Public material export ----------------------------------------------------------------------------------------

function candidateDetail(c: PublicExportCandidate): string {
  if (c.kind === "note") return L("public.noteDetail");
  if (c.kind === "workflow") return L("public.workflowDetail");
  return c.licence ? L("public.licence", { licence: c.licence }) : L("public.licenceUnknown");
}

export function PublicExportDialog({ projectId, noteId, open, onOpenChange }: { projectId: string; noteId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const locale = geoLocale();
  const { preview, failure, reload } = usePreview<PublicExportPreview>(open ? `/geo/notes/${encodeURIComponent(noteId)}/public-export?locale=${locale}` : null, projectId);
  // Nothing is pre-confirmed: the researcher ticks each file that may leave the institute.
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [downloadFailure, setDownloadFailure] = useState<ExportFailure | null>(null);
  useEffect(() => { if (open) { setConfirmed(new Set()); setDone(false); setDownloadFailure(null); } }, [open]);
  useEffect(() => { setConfirmed(new Set()); }, [preview]);

  const chosen = preview?.candidates.filter((c) => confirmed.has(c.id)) ?? [];
  const chosenBytes = chosen.reduce((s, c) => s + c.bytes, 0);
  const toggle = (id: string, on: boolean) => setConfirmed((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

  const download = async () => {
    if (!preview || !chosen.length) return;
    setBusy(true); setDownloadFailure(null); setDone(false);
    try {
      await downloadZip(`/geo/notes/${encodeURIComponent(noteId)}/public-export`, { digest: preview.digest, locale, files: chosen.map((c) => ({ id: c.id, mayLeave: true })) }, projectId, `${noteId}-public.zip`);
      setDone(true);
    } catch (err) {
      setDownloadFailure(err instanceof ExportFailure ? err : new ExportFailure("download", String(err)));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{L("public.title")}</DialogTitle>
          <DialogDescription>{L("public.intro")}</DialogDescription>
        </DialogHeader>
        {failure ? <Failure failure={failure} scope="public" onRetry={() => void reload()} />
          : !preview ? <Skeleton label={L("public.loading")} />
          : (
            <div className="space-y-4 text-sm">
              <p className="font-medium">{L("public.confirmEach")}</p>
              <ul className="space-y-2">
                {preview.candidates.map((c) => {
                  const inputId = `public-export-${c.id}`;
                  return (
                    <li key={c.id} className="rounded-md border px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          <span className="text-xs text-muted-foreground">{L(`public.kind.${c.kind}`)}</span>
                          <span className="block truncate" title={c.title}>{c.title}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatSize(c.bytes, locale)}</span>
                      </div>
                      <p className={c.kind === "paper" && !c.licence ? "mt-1 text-xs text-[var(--gaid-warning)]" : "mt-1 text-xs text-muted-foreground"}>{candidateDetail(c)}</p>
                      <label htmlFor={inputId} className="mt-2 flex cursor-pointer items-center gap-2">
                        <input id={inputId} type="checkbox" className="size-4 accent-primary" checked={confirmed.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                        <span>{L("public.mayLeave")}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {preview.skipped.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none">{L("public.skipped.summary", { count: preview.skipped.length })}</summary>
                  <ul className="mt-2 space-y-0.5">
                    {preview.skipped.map((s) => <li key={s.key}>{s.title ?? <span className="font-mono">{s.key}</span>} · {L(`public.skipped.${s.reason}`)}</li>)}
                  </ul>
                </details>
              )}
              <p className="text-xs text-muted-foreground">{L("public.record")}</p>
              <p className="tabular-nums text-muted-foreground" aria-live="polite">{chosen.length ? L("public.selected", { count: chosen.length, size: formatSize(chosenBytes, locale) }) : L("public.none")}</p>
              {done && <Done text={L("public.export.done")} />}
              {downloadFailure && <Failure failure={downloadFailure} scope="public" onRetry={downloadFailure.kind === "changed" ? () => void reload() : undefined} />}
            </div>
          )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L("public.close.button")}</Button>
          <Button disabled={!chosen.length || busy} onClick={() => void download()}>{busy ? L("public.export.busy") : L("public.export.button")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

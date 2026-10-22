"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { folderPath } from "@/geo/library/folder-tree";
import { geoText } from "@/geo/i18n";
import type { LibraryCollection } from "@/geo/contracts/library";
import { ORCID_LIMITS, type OrcidConfirmResult, type OrcidWorksPreview } from "@/geo/contracts/orcid";
import { confirmOrcidWorks, orcidProblem, previewOrcidWorks } from "./api";
import { OrcidId } from "./id-display";
import { alreadyOwn, defaultSelection, selectNew } from "./selection";

const text = geoText("orcid");

export function OrcidImportDialog({ open, onOpenChange, collections, onImported }: {
  open: boolean; onOpenChange: (open: boolean) => void; collections: LibraryCollection[]; onImported: () => void;
}) {
  const [preview, setPreview] = useState<OrcidWorksPreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [folder, setFolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const [result, setResult] = useState<OrcidConfirmResult | null>(null);
  const [reload, setReload] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const imported = useRef(onImported);
  useEffect(() => { imported.current = onImported; }, [onImported]);

  useEffect(() => {
    let live = true;
    setPreview(null); setProblem(null); setResult(null); setLoading(true); setFolder("");
    previewOrcidWorks().then((p) => {
      if (live) { setPreview(p); setSelected(defaultSelection(p.works)); }
    }).catch((e: unknown) => { if (live) setProblem(e); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Mounted on the first explicit import action; retain choices and in-flight results when closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const confirm = async () => {
    if (!selected.length || saving) return;
    setSaving(true); setProblem(null);
    try {
      setResult(await confirmOrcidWorks({ putCodes: selected, collectionId: folder || undefined }));
      imported.current();
    } catch (e) { setProblem(e); }
    finally { setSaving(false); }
  };
  const folders = collections.filter((c) => c.source === "gaid");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[720px]" onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={() => { trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(e) => { e.preventDefault(); trigger.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{text("import.title")}</DialogTitle>
          <DialogDescription>{saving ? text("import.saving") : text("import.hint")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto" aria-busy={loading || saving}>
          {loading && <div className="space-y-3 py-4" role="status"><p className="text-sm text-gaid-ink-2">{text("import.loading")}</p>{[1, 2, 3].map((n) => <div key={n} className="h-16 rounded-md bg-gaid-face-2" />)}</div>}
          {preview && !result && <div className="flex flex-col gap-3">
            <OrcidId id={preview.orcid} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm tabular-nums">{text("import.selected", { n: selected.length, total: preview.works.length })}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={saving} onClick={() => setSelected(selectNew(preview.works))}>{text("import.selectNew.button")}</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => setSelected([])}>{text("import.clear.button")}</Button>
              </div>
            </div>
            {preview.works.length > ORCID_LIMITS.confirm && <p className="text-xs text-gaid-ink-2">{text("import.batch", { n: ORCID_LIMITS.confirm })}</p>}
            {preview.omitted > 0 && <p className="text-sm text-gaid-warning">{text("import.omitted", { n: preview.omitted })}</p>}
            {preview.works.length === 0 && <p className="py-6 text-sm text-gaid-ink-2">{text("import.empty")}</p>}
            <ul className="divide-y divide-gaid-edge">
              {preview.works.map((work) => {
                const own = alreadyOwn(work);
                const checked = selected.includes(work.putCode);
                return <li key={work.putCode} className="py-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={checked} disabled={saving || own || (!checked && selected.length >= ORCID_LIMITS.confirm)}
                      onChange={() => setSelected((prev) => checked ? prev.filter((n) => n !== work.putCode) : prev.length < ORCID_LIMITS.confirm ? [...prev, work.putCode] : prev)}
                      className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{work.title}</span>
                      <span className="mt-1 block text-xs text-gaid-ink-2">{[work.year, work.container].filter(Boolean).join(" · ")}</span>
                      <span className="mt-1 block text-xs text-gaid-ink-2">{text(`match.${own ? "own" : work.match.kind}`)}</span>
                    </span>
                  </label>
                  {work.match.kind === "similar" && <p className="mt-1 pl-8 text-xs text-gaid-warning">{text("import.similar", { title: work.match.title })}</p>}
                  <details className="mt-1 pl-8 text-xs text-gaid-ink-2">
                    <summary className="cursor-pointer">{text("import.sourceDetails")}</summary>
                    {work.doi && <a className="mt-1 block break-all underline" href={`https://doi.org/${encodeURIComponent(work.doi)}`} target="_blank" rel="noreferrer">{text("import.doi", { doi: work.doi })}</a>}
                    <p className="mt-1">{text("import.sources", { names: work.sources.join(", ") || text("import.noSource") })}</p>
                  </details>
                </li>;
              })}
            </ul>
          </div>}
          {result && <div role="status" className="space-y-3 py-4">
            <h3 className="font-semibold">{text("result.title")}</h3>
            <p className="text-sm tabular-nums">{text("result.summary", { added: result.added, marked: result.marked, failed: result.failed })}</p>
            {result.lookupFailed > 0 && <p className="text-sm text-gaid-ink-2">{text("result.fallback", { n: result.lookupFailed })}</p>}
            {result.failed > 0 && <p className="text-sm text-gaid-warning">{text("result.failed")}</p>}
          </div>}
          {problem != null && <div className="space-y-2 py-2">
            <p role="alert" className="text-sm text-gaid-warning">{text(`error.${orcidProblem(problem)}`)}</p>
            <TechnicalDetail detail={problem instanceof Error ? problem.message : undefined} />
            {!preview && <Button variant="outline" onClick={() => setReload((n) => n + 1)}>{text("retry.button")}</Button>}
          </div>}
        </div>
        {preview && !result && folders.length > 0 && <label className="flex flex-wrap items-center gap-2 border-t border-gaid-edge pt-3 text-sm">
          {text("import.folder")}
          <select className="h-9 min-w-0 flex-1 rounded-md border border-gaid-control-edge bg-gaid-face px-2 text-sm" disabled={saving} value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">{text("import.noFolder")}</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{folderPath(collections, f.id)}</option>)}
          </select>
        </label>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{text(saving ? "import.background.button" : "close.button")}</Button>
          {result ? <Button onClick={() => setReload((n) => n + 1)}>{text("import.reread.button")}</Button>
            : <Button disabled={!preview || !selected.length || saving || loading} onClick={() => void confirm()}>{text(saving ? "import.saving.button" : "import.confirm.button", { n: selected.length })}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

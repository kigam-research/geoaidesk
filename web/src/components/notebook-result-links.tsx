"use client";
import { geoText } from "@/geo/i18n";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScientificResultCard } from "./scientific-result-card";
import { apiFetch } from "@/lib/projects";
import { parseScientificResult } from "@/lib/scientific-results";
import type { NotebookEntry } from "@/lib/notebook";
import type { NotebookResolvedResult } from "@/lib/notebook-result-links";

const nbText = geoText("notebook");

export function NotebookResultLinks({ entry, sessionId, projectId, onOpenFile }: {
  entry: NotebookEntry; sessionId: string; projectId: string; onOpenFile: (path: string) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<NotebookResolvedResult | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (selected === null) return;
    const controller = new AbortController();
    setResult(null); setError("");
    const timer = setTimeout(() => controller.abort(), 15_000);
    let disposed = false;
    void (async () => {
      try {
        const res = await apiFetch(`/sessions/${encodeURIComponent(sessionId)}/notebook/${encodeURIComponent(entry.id)}/results/${selected}`, { signal: controller.signal, cache: "no-store" }, projectId);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? nbText("links.lookup_failed"));
        const card = data.card ? parseScientificResult(data.card) : null;
        if (data.card && !card) throw new Error(nbText("links.invalid"));
        if (!disposed) setResult({ ...data, card: card ?? undefined });
      } catch (e) { if (!disposed) setError(controller.signal.aborted ? nbText("links.timeout") : (e as Error).message); }
      finally { clearTimeout(timer); }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [entry.id, sessionId, projectId, selected, retry]);
  if (!entry.results?.length) return null;
  return <div className="space-y-1 text-xs">
    <p className="font-medium">{nbText("links.results")}</p>
    {entry.results.map((ref, index) => <div key={`${ref.sessionId}:${ref.toolCallId}:${index}`} className="flex min-w-0 flex-wrap items-center gap-1">
      <Button type="button" variant="outline" size="xs" disabled={entry.provisional} onClick={() => setSelected(index)}>{nbText("links.view", { index: index + 1 })}</Button>
    </div>)}
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="min-w-0 max-h-[85vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{nbText("links.result_title")}</DialogTitle><DialogDescription>{nbText("links.description")}</DialogDescription></DialogHeader>
        {error && <div role="alert" className="text-sm text-destructive">{nbText("links.lookup_failed")} <Button variant="outline" size="xs" onClick={() => setRetry((n) => n + 1)}>{nbText("common.retry")}</Button>
          <details className="mt-2 text-xs"><summary className="cursor-pointer">{nbText("links.source.technical")}</summary>
            <button type="button" className="my-1 underline" onClick={() => void navigator.clipboard.writeText(error)}>{nbText("common.copy.button")}</button>
            <p className="whitespace-pre-wrap">{error}</p>
          </details>
        </div>}
        {!error && !result && <p role="status">{nbText("links.loading")}</p>}
        {result && <>
          <details className="rounded border p-2 text-xs"><summary className="cursor-pointer">{nbText("links.source.technical")}</summary>
          <button type="button" className="my-1 underline" onClick={() => void navigator.clipboard.writeText(JSON.stringify({ reference: result.reference, reason: result.reason }, null, 2))}>{nbText("common.copy.button")}</button>
          <p className="break-all text-muted-foreground">{result.reference.childLocal ? nbText("links.child_reference", { id: result.reference.toolCallId }) : nbText(result.reference.sha256 ? "links.pinned_reference" : "links.unpinned_reference", { session: result.reference.sessionId, id: result.reference.toolCallId, hash: result.reference.sha256 ?? "" })}</p>
          {result.reason && <p>{result.reason}</p>}</details>
          <p className={result.status === "available" ? "text-xs" : "rounded border border-amber-500/40 p-2 text-xs"}>{nbText(`result_status.${result.status}`)}</p>
          {result.card && <ScientificResultCard projectId={projectId} onOpenFile={onOpenFile} item={{ id: `notebook-result-${result.reference.toolCallId}`, label: nbText("links.recorded"), toolName: "scientific_result", status: "complete", timestamp: entry.timestamp, scientificResult: result.card }} />}
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}

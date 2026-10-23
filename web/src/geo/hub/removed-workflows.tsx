"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { HubEntry } from "@/geo/contracts/hub-shared";
import { hubVersionOf } from "@/geo/contracts/hub-version";
import { geoLocale, geoText } from "@/geo/i18n";
import { sharedHub } from "./shared-api";
import { TechnicalDetail } from "./technical";
import { PageBody, PageHeader } from "@/geo/shell/page-header";

const text = geoText("hub");

export function RemoveWorkflowDialog({ open, onOpenChange, entry, local, onRemoved }: {
  open: boolean; onOpenChange: (open: boolean) => void; entry: HubEntry; local: boolean; onRemoved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setReason(""); }, [entry.id]);
  useEffect(() => { if (open) setError(null); }, [open]);
  return <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{text("remove.title")}</DialogTitle>
        <DialogDescription>{text("remove.body", { title: entry.title })}</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">{text(local ? "remove.restoreLocal" : "remove.restoreAdmin")}</p>
      <label className="flex flex-col gap-2 text-sm font-medium">{text("remove.reason")}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} disabled={busy} />
      </label>
      {error && <div role="alert" className="space-y-2 text-sm"><p>{text("remove.failed")}</p><TechnicalDetail detail={error} /></div>}
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{text("remove.cancel")}</Button>
        <Button variant="destructive" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await sharedHub.remove(entry.id, reason.trim() || undefined); onOpenChange(false); onRemoved(); }
          catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        }}>{text(busy ? "remove.busy" : "remove.action")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function RemovedWorkflows({ entries, onRestored, loading = false, error: loadError = null }: {
  loading?: boolean; error?: string | null; entries: HubEntry[]; onRestored: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; detail: string } | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  // Same page header as every hub list page (PageHeader); the sidebar already leads back to the lists.
  return <PageBody className="gap-5">
      <PageHeader title={text("removed.title")} context={text("removed.body")} />
      {restored && <p role="status" className="text-sm">{text("removed.restored", { title: restored })}</p>}
      {loading && <p role="status" className="text-sm">{text("home.loading")}</p>}
      {loadError && <div role="alert" className="space-y-2 text-sm"><p>{text("home.browse.error")}</p><TechnicalDetail detail={loadError} /><Button variant="outline" onClick={() => void onRestored()}>{text("home.browse.retry.button")}</Button></div>}
      {!loading && !loadError && !entries.length && <p className="text-sm text-muted-foreground">{text("removed.empty")}</p>}
      <ul className="divide-y divide-gaid-edge">
        {entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <h2 className="font-medium break-words">{entry.title}</h2>
            <p className="text-muted-foreground tabular-nums">{text("removed.meta", { version: hubVersionOf(entry) ?? "", author: entry.author })}</p>
            {entry.removed && <>
              <p className="text-muted-foreground">{text("removed.by", { author: entry.removed.by, when: new Date(entry.removed.at).toLocaleString(geoLocale() === "ko" ? "ko-KR" : "en-US") })}</p>
              {entry.removed.reason && <p className="whitespace-pre-wrap break-words">{text("removed.reason", { reason: entry.removed.reason })}</p>}
            </>}
            {error?.id === entry.id && <div role="alert"><p>{text("removed.failed")}</p><TechnicalDetail detail={error.detail} /></div>}
          </div>
          <Button variant="outline" disabled={busy !== null} onClick={async () => {
            setBusy(entry.id); setError(null);
            try { await sharedHub.restore(entry.id); await onRestored(); setRestored(entry.title); }
            catch (e) { setError({ id: entry.id, detail: (e as Error).message }); }
            finally { setBusy(null); }
          }}>{text(busy === entry.id ? "removed.busy" : "removed.restore")}</Button>
        </li>)}
      </ul>
  </PageBody>;
}

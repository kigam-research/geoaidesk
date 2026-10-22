"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LibrarySyncStatus } from "@/geo/contracts/hub-server";
import { HUB_CONNECTION_CHANGED, hubServer } from "@/geo/hub-server/api";
import { dateLabel, ErrorNotice, text } from "@/geo/hub-server/parts";

/** Personal account sync is separate from the library's Zotero connection. */
export function LibrarySyncLine({ onSynced, refreshKey }: { onSynced?: () => void; refreshKey?: unknown }) {
  const [status, setStatus] = useState<LibrarySyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    try { setStatus(await hubServer.syncStatus()); } catch { /* No sync service on an older GAID: keep the local library usable. */ }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(HUB_CONNECTION_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener(HUB_CONNECTION_CHANGED, refresh); window.removeEventListener("focus", refresh); };
  }, [load]);
  useEffect(() => {
    if (!status?.running) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [status?.running, load]);
  if (!status?.available) return null;
  const pending = status.pending.items + status.pending.folders + status.pending.files;
  return <div className="flex flex-col gap-2 border-b border-gaid-edge pb-3 text-[13px] text-gaid-ink-2" aria-label={text("sync.title")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="tabular-nums">{text(status.lastSyncedAt ? "sync.summary" : "sync.never", { when: status.lastSyncedAt ? dateLabel(status.lastSyncedAt) : "", pending, conflicts: status.conflicts })}</p>
      <Button type="button" size="sm" variant="outline" disabled={busy || status.running} onClick={async () => {
        setBusy(true); setError(null);
        try { const result = await hubServer.sync(); setStatus(result.status); onSynced?.(); }
        catch (e) { setError(e); await load(); }
        finally { setBusy(false); }
      }}>{text(busy || status.running ? "sync.running" : "sync.now.button")}</Button>
    </div>
    <ErrorNotice error={error || status.lastError} fallback="sync.failed" />
  </div>;
}

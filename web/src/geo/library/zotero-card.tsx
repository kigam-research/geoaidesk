"use client";

/** Zotero connection card in the library status column (ADR decision 3: smooth, read-mostly mirror). */
import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TechnicalDetail } from "@/geo/hub/technical";
import { t } from "@/geo/i18n";
import type { ZoteroLibraryState, ZoteroState } from "@/geo/contracts/library";
import { connectLocalZotero, connectWebZotero, syncZotero, zoteroDetail, zoteroState } from "./api";
import { WEB_KEY_STATES, zoteroStatus, type ZoteroStatus } from "./zotero-status";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);

interface Problem { state: ZoteroState; detail?: string }

/** The connection line; the library header shows the same `zoteroStatus` in short form. */
function statusLine(status: Exclude<ZoteroStatus, { kind: "none" }>): string {
  const connection = status.connection;
  if (status.kind === "synced") return L("zotero.ok", { connection, when: new Date(status.at).toLocaleTimeString() });
  if (status.kind === "not-synced") return L("zotero.notSynced", { connection });
  return status.lastSyncAt ? L("zotero.failedSince", { connection, when: new Date(status.lastSyncAt).toLocaleTimeString() }) : L("zotero.failed", { connection });
}

export function ZoteroCard({ libraries, onChanged }: { libraries: ZoteroLibraryState[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState("");
  const run = async (work: () => Promise<Problem | undefined>) => {
    setBusy(true);
    setProblem(null);
    try {
      const failed = await work();
      if (failed && failed.state !== "ok") setProblem(failed);
      onChanged();
    } catch (error) {
      setProblem({ state: zoteroState(error) ?? "failed", detail: zoteroDetail(error) });
    } finally {
      setBusy(false);
    }
  };
  const status = zoteroStatus(libraries);
  // A failed action of this card first, else the failure recorded with the library by the last refresh.
  const shown: Problem | null = problem ?? (status.kind === "failed" ? { state: status.state, detail: status.detail } : null);
  const usesWebKey = status.kind === "none" ? showKey : status.connection === "web";
  const keyForm = (status.kind === "none" && showKey) || (usesWebKey && shown !== null && WEB_KEY_STATES.includes(shown.state));
  const usesPc = status.kind === "none" || libraries.some((l) => l.connection === "local");
  const saveKey = () => void run(async () => { await connectWebZotero(key.trim()); setKey(""); setShowKey(false); return undefined; });

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="text-base font-semibold">{L("zotero.title")}</h2>
      {status.kind !== "none" ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm" role="status">{busy ? L("zotero.syncing") : statusLine(status)}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => {
            const { libraries: next } = await syncZotero();
            const failed = zoteroStatus(next);
            return failed.kind === "failed" ? { state: failed.state, detail: failed.detail } : undefined;
          })}>
            <RefreshCwIcon data-icon="inline-start" />{L("zotero.sync.button")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{L("zotero.hint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => {
              const state = await connectLocalZotero();
              return state.state === "ok" ? undefined : { state: state.state, detail: state.detail };
            })}>{L("zotero.connectLocal.button")}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setShowKey((v) => !v)}>{L("zotero.connectWeb.button")}</Button>
          </div>
        </>
      )}
      {shown && <p className="text-sm text-gaid-warning" role="alert">{L(`zotero.states.${shown.state}`)}</p>}
      <TechnicalDetail detail={shown?.detail} />
      {keyForm && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="zotero-key">{L(status.kind === "none" ? "zotero.webKey" : "zotero.newKey")}</label>
          <div className="flex gap-2">
            <Input id="zotero-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy && key.trim().length >= 16) saveKey(); }} />
            <Button size="sm" variant="outline" disabled={busy || key.trim().length < 16} onClick={saveKey}>{L("zotero.save.button")}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{L("zotero.webKeyHint")}</p>
        </div>
      )}
      {usesPc && <p className="text-xs text-muted-foreground">{L("zotero.localNote")}</p>}
    </div>
  );
}

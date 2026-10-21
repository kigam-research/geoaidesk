"use client";

/** Zotero connection card in the library status column (ADR decision 3: smooth, read-mostly mirror). */
import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/geo/i18n";
import type { ZoteroLibraryState } from "@/geo/contracts/library";
import { connectLocalZotero, connectWebZotero, syncZotero, zoteroState } from "./api";

const L = (key: string, values?: Record<string, unknown>) => t(`library.${key}`, values as never);

export function ZoteroCard({ libraries, onChanged }: { libraries: ZoteroLibraryState[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ZoteroLibraryState["state"] | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState("");
  const run = async (work: () => Promise<ZoteroLibraryState["state"] | undefined>) => {
    setBusy(true);
    setProblem(null);
    try {
      const state = await work();
      if (state && state !== "ok") setProblem(state);
      onChanged();
    } catch (error) {
      setProblem(zoteroState(error) ?? "unreachable");
    } finally {
      setBusy(false);
    }
  };
  const broken = libraries.find((l) => l.state !== "ok");
  const synced = libraries.map((l) => l.lastSyncAt).filter(Boolean).sort().at(-1);
  const shown = problem ?? broken?.state ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="text-base font-semibold">{L("zotero.title")}</h2>
      {libraries.length > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">{busy ? L("zotero.syncing") : synced ? L("zotero.ok", { when: new Date(synced).toLocaleTimeString() }) : L("zotero.notSynced")}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await syncZotero(); return undefined; })}>
            <RefreshCwIcon data-icon="inline-start" />{L("zotero.sync.button")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{L("zotero.hint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => (await connectLocalZotero()).state)}>{L("zotero.connectLocal.button")}</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setShowKey((v) => !v)}>{L("zotero.connectWeb.button")}</Button>
          </div>
          {showKey && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="zotero-key">{L("zotero.webKey")}</label>
              <div className="flex gap-2">
                <Input id="zotero-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
                <Button size="sm" variant="outline" disabled={busy || key.trim().length < 16} onClick={() => void run(async () => { await connectWebZotero(key.trim()); setKey(""); return undefined; })}>{L("zotero.save.button")}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{L("zotero.webKeyHint")}</p>
            </div>
          )}
        </>
      )}
      {shown && shown !== "ok" && <p className="text-sm text-amber-700 dark:text-amber-300" role="status">{L(`zotero.states.${shown}`)}</p>}
    </div>
  );
}

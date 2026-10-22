"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/components/settings/primitives";
import type { HubServerStatus } from "@/geo/contracts/hub-server";
import { connectionChanged, hubServer } from "./api";
import { AccountSettings } from "./account";
import { AdminSettings } from "./admin";
import { AuthForms } from "./auth-forms";
import { ErrorNotice, Field, text } from "./parts";

export function HubServerCard() {
  const [status, setStatus] = useState<HubServerStatus | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [admin, setAdmin] = useState(false);
  const apply = useCallback((value: HubServerStatus) => { setStatus(value); setUrl(value.url ?? ""); if (value.account?.role !== "admin") setAdmin(false); }, []);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { apply(await hubServer.status()); } catch (e) { setError(e); }
    finally { setBusy(false); }
  }, [apply]);
  useEffect(() => { void load(); }, [load]);
  const run = async (action: () => Promise<HubServerStatus>) => {
    setBusy(true); setError(null); setSaved(false);
    try { apply(await action()); setSaved(true); connectionChanged(); return true; }
    catch (e) { setError(e); return false; }
    finally { setBusy(false); }
  };
  const addressForm = <form onSubmit={event => { event.preventDefault(); void run(() => hubServer.config(url.trim())); }}>
    <fieldset disabled={busy || status?.fromEnv} className="flex flex-col gap-3">
      <Field label="address" type="url" required value={url} onChange={e => setUrl(e.target.value)} />
      {!status?.fromEnv && <Button type="submit" className="self-end" variant={status?.url ? "outline" : "default"}>{text(busy ? "working" : "connect.button")}</Button>}
    </fieldset>
    {status?.fromEnv && <p className="mt-2 text-[13px] text-gaid-ink-2">{text("fromEnv")}</p>}
  </form>;
  return <SettingsCard id="gaid-hub-server" title={text("title")} className="border-gaid-edge bg-gaid-face p-4 text-gaid-ink [&>legend]:text-[17px]">
    <div className="flex flex-col gap-4 text-[15px]">
      <p className="text-[13px] text-gaid-ink-2">{text(status?.url?.startsWith("https:") ? "https" : "http")}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="status" className="text-[13px]">
          <p>{text(!status ? "loading" : !status.url ? "notConfigured" : status.reachable === true ? "reachable" : status.reachable === false ? "unreachable" : "unchecked")}</p>
          {status?.server && <p className="text-gaid-ink-2">{text("serverVersion", { version: status.server.version })}</p>}
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void load()}>{text("refresh.button")}</Button>
      </div>
      <ErrorNotice error={error || status?.error} />
      {status?.url ? <details><summary className="cursor-pointer text-[13px] text-gaid-ink-2">{text("addressSettings")}</summary>
        <div className="mt-3 flex flex-col gap-3">{addressForm}
          {!status.fromEnv && <Button type="button" variant="outline" disabled={busy} className="self-start" onClick={() => void run(() => hubServer.config(null))}>{text("disconnect.button")}</Button>}
        </div>
      </details> : addressForm}
      {status?.url && (status.account ? <>
        <AccountSettings key={status.account.id} account={status.account} busy={busy} run={run} />
        {status.account.role === "admin" && <details open={admin} onToggle={event => setAdmin(event.currentTarget.open)}>
          <summary className="cursor-pointer text-[15px] font-medium">{text("admin.title")}</summary>
          {admin && <AdminSettings onAccountChange={() => { connectionChanged(); void load(); }} />}
        </details>}
      </> : <AuthForms busy={busy} run={run} />)}
      {saved && <p role="status" className="text-[13px] text-gaid-ink-2">{text("saved")}</p>}
    </div>
  </SettingsCard>;
}

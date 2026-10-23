"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { geoLocale, geoText } from "@/geo/i18n";
import { normalizeOrcidId, type OrcidStatus } from "@/geo/contracts/orcid";
import { openSettings } from "@/lib/settings-nav";
import { getOrcid, linkOrcid, orcidProblem, startOrcidAuth, unlinkOrcid, unlinkOrcidAuth } from "./api";
import { OrcidId } from "./id-display";

const text = geoText("orcid");

export function OrcidCard({ status, loadError, onStatus, onChanged, onRetry, onImport }: {
  status: OrcidStatus | null; loadError: boolean; onImport: () => void;
  onStatus: (status: OrcidStatus) => void; onChanged: () => void; onRetry: () => void;
}) {
  const inputId = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [unlinking, setUnlinking] = useState<"local" | "auth" | null>(null);
  const [authProblem, setAuthProblem] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const unlinkButton = useRef<HTMLButtonElement>(null);
  const profile = status?.profile;
  const authenticated = Boolean(profile?.authenticated);
  // Event-driven only: no polling ORCID or the hub while the other tab is open.
  useEffect(() => {
    if (busy) return;
    let live = true;
    let refreshing = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || refreshing) return;
      refreshing = true;
      try {
        const next = await getOrcid();
        if (live) {
          onStatus(next); setProblem(null);
          if (next.hub.state === "linked") { setWaiting(false); setAuthUrl(null); }
        }
      } catch (e) { if (live) { setAuthProblem(true); setProblem(e); } }
      finally { refreshing = false; }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [busy, onStatus]);

  const run = async (work: () => Promise<OrcidStatus>) => {
    setBusy(true); setProblem(null); setAuthProblem(unlinking === "auth");
    try { onStatus(await work()); onChanged(); setUnlinking(null); setInput(""); setWaiting(false); setAuthUrl(null); }
    catch (e) { setProblem(e); }
    finally { setBusy(false); }
  };
  const authenticate = async () => {
    // Open before the await so popup blockers do not discard the user gesture. Detach the opener before navigating.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true); setProblem(null); setAuthProblem(true); setAuthUrl(null);
    try {
      const start = await startOrcidAuth();
      setWaiting(true);
      if (tab && !tab.closed) tab.location.href = start.authorizeUrl;
      else setAuthUrl(start.authorizeUrl);
    } catch (e) { tab?.close(); setProblem(e); setWaiting(false); }
    finally { setBusy(false); }
  };

  return <section aria-label={text("card.title")} className="flex flex-col gap-2 rounded-xl border border-gaid-edge bg-gaid-face p-4">
    <h2 className="text-base font-semibold">{text("card.title")}</h2>
    {loadError ? <><p role="alert" className="text-sm text-gaid-warning">{text("error.status")}</p><Button variant="outline" onClick={onRetry}>{text("retry.button")}</Button></>
      : !status ? <p role="status" className="text-sm text-gaid-ink-2">{text("card.loading")}</p>
      : <>
      {status.hub.state === "ready" && !authenticated && <>
        <p className="text-sm text-gaid-ink-2">{text("auth.hint")}</p>
        {status.hub.environment === "sandbox" && <p className="text-xs text-gaid-ink-2">{text("id.sandbox")}</p>}
        <Button size="sm" variant="outline" className="self-start" disabled={busy} onClick={() => void authenticate()}>{text(busy ? "auth.starting.button" : "auth.start.button")}</Button>
        {waiting && <p role="status" className="text-sm text-gaid-ink-2">{text("auth.waiting")}</p>}
        {authUrl && <a href={authUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">{text("auth.open.button")}</a>}
      </>}
      {status.hub.state === "no-account" && <>
        <p className="text-sm text-gaid-ink-2">{text("auth.noAccount")}</p>
        <Button size="sm" variant="outline" className="self-start" onClick={() => openSettings({ tab: "services", section: "gaid-hub-server" })}>{text("auth.settings.button")}</Button>
      </>}
      {status.hub.state === "not-configured" && <p className="text-sm text-gaid-ink-2">{text("auth.notConfigured")}</p>}
      {status.hub.state === "unreachable" && <>
        <p role="status" className="text-sm text-gaid-warning">{text("auth.unreachable")}</p>
        <Button size="sm" variant="outline" className="self-start" disabled={busy} onClick={onRetry}>{text("retry.button")}</Button>
      </>}
      {profile ? <>
        <OrcidId id={profile.orcid} authenticated={authenticated} environment={profile.environment} />
        {profile.name && <p className="text-sm">{profile.name}</p>}
        <p className="text-sm tabular-nums">{text("card.ownWorks", { n: status.ownWorks })}</p>
        {profile.lastImportAt && <p className="text-xs text-gaid-ink-2">{text("card.lastImport", { when: new Date(profile.lastImportAt).toLocaleDateString(geoLocale()) })}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onImport}>{text("card.import.button")}</Button>
          <Button ref={unlinkButton} size="sm" variant="ghost" disabled={busy || (authenticated && status.hub.state !== "linked")} onClick={() => { setProblem(null); setUnlinking(authenticated ? "auth" : "local"); }}>{text(authenticated ? "auth.unlink.button" : "card.unlink.button")}</Button>
        </div>
      </> : <>
        <p className="text-sm text-gaid-ink-2">{text("card.hint")}</p>
        <form className="flex flex-col gap-2" onSubmit={(e) => {
          e.preventDefault();
          const id = normalizeOrcidId(input);
          setInvalid(!id);
          if (id) void run(() => linkOrcid(id));
        }}>
          <label htmlFor={inputId} className="text-xs font-medium">{text("card.label")}</label>
          <Input id={inputId} value={input} placeholder={text("card.placeholder")} autoComplete="off" disabled={busy}
            aria-invalid={invalid} aria-describedby={invalid ? `${inputId}-error` : undefined}
            onChange={(e) => { setInput(e.target.value); setInvalid(false); setProblem(null); }} />
          {invalid && <p id={`${inputId}-error`} role="alert" className="text-sm text-gaid-warning">{text("error.invalid")}</p>}
          <Button type="submit" variant="outline" size="sm" disabled={busy || !input.trim()} className="self-start">{text(busy ? "card.linking.button" : "card.link.button")}</Button>
        </form>
      </>}
      </>}
    {problem != null && !unlinking && <><p role="alert" className="text-sm text-gaid-warning">{text(authProblem ? "error.auth" : `error.${orcidProblem(problem)}`)}</p><TechnicalDetail detail={problem instanceof Error ? problem.message : undefined} />{authProblem && <Button size="sm" variant="outline" className="self-start" onClick={() => { setProblem(null); onRetry(); }}>{text("retry.button")}</Button>}</>}
    <Dialog open={unlinking !== null} onOpenChange={(open) => { if (!busy && !open) setUnlinking(null); }}>
      <DialogContent className="sm:max-w-[480px]" onCloseAutoFocus={(e) => { e.preventDefault(); unlinkButton.current?.focus(); }}>
        <DialogHeader><DialogTitle>{text(unlinking === "auth" ? "auth.unlink.title" : "unlink.title")}</DialogTitle><DialogDescription>{text(unlinking === "auth" ? "auth.unlink.hint" : "unlink.hint")}</DialogDescription></DialogHeader>
        {problem != null && <p role="alert" className="text-sm text-gaid-warning">{text(authProblem ? "error.auth" : `error.${orcidProblem(problem)}`)}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setUnlinking(null)}>{text("cancel.button")}</Button><Button variant="outline" disabled={busy} onClick={() => void run(unlinking === "auth" ? unlinkOrcidAuth : unlinkOrcid)}>{text(unlinking === "auth" ? "auth.unlink.button" : "card.unlink.button")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

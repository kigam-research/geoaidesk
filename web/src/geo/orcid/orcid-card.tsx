"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechnicalDetail } from "@/geo/hub/technical";
import { geoLocale, geoText } from "@/geo/i18n";
import { normalizeOrcidId, type OrcidStatus } from "@/geo/contracts/orcid";
import { linkOrcid, orcidProblem, unlinkOrcid } from "./api";
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
  const [unlinking, setUnlinking] = useState(false);
  const profile = status?.profile;
  const run = async (work: () => Promise<OrcidStatus>) => {
    setBusy(true); setProblem(null);
    try { onStatus(await work()); onChanged(); setUnlinking(false); setInput(""); }
    catch (e) { setProblem(e); }
    finally { setBusy(false); }
  };

  return <section aria-label={text("card.title")} className="flex flex-col gap-2 rounded-xl border border-gaid-edge bg-gaid-face p-4">
    <h2 className="text-base font-semibold">{text("card.title")}</h2>
    {loadError ? <><p role="alert" className="text-sm text-gaid-warning">{text("error.status")}</p><Button variant="outline" onClick={onRetry}>{text("retry.button")}</Button></>
      : !status ? <p role="status" className="text-sm text-gaid-ink-2">{text("card.loading")}</p>
      : profile ? <>
        <OrcidId id={profile.orcid} />
        {profile.name && <p className="text-sm">{profile.name}</p>}
        <p className="text-sm tabular-nums">{text("card.ownWorks", { n: status.ownWorks })}</p>
        {profile.lastImportAt && <p className="text-xs text-gaid-ink-2">{text("card.lastImport", { when: new Date(profile.lastImportAt).toLocaleDateString(geoLocale()) })}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={onImport}>{text("card.import.button")}</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setProblem(null); setUnlinking(true); }}>{text("card.unlink.button")}</Button>
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
    {problem != null && !unlinking && <><p role="alert" className="text-sm text-gaid-warning">{text(`error.${orcidProblem(problem)}`)}</p><TechnicalDetail detail={problem instanceof Error ? problem.message : undefined} /></>}
    <Dialog open={unlinking} onOpenChange={(open) => { if (!busy) setUnlinking(open); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>{text("unlink.title")}</DialogTitle><DialogDescription>{text("unlink.hint")}</DialogDescription></DialogHeader>
        {problem != null && <p role="alert" className="text-sm text-gaid-warning">{text(`error.${orcidProblem(problem)}`)}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setUnlinking(false)}>{text("cancel.button")}</Button><Button variant="outline" disabled={busy} onClick={() => void run(unlinkOrcid)}>{text("card.unlink.button")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

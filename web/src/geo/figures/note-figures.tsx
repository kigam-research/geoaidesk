"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/projects";
import { rawFileUrl } from "@/lib/use-sandbox";
import { prefillChat, type ChatPrefillOptions } from "@/lib/chat-prefill";
import { t } from "@/geo/i18n";
import { FIGURE_KINDS, kindIsAiMade, type FigureRecord, type FigureListResponse, type FigureTarget, type JournalSummary } from "@/geo/contracts/figures";
import { redrawMessage } from "./redraw-message";
import { checkPreviewUrl } from "./preview-url";

export interface NoteFiguresProps {
  projectId: string;
  noteId: string;
  onOpenFile: (path: string) => void;
  onOpenChat?: (sessionId: string, title: string) => void;
  /** Compose only. The parent can focus the chat before forwarding this to prefillChat. */
  onPrefill?: (text: string, options: ChatPrefillOptions) => unknown;
}

/** Only white-backed figures receive a light mat. This reads pixels; it never changes them (I6). */
function FigureThumbnail({ figure, projectId }: { figure: FigureRecord; projectId: string }) {
  const [white, setWhite] = useState(false);
  function sample(event: SyntheticEvent<HTMLImageElement>) {
    try {
      const img = event.currentTarget, canvas = document.createElement("canvas");
      canvas.width = 2; canvas.height = 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ctx.drawImage(img, x ? img.naturalWidth - 1 : 0, y ? img.naturalHeight - 1 : 0, 1, 1, x, y, 1, 1);
      const data = ctx.getImageData(0, 0, 2, 2).data;
      setWhite([0, 4, 8, 12].every(i => data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245 && data[i + 3] > 245));
    } catch { /* A browser without readable pixels keeps the neutral face. */ }
  }
  const supported = /\.(png|jpe?g|svg|webp|gif)$/i.test(figure.path);
  return supported && figure.exists ? <span className={`flex h-20 w-28 shrink-0 items-center justify-center rounded p-1 ${white ? "bg-primary-foreground" : "bg-gaid-face-2"}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img crossOrigin="anonymous" src={rawFileUrl(figure.path, projectId)} alt="" onLoad={sample} className="max-h-full max-w-full object-contain" />
  </span> : <span className="flex h-20 w-28 shrink-0 items-center justify-center bg-gaid-face-2 text-xs text-gaid-ink-2">{t(figure.exists ? "figures.previewUnavailable" : "figures.missing")}</span>;
}

export function NoteFigures({ projectId, noteId, onOpenFile, onOpenChat, onPrefill = prefillChat }: NoteFiguresProps) {
  const [data, setData] = useState<FigureListResponse | null>(null);
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"origin" | "check" | "ai">("origin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const scope = `${projectId}/${noteId}`, scopeRef = useRef(scope);
  scopeRef.current = scope;
  const figure = data?.figures.find(f => f.path === selected) ?? data?.figures[0];
  const target = data?.target ?? null;
  const journal = journals.find(j => j.id === target?.journalId);
  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await apiFetch(url, init, projectId);
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  }
  useEffect(() => {
    let live = true;
    setData(null); setSelected(null); setError(null); setNotice(null); setTab("origin"); setBusy(false);
    Promise.all([request<FigureListResponse>(`/geo/figures?note=${encodeURIComponent(noteId)}`), request<{ journals: JournalSummary[] }>("/geo/figures/journals")])
      .then(([next, profiles]) => { if (live) { setData(next); setJournals(profiles.journals); } })
      .catch(e => { if (live) setError(String(e)); });
    return () => { live = false; };
    // request is scoped to this exact project/note, not a global active project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, noteId, reload]);
  async function mutate(url: string, body: unknown, method = "PUT") {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await request<{ figure?: FigureRecord; target?: FigureTarget | null }>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (scopeRef.current !== scope) return;
      if (result.figure && !kindIsAiMade(result.figure.kind)) setTab(prev => prev === "ai" ? "origin" : prev);
      if (result.figure) setData(prev => prev ? { ...prev, figures: prev.figures.map(f => f.path === result.figure!.path ? { ...result.figure!, caption: f.caption, noteId: f.noteId } : f) } : prev);
      if ("target" in result) {
        const refreshed = await request<FigureListResponse>(`/geo/figures?note=${encodeURIComponent(noteId)}`);
        if (scopeRef.current === scope) setData(refreshed);
      }
    } catch (e) { if (scopeRef.current === scope) setError(String(e)); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  }
  function redraw(atTarget: boolean) {
    if (!figure) return;
    const accepted = onPrefill(redrawMessage(figure, atTarget ? target : null, atTarget ? journal ?? null : null), { send: false });
    setNotice(t(accepted === null || accepted === false ? "figures.noChat" : "figures.prefilled"));
  }
  const currentCheck = figure?.check;
  const mismatch = currentCheck && ((currentCheck.target?.journalId ?? null) !== (target?.journalId ?? null) || (currentCheck.target?.width ?? null) !== (target?.width ?? null) || currentCheck.kind !== figure.kind);
  return <section aria-label={t("figures.title")} className="@container space-y-3 text-sm text-gaid-ink">
    <h3 className="text-lg font-semibold">{t("figures.title")}</h3>
    {error && <div role="alert" className="space-y-2"><p>{t("figures.error")}</p><Button variant="outline" onClick={() => setReload(v => v + 1)}>{t("figures.reload")}</Button><details><summary>{t("figures.error.technical")}</summary><pre className="whitespace-pre-wrap break-all text-xs">{error}</pre><Button variant="ghost" onClick={() => void navigator.clipboard.writeText(error)}>{t("figures.copyTechnical")}</Button></details></div>}
    {notice && <p role="status" className="text-gaid-ink-2">{notice}</p>}
    {!data && !error && <p role="status">{t("figures.loading")}</p>}
    {data?.figures.length === 0 && <p className="text-gaid-ink-2">{t("figures.empty")}</p>}
    {figure && <div className="grid gap-4 @min-[960px]:grid-cols-[minmax(0,38fr)_minmax(0,62fr)]">
      <div aria-label={t("figures.list")} className="max-h-96 space-y-1 overflow-y-auto">
        {data!.figures.map(f => <button key={f.path} type="button" disabled={busy} aria-pressed={f.path === figure.path} onClick={() => { setSelected(f.path); setNotice(null); if (tab === "ai" && !kindIsAiMade(f.kind)) setTab("origin"); }} className={`flex w-full gap-3 rounded p-3 text-left hover:bg-gaid-face-2 focus-visible:outline-2 focus-visible:outline-gaid-signal ${f.path === figure.path ? "gaid-index bg-gaid-signal-tint font-medium" : ""}`}>
          <FigureThumbnail figure={f} projectId={projectId} />
          <span className="min-w-0 space-y-1"><span className="block break-words">{f.caption ?? f.path.split("/").at(-1)}</span><span className="block text-xs text-gaid-ink-2">{t(`figures.kind.${f.kind}`)}</span>
            {(!f.exists || f.staleness === "stale" || f.inputsChanged || f.check?.items.some(i => i.status === "fail")) && <span className="block text-xs text-gaid-warning">{t(!f.exists ? "figures.missing" : f.staleness === "stale" ? "figures.stale" : f.inputsChanged ? "figures.changed" : "figures.checkFailed")}</span>}
          </span>
        </button>)}
        {data!.truncated && <p className="text-xs text-gaid-ink-2">{t("figures.truncated")}</p>}
      </div>
      <aside aria-label={t("figures.inspector")} className="min-w-0 space-y-4 border-t border-gaid-edge pt-4 @min-[960px]:border-t-0 @min-[960px]:pt-0">
        <header className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{figure.caption ?? figure.path.split("/").at(-1)}</span><Button variant="ghost" onClick={() => onOpenFile(figure.path)}>{t("figures.openFile")}</Button></header>
        <div role="tablist" aria-label={t("figures.inspector")} className="gaid-seg flex flex-wrap gap-2">
          {(["origin", "check", ...(kindIsAiMade(figure.kind) ? ["ai"] : [])] as const).map(key => <Button key={key} role="tab" aria-selected={tab === key} variant="ghost" className={tab === key ? "bg-gaid-signal-tint font-semibold" : ""} onClick={() => setTab(key as typeof tab)}>{t(`figures.tab.${key}`)}</Button>)}
        </div>
        <div role="tabpanel" className="space-y-4">
          {tab === "origin" && <>
            <Button disabled={busy || !figure.exists} onClick={() => redraw(false)}>{t("figures.redraw")}</Button>
            {figure.origin ? <div className="space-y-3">
              {figure.origin.producedAt && <p className="text-xs text-gaid-ink-2">{t("figures.produced", { date: figure.origin.producedAt.slice(0, 10) })}</p>}
              {figure.origin.sessionId && onOpenChat && <Button variant="outline" onClick={() => onOpenChat(figure.origin!.sessionId!, figure.caption ?? t("figures.title"))}>{t("figures.openChat")}</Button>}
              {figure.origin.copiedFrom && <p className="text-xs text-gaid-ink-2">{t(figure.origin.copyMatch === "hash" ? "figures.copyHash" : "figures.copyEdge")} <button className="text-gaid-signal-ink underline" onClick={() => onOpenFile(figure.origin!.copiedFrom!)}>{figure.origin.copiedFrom}</button></p>}
              <ul className="space-y-2">{figure.origin.inputs.map(input => <li key={input.path} className="break-all"><span className="mr-2 text-xs text-gaid-ink-2">{t(`figures.role.${input.role}`)}</span><button className="text-gaid-signal-ink underline" onClick={() => onOpenFile(input.path)}>{input.path}</button>{input.changedSinceUse && <span className="ml-2 text-xs text-gaid-warning">{t("figures.changed")}</span>}{!input.exists && <span className="ml-2 text-xs text-gaid-warning">{t("figures.missing")}</span>}{input.confidence === "inferred" && <span className="ml-2 text-xs text-gaid-ink-2">{t("figures.inferred")}</span>}</li>)}</ul>
              {figure.origin.incomplete && <p className="text-xs text-gaid-ink-2">{t("figures.incomplete")}</p>}
            </div> : <p className="text-gaid-ink-2">{t("figures.noOrigin")}</p>}
          </>}
          {tab === "check" && <>
            <label className="block space-y-1"><span>{t("figures.journal")}</span><select aria-label={t("figures.journal")} disabled={busy} value={target?.journalId ?? ""} className="h-8 w-full rounded border border-gaid-control-edge bg-gaid-face px-2" onChange={e => { const next = journals.find(j => j.id === e.target.value); void mutate("/geo/figures/target", { journalId: next?.id ?? null, width: next?.widths[0]?.id ?? null }); }}><option value="">{t("figures.noTarget")}</option>{journals.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
            {journal && <label className="block space-y-1"><span>{t("figures.width")}</span><select aria-label={t("figures.width")} disabled={busy} value={target?.width ?? ""} className="h-8 w-full rounded border border-gaid-control-edge bg-gaid-face px-2" onChange={e => void mutate("/geo/figures/target", { journalId: journal.id, width: e.target.value })}>{journal.widths.map(w => <option key={w.id} value={w.id}>{w.label}{w.mm === null ? "" : ` (${w.mm} mm)`}</option>)}</select></label>}
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !figure.exists || !target} onClick={() => redraw(true)}>{t("figures.redrawTarget")}</Button><Button disabled={busy || !figure.exists} onClick={() => void mutate("/geo/figures/check", { path: figure.path }, "POST")}>{t(busy ? "figures.checking" : "figures.runCheck")}</Button></div>
            {!target && <p className="text-xs text-gaid-ink-2">{t("figures.chooseTarget")}</p>}
            {currentCheck ? <>
              <p className="text-xs text-gaid-ink-2">{t("figures.checked", { date: currentCheck.checkedAt.slice(0, 10) })}</p>
              {mismatch && <p className="text-gaid-warning">{t("figures.checkMismatch")}</p>}
              <table className="w-full text-left text-xs tabular-nums"><thead><tr><th className="py-2">{t("figures.checkItem")}</th><th>{t("figures.measured")}</th><th>{t("figures.required")}</th><th>{t("figures.result")}</th></tr></thead><tbody>{currentCheck.items.map(item => <tr key={item.id} className="border-t border-gaid-edge"><td className="py-2">{t(`figures.item.${item.id}`)}</td><td>{item.measured ?? t("figures.notMeasured")}</td><td>{item.required ?? t("figures.unknown")}</td><td className={item.status === "fail" ? "text-gaid-danger" : "text-gaid-ink-2"}>{t(`figures.status.${item.status}`)}</td></tr>)}</tbody></table>
              {!!currentCheck.cvdPreviews.length && <details><summary>{t("figures.cvdPreviews")}</summary><div className="mt-2 space-y-3">{currentCheck.cvdPreviews.map((p, i) => {
                const variant = /-cvd-(deuteranopia|protanopia|tritanopia)\.png$/.exec(p)?.[1];
                return variant ? <img key={p} src={checkPreviewUrl(projectId, currentCheck.sha256, variant)} alt={t("figures.cvdPreview", { number: i + 1 })} className="max-w-full" /> : null;
              })}</div></details>}
              {!!currentCheck.advice?.length && <details><summary>{t("figures.advice.limit")}</summary><ul>{currentCheck.advice.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}
            </> : <p className="text-gaid-ink-2">{t("figures.noCheck")}</p>}
            <p className="text-xs text-gaid-ink-2">{t("figures.journalRules.limit")}</p>
            {(currentCheck?.rulesCheckedAt ?? journal?.rulesCheckedAt) && <p className="text-xs text-gaid-ink-2">{t("figures.rulesDate", { date: currentCheck?.rulesCheckedAt ?? journal?.rulesCheckedAt ?? "" })}</p>}
            {journal?.sourceUrl && <a href={journal.sourceUrl} target="_blank" rel="noreferrer" className="text-gaid-signal-ink underline">{t("figures.rulesSource")}</a>}
          </>}
          {tab === "ai" && kindIsAiMade(figure.kind) && <>
            {journal && <p className="font-medium">{journal.name}</p>}
            <p>{t(`figures.policy.${figure.policy?.policy ?? "unknown"}`)}</p>
            {!target && <p className="text-gaid-ink-2">{t("figures.chooseTarget")}</p>}
            {figure.policy?.sourceUrl && <a href={figure.policy.sourceUrl} target="_blank" rel="noreferrer" className="text-gaid-signal-ink underline">{t("figures.rulesSource")}</a>}
            <p className="text-xs text-gaid-ink-2">{t("figures.disclosure.limit")}</p>
            {journal?.rulesCheckedAt && <p className="text-xs text-gaid-ink-2">{t("figures.rulesDate", { date: journal.rulesCheckedAt })}</p>}
          </>}
        </div>
        <details><summary>{t("figures.changeKind")}</summary><label className="mt-2 block space-y-1"><span>{t("figures.kindLabel")}</span><select aria-label={t("figures.kindLabel")} disabled={busy || !figure.sha256} value={figure.kindSource === "derived" ? "" : figure.kind} className="h-8 w-full rounded border border-gaid-control-edge bg-gaid-face px-2" onChange={e => void mutate("/geo/figures/kind", { path: figure.path, sha256: figure.sha256, kind: e.target.value || null })}><option value="">{t("figures.autoKind")}</option>{FIGURE_KINDS.map(k => <option key={k} value={k}>{t(`figures.kind.${k}`)}</option>)}</select></label></details>
        <details><summary>{t("figures.view.record")}</summary><dl className="mt-2 space-y-2 text-xs"><dt>{t("figures.tool.record")}</dt><dd>{figure.origin?.record.toolName ?? t("figures.unknown")}</dd><dt>{t("figures.model.record")}</dt><dd>{figure.origin?.record.model ?? t("figures.unknown")}</dd><dt>{t("figures.environment.record")}</dt><dd className="break-all">{figure.origin?.record.environmentId ?? t("figures.unknown")}</dd></dl>{figure.disclosure && <div className="mt-4 space-y-2"><h4>{t("figures.disclosure.record")}</h4><p className="whitespace-pre-wrap break-words text-xs">{figure.disclosure}</p><Button variant="outline" onClick={() => void navigator.clipboard.writeText(figure.disclosure!).then(() => setNotice(t("figures.copied"))).catch(e => setError(String(e)))}>{t("figures.copyDisclosure.record")}</Button></div>}</details>
      </aside>
    </div>}
  </section>;
}

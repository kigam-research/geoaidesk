"use client";
/** The optional reading-first choice, kept only in the open start window (gaid-library-prep). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { digestKey, type DigestCandidate } from "@/geo/contracts/library";
import type { WorkflowDigestChoice } from "@/geo/contracts/workflow-doc";
import { getDigestCandidates } from "@/geo/library/api";
import { t } from "@/geo/i18n";
import { OptionCard, SummaryRows, type SummaryRow } from "./setup-steps";

export const digestSettings = (value: DigestCandidate | null): WorkflowDigestChoice | undefined => value ? ({
  key: digestKey(value.itemId), title: value.title, status: value.status, origin: value.origin,
  covers: (value.papers ?? []).map((paper) => paper.key),
}) : undefined;

export interface DigestChoiceState {
  candidates: DigestCandidate[];
  selected: DigestCandidate | null;
  failed: boolean;
  choose: (id: string | null) => void;
  reload: () => Promise<void>;
  reset: () => void;
}

/** A recommendation is adopted only before the researcher chooses; late replies never overwrite a choice. */
export function useDigestCandidates(projectId: string | undefined, method: string | null): DigestChoiceState {
  const scope = `${projectId ?? ""}:${method ?? ""}`;
  const [data, setData] = useState<{ scope: string; candidates: DigestCandidate[]; failed: boolean }>({ scope, candidates: [], failed: false });
  const [choice, setChoice] = useState<{ scope: string; id: string | null } | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const serial = ++request.current;
    if (!projectId) return;
    try {
      const result = await getDigestCandidates(projectId, method ?? undefined);
      if (!Array.isArray(result?.digests)) throw new Error("Invalid digest candidate response");
      if (serial === request.current) setData({ scope, candidates: result.digests, failed: false });
    } catch { if (serial === request.current) setData((old) => old.scope === scope ? { ...old, failed: true } : { scope, candidates: [], failed: true }); }
  }, [projectId, method, scope]);
  useEffect(() => { void reload(); }, [reload]);
  const candidates = data.scope === scope ? data.candidates : [];
  const id = choice?.scope === scope ? choice.id : candidates.find((row) => row.recommended && row.origin === "gaid")?.itemId;
  const selected = candidates.find((row) => row.itemId === id) ?? null;
  return { candidates, selected, failed: data.scope === scope && data.failed,
    choose: (id) => setChoice({ scope, id }), reload, reset: () => setChoice(null) };
}

export function DigestChoice({ state }: { state: DigestChoiceState }) {
  if (!state.candidates.length) return null;
  const ordered = [...state.candidates].sort((a, b) => Number(b.recommended && b.origin === "gaid") - Number(a.recommended && a.origin === "gaid"));
  const card = (row: DigestCandidate) => <OptionCard key={row.itemId} selected={state.selected?.itemId === row.itemId} onSelect={() => state.choose(row.itemId)}
        title={row.title} badge={<>
          {row.recommended && row.origin === "gaid" && <Badge variant="outline">{t("digestStart.recommended")}</Badge>}
          {row.origin === "external" && <Badge variant="outline">{t("digestStart.external")}</Badge>}
          <Badge variant="outline">{t(`digestStart.status.${row.status}`)}</Badge>
        </>}
        hint={<>
          {t("digestStart.coverage", { covered: row.covered, total: row.total })}
          {row.origin === "external" && <span className="ml-2">{t("digestStart.referenceOnly")}</span>}
          {row.newPapers > 0 && <span className="mt-0.5 block">{t("digestStart.newPapers", { count: row.newPapers })}</span>}
        </>} />;
  return <div className="space-y-2">
    <div role="radiogroup" aria-label={t("digestStart.label")} className="space-y-2">
      {ordered.slice(0, 2).map(card)}
      {ordered.length > 2 && <details open={ordered.slice(2).some((row) => row.itemId === state.selected?.itemId) || undefined}>
        <summary className="cursor-pointer text-[13px] text-gaid-ink-2">{t("digestStart.more", { count: ordered.length - 2 })}</summary>
        <div className="mt-2 space-y-2">{ordered.slice(2).map(card)}</div>
      </details>}
      <OptionCard selected={!state.selected} onSelect={() => state.choose(null)} title={t("digestStart.none")} hint={t("digestStart.noneHint")} />
    </div>
    {state.failed && <p role="status" className="text-[13px] text-gaid-ink-2">{t("digestStart.failed")} <Button variant="ghost" size="sm" onClick={() => void state.reload()}>{t("digestStart.retry")}</Button></p>}
  </div>;
}

export function digestSummaryRow(state: DigestChoiceState): SummaryRow | null {
  if (!state.candidates.length) return null;
  const value = state.selected;
  return { step: 0, label: t("digestStart.label"),
    value: value?.title ?? t("digestStart.none"), muted: !value,
    hint: value ? t("digestStart.summaryState", { origin: t(value.origin === "external" ? "digestStart.external" : "digestStart.gaid"), status: t(`digestStart.status.${value.status}`) }) : undefined,
    note: value ? t(value.origin === "external" ? "digestStart.externalNote" : "digestStart.citationNote") : t("digestStart.noneHint") };
}

export function DigestSummary({ state, onEdit }: { state: DigestChoiceState; onEdit: () => void }) {
  const row = digestSummaryRow(state);
  return row ? <SummaryRows rows={[row]} onEdit={onEdit} /> : null;
}

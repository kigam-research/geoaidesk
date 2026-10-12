"use client";
import { geoText, geoLocale, hasGeoText } from "@/geo/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { normalizeAnalysisPlan, latestFrozenPlan, PLAN_TEXT_FIELDS, planFieldValue,
  type AnalysisPlanInput, type AnalysisPlanHistory, type AnalysisPlanPreview, type PlanTextField, type PlanDeviationInput, type PlanDeviationEvent } from "@/lib/notebook-plans";
import type { NotebookEntry } from "@/lib/notebook";

const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
const fieldClass = "w-full rounded-md border bg-background px-2 py-1.5 text-xs";
function emptyPlan(title: string): AnalysisPlanInput {
  return { hypothesis: title, primaryOutcome: "", exclusions: "", model: "", multiplicity: "", qc: "", stopping: "", exposureNotes: "", datasets: [], intent: "exploratory", priorExposure: "unknown" };
}
function PlanDetails({ plan }: { plan: AnalysisPlanInput }) {
  return <dl className="grid gap-2 text-xs [overflow-wrap:anywhere]">
    <div><dt className="font-medium">{rt("plan.declared_intent_prior_exposure")}</dt><dd>{valueText(plan.intent)} / {valueText(plan.priorExposure)}</dd></div>
    {Object.entries(PLAN_TEXT_FIELDS).map(([key]) => <div key={key}><dt className="font-medium">{rt(`plan.fields.${key}`)}</dt><dd className="whitespace-pre-wrap text-muted-foreground">{plan[key as PlanTextField]}</dd></div>)}
    <div><dt className="font-medium">{rt("plan.datasets")}</dt><dd className="whitespace-pre-wrap">{plan.datasets.join("\n")}</dd></div>
  </dl>;
}

export function NotebookPlanDialog({ entry, sessionId, projectId }: { entry: NotebookEntry; sessionId: string; projectId: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<AnalysisPlanHistory | null>(entry.planHistory ?? null);
  const [mode, setMode] = useState<"history" | "edit" | "preview" | "deviation">("history");
  const [draft, setDraft] = useState<AnalysisPlanInput>(() => entry.analysisPlan ?? emptyPlan(entry.title));
  const [datasetText, setDatasetText] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [preview, setPreview] = useState<AnalysisPlanPreview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [allowUnknown, setAllowUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deviation, setDeviation] = useState<PlanDeviationInput>({ planId: "", field: "model", actual: "", reason: "", timing: "unknown" });
  const lifetime = useRef(0);
  const base = `/sessions/${encodeURIComponent(sessionId)}/notebook/${encodeURIComponent(entry.id)}/plans`;
  const latest = history ? latestFrozenPlan(history) : undefined;
  const [reload, setReload] = useState(0);

  // Project polling can observe a revision approved in another tab. Update the
  // closed control, but never replace a scientist's in-progress review state.
  useEffect(() => {
    if (!open && entry.planHistory && entry.planHistory.events.length > (history?.events.length ?? 0)) setHistory(entry.planHistory);
  }, [entry.planHistory, history?.events.length, open]);

  useEffect(() => {
    if (!open) return;
    const version = ++lifetime.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let disposed = false;
    setBusy(true); setError(""); setMode("history"); setPreview(null);
    void (async () => {
      try {
        const res = await apiFetch(base, { signal: controller.signal, cache: "no-store" }, projectId);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail ?? rt("plan.could_not_load_plan_history"));
        if (!controller.signal.aborted && version === lifetime.current) setHistory(data);
      } catch (e) { if (!disposed && version === lifetime.current) { setHistory(null); setError(controller.signal.aborted ? rt("plan.plan_lookup_timed_out_reload_history_to_retry") : (e as Error).message); } }
      finally { clearTimeout(timer); if (!disposed && version === lifetime.current) setBusy(false); }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timer); lifetime.current++; };
  }, [open, base, projectId, reload]);

  async function post<T>(action: string, body: unknown): Promise<T | undefined> {
    const version = lifetime.current;
    setBusy(true); setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await apiFetch(`${base}/${action}`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, projectId);
      const data = await res.json();
      if (version !== lifetime.current) return;
      if (!res.ok) {
        if (res.status === 409 || res.status === 410) { setPreview(null); setMode("history"); setHistory(null); }
        throw new Error(data.detail ?? rt("plan.plan_operation_failed"));
      }
      return data as T;
    } catch (e) { if (version === lifetime.current) setError((e as Error).message); }
    finally { clearTimeout(timer); if (version === lifetime.current) setBusy(false); }
  }
  function editPlan() {
    const initial = latest?.plan ?? entry.analysisPlan ?? emptyPlan(entry.title);
    setDraft(initial); setDatasetText(initial.datasets.join("\n")); setRevisionReason("");
    setPreview(null); setConfirm(false); setAllowUnknown(false); setError(""); setMode("edit");
  }
  function editDeviation(previous?: PlanDeviationEvent) {
    setDeviation(previous ? { planId: previous.planId, field: previous.field, actual: previous.actual, reason: "", timing: previous.timing, corrects: previous.id } : { planId: latest!.id, field: "model", actual: "", reason: "", timing: "unknown" });
    setError(""); setMode("deviation");
  }
  async function prepare() {
    try {
      const plan = normalizeAnalysisPlan({ ...draft, datasets: datasetText.split(/\r?\n/).map((p) => p.trim()).filter(Boolean) });
      const data = await post<AnalysisPlanPreview>("preview", { plan, expectedHead: history?.head ?? null, revisionReason });
      if (data) { setPreview(data); setConfirm(false); setAllowUnknown(false); setMode("preview"); }
    } catch (e) { setError((e as Error).message); }
  }
  const selectedPlan = history?.events.find((e) => e.kind === "freeze" && e.id === deviation.planId);
  return <>
    <Button type="button" variant="outline" size="xs" disabled={entry.provisional} onClick={() => setOpen(true)}>
      {latest ? rt("plan.analysis_plan_revision", { revision: latest.revision }) : entry.analysisPlan ? rt("plan.review_proposed_analysis_plan") : rt("plan.analysis_plan")}
    </Button>
    {entry.planHistoryError && <p className="text-xs text-destructive">{rt("plan.plan_history_unavailable_message", { value1: entry.planHistoryError })}</p>}
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="min-w-0 max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{rt("plan.analysis_plan")}</DialogTitle><DialogDescription>{rt("plan.user_approved_local_records_not_external_preregistration_proof_of_data")}</DialogDescription></DialogHeader>
        {error && <div role="alert" className="rounded border border-destructive/30 p-2 text-sm text-destructive">{error} <Button variant="outline" size="xs" disabled={busy} onClick={() => setReload((n) => n + 1)}>{rt("plan.reload_history")}</Button></div>}
        {busy && <p role="status" className="text-xs">{rt("plan.working")}</p>}
        {mode === "history" && history && <div className="space-y-3">
          {!latest && <p className="text-sm">{rt("plan.no_frozen_plan_yet_a_proposed_plan_is_only_an")}</p>}
          {history.events.map((event) => <section key={event.id} className="rounded-md border p-3 text-xs [overflow-wrap:anywhere]">
            <p className="font-semibold">{event.kind === "freeze" ? rt("plan.frozen_revision", { revision: event.revision }) : event.corrects ? rt("plan.deviation_correction") : rt("plan.deviation")} · {new Date(event.recordedAt).toLocaleString(geoLocale())}</p>
            <p className="mt-1 text-muted-foreground">{rt("plan.recorded_by_you_message", { value1: event.id })}</p>
            {event.kind === "freeze" ? <details className="mt-2"><summary className="cursor-pointer">{rt("plan.inspect_immutable_plan_message", { value1: event.id === latest?.id ? rt("plan.latest_revision") : rt("plan.historical_revision") })}</summary>
              {event.revisionReason && <p className="my-2">{rt("plan.revision_reason_message", { value1: event.revisionReason })}</p>}
              <PlanDetails plan={event.plan} />
              <ul className="mt-2">{event.datasets.map((d, i) => <li key={i}>{d.path}: {d.sha256 ? `sha256 ${d.sha256}` : rt("plan.unverified_reason", { reason: d.reason ?? valueText("unknown") })}</li>)}</ul>
              <p className="mt-2 text-muted-foreground">{rt("plan.record_digest_message", { value1: event.digest })}</p>
            </details> : <div className="mt-2 space-y-1">
              <p>{rt("plan.plan_message", { value1: history.events.find((e) => e.id === event.planId && e.kind === "freeze")?.kind === "freeze" ? event.planId : valueText("unavailable"), value2: rt(`plan.fields.${event.field}`) })}</p>
              <p className="whitespace-pre-wrap">{rt("plan.planned_message", { value1: ["intent", "priorExposure"].includes(event.field) ? valueText(event.planned) : event.planned })}</p><p className="whitespace-pre-wrap">{rt("plan.actual_message", { value1: event.actual })}</p><p>{rt("plan.reason_message", { value1: event.reason })}</p>
              <p>{rt("plan.timing_message", { value1: valueText(event.timing) })}</p>
              {event.corrects && <p>{rt("plan.corrects_message", { value1: event.corrects })}</p>}
              {history.events.some((e) => e.kind === "deviation" && e.corrects === event.id) ? <p className="font-medium">{rt("plan.a_later_correction_exists_this_is_historical")}</p> : <Button variant="outline" size="xs" disabled={busy} onClick={() => editDeviation(event)}>{rt("plan.correct_this_deviation")}</Button>}
            </div>}
          </section>)}
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={editPlan}>{latest ? rt("plan.propose_a_revised_plan") : rt("plan.prepare_plan")}</Button>{latest && <Button variant="outline" size="sm" disabled={busy} onClick={() => editDeviation()}>{rt("plan.record_deviation")}</Button>}</div>
        </div>}
        {mode === "edit" && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void prepare(); }}>
          <p className="text-xs text-muted-foreground">{rt("plan.complete_every_field_state_unknown_or_not_applicable_explicitly_rather")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">{rt("plan.analysis_intent")}<select aria-label={rt("plan.analysis_intent")} className={fieldClass} value={draft.intent} onChange={(e) => setDraft({ ...draft, intent: e.target.value as AnalysisPlanInput["intent"] })}><option value="exploratory">{rt("plan.exploratory")}</option><option value="confirmatory">{rt("plan.intended_confirmatory_declared")}</option></select></label>
            <label className="space-y-1 text-xs">{rt("plan.prior_exposure")}<select aria-label={rt("plan.prior_exposure")} className={fieldClass} value={draft.priorExposure} onChange={(e) => setDraft({ ...draft, priorExposure: e.target.value as AnalysisPlanInput["priorExposure"] })}>{["unknown", "none", "metadata-only", "outcomes-inspected"].map((x) => <option key={x} value={x}>{valueText(x)}</option>)}</select></label>
          </div>
          {Object.entries(PLAN_TEXT_FIELDS).map(([key]) => <label key={key} className="block space-y-1 text-xs">{rt(`plan.fields.${key}`)}<textarea aria-label={rt(`plan.fields.${key}`)} required maxLength={4000} rows={2} className={fieldClass} value={draft[key as PlanTextField]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
          <label className="block space-y-1 text-xs">{rt("plan.dataset_paths_one_per_line")}<textarea aria-label={rt("plan.dataset_paths")} required rows={3} className={fieldClass} value={datasetText} onChange={(e) => setDatasetText(e.target.value)} /></label>
          {latest && <label className="block space-y-1 text-xs">{rt("plan.reason_for_revision")}<textarea aria-label={rt("plan.reason_for_revision")} required maxLength={4000} className={fieldClass} value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} /></label>}
          <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}>{rt("plan.review_freeze_preview")}</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setMode("history")}>{rt("plan.cancel")}</Button></div>
        </form>}
        {mode === "preview" && preview && <div className="space-y-3">
          <p className="font-medium">{rt("plan.review_exactly_what_will_be_frozen")}</p>
          <PlanDetails plan={preview.plan} />
          <div className="rounded border p-3 text-xs"><p className="font-semibold">{rt("plan.server_measured_dataset_identities")}</p><ul className="space-y-1 [overflow-wrap:anywhere]">{preview.datasets.map((d, i) => <li key={i}>{rt("plan.bytes_message", { value1: d.path, value2: d.sha256 ? `sha256 ${d.sha256}` : rt("plan.unverified_preview", { reason: d.reason ?? valueText("unknown") }), value3: d.size ?? valueText("unknown") })}</li>)}</ul><p className="mt-2">{rt("plan.files_are_rechecked_on_confirmation_unknown_identities_cannot_be_proven_message", { value1: new Date(preview.expiresAt).toLocaleTimeString(geoLocale()) })}</p></div>
          {preview.plan.intent === "confirmatory" && preview.plan.priorExposure !== "none" && <p className="rounded border border-amber-500/40 p-2 text-xs">{rt("plan.prior_exposure_is_not_declared_absent_an_intended_confirmatory_label")}</p>}
          {preview.revisionReason && <p className="text-xs">{rt("plan.reason_for_revision_151_message", { value1: preview.revisionReason })}</p>}
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{rt("plan.i_approve_this_local_plan_record_it_is_not_external")}</label>
          {preview.datasets.some((d) => !d.sha256) && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={allowUnknown} onChange={(e) => setAllowUnknown(e.target.checked)} />{rt("plan.i_acknowledge_that_some_dataset_identities_are_unverified")}</label>}
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !confirm || (preview.datasets.some((d) => !d.sha256) && !allowUnknown)} onClick={async () => {
            const saved = await post<AnalysisPlanHistory>("freeze", { previewId: preview.id, acknowledgeLocalFreeze: confirm, acknowledgeUnverified: allowUnknown });
            if (saved) { setHistory(saved); setPreview(null); setMode("history"); }
          }}>{rt("plan.approve_and_freeze_locally")}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setPreview(null); setMode("edit"); }}>{rt("plan.back_to_editing")}</Button></div>
        </div>}
        {mode === "deviation" && history && <form className="space-y-3" onSubmit={async (event) => { event.preventDefault(); const saved = await post<AnalysisPlanHistory>("deviations", { ...deviation, expectedHead: history.head }); if (saved) { setHistory(saved); setMode("history"); } }}>
          <p className="text-sm">{deviation.corrects ? rt("plan.correct_a_deviation_original_retained") : rt("plan.record_an_analysis_plan_deviation")}</p>
          <label className="block space-y-1 text-xs">{rt("plan.frozen_plan")}<select aria-label={rt("plan.frozen_plan")} className={fieldClass} disabled={Boolean(deviation.corrects)} value={deviation.planId} onChange={(e) => setDeviation({ ...deviation, planId: e.target.value })}>{history.events.filter((e) => e.kind === "freeze").map((e) => <option key={e.id} value={e.id}>{rt("plan.revision_message", { value1: e.revision })}</option>)}</select></label>
          <label className="block space-y-1 text-xs">{rt("plan.changed_field")}<select aria-label={rt("plan.changed_field")} className={fieldClass} disabled={Boolean(deviation.corrects)} value={deviation.field} onChange={(e) => setDeviation({ ...deviation, field: e.target.value as PlanDeviationInput["field"] })}>{[...Object.entries(PLAN_TEXT_FIELDS), ["datasets", "Datasets"], ["intent", "Intent"], ["priorExposure", rt("plan.prior_exposure")]].map(([key]) => <option key={key} value={key}>{rt(`plan.fields.${key}`)}</option>)}</select></label>
          <p className="whitespace-pre-wrap rounded border p-2 text-xs">{rt("plan.planned_message", { value1: selectedPlan?.kind === "freeze" ? ["intent", "priorExposure"].includes(deviation.field) ? valueText(planFieldValue(selectedPlan.plan, deviation.field)) : planFieldValue(selectedPlan.plan, deviation.field) : rt("plan.unavailable") })}</p>
          <label className="block space-y-1 text-xs">{rt("plan.what_was_actually_done")}<textarea aria-label={rt("plan.what_was_actually_done")} required maxLength={4000} className={fieldClass} value={deviation.actual} onChange={(e) => setDeviation({ ...deviation, actual: e.target.value })} /></label>
          <label className="block space-y-1 text-xs">{rt("plan.reason_for_deviation_correction")}<textarea aria-label={rt("plan.reason_for_deviation")} required maxLength={4000} className={fieldClass} value={deviation.reason} onChange={(e) => setDeviation({ ...deviation, reason: e.target.value })} /></label>
          <label className="block space-y-1 text-xs">{rt("plan.decision_timing")}<select aria-label={rt("plan.decision_timing")} className={fieldClass} value={deviation.timing} onChange={(e) => setDeviation({ ...deviation, timing: e.target.value as PlanDeviationInput["timing"] })}>{["unknown", "before-results", "after-results"].map((x) => <option key={x} value={x}>{valueText(x)}</option>)}</select></label>
          <p className="text-xs text-muted-foreground">{rt("plan.timing_is_self_reported_this_records_a_change_it_does")}</p>
          <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}>{rt("plan.save_deviation")}</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setMode("history")}>{rt("plan.cancel")}</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}

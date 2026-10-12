"use client";
import { geoText, geoLocale, hasGeoText } from "@/geo/i18n";
import { useEffect, useRef, useState } from "react";
import { LightbulbIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { NextExperimentCards } from "./next-experiment-cards";
import { nextExperimentsText, type NextExperimentView, type NextExperimentProposalView } from "@/lib/next-experiments";
import type { NotebookEntry } from "@/lib/notebook";
const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
const field = "w-full rounded-md border bg-background px-2 py-1.5 text-xs";
interface Props { entry: NotebookEntry; sessionId: string; projectId: string; model?: string; onSaved?: () => void }
export function NextExperimentsDialog(props: Props) { return <PlanningDialog key={`${props.projectId}:${props.sessionId}:${props.entry.id}`} {...props} />; }
function PlanningDialog({ entry, sessionId, projectId, model, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<NextExperimentView | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [constraints, setConstraints] = useState("Prefer informative, low-cost checks using existing data before new collection.");
  const [approveCall, setApproveCall] = useState(false);
  const [lastRequest, setLastRequest] = useState<string | null>(null); const [requestStatus, setRequestStatus] = useState("");
  const [selection, setSelection] = useState<{ proposal: NextExperimentProposalView; candidateId: string } | null>(null);
  const [disposition, setDisposition] = useState<"prioritize" | "defer" | "reject">("prioritize");
  const [reason, setReason] = useState(""); const [ackContext, setAckContext] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef<AbortController | null>(null); const epoch = useRef(0);
  const base = `/sessions/${encodeURIComponent(sessionId)}/notebook/${encodeURIComponent(entry.id)}/next-experiments`;
  useEffect(() => { setApproveCall(false); }, [model]);
  useEffect(() => {
    if (!open) return;
    const version = ++epoch.current; const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 30_000);
    setBusy(true); setError(""); setSelection(null); setApproveCall(false);
    void (async () => {
      try {
        const res = await apiFetch(base, { signal: controller.signal, cache: "no-store" }, projectId);
        const data = await res.json(); if (!res.ok) throw new Error(data.detail ?? rt("next_experiments.could_not_read_proposal_context"));
        if (data.context?.projectId !== projectId || data.context?.source.sessionId !== sessionId || data.context?.source.entryId !== entry.id) throw new Error(rt("next_experiments.proposal_context_did_not_match_this_project_hypothesis"));
        if (version === epoch.current && !controller.signal.aborted) setView(data);
      } catch (e) { if (version === epoch.current) { setView(null); setError(controller.signal.aborted ? rt("next_experiments.context_read_timed_out_refresh_to_retry") : (e as Error).message); } }
      finally { clearTimeout(timer); if (version === epoch.current) setBusy(false); }
    })();
    return () => { epoch.current++; controller.abort(); request.current?.abort(); clearTimeout(timer); };
  }, [open, reload, base, projectId, sessionId, entry.id]);
  async function post<T>(suffix: string, body: unknown): Promise<T | undefined> {
    const version = epoch.current; const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 120_000);
    setBusy(true); setError("");
    try {
      const res = await apiFetch(base + suffix, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, projectId);
      const data = await res.json();
      if (!res.ok) throw new Error(`${data.detail ?? rt("next_experiments.planning_request_failed")}${data.modelCallRecorded ? rt("next_experiments.usage_recorded", { cost: typeof data.costUsd === "number" ? `: ${data.costUsd.toFixed(6)}` : "" }) : ""}`);
      if (version === epoch.current) return data;
    } catch (e) { if (version === epoch.current) setError(controller.signal.aborted ? rt("next_experiments.request_timed_out_a_model_call_may_still_be_running") : (e as Error).message); }
    finally { clearTimeout(timer); if (version === epoch.current) setBusy(false); }
  }
  async function checkRequest() {
    if (!lastRequest) return;
    const version = epoch.current; setBusy(true);
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await apiFetch(`${base}/requests/${lastRequest}`, { cache: "no-store", signal: controller.signal }, projectId); const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? rt("next_experiments.request_status_unavailable"));
      if (version === epoch.current) setRequestStatus(rt("next_experiments.request_status", { state: valueText(data.state), error: data.error?.message ? `: ${data.error.message}` : "" }));
    } catch (e) { if (version === epoch.current) setRequestStatus((e as Error).message); }
    finally { clearTimeout(timer); if (version === epoch.current) setBusy(false); }
  }
  async function copy(proposal: NextExperimentProposalView) {
    try { await navigator.clipboard.writeText(`${nextExperimentsText(proposal.plan)}\n\nSource proposal: ${proposal.source.sessionId}/${proposal.source.entryId}\nDigest: ${proposal.digest}\nContext status: ${valueText(proposal.contextStatus)}\nOmitted source sessions default to ${proposal.source.sessionId}.\nThis is a planning brief, not authorization to execute or spend.`); toast.success(rt("next_experiments.planning_brief_copied_nothing_was_executed")); }
    catch { toast.error(rt("next_experiments.clipboard_unavailable")); }
  }
  return <>
    <Button type="button" variant="outline" size="xs" disabled={entry.provisional} onClick={() => setOpen(true)}><LightbulbIcon data-icon="inline-start" />{rt("next_experiments.what_next")}</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent className="min-w-0 max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto [overflow-wrap:anywhere] sm:max-w-4xl">
      <DialogHeader><DialogTitle>{rt("next_experiments.what_should_we_test_next")}</DialogTitle><DialogDescription>{rt("next_experiments.proposed_investigations_not_findings_or_execution_approvals_compare_competing_explanations")}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={busy} onClick={() => setReload((n) => n + 1)}>{rt("next_experiments.refresh_sources_and_proposals")}</Button>{busy && <span role="status" className="text-xs">{rt("next_experiments.working")}</span>}</div>
      {error && <p role="alert" className="rounded border border-destructive/30 p-2 text-sm text-destructive">{error}</p>}
      {view && <>
        <details className="rounded border p-2"><summary className="cursor-pointer text-xs font-medium">{rt("next_experiments.grounding_context_message", { value1: view.context.sources.length, value2: valueText(view.context.targetStatus) })}</summary>
          <p className="my-2 text-[11px] text-muted-foreground">{rt("next_experiments.bounded_original_records_not_exhaustive_project_evidence_context_captured_message", { value1: new Date(view.context.capturedAt).toLocaleString(geoLocale()), value2: view.context.digest })}</p>
          {view.context.sources.map((s, i) => <details key={i} className="border-t py-1 text-xs"><summary className="cursor-pointer">{valueText(s.hit.type)}: {s.hit.title} · {valueText(s.hit.recordStatus)}</summary><p>{s.hit.scope}</p><p>{s.hit.qualifiers.join(" ")}</p><pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-muted/30 p-2 text-[11px]">{s.text}</pre>{s.textTruncated && <p>{rt("next_experiments.excerpt_bounded_consult_the_original_source")}</p>}<p className="break-all text-[10px]">{JSON.stringify(s.hit.source)} · {s.hit.digest}</p></details>)}
          {view.context.artifacts.map((a) => <p key={a.path} className="mt-1 text-[10px]">{a.path}: {a.sha256 ?? rt("next_experiments.unverified_reason", { reason: a.reason ?? valueText("unknown") })}</p>)}
        </details>
        {view.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>)}
        <details open={view.proposals.length === 0} className="space-y-2 rounded border p-3">
          <summary className="cursor-pointer text-sm font-semibold">{rt("next_experiments.generate_a_source_linked_proposal")}</summary>
          <label className="block text-xs">{rt("next_experiments.current_decision_constraints")}<textarea aria-label={rt("next_experiments.decision_constraints")} rows={3} maxLength={4000} className={field} value={constraints} onChange={(e) => { setConstraints(e.target.value); setApproveCall(false); }} /></label>
          <p className="text-xs">{rt("next_experiments.model")} <strong>{model ?? rt("next_experiments.default_model")}</strong>{rt("next_experiments.this_makes_one_model_call_using_bounded_source_excerpts_and")}</p>
          {model?.startsWith("fusion/") && <p className="text-xs text-destructive">{rt("next_experiments.choose_a_non_fusion_model_for_this_one_shot_call")}</p>}
          {view.context.targetStatus === "superseded" && <p className="text-xs">{rt("next_experiments.this_hypothesis_is_historical_use_its_amended_version_to_generate")}</p>}
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={approveCall} onChange={(e) => setApproveCall(e.target.checked)} />{rt("next_experiments.i_approve_one_planning_model_call_with_this_bounded_project")}</label>
          <Button size="sm" disabled={busy || !approveCall || model?.startsWith("fusion/") || view.context.targetStatus === "superseded"} onClick={async () => {
            const requestId = crypto.randomUUID(); setLastRequest(requestId); setRequestStatus(""); setApproveCall(false);
            const result = await post("/generate", { model, constraints, expectedContextDigest: view.context.digest, requestId, approveModelCall: true });
            if (result) { onSaved?.(); toast.success(rt("next_experiments.planning_proposal_saved_no_experiment_was_run")); setReload((n) => n + 1); }
          }}>{rt("next_experiments.generate_proposals")}</Button>
          {lastRequest && <div className="space-y-1 text-[11px]"><p>{rt("next_experiments.last_request_message", { value1: lastRequest })}</p><Button variant="ghost" size="xs" disabled={busy} onClick={checkRequest}>{rt("next_experiments.check_request_status_no_retry")}</Button>{requestStatus && <p>{requestStatus}</p>}</div>}
        </details>
        {!view.proposals.length && <p className="text-sm text-muted-foreground">{rt("next_experiments.no_saved_next_investigation_proposals_yet_kady_can_also_author")}</p>}
        {view.proposals.map((proposal) => <details key={`${proposal.source.sessionId}:${proposal.source.entryId}`} open={view.proposals.length === 1} className="rounded border p-3">
          <summary className="cursor-pointer text-sm font-semibold">{rt("next_experiments.context_message", { value1: proposal.plan.question, value2: valueText(proposal.status), value3: valueText(proposal.contextStatus) })}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs">{rt("next_experiments.recorded_author_message", { value1: proposal.author, value2: new Date(proposal.timestamp).toLocaleString(geoLocale()), value3: proposal.source.sessionId, value4: proposal.source.entryId })}</p>
            {proposal.binding?.generation && <p className="text-[11px] text-muted-foreground">{rt("next_experiments.planning_model_message", { value1: proposal.binding.generation.model, value2: proposal.binding.generation.costUsd.toFixed(6), value3: proposal.binding.generation.billingMode ? ` (${valueText(proposal.binding.generation.billingMode)})` : "" })}</p>}
            {proposal.contextStatus !== "current" && <p className="rounded border border-amber-500/40 p-2 text-xs">{rt("next_experiments.source_context_is_message", { value1: valueText(proposal.contextStatus) })}</p>}
            {proposal.binding?.contextChangedDuringGeneration && <p className="text-xs">{rt("next_experiments.the_context_changed_or_could_not_be_rechecked_while_the")}</p>}
            {Boolean(proposal.binding?.artifacts?.length) && <details className="rounded border p-2 text-xs"><summary className="cursor-pointer">{rt("next_experiments.planning_time_file_identities_hashes_only_not_retained_bytes")}</summary>{proposal.binding!.artifacts!.map((a) => {
              const current = view.context.artifacts.find((c) => c.path === a.path);
              const status = !a.sha256 || !current?.sha256 ? rt("next_experiments.unverified_unavailable") : a.sha256 === current.sha256 ? rt("next_experiments.same_planning_bytes") : rt("next_experiments.changed_since_planning");
              return <p key={a.path} className="mt-1 break-all">{rt("next_experiments.recorded_sha_256_message", { value1: a.path, value2: status, value3: a.sha256 ?? a.reason ?? valueText("unknown") })}</p>;
            })}</details>}
            <NextExperimentCards plan={proposal.plan} projectId={projectId} sessionId={proposal.source.sessionId} sourceDigests={proposal.binding?.sourceDigests} actions={(candidate) => {
              const choices = proposal.decisions.filter((d) => d.choice.candidateId === candidate.id);
              const latest = choices.filter((d) => d.choice.proposal.digest === proposal.digest).at(-1);
              return <div className="space-y-2 border-t pt-2 text-xs">
                {latest && <p>{rt("next_experiments.latest_user_preference")} <strong>{valueText(latest.choice.disposition)}</strong> — {latest.choice.reason}. {latest.choice.contextDigest !== view.context.digest && rt("next_experiments.source_context_changed_since_this_preference")}{rt("next_experiments.not_execution_approval")}</p>}
                {choices.length > 0 && <details><summary className="cursor-pointer">{rt("next_experiments.preference_history_message", { value1: choices.length })}</summary>{choices.map((d) => <p key={d.id}>{rt("next_experiments.context_222_message", { value1: new Date(d.timestamp).toLocaleString(geoLocale()), value2: valueText(d.choice.disposition), value3: d.choice.reason, value4: valueText(d.choice.proposalContextStatus), value5: d.choice.proposal.digest === proposal.digest ? rt("next_experiments.same_proposal_version") : rt("next_experiments.earlier_proposal_version") })}</p>)}</details>}
                <Button size="xs" variant="outline" disabled={busy || proposal.status === "superseded" || view.context.targetStatus === "superseded"} onClick={() => { setSelection({ proposal, candidateId: candidate.id }); setDisposition("prioritize"); setReason(""); setAckContext(false); }}>{rt("next_experiments.record_planning_preference")}</Button>
                {selection?.proposal.digest === proposal.digest && selection.candidateId === candidate.id && <form className="space-y-2 rounded border p-2" onSubmit={async (e) => {
                  e.preventDefault(); const saved = await post("/decision", { proposal: proposal.source, expectedProposalDigest: proposal.digest, expectedContextDigest: view.context.digest, candidateId: candidate.id, disposition, reason, requestId: crypto.randomUUID(), acknowledgeUnverifiedContext: ackContext });
                  if (saved) { onSaved?.(); setSelection(null); setReload((n) => n + 1); toast.success(rt("next_experiments.planning_preference_recorded_nothing_was_executed_or_approved_to_run")); }
                }}>
                  <label className="block">{rt("next_experiments.preference")}<select aria-label={rt("next_experiments.planning_preference")} className={field} value={disposition} onChange={(e) => setDisposition(e.target.value as typeof disposition)}><option value="prioritize">{rt("next_experiments.prioritize_for_planning")}</option><option value="defer">{rt("next_experiments.defer")}</option><option value="reject">{rt("next_experiments.reject_this_option")}</option></select></label>
                  <label className="block">{rt("next_experiments.reason")}<textarea aria-label={rt("next_experiments.planning_preference_reason")} className={field} required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  {proposal.contextStatus !== "current" && <label className="flex items-start gap-2"><input type="checkbox" checked={ackContext} onChange={(e) => setAckContext(e.target.checked)} />{rt("next_experiments.i_reviewed_the_changed_unverified_source_context_this_is_a")}</label>}
                  <p>{rt("next_experiments.this_appends_a_decision_record_it_does_not_freeze_a")}</p>
                  <Button type="submit" size="xs" disabled={busy || !reason.trim() || proposal.contextStatus !== "current" && !ackContext}>{rt("next_experiments.save_preference_no_execution")}</Button>
                </form>}
              </div>;
            }} />
            <Button variant="outline" size="xs" onClick={() => copy(proposal)}>{rt("next_experiments.copy_planning_brief")}</Button>
            <p className="text-xs text-muted-foreground">{rt("next_experiments.to_act_prepare_a_current_analysis_plan_and_obtain_any")}</p>
          </div>
        </details>)}
      </>}
    </DialogContent></Dialog>
  </>;
}

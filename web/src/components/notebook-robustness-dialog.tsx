"use client";
import { geoText, geoLocale, hasGeoText } from "@/geo/i18n";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { latestFrozenPlan, type AnalysisPlanHistory } from "@/lib/notebook-plans";
import { normalizeRobustnessDraft, summarizeRobustness, robustnessText, type RobustnessDraft, type RobustnessPreview, type RobustnessWorkflow } from "@/lib/notebook-robustness";
import type { NotebookEntry } from "@/lib/notebook";
import { SettingsLink } from "@/components/settings-link";

const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
const field = "w-full rounded-md border bg-background px-2 py-1.5 text-xs";
const activeStates = new Set(["awaiting-admission", "queued", "preparing", "running", "collecting"]);
const blank = (entry: NotebookEntry): RobustnessDraft => ({ title: entry.title, script: "", inputs: [], metric: "", unit: "", nullValue: 0, instance: "cpu-2", timeoutSec: 600, packages: [], specifications: [
  { key: "baseline", label: rt("robustness.baseline"), rationale: "", seed: 42, parametersJson: "{}" },
  { key: "alternative", label: rt("robustness.alternative"), rationale: "", seed: 42, parametersJson: "{}" },
] });

export function RobustnessResults({ workflow, onOpenFile }: { workflow: RobustnessWorkflow; onOpenFile?: (path: string) => void }) {
  const { attempts, preview } = workflow;
  const summary = summarizeRobustness(attempts);
  const plotted = attempts.filter((a) => a.state === "succeeded" && a.resultStatus === "available" && a.result?.estimate !== undefined);
  const values = [preview.draft.nullValue, ...plotted.flatMap((a) => [a.result!.estimate!, ...(a.result!.interval ? [a.result!.interval.low, a.result!.interval.high] : [])])];
  const magnitude = Math.max(1, ...values.map(Math.abs));
  const scaled = values.map((n) => n / magnitude);
  const lo = Math.min(...scaled) - 0.05; const hi = Math.max(...scaled) + 0.05;
  const x = (n: number) => 220 + (n / magnitude - lo) / (hi - lo) * 400;
  return <section className="space-y-3">
    {workflow.admissionError && <p role="alert" className="rounded border border-destructive/40 p-2 text-sm">{rt("robustness.admission_failed_message", { value1: workflow.admissionError })}</p>}
    {workflow.cancelled && <p className="text-xs">{rt("robustness.cancellation_requested_already_completed_attempts_remain_recorded")}</p>}
    <p className="text-sm"><strong>{rt("robustness.comparable_qc_pass_outputs_message", { value1: summary.eligible, value2: summary.total })}</strong> {summary.eligible ? rt("robustness.estimate_range", { min: summary.min!, max: summary.max!, median: summary.median! }) : rt("robustness.no_eligible_estimates_to_summarize")}</p>
    <p className="text-xs text-muted-foreground">{rt("robustness.descriptive_sensitivity_only_not_a_significance_vote_probability_of_truth_message", { value1: preview.draft.metric, value2: preview.draft.unit })}</p>
    {plotted.length > 0 && <figure className="overflow-x-auto rounded border p-2">
      <svg role="img" aria-label={rt("robustness.specification_estimates_and_supplied_uncertainty_intervals")} viewBox={`0 0 660 ${plotted.length * 30 + 35}`} className="w-full min-w-[560px]">
        <line x1={x(preview.draft.nullValue)} x2={x(preview.draft.nullValue)} y1="5" y2={plotted.length * 30 + 10} stroke="currentColor" strokeDasharray="3 3" opacity="0.4" />
        {plotted.map((a, i) => <g key={a.jobId}><title>{rt("robustness.qc_message", { value1: a.specification.label, value2: a.result!.estimate, value3: valueText(a.result!.qc) })}</title>
          <text x="4" y={i * 30 + 24} fill="currentColor" fontSize="11">{a.specification.key.slice(0, 30)}</text>
          {a.result!.interval && <line x1={x(a.result!.interval.low)} x2={x(a.result!.interval.high)} y1={i * 30 + 20} y2={i * 30 + 20} stroke={a.result!.qc === "pass" ? "#0d9488" : "#d97706"} strokeWidth="2" />}
          <circle cx={x(a.result!.estimate!)} cy={i * 30 + 20} r="4" fill={a.result!.qc === "pass" ? "#0d9488" : "#d97706"} />
        </g>)}
        <text x="220" y={plotted.length * 30 + 28} fontSize="10" fill="currentColor">{rt("robustness.reference_null_message", { value1: preview.draft.nullValue })}</text>
      </svg>
      <figcaption className="text-[10px] text-muted-foreground">{rt("robustness.plot_and_table_scroll_horizontally_on_narrow_screens_successful_valid")}</figcaption>
    </figure>}
    <div className="overflow-x-auto rounded border"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr className="border-b bg-muted/30"><th className="p-2">{rt("robustness.specification")}</th><th className="p-2">{rt("robustness.job_state")}</th><th className="p-2">{rt("robustness.estimate_uncertainty")}</th><th className="p-2">{rt("robustness.qc_validation")}</th><th className="p-2">{rt("robustness.estimated_cost")}</th></tr></thead><tbody>
      {attempts.map((a) => <tr key={a.jobId} className="border-b align-top last:border-0"><td className="max-w-56 p-2"><strong>{a.specification.label}</strong><p className="text-muted-foreground">{a.specification.rationale}</p><p>{rt("robustness.seed_message", { value1: a.specification.seed })}</p><code className="break-all text-[10px]">{a.jobId}</code><details><summary className="cursor-pointer">{rt("robustness.parameters")}</summary><pre className="whitespace-pre-wrap break-all">{a.specification.parametersJson}</pre></details></td>
        <td className="max-w-44 p-2">{valueText(a.state)}{a.error && <p className="mt-1 text-destructive">{a.error}</p>}</td>
        <td className="p-2">{a.result ? <>{a.result.estimate ?? rt("robustness.not_estimated")}<p>{a.result.interval ? rt("robustness.uncertainty_interval", { low: a.result.interval.low, high: a.result.interval.high, level: (a.result.interval.level * 100).toFixed(1) }) : rt("robustness.interval_not_provided")}</p><p>{a.result.sampleSize ? `n=${a.result.sampleSize}` : rt("robustness.sample_size_not_provided")}</p></> : rt("robustness.no_estimate_inferred")}</td>
        <td className="max-w-52 p-2">{a.result?.qc ? valueText(a.result.qc) : "—"} · {valueText(a.resultStatus)}{a.resultReason && <p>{a.resultReason}</p>}{a.result?.notes && <p>{a.result.notes}</p>}{onOpenFile && a.resultStatus !== "pending" && a.resultStatus !== "missing" && <Button variant="ghost" size="xs" onClick={() => onOpenFile(a.outputPath)}>{rt("robustness.open_current_json")}</Button>}</td>
        <td className="p-2">{a.estimatedCostUsd !== undefined ? `$${a.estimatedCostUsd.toFixed(6)}` : rt("robustness.pending")}{!a.reconciled && <p>{rt("robustness.unreconciled")}</p>}</td>
      </tr>)}
    </tbody></table></div>
    <p className="text-[10px] text-muted-foreground">{rt("robustness.values_above_come_from_retained_checksummed_modal_output_staging_open")}</p>
  </section>;
}

export function NotebookRobustnessDialog({ entry, sessionId, projectId, onOpenFile }: { entry: NotebookEntry; sessionId: string; projectId: string; onOpenFile: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"history" | "edit" | "review">("history");
  const [draft, setDraft] = useState<RobustnessDraft>(() => entry.robustness ?? blank(entry));
  const [inputs, setInputs] = useState(""); const [packages, setPackages] = useState("");
  const [preview, setPreview] = useState<RobustnessPreview | null>(null);
  const [history, setHistory] = useState<RobustnessWorkflow[]>([]);
  const [plans, setPlans] = useState<AnalysisPlanHistory | null>(null);
  const [instances, setInstances] = useState<{ id: string; label: string; pricePerHour: number }[]>([]);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [scriptOk, setScriptOk] = useState(false); const [remoteOk, setRemoteOk] = useState(false);
  const [costOk, setCostOk] = useState(false); const [unknownOk, setUnknownOk] = useState(false);
  const [maxCost, setMaxCost] = useState(""); const [refresh, setRefresh] = useState(0);
  const epoch = useRef(0);
  const base = `/sessions/${encodeURIComponent(sessionId)}/notebook/${encodeURIComponent(entry.id)}`;
  const frozen = plans ? latestFrozenPlan(plans) : undefined;
  useEffect(() => {
    if (!open) return;
    const version = ++epoch.current; const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000); let disposed = false;
    setBusy(true); setError("");
    void (async () => {
      try {
        const responses = await Promise.all([`${base}/robustness`, `${base}/plans`, "/modal/instances"].map((url) => apiFetch(url, { signal: controller.signal, cache: "no-store" }, projectId)));
        const data = await Promise.all(responses.map((r) => r.json()));
        const bad = responses.findIndex((r) => !r.ok); if (bad >= 0) throw new Error(data[bad].detail ?? rt("robustness.could_not_load_robustness_context"));
        if (!disposed && version === epoch.current) { setHistory(data[0].workflows); setLoadErrors(data[0].errors ?? []); setConfigured(data[0].configured); setPlans(data[1]); setInstances(data[2].instances ?? []); }
      } catch (e) { if (!disposed && version === epoch.current) setError(controller.signal.aborted ? rt("robustness.context_lookup_timed_out_refresh_to_retry") : (e as Error).message); }
      finally { clearTimeout(timeout); if (!disposed && version === epoch.current) setBusy(false); }
    })();
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); epoch.current++; };
  }, [open, base, projectId, refresh]);
  const hasActive = history.some((w) => w.attempts.some((a) => activeStates.has(a.state)));
  useEffect(() => {
    if (!open || mode !== "history") return;
    const timer = setInterval(() => { if (!document.hidden && !busy) setRefresh((n) => n + 1); }, hasActive ? 5000 : 30_000);
    return () => clearInterval(timer);
  }, [open, mode, hasActive, busy]);
  async function post<T>(suffix: string, body: unknown): Promise<T | undefined> {
    const version = epoch.current; setBusy(true); setError("");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await apiFetch(`${base}/robustness/${suffix}`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, projectId);
      const data = await response.json();
      if (version !== epoch.current) return;
      if (!response.ok) { if (response.status === 409 || response.status === 410) { setPreview(null); setMode("edit"); } throw new Error(data.detail ?? rt("robustness.robustness_operation_failed")); }
      return data;
    } catch (e) { if (version === epoch.current) setError(controller.signal.aborted ? rt("robustness.request_timed_out_approval_may_have_been_recorded_refresh_history") : (e as Error).message); }
    finally { clearTimeout(timer); if (version === epoch.current) setBusy(false); }
  }
  function edit(initial = entry.robustness ?? blank(entry)) {
    setDraft(initial); setInputs(initial.inputs.join("\n")); setPackages(initial.packages.join("\n")); setPreview(null); setMode("edit"); setError("");
  }
  function exportWorkflow(workflow: RobustnessWorkflow, format: "json" | "md" = "json") {
    const url = URL.createObjectURL(new Blob([format === "json" ? JSON.stringify(workflow, null, 2) : robustnessText([workflow])], { type: format === "json" ? "application/json" : "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `robustness-${workflow.preview.id}.${format}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  return <>
    <Button variant="outline" size="xs" disabled={entry.provisional} onClick={() => setOpen(true)}>{rt("robustness.stress_test_finding")}</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}><DialogContent className="min-w-0 max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto [overflow-wrap:anywhere] sm:max-w-4xl">
      <DialogHeader><DialogTitle>{rt("robustness.stress_test_this_finding")}</DialogTitle><DialogDescription>{rt("robustness.review_defensible_alternatives_before_execution_this_runs_your_script_remotely")}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="rounded border border-destructive/30 p-2 text-sm text-destructive">{error}</p>}
      {loadErrors.map((e, i) => <p key={i} role="alert" className="text-xs text-destructive">{rt("robustness.some_history_is_unavailable_message", { value1: e })}</p>)}
      <div className="flex flex-wrap items-center gap-2 text-xs"><Button size="xs" variant="outline" disabled={busy} onClick={() => setRefresh((n) => n + 1)}>{rt("robustness.refresh_context_history")}</Button>{busy && <span role="status">{rt("robustness.working")}</span>}{!configured && <span>{rt("robustness.configure_modal_credentials_in")} <SettingsLink tab="services" section="modal">{rt("robustness.settings_services")}</SettingsLink> {rt("robustness.before_approval")}</span>}</div>
      {mode === "history" && <div className="space-y-4">
        {!frozen && <p>{rt("robustness.freeze_an_analysis_plan_first_using_the_hypothesis_s_analysis")}</p>}
        {frozen && <p className="text-xs">{rt("robustness.latest_local_frozen_plan_revision_message", { value1: frozen.revision })}</p>}
        <Button size="sm" disabled={busy || !frozen} onClick={() => edit()}>{rt("robustness.prepare_robustness_workflow")}</Button>
        {!history.length && <p className="text-sm text-muted-foreground">{rt("robustness.no_approved_robustness_workflows_yet")}</p>}
        {history.map((w) => <details key={w.preview.id} open={history.length === 1} className="rounded border p-3"><summary className="cursor-pointer text-sm font-semibold">{w.preview.draft.title} · {w.preview.id}</summary>
          <div className="mt-3 space-y-3"><p className="text-xs">{rt("robustness.approved_message", { value1: w.approvedAt ? new Date(w.approvedAt).toLocaleString(geoLocale()) : rt("robustness.not_yet"), value2: w.preview.planRevision, value3: w.preview.totalReservationUsd.toFixed(6) })}</p>
            <RobustnessResults workflow={w} onOpenFile={onOpenFile} />
            <details><summary className="cursor-pointer text-xs">{rt("robustness.exact_approved_recipe")}</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(w.preview.draft, null, 2)}</pre></details>
            <details><summary className="cursor-pointer text-xs">{rt("robustness.approved_python_snapshot")}</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[10px] whitespace-pre-wrap break-all">{w.preview.scriptSource}</pre></details>
            <div className="flex flex-wrap gap-2"><Button variant="outline" size="xs" onClick={() => exportWorkflow(w)}>{rt("robustness.export_workflow_json")}</Button><Button variant="outline" size="xs" onClick={() => exportWorkflow(w, "md")}>{rt("robustness.export_summary_markdown")}</Button><Button variant="outline" size="xs" disabled={busy || !frozen} onClick={() => edit(w.preview.draft)}>{rt("robustness.new_reviewed_workflow")}</Button>
              {w.attempts.some((a) => activeStates.has(a.state)) && !w.cancelled && <Button variant="outline" size="xs" disabled={busy} onClick={async () => { const next = await post<RobustnessWorkflow>(`${w.preview.id}/cancel`, {}); if (next) setHistory((old) => old.map((item) => item.preview.id === next.preview.id ? next : item)); }}>{rt("robustness.cancel_remaining_jobs")}</Button>}
            </div>
          </div>
        </details>)}
      </div>}
      {mode === "edit" && <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        try {
          const recipe = normalizeRobustnessDraft({ ...draft, inputs: inputs.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), packages: packages.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) });
          const p = await post<RobustnessPreview>("preview", { draft: recipe, planId: frozen?.id, expectedPlanHead: plans?.head });
          if (p) { setPreview(p); setScriptOk(false); setRemoteOk(false); setCostOk(false); setUnknownOk(false); setMaxCost(String(Math.ceil(p.totalReservationUsd * 1e6) / 1e6)); setMode("review"); }
        } catch (e) { setError((e as Error).message); }
      }}>
        <p className="text-xs">{rt("robustness.python_script_contract_accept")} <code>--spec JSON_PATH --output RESULT_PATH</code>{rt("robustness.spec_contains_metric_unit_nullvalue_seed_and_parameters_honor_the")}</p>
        <label className="block text-xs">{rt("robustness.workflow_title")}<input aria-label={rt("robustness.workflow_title")} className={field} value={draft.title} maxLength={200} required onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="block text-xs">{rt("robustness.existing_python_script")}<input aria-label={rt("robustness.existing_python_script")} className={field} value={draft.script} required onChange={(e) => setDraft({ ...draft, script: e.target.value })} /></label>
        <label className="block text-xs">{rt("robustness.explicit_input_files_one_per_line_include_all_plan_datasets")}<textarea aria-label={rt("robustness.explicit_input_files")} className={field} rows={3} value={inputs} onChange={(e) => setInputs(e.target.value)} /></label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-xs">{rt("robustness.common_effect_metric")}<input aria-label={rt("robustness.common_effect_metric")} className={field} required value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} /></label>
          <label className="text-xs">{rt("robustness.common_unit_scale")}<input aria-label={rt("robustness.common_unit")} className={field} required value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
          <label className="text-xs">{rt("robustness.reference_null_e_g_0_for_difference_1_for_ratio")}<input aria-label={rt("robustness.reference_null_65")} className={field} type="number" step="any" required value={draft.nullValue} onChange={(e) => setDraft({ ...draft, nullValue: Number(e.target.value) })} /></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">{rt("robustness.resource_per_variation")}<select aria-label={rt("robustness.resource_per_variation")} className={field} value={draft.instance} onChange={(e) => setDraft({ ...draft, instance: e.target.value })}>{instances.map((i) => <option key={i.id} value={i.id}>{rt("robustness.est_message", { value1: i.label, value2: i.pricePerHour })}</option>)}</select></label><label className="text-xs">{rt("robustness.maximum_seconds_per_variation")}<input aria-label={rt("robustness.maximum_seconds_per_variation")} className={field} type="number" min={1} max={3600} value={draft.timeoutSec} onChange={(e) => setDraft({ ...draft, timeoutSec: Number(e.target.value) })} /></label></div>
        <label className="block text-xs">{rt("robustness.exact_pypi_package_version_pins_one_per_line")}<textarea aria-label={rt("robustness.package_pins")} className={field} rows={2} value={packages} onChange={(e) => setPackages(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">{rt("robustness.image_recipe_python_3_13_slim_these_pins_no_shared")}</p>
        {draft.specifications.map((s, index) => <fieldset key={index} className="space-y-2 rounded border p-3"><legend className="px-1 text-xs font-semibold">{rt("robustness.variation_message", { value1: index + 1 })}</legend>
          <div className="grid gap-2 sm:grid-cols-3">{(["key", "label", "seed"] as const).map((name) => <label key={name} className="text-xs">{valueText(name)}<input aria-label={rt("robustness.variation_field", { index: index + 1, field: valueText(name) })} className={field} required type={name === "seed" ? "number" : "text"} value={s[name]} onChange={(e) => setDraft({ ...draft, specifications: draft.specifications.map((row, i) => i === index ? { ...row, [name]: name === "seed" ? Number(e.target.value) : e.target.value } : row) })} /></label>)}</div>
          <label className="block text-xs">{rt("robustness.scientific_rationale")}<textarea aria-label={rt("robustness.variation_rationale", { index: index + 1 })} className={field} required maxLength={2000} value={s.rationale} onChange={(e) => setDraft({ ...draft, specifications: draft.specifications.map((row, i) => i === index ? { ...row, rationale: e.target.value } : row) })} /></label>
          <label className="block text-xs">{rt("robustness.parameter_json_object")}<textarea aria-label={rt("robustness.variation_parameters", { index: index + 1 })} className={`${field} font-mono`} required maxLength={8000} value={s.parametersJson} onChange={(e) => setDraft({ ...draft, specifications: draft.specifications.map((row, i) => i === index ? { ...row, parametersJson: e.target.value } : row) })} /></label>
          <Button type="button" size="xs" variant="ghost" disabled={draft.specifications.length <= 2} onClick={() => setDraft({ ...draft, specifications: draft.specifications.filter((_, i) => i !== index) })}>{rt("robustness.remove_before_approval")}</Button>
        </fieldset>)}
        <div className="flex flex-wrap gap-2"><Button type="button" size="xs" variant="outline" disabled={draft.specifications.length >= 16} onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { key: `variation_${draft.specifications.length + 1}`, label: "", rationale: "", seed: 42, parametersJson: "{}" }] })}>{rt("robustness.add_variation")}</Button><Button type="submit" size="sm" disabled={busy || !frozen}>{rt("robustness.prepare_snapshot_and_quote")}</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode("history")}>{rt("robustness.back")}</Button></div>
      </form>}
      {mode === "review" && preview && <div className="space-y-3">
        <h3 className="font-semibold">{rt("robustness.review_exact_snapshot_and_all_message", { value1: preview.jobs.length })}</h3>
        <p className="text-sm">{rt("robustness.maximum_estimated_sandbox_commitment")} <strong>${preview.totalReservationUsd.toFixed(6)}</strong> · {preview.draft.instance} × {preview.jobs.length} {rt("robustness.up_to")} {preview.draft.timeoutSec}{rt("robustness.s_no_fallback_or_automatic_retry")}</p>
        <p className="rounded border border-amber-500/40 p-2 text-xs">{rt("robustness.this_is_an_estimate_not_a_modal_invoice_cap_image")}</p>
        <p className="text-xs">{rt("robustness.frozen_plan_revision_message", { value1: preview.planRevision, value2: new Date(preview.expiresAt).toLocaleString(geoLocale()) })}</p>
        <details open><summary className="cursor-pointer text-sm">{rt("robustness.exact_python_script_message", { value1: preview.draft.script })}</summary><pre className="mt-2 max-h-64 overflow-auto rounded bg-muted/40 p-2 text-[11px] whitespace-pre-wrap break-all">{preview.scriptSource}</pre></details>
        <details><summary className="cursor-pointer text-xs">{rt("robustness.input_file_identities_and_execution_commands")}</summary><pre className="max-h-64 overflow-auto p-2 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify({ inputs: preview.inputFiles, generated: preview.generatedFiles, jobs: preview.jobs, packages: preview.draft.packages }, null, 2)}</pre></details>
        {preview.draft.specifications.map((s) => <div key={s.key} className="rounded border p-2 text-xs"><strong>{s.label}</strong> ({s.key}{rt("robustness.seed_93")} {s.seed})<p>{s.rationale}</p><pre className="whitespace-pre-wrap break-all">{s.parametersJson}</pre></div>)}
        {preview.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}
        <label className="block text-xs">{rt("robustness.approved_maximum_estimated_usd")}<input aria-label={rt("robustness.approved_maximum_estimated_usd")} type="number" step="any" min={preview.totalReservationUsd} className={field} value={maxCost} onChange={(e) => setMaxCost(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={scriptOk} onChange={(e) => setScriptOk(e.target.checked)} />{rt("robustness.i_reviewed_this_exact_script_input_list_and_all_specifications")}</label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} />{rt("robustness.i_authorize_uploading_these_files_and_executing_this_code_remotely")}</label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={costOk} onChange={(e) => setCostOk(e.target.checked)} />{rt("robustness.i_approve_the_estimated_commitment_and_understand_it_is_not")}</label>
        {preview.warnings.length > 0 && <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={unknownOk} onChange={(e) => setUnknownOk(e.target.checked)} />{rt("robustness.i_acknowledge_that_some_original_plan_dataset_identities_were_unverified")}</label>}
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !configured || !scriptOk || !remoteOk || !costOk || (preview.warnings.length > 0 && !unknownOk) || !maxCost || !Number.isFinite(Number(maxCost)) || Number(maxCost) < preview.totalReservationUsd} onClick={async () => {
          const workflow = await post<RobustnessWorkflow>(`${preview.id}/approve`, { digest: preview.digest, approveRemote: remoteOk, reviewedScript: scriptOk, acknowledgeEstimates: costOk, acknowledgeUnverifiedPlanData: unknownOk, maxEstimatedUsd: Number(maxCost) });
          if (workflow) { setHistory((old) => [workflow, ...old.filter((w) => w.preview.id !== workflow.preview.id)]); setPreview(null); setMode("history"); }
        }}>{rt("robustness.approve_and_submit_batch")}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setPreview(null); setMode("edit"); }}>{rt("robustness.back_to_editing")}</Button></div>
      </div>}
    </DialogContent></Dialog>
  </>;
}

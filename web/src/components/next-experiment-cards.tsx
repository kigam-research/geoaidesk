"use client";
import { geoText, hasGeoText } from "@/geo/i18n";
import { memorySourceKey } from "@/lib/notebook-memory";
import type { NextExperimentBinding } from "@/lib/next-experiments";
import { API_BASE } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import { orderedExperiments, resolveExperimentSource, type NextExperimentPlan, type ExperimentSourceRef } from "@/lib/next-experiments";
const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
function Sources({ refs, projectId, sessionId, sourceDigests }: { refs: ExperimentSourceRef[]; projectId: string; sessionId: string; sourceDigests?: NextExperimentBinding["sourceDigests"] }) {
  return <span className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">{refs.map((ref, i) => {
    const source = resolveExperimentSource(ref, sessionId);
    const digest = sourceDigests?.find((s) => memorySourceKey(s.source) === memorySourceKey(source))?.digest;
    const url = `${API_BASE.replace(/\/+$/, "")}/projects/${encodeURIComponent(projectId)}/notebook/memory/record?project=${encodeURIComponent(projectId)}&source=${encodeURIComponent(JSON.stringify(source))}${digest ? `&expectedDigest=${digest}` : ""}`;
    return <a key={i} href={withApiToken(url)} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted" title={JSON.stringify(source)}>{rt("next_experiment_cards.read_source_message", { value1: i + 1, value2: valueText(source.kind) })}</a>;
  })}</span>;
}
export function NextExperimentCards({ plan, projectId, sessionId, actions, sourceDigests }: {
  plan: NextExperimentPlan; projectId: string; sessionId: string; sourceDigests?: NextExperimentBinding["sourceDigests"];
  actions?: (candidate: NextExperimentPlan["experiments"][number]) => React.ReactNode;
}) {
  return <div className="space-y-3 [overflow-wrap:anywhere]">
    <p className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs">{rt("next_experiment_cards.notice")}</p>
    <p className="text-sm font-semibold">{plan.question}</p>
    <p className="text-xs"><strong>{rt("next_experiment_cards.decision_to_inform")}</strong> {plan.decision}</p>
    <p className="text-xs"><strong>{rt("next_experiment_cards.existing_data_assessment")}</strong> {plan.existingDataAssessment}</p>
    <div className="grid gap-2 sm:grid-cols-2">{plan.explanations.map((e) => <section key={e.id} className="space-y-1 rounded border p-2 text-xs"><h4 className="font-semibold">{rt("next_experiment_cards.competing_explanation_message", { value1: e.label })}</h4><p>{e.description}</p><Sources refs={e.sources} projectId={projectId} sessionId={sessionId} sourceDigests={sourceDigests} /></section>)}</div>
    <p className="text-[11px] text-muted-foreground">{rt("next_experiment_cards.suggested_order_is_qualitative_prerequisites_appear_before_follow_ups_equal")}</p>
    {orderedExperiments(plan).map((e) => <section key={e.id} className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">{e.title}</h4><span className="rounded border px-1.5 py-0.5 text-[10px]">{rt("next_experiment_cards.qualitative_message", { value1: valueText(e.priority) })}</span><span className="rounded border px-1.5 py-0.5 text-[10px]">{valueText(e.kind)}</span></div>
      <p className="text-xs">{e.rationale}</p>
      {e.dependsOn.length > 0 && <p className="text-xs"><strong>{rt("next_experiment_cards.prerequisites")}</strong> {e.dependsOn.map((id) => plan.experiments.find((p) => p.id === id)?.title ?? id).join("; ")}</p>}
      <p className="text-xs"><strong>{rt("next_experiment_cards.proposed_method")}</strong> {e.method}</p><p className="text-xs"><strong>{rt("next_experiment_cards.measurement")}</strong> {e.measurement}</p>
      <div className="text-xs"><strong>{rt("next_experiment_cards.controls")}</strong><ul className="list-disc pl-4">{e.controls.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      <div className="overflow-x-auto rounded border"><table className="w-full min-w-[440px] text-left text-xs"><thead><tr className="border-b bg-muted/30"><th className="p-2">{rt("next_experiment_cards.if_this_explanation_were_true")}</th><th className="p-2">{rt("next_experiment_cards.predicted_outcome_not_observed_evidence")}</th></tr></thead><tbody>{e.predictions.map((p) => <tr key={p.explanationId} className="border-b last:border-0"><td className="p-2 align-top">{plan.explanations.find((x) => x.id === p.explanationId)?.label ?? p.explanationId}</td><td className="p-2">{p.expectedOutcome}</td></tr>)}</tbody></table></div>
      <div className="overflow-x-auto rounded border"><table className="w-full min-w-[440px] text-left text-xs"><thead><tr className="border-b bg-muted/30"><th className="p-2">{rt("next_experiment_cards.if_subsequently_observed")}</th><th className="p-2">{rt("next_experiment_cards.decision_consequence")}</th></tr></thead><tbody>{e.decisionBranches.map((b, i) => <tr key={i} className="border-b last:border-0"><td className="p-2 align-top">{b.outcome}</td><td className="p-2">{b.decisionChange}</td></tr>)}</tbody></table></div>
      <p className="text-xs"><strong>{rt("next_experiment_cards.if_inconclusive")}</strong> {e.inconclusiveAction}</p>
      <div className="text-xs"><strong>{rt("next_experiment_cards.required_inputs_availability_not_verified")}</strong><ul className="list-disc pl-4">{e.requiredInputs.map((v, i) => <li key={i}>{v}</li>)}</ul></div>
      <p className="text-xs"><strong>{rt("next_experiment_cards.resources")}</strong> {e.resources}</p>
      <div className="grid gap-2 text-xs sm:grid-cols-2"><p><strong>{rt("next_experiment_cards.time_effort_message", { value1: valueText(e.time.level) })}</strong><br />{e.time.rationale}</p><p><strong>{rt("next_experiment_cards.cost_effort_message", { value1: valueText(e.cost.level) })}</strong><br />{e.cost.rationale}</p></div>
      {e.whyNewData && <p className="rounded border border-amber-500/30 p-2 text-xs"><strong>{rt("next_experiment_cards.why_new_data_are_necessary")}</strong> {e.whyNewData}</p>}
      <div className="text-xs"><strong>{rt("next_experiment_cards.what_this_would_not_establish_limitations")}</strong><ul className="list-disc pl-4">{e.limitations.map((v, i) => <li key={i}>{v}</li>)}</ul></div>
      <Sources refs={e.sources} projectId={projectId} sessionId={sessionId} sourceDigests={sourceDigests} />
      {actions?.(e)}
    </section>)}
  </div>;
}

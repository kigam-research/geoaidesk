"use client";
import { geoText, geoLocale, hasGeoText } from "@/geo/i18n";
import { useEffect, useRef, useState } from "react";
import { BrainIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, API_BASE } from "@/lib/projects";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { MEMORY_KINDS, MEMORY_OUTCOMES, MEMORY_RULES, memoryCitation, memorySourceKey, type MemoryHit, type MemoryKind, type MemorySource, type MemorySearchResponse, type MemoryRecordResponse } from "@/lib/notebook-memory";
import type { NotebookOutcome } from "@/lib/notebook-evidence-core";

const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
const field = "w-full rounded-md border bg-background px-2 py-1.5 text-xs";
function Qualifiers({ hit }: { hit: MemoryHit }) {
  return <div className="space-y-1 text-xs">
    <div className="flex flex-wrap gap-1.5"><span className="rounded border px-1.5 py-0.5">{valueText(hit.type)}</span><span className={hit.recordStatus === "active" ? "rounded border px-1.5 py-0.5" : "rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5"}>{hit.recordStatus === "active" ? rt("memory.no_recorded_amendment") : valueText(hit.recordStatus)}</span>{hit.artifactHealth.some((c) => c.status === "changed" || c.status === "missing") && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5">{rt("memory.needs_artifact_review")}</span>}{(hit.artifactHealth.some((c) => c.status === "unverified") || hit.artifactsUnchecked > 0) && <span className="rounded border px-1.5 py-0.5">{rt("memory.unverified_artifact_checks")}</span>}{hit.outcome && <span className="rounded border px-1.5 py-0.5">{rt("memory.outcome_message", { value1: valueText(hit.outcome) })}</span>}{hit.evidenceStatus && <span className="rounded border px-1.5 py-0.5">{hit.evidenceStatus === "unknown" ? rt("memory.evidence_status_incomplete") : rt(`memory.evidence.${hit.evidenceStatus}`)}</span>}</div>
    {hit.scope && <p><strong>{rt("memory.applies_to")}</strong> {hit.scope}</p>}
    {hit.revisitWhen && <p><strong>{rt("memory.revisit_when")}</strong> {hit.revisitWhen}</p>}
    {hit.limitations.length > 0 && <ul className="list-disc pl-4">{hit.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul>}
    <ul className="space-y-1 text-muted-foreground">{hit.qualifiers.map((text, i) => <li key={i}>{text}</li>)}</ul>
  </div>;
}
function contextText(result: MemorySearchResponse): string {
  const hits = result.hits.map((h) => ({ source: h.source, digest: h.digest, title: h.title.slice(0, 300), type: h.type, recordStatus: h.recordStatus, outcome: h.outcome,
    scope: h.scope?.slice(0, 400), scopeTruncated: (h.scope?.length ?? 0) > 400, revisitWhen: h.revisitWhen?.slice(0, 400), revisitWhenTruncated: (h.revisitWhen?.length ?? 0) > 400,
    limitations: h.limitations.slice(0, 4).map((s) => s.slice(0, 500)), limitationsOmitted: Math.max(0, h.limitations.length - 4), limitationTextTruncated: h.limitations.some((s) => s.length > 500), excerpt: h.excerpt.slice(0, 500), excerptBounded: true,
    qualifiers: h.qualifiers, related: h.related.slice(0, 2),
    artifactChecks: { changed: h.artifactHealth.filter((c) => c.status === "changed").length, missing: h.artifactHealth.filter((c) => c.status === "missing").length, unverified: h.artifactHealth.filter((c) => c.status === "unverified").length, unchecked: h.artifactsUnchecked },
  }));
  const payload = { rules: MEMORY_RULES, checkedAt: result.checkedAt, coverage: result.coverage, query: result.query, hits, omittedHits: 0 };
  while (new TextEncoder().encode(JSON.stringify(payload, null, 2)).length > 16 * 1024 && hits.length) { hits.pop(); payload.omittedHits++; }
  if (!hits.length && result.hits.length) return JSON.stringify({ rules: MEMORY_RULES, checkedAt: result.checkedAt, source: result.hits[0].source, expectedDigest: result.hits[0].digest, warning: "Record metadata did not fit this context bundle. Read this source with notebook_search; no recalled finding is included here." }, null, 2);
  return JSON.stringify(payload, null, 2);
}
interface NotebookMemoryProps {
  projectId: string;
  activeSessionId?: string | null;
  onJump: (source: MemorySource) => void;
  onOpenFile: (path: string) => void;
}
export function NotebookMemoryDialog(props: NotebookMemoryProps) {
  return <MemoryDialog key={props.projectId} {...props} />;
}
function MemoryDialog({ projectId, activeSessionId, onJump, onOpenFile }: NotebookMemoryProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MemoryKind | "">("");
  const [outcome, setOutcome] = useState<NotebookOutcome | "">("");
  const [includeSuperseded, setIncludeSuperseded] = useState(true);
  const [result, setResult] = useState<MemorySearchResponse | null>(null);
  const [record, setRecord] = useState<MemoryRecordResponse | null>(null);
  const [busy, setBusy] = useState(false); const [reading, setReading] = useState(false);
  const [error, setError] = useState(""); const [readError, setReadError] = useState("");
  const searchRequest = useRef<AbortController | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const sourcePanel = useRef<HTMLElement | null>(null);
  const sourceError = useRef<HTMLParagraphElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const target = record ? sourcePanel.current : readError ? sourceError.current : null;
    target?.scrollIntoView?.({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
  }, [record, readError, reducedMotion]);
  useEffect(() => () => { epoch.current++; searchRequest.current?.abort(); readRequest.current?.abort(); }, [projectId]);
  function close(value: boolean) {
    setOpen(value);
    if (!value) { epoch.current++; searchRequest.current?.abort(); readRequest.current?.abort(); setBusy(false); setReading(false); }
  }
  async function search() {
    searchRequest.current?.abort(); readRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    const version = ++epoch.current;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setBusy(true); setError(""); setRecord(null); setReadError(""); setReading(false);
    try {
      const response = await apiFetch(`/projects/${encodeURIComponent(projectId)}/notebook/memory/search`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, limit: 8, ...(type ? { type } : {}), ...(outcome ? { outcome } : {}), includeSuperseded }) }, projectId);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? rt("memory.research_memory_search_failed"));
      if (data.projectId !== projectId || !Array.isArray(data.hits)) throw new Error(rt("memory.research_memory_response_did_not_match_the_requested_project"));
      if (version === epoch.current) setResult(data);
    } catch (e) { if (version === epoch.current) { setResult(null); setError(controller.signal.aborted ? rt("memory.memory_search_timed_out_do_not_infer_absence_of_prior") : (e as Error).message); } }
    finally { clearTimeout(timeout); if (version === epoch.current) setBusy(false); }
  }
  async function read(source: MemorySource, digest?: string) {
    readRequest.current?.abort();
    const controller = new AbortController(); readRequest.current = controller;
    const version = epoch.current;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setReading(true); setReadError(""); setRecord(null);
    try {
      const url = `/projects/${encodeURIComponent(projectId)}/notebook/memory/record?source=${encodeURIComponent(JSON.stringify(source))}${digest ? `&expectedDigest=${digest}` : ""}`;
      const response = await apiFetch(url, { signal: controller.signal, cache: "no-store" }, projectId);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? rt("memory.source_could_not_be_loaded"));
      if (data.projectId !== projectId || !data.hit?.source || memorySourceKey(data.hit.source) !== memorySourceKey(source)) throw new Error(rt("memory.memory_source_response_did_not_match_the_requested_record"));
      if (version === epoch.current && readRequest.current === controller) setRecord(data);
    } catch (e) { if (version === epoch.current && readRequest.current === controller) setReadError(controller.signal.aborted ? rt("memory.source_lookup_timed_out_inspect_the_original_notebook") : (e as Error).message); }
    finally { clearTimeout(timeout); if (version === epoch.current && readRequest.current === controller) setReading(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success(rt("memory.source_linked_recall_copied_review_it_before_using_it_in")); }
    catch { toast.error(rt("memory.clipboard_unavailable_read_the_source_in_the_notebook_instead")); }
  }
  function jump(source: MemorySource) { close(false); onJump(source); }
  const canJump = (source: MemorySource) => source.kind !== "user-note" || source.sessionId === activeSessionId;
  return <>
    <Button variant="outline" size="xs" onClick={() => setOpen(true)}><BrainIcon data-icon="inline-start" />{rt("memory.research_memory")}</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent className="min-w-0 max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto [overflow-wrap:anywhere] sm:max-w-4xl">
      <DialogHeader><DialogTitle>{rt("memory.project_research_memory")}</DialogTitle><DialogDescription>{rt("memory.search_saved_records_across_chats_results_are_source_excerpts_not")}</DialogDescription></DialogHeader>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <label className="block text-xs">{rt("memory.scientific_query")}<input aria-label={rt("memory.scientific_memory_query")} className={field} maxLength={500} placeholder={rt("memory.method_dataset_failed_approach_or_decision")} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">{rt("memory.record_type")}<select aria-label={rt("memory.memory_record_type")} className={field} value={type} onChange={(e) => setType(e.target.value as MemoryKind | "")}><option value="">{rt("memory.all_record_types")}</option>{MEMORY_KINDS.map((t) => <option key={t} value={t}>{valueText(t)}</option>)}</select></label><label className="text-xs">{rt("memory.recorded_outcome")}<select aria-label={rt("memory.memory_outcome")} className={field} value={outcome} onChange={(e) => setOutcome(e.target.value as NotebookOutcome | "")}><option value="">{rt("memory.all_outcomes")}</option>{MEMORY_OUTCOMES.map((t) => <option key={t} value={t}>{valueText(t)}</option>)}</select></label></div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={includeSuperseded} onChange={(e) => setIncludeSuperseded(e.target.checked)} />{rt("memory.include_superseded_historical_records_with_their_warnings")}</label>
        <p className="text-[11px] text-muted-foreground">{rt("memory.outcome_filters_use_explicit_recorded_labels_older_unlabeled_failures_null")}</p>
        <Button size="sm" type="submit" disabled={busy || (!query.trim() && !type && !outcome)}>{busy ? rt("memory.searching") : rt("memory.search_memory")}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result && <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p>{rt("memory.of_message", { value1: result.hits.length, value2: result.totalMatches, value3: result.query || rt("memory.submitted_filters"), value4: new Date(result.checkedAt).toLocaleString(geoLocale()) })}</p>{result.hits.length > 0 && <Button variant="outline" size="xs" disabled={busy} onClick={() => copy(contextText(result))}>{rt("memory.copy_bounded_recall_for_chat")}</Button>}</div>
        {!result.coverage.complete && <div role="alert" className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs"><strong>{rt("memory.incomplete_recall_coverage")}</strong> {rt("memory.do_not_infer_absence_or_currentness_from_this_scan")}<ul className="list-disc pl-4">{result.coverage.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
        {result.hits.length === 0 && <p>{rt("memory.no_matching_indexed_records_this_does_not_prove_the_work")}</p>}
        {result.hits.map((hit) => <article key={memorySourceKey(hit.source)} className="space-y-2 rounded border p-3">
          <h3 className="text-sm font-semibold">{hit.title}</h3>
          <p className="text-[11px] text-muted-foreground">{rt("memory.recorded_author_message", { value1: hit.author, value2: hit.source.sessionId, value3: new Date(hit.timestamp).toLocaleString(geoLocale()) })}</p>
          <Qualifiers hit={hit} />
          <p className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">{hit.excerpt}</p>
          <p className="text-[10px] text-muted-foreground">{rt("memory.matched_message", { value1: hit.matchedFields.map(valueText).join(", "), value2: hit.excerptTruncated ? rt("memory.excerpt_not_full") : rt("memory.source_excerpt") })}</p>
          <div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={busy || reading} onClick={() => read(hit.source, hit.digest)}>{reading ? rt("memory.reading") : rt("memory.read_source")}</Button><Button size="xs" variant="ghost" disabled={busy} onClick={() => copy(memoryCitation({ ...hit, sourceUri: `${API_BASE.replace(/\/+$/, "")}${hit.sourceUri}` }))}>{rt("memory.copy_citation")}</Button>{canJump(hit.source) && <Button size="xs" variant="ghost" onClick={() => jump(hit.source)}>{hit.source.kind === "plan-event" ? rt("memory.view_hypothesis_in_notebook") : rt("memory.view_in_notebook")}</Button>}</div>
        </article>)}
      </section>}
      {reading && <p role="status" className="text-xs">{rt("memory.reading_the_exact_saved_source")}</p>}
      {readError && <p ref={sourceError} role="alert" className="text-sm text-destructive">{readError}</p>}
      {record && <section ref={sourcePanel} className="space-y-3 rounded border-2 p-3">
        <h3 className="text-sm font-semibold">{rt("memory.source_record_message", { value1: record.hit.title })}</h3>
        {record.changedSinceSearch && <p role="alert" className="rounded border border-amber-500/40 p-2 text-xs">{rt("memory.source_changed_since_the_search_this_is_the_current_record")}</p>}
        {record.truncated && <p className="text-xs">{rt("memory.this_source_view_is_bounded_inspect_the_original_notebook_for")}</p>}
        <Qualifiers hit={record.hit} />
        <p className="break-all text-[10px] text-muted-foreground">{rt("memory.source_digest_message", { value1: record.hit.digest })}</p>
        {record.entry.confidence && <p className="text-xs">{rt("memory.author_confidence_message", { value1: valueText(record.entry.confidence) })}</p>}
        <p className="text-[10px] text-muted-foreground">{rt("memory.plain_text_source_view_embedded_markup_is_not_activated_journal")}</p>
        {record.entry.body && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 text-xs">{record.entry.body}</pre>}
        {record.entry.code && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 text-[11px]">{record.entry.code.source}</pre>}
        {record.hit.artifactHealth.length > 0 && <div className="space-y-1 text-xs"><strong>{rt("memory.direct_artifact_checks_not_scientific_verification")}</strong>{record.hit.artifactHealth.map((c) => <p key={c.path}><button type="button" className="underline decoration-dotted" onClick={() => onOpenFile(c.path)}>{c.path}</button>: {valueText(c.status)} — {c.reason} {rt("memory.checked_376")} {new Date(c.checkedAt).toLocaleString(geoLocale())}.</p>)}</div>}
        {record.hit.related.length > 0 && <div className="space-y-1 text-xs"><strong>{rt("memory.related_records")}</strong>{record.hit.related.map((r, i) => <p key={i}><button type="button" className="text-left underline decoration-dotted" disabled={reading} onClick={() => read(r.source, r.digest)}>{valueText(r.relation)}: {r.title}</button></p>)}</div>}
        {canJump(record.hit.source) && <Button size="xs" variant="outline" onClick={() => jump(record.hit.source)}>{rt("memory.open_original_notebook")}</Button>}
      </section>}
    </DialogContent></Dialog>
  </>;
}

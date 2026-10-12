"use client";
import { geoText, geoLocale, hasGeoText } from "@/geo/i18n";
import { useEffect, useRef, useState } from "react";
import { PackageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/projects";
import { type EvidenceRoot, type EvidencePackagePreview, type EvidenceStorage } from "@/lib/evidence-packages";
export interface EvidenceCandidate extends EvidenceRoot { title: string; type: string }
interface Props { projectId: string; candidates: EvidenceCandidate[]; initialRoot?: EvidenceRoot }
interface PackageList { packages: { id: string; title: string; createdAt: number; bytes: number; issues: number; available: boolean }[]; errors: string[]; storage?: EvidenceStorage }
const key = (r: EvidenceRoot) => JSON.stringify([r.sessionId, r.entryId]);
const bytes = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / (1024 * 1024)).toFixed(2)} MiB`;
const rt = geoText("research");
const valueText = (value: string) => hasGeoText(`research.values.${value}`) ? rt(`values.${value}`) : value;
const field = "w-full rounded-md border bg-background px-2 py-1.5 text-xs";
export function EvidencePackageDialog(props: Props) { return <PackageDialog key={props.projectId + (props.initialRoot ? key(props.initialRoot) : "")} {...props} />; }
function PackageDialog({ projectId, candidates, initialRoot }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"select" | "review" | "storage">("select");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialRoot ? [key(initialRoot)] : []));
  const [title, setTitle] = useState(rt("evidence_package.reviewer_evidence_package"));
  const [filter, setFilter] = useState("");
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [includeArgs, setIncludeArgs] = useState(false);
  const [preview, setPreview] = useState<EvidencePackagePreview | null>(null);
  const [list, setList] = useState<PackageList | null>(null);
  const [sensitive, setSensitive] = useState(false); const [limits, setLimits] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null); const [prune, setPrune] = useState(false);
  const generation = useRef(0); const request = useRef<AbortController | null>(null);
  const base = `/projects/${encodeURIComponent(projectId)}/notebook/evidence-packages`;
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  const all = new Map(candidates.map((c) => [key(c), c]));
  async function call<T>(suffix = "", body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T | undefined> {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const version = ++generation.current; const timer = setTimeout(() => controller.abort(), 120_000);
    setBusy(true); setError("");
    try {
      const res = await apiFetch(base + suffix, { method, signal: controller.signal, cache: "no-store", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }, projectId);
      const data = await res.json(); if (!res.ok) throw new Error(data.detail ?? rt("evidence_package.evidence_package_operation_failed"));
      if (version === generation.current) return data as T;
    } catch (e) { if (version === generation.current) setError(controller.signal.aborted ? rt("evidence_package.request_timed_out_a_prepared_package_may_still_exist_check") : (e as Error).message); }
    finally { clearTimeout(timer); if (version === generation.current) setBusy(false); }
  }
  async function refreshStorage() { const value = await call<PackageList>(); if (value) { setList(value); setMode("storage"); } }
  async function download() {
    if (!preview || !sensitive || !limits) return;
    const controller = new AbortController(); request.current = controller; const version = ++generation.current;
    const timer = setTimeout(() => controller.abort(), 120_000); setBusy(true); setError("");
    try {
      const response = await apiFetch(`${base}/${preview.id}/download`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digest: preview.digest, acknowledgeSensitive: sensitive, acknowledgeLimitations: limits }) }, projectId);
      if (!response.ok) { const data = await response.json(); throw new Error(data.detail ?? rt("evidence_package.package_download_failed")); }
      if (response.headers.get("X-Content-SHA256") !== preview.zipSha256) throw new Error(rt("evidence_package.download_identity_did_not_match_the_reviewed_package"));
      const blob = await response.blob();
      if (blob.size !== preview.zipBytes) throw new Error(rt("evidence_package.downloaded_package_size_did_not_match_its_reviewed_manifest"));
      if (!globalThis.crypto?.subtle) throw new Error(rt("evidence_package.browser_checksum_verification_is_unavailable_open_kady_on_localhost_or"));
      const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
      const actual = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (actual !== preview.zipSha256) throw new Error(rt("evidence_package.downloaded_bytes_failed_the_reviewed_zip_checksum_nothing_was_saved"));
      if (version !== generation.current) return;
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `evidence-${preview.id}.zip`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success(rt("evidence_package.evidence_package_downloaded_integrity_checks_do_not_establish_scientific_reproducibility"));
    } catch (e) { if (version === generation.current) setError((e as Error).message); }
    finally { clearTimeout(timer); if (version === generation.current) setBusy(false); }
  }
  return <>
    <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)}><PackageIcon data-icon="inline-start" />{rt("evidence_package.evidence_package")}</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}><DialogContent className="min-w-0 max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto [overflow-wrap:anywhere] sm:max-w-4xl">
      <DialogHeader><DialogTitle>{rt("evidence_package.reviewer_evidence_package")}</DialogTitle><DialogDescription>{rt("evidence_package.notice")}</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={busy} onClick={() => setMode("select")}>{rt("evidence_package.select_evidence")}</Button><Button size="xs" variant="outline" disabled={busy} onClick={refreshStorage}>{rt("evidence_package.saved_packages_storage")}</Button>{busy && <span role="status" className="text-xs">{rt("evidence_package.working_locally")}</span>}</div>
      {error && <p role="alert" className="rounded border border-destructive/30 p-2 text-sm text-destructive">{error}</p>}
      {mode === "select" && <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const roots = [...selected].map((k) => all.get(k)).filter((r): r is EvidenceCandidate => !!r).map(({ sessionId, entryId }) => ({ sessionId, entryId }));
        const p = await call<EvidencePackagePreview>("/prepare", { title, roots, includeArtifacts, includeCurrentUnverified: includeCurrent, includeCommandArguments: includeArgs });
        if (p) { if (p.projectId !== projectId) { setError(rt("evidence_package.package_belongs_to_a_different_project")); return; } setPreview(p); setSensitive(false); setLimits(false); setMode("review"); }
      }}>
        <label className="block text-xs">{rt("evidence_package.package_title")}<input aria-label={rt("evidence_package.package_title")} className={field} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <p className="text-xs">{rt("evidence_package.choose_1_8_roots_supporting_challenging_links_and_amendments_are")}</p>
        <input aria-label={rt("evidence_package.filter_package_roots")} className={field} placeholder={rt("evidence_package.filter_roots_by_title")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="max-h-56 space-y-1 overflow-y-auto rounded border p-2">
          {[...all].filter(([, c]) => c.title.toLowerCase().includes(filter.toLowerCase())).slice(0, 200).map(([id, c]) => <label key={id} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={selected.has(id)} disabled={!selected.has(id) && selected.size >= 8} onChange={(e) => setSelected((old) => { const next = new Set(old); if (e.target.checked) next.add(id); else next.delete(id); return next; })} /><span>{c.title} <span className="text-muted-foreground">{rt("evidence_package.chat_message", { value1: valueText(c.type), value2: c.sessionId })}</span></span></label>)}
          {all.size === 0 && <p className="text-xs">{rt("evidence_package.no_saved_notebook_roots_are_available_in_this_view")}</p>}
        </div>
        <p className="text-[11px] text-muted-foreground">{rt("evidence_package.selected_root_picker_shows_up_to_200_matches_narrow_the_message", { value1: selected.size })}</p>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={includeArtifacts} onChange={(e) => setIncludeArtifacts(e.target.checked)} />{rt("evidence_package.include_artifact_bytes_and_retain_local_version_snapshots_up_to")}</label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={includeCurrent} disabled={!includeArtifacts} onChange={(e) => setIncludeCurrent(e.target.checked)} />{rt("evidence_package.allow_current_unverified_comparison_copies_when_original_identities_cannot_be")}</label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={includeArgs} onChange={(e) => setIncludeArgs(e.target.checked)} />{rt("evidence_package.include_raw_recorded_provenance_arguments_may_contain_sensitive_command_parameters")}</label>
        <p className="rounded border border-amber-500/30 p-2 text-xs">{rt("evidence_package.preparation_retains_local_snapshots_and_a_frozen_zip_it_does")}</p>
        <Button type="submit" size="sm" disabled={busy || !selected.size || selected.size > 8}>{rt("evidence_package.prepare_review_package")}</Button>
      </form>}
      {mode === "review" && preview && <div className="space-y-3">
        <h3 className="text-sm font-semibold">{preview.manifest.title}</h3>
        <p className="text-xs">{rt("evidence_package.source_records_message", { value1: preview.manifest.records.length, value2: preview.manifest.artifacts.filter((a) => a.archivePath).length, value3: bytes(preview.zipBytes), value4: new Date(preview.createdAt).toLocaleString(geoLocale()) })}</p>
        <p className="rounded border border-amber-500/40 p-2 text-xs"><strong>{rt("evidence_package.not_reproduced")}</strong> {rt("evidence_package.this_frozen_package_will_not_refresh_itself_when_the_project")}</p>
        <details><summary className="cursor-pointer text-xs font-medium">{rt("evidence_package.included_sources_and_metadata")}</summary><ul className="space-y-1 text-xs">{preview.manifest.records.map((r) => <li key={r.key}>{valueText(r.selection)}: {r.title} · {valueText(r.status)} · {r.source.sessionId}/{r.source.entryId}</li>)}</ul><ul className="mt-2 text-[11px]">{preview.manifest.metadataFiles.map((f) => <li key={f}>{f}</li>)}</ul></details>
        <div className="overflow-x-auto rounded border"><table className="w-full min-w-[680px] text-left text-xs"><thead><tr className="border-b bg-muted/30"><th className="p-2">{rt("evidence_package.artifact_version_basis")}</th><th className="p-2">{rt("evidence_package.package_status")}</th><th className="p-2">{rt("evidence_package.identity_origin")}</th></tr></thead><tbody>{preview.manifest.artifacts.map((a) => <tr key={a.id} className="border-b align-top last:border-0"><td className="max-w-64 p-2 break-all">{a.path}<p className="text-muted-foreground">{valueText(a.basis)}</p></td><td className="max-w-64 p-2">{valueText(a.status)}<p>{a.reason}</p></td><td className="max-w-72 p-2 break-all"><p>{rt("evidence_package.expected_message", { value1: a.expectedSha256 ?? rt("evidence_package.not_recorded") })}</p><p>{rt("evidence_package.packaged_message", { value1: a.sha256 ?? valueText("none") })}</p>{a.origin && <p>{valueText(a.origin)} · {bytes(a.size ?? 0)}</p>}</td></tr>)}</tbody></table></div>
        <p className="text-[10px] text-muted-foreground">{rt("evidence_package.the_version_table_scrolls_horizontally_on_narrow_screens_current_unverified")}</p>
        <details open className="rounded border p-2"><summary className="cursor-pointer text-xs font-semibold">{rt("evidence_package.missing_unverified_information_message", { value1: preview.manifest.issues.length })}</summary><ul className="mt-2 max-h-52 list-disc overflow-y-auto pl-4 text-xs">{preview.manifest.issues.map((i, n) => <li key={n}><strong>{i.code}</strong>{i.subject ? ` (${i.subject})` : ""}: {i.message}</li>)}</ul></details>
        <details><summary className="cursor-pointer text-xs">{rt("evidence_package.checksum_inventory")}</summary><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all p-2 text-[10px]">{preview.files.map((f) => `${f.sha256}  ${f.path}`).join("\n")}</pre></details>
        <p className="break-all text-[10px]">{rt("evidence_package.zip_sha256_message", { value1: preview.zipSha256 })}</p>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} />{rt("evidence_package.i_reviewed_the_selected_contents_and_will_check_sensitive_data")}</label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={limits} onChange={(e) => setLimits(e.target.checked)} />{rt("evidence_package.i_understand_the_listed_gaps_unverified_versions_and_that_packaging")}</label>
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !sensitive || !limits} onClick={download}>{rt("evidence_package.download_reviewed_zip")}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => setMode("select")}>{rt("evidence_package.prepare_a_different_snapshot")}</Button></div>
        <p className="text-[11px] text-muted-foreground">{rt("evidence_package.after_extraction_optionally_run")} <code>python3 -I verify.py</code> {rt("evidence_package.to_check_file_hashes_only_no_analysis_runs_automatically_reproduction")}</p>
      </div>}
      {mode === "storage" && list && <div className="space-y-3">
        {list.storage && <p className="text-xs">{rt("evidence_package.snapshots_message", { value1: bytes(list.storage.snapshotsBytes), value2: bytes(list.storage.snapshotsLimitBytes), value3: bytes(list.storage.packagesBytes), value4: bytes(list.storage.packagesLimitBytes), value5: list.storage.packageCount, value6: list.storage.packageLimit })}</p>}
        {list.errors.map((e, i) => <p key={i} role="alert" className="text-xs text-destructive">{e}</p>)}
        {list.packages.map((p) => <div key={p.id} className="space-y-1 rounded border p-2 text-xs"><p className="font-medium">{p.title}</p><p>{rt("evidence_package.notices_message", { value1: p.id, value2: bytes(p.bytes), value3: p.issues })}</p><div className="flex flex-wrap gap-2"><Button size="xs" variant="outline" disabled={busy || !p.available} onClick={async () => { const full = await call<EvidencePackagePreview>(`/${p.id}`); if (full) { setPreview(full); setSensitive(false); setLimits(false); setMode("review"); } }}>{rt("evidence_package.review_saved_package")}</Button><Button size="xs" variant="ghost" disabled={busy} onClick={() => setDeleteId(p.id)}>{rt("evidence_package.remove_package")}</Button></div>
          {deleteId === p.id && <div className="rounded border border-amber-500/30 p-2"><p>{rt("evidence_package.remove_this_frozen_zip_and_its_payload_shared_historical_snapshots")}</p><Button size="xs" disabled={busy} onClick={async () => { const result = await call(`/${p.id}`, undefined, "DELETE"); if (result) { setDeleteId(null); await refreshStorage(); } }}>{rt("evidence_package.confirm_removal")}</Button></div>}
        </div>)}
        {!list.packages.length && <p className="text-xs">{rt("evidence_package.no_saved_evidence_packages")}</p>}
        <div className="rounded border border-amber-500/40 p-2 text-xs"><label className="flex items-start gap-2"><input type="checkbox" checked={prune} onChange={(e) => setPrune(e.target.checked)} />{rt("evidence_package.i_understand_pruning_removes_historical_byte_versions_not_referenced_by")}</label><Button className="mt-2" variant="outline" size="xs" disabled={busy || !prune} onClick={async () => { const result = await call("/prune-snapshots", { confirmed: true }); if (result) { setPrune(false); await refreshStorage(); } }}>{rt("evidence_package.prune_unreferenced_snapshots")}</Button></div>
      </div>}
    </DialogContent></Dialog>
  </>;
}

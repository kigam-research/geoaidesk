"use client";
import { useEffect, useState } from "react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { apiFetch, API_BASE, getActiveProjectId } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";
import type { DepthManifest, DepthWindow, DepthWindowRequest } from "../../contracts/depth";
import type { GeoInspection } from "../../contracts/inspection";
import { parseDepthManifest } from "../../contracts/depth";
import { DepthTracks, FLAG_STYLE } from "./tracks";
import { depthText as t } from "./strings";
const button = "rounded border px-2 py-1 disabled:opacity-40";
async function post<T>(url: string, body: unknown, projectId: string | undefined, signal: AbortSignal): Promise<T> {
  const res = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, projectId);
  const out = await res.json();
  if (!res.ok) throw new Error(out.detail ?? t("failed"));
  return out as T;
}
export default function DepthViewer(props: ViewerProps) { return <Viewer key={`${props.projectId}:${props.path}`} {...props} />; }
function Viewer(props: ViewerProps) {
  const isManifest = props.path.toLowerCase().endsWith(".depth.json");
  const [manifest, setManifest] = useState<DepthManifest | null>(null);
  const [data, setData] = useState<DepthWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tracks" | "inventory" | "rows" | "metadata">("tracks");
  const [request, setRequest] = useState<Omit<DepthWindowRequest, "path">>({ mode: "display" });
  const [rangeError, setRangeError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [row, setRow] = useState("1");
  useEffect(() => {
    const ac = new AbortController(); let live = true;
    const timer = setTimeout(() => ac.abort(), 40_000);
    setError(null); setData(null);
    (async () => {
      const m = isManifest ? parseDepthManifest(await post("/geo/depth-result", { path: props.path }, props.projectId, ac.signal)) : null;
      const q = { ...request, path: m?.dataPath ?? props.path, columns: request.columns ?? m?.curves.map(c => c.column) };
      if (m?.sourceRow && request.mode === "rows" && !request.startRow) q.startRow = m.sourceRow;
      const inspection = await post<GeoInspection>("/geo/inspect", { path: q.path, previewRows: 0 }, props.projectId, ac.signal);
      if (inspection.asset?.format !== "las") throw new Error(t("failed"));
      const out = await post<DepthWindow>("/geo/series-window", q, props.projectId, ac.signal);
      if (m && (m.depth.unit !== (out.depth.unit ?? "") || m.curves.some(c => out.curves[c.column]?.unit !== c.unit) || m.flags.some(f => f.toRow > out.sourceRows || (f.column !== undefined && !out.curves[f.column])) || (m.sourceRow !== undefined && m.sourceRow > out.sourceRows))) throw new Error(t("mismatch"));
      if (live) { setManifest(m); setData(out); }
    })().catch(e => { if (live) setError(e instanceof Error ? e.message : t("failed")); }).finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); ac.abort(); };
  }, [props.path, props.projectId, request, retry, isManifest]);
  const openRow = (n: number) => { setRow(String(n)); setTab("rows"); setRequest(r => ({ columns: r.columns, mode: "rows", startRow: n, limit: 100 })); };
  const selectTab = (next: typeof tab) => { setTab(next); if (next === "rows") setRequest(r => ({ ...r, mode: "rows", limit: 100 })); else if (next === "tracks") setRequest(r => ({ ...r, mode: "display", limit: 1200, startRow: 1 })); };
  const download = (path: string) => withApiToken(`${API_BASE}/sandbox/download?path=${encodeURIComponent(path)}&project=${encodeURIComponent(props.projectId ?? getActiveProjectId())}`);
  if (error) return <div role="alert" className="space-y-2 p-4 text-sm"><p>{t("failed")}</p><p>{error}</p><button className={button} onClick={() => { props.onRetry?.(); setRetry(r => r + 1); }}>{t("retry")}</button></div>;
  if (!data) return <div role="status" className="p-4">{t("loading")}</div>;
  const flags = manifest?.flags ?? [];
  return <div className="h-full overflow-auto space-y-4 p-4 text-sm" data-testid="depth-viewer">
    <header className="space-y-1"><h3 className="font-semibold">{data.well || props.name}{data.run && ` · ${data.run}`}</h3><p>{t("source")}: {data.path}</p><p>{t("basis")}: {data.depth.basis === "unknown" ? t("unknown") : data.depth.basis} · {t("datum")}: {data.depth.datum || t("unknown")} · {t("unit")}: {data.depth.unit || t("unknown")} · {t("direction")}: {t(data.depth.direction)}</p>{manifest && <p>{t(manifest.status)} · {t("manifestBasis")}: {manifest.depth.basis === "unknown" ? t("unknown") : manifest.depth.basis} · {manifest.depth.datum || t("unknown")}</p>}</header>
    <nav aria-label={t("tracks")} className="flex flex-wrap gap-2">{(["tracks", "inventory", "rows", "metadata"] as const).map(k => <button className={button} aria-pressed={tab === k} key={k} onClick={() => selectTab(k)}>{t(k)}</button>)}</nav>
    <p>{t("sampling", { total: data.sourceRows, matched: data.matchedRows, shown: data.displayedRows })}</p>
    {data.truncated && <p role="status">{t("truncated")}</p>}
    {tab === "tracks" && <>
      <fieldset className="flex flex-wrap gap-3"><legend>{t("choose")}</legend>{data.curves.slice(1).map(c => <label key={c.column}><input type="checkbox" checked={data.selectedColumns.includes(c.column)} disabled={!data.selectedColumns.includes(c.column) && data.selectedColumns.length >= 8} onChange={e => { const cols = e.target.checked ? [...data.selectedColumns, c.column] : data.selectedColumns.filter(v => v !== c.column); if (cols.length) setRequest(r => ({ ...r, columns: cols })); }} /> {c.mnemonic}</label>)}</fieldset>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (min !== "" && max !== "" && Number(min) > Number(max)) { setRangeError(true); return; } setRangeError(false); setRequest(r => ({ ...r, startRow: 1, minDepth: min === "" ? undefined : Number(min), maxDepth: max === "" ? undefined : Number(max) })); }}><label>{t("min")} [{data.depth.unit || t("unknown")}]<input className="block w-32 border bg-transparent p-1" type="number" step="any" value={min} onChange={e => setMin(e.target.value)} /></label><label>{t("max")}<input className="block w-32 border bg-transparent p-1" type="number" step="any" value={max} onChange={e => setMax(e.target.value)} /></label><button className={button}>{t("apply")}</button></form>
      {rangeError && <p role="alert">{t("invalidWindow")}</p>}
      {data.sampled && <p>{t("reduction")}</p>}<DepthTracks data={data} flags={flags} onRow={openRow} />
    </>}
    {tab === "inventory" && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{["column", "curve", "unit", "description", "coverage", "null"].map(k => <th key={k} className="p-2">{t(k as "column")}</th>)}</tr></thead><tbody>{data.curves.map(c => <tr key={c.column}><td>{c.column}</td><td>{c.mnemonic}{c.mnemonic !== c.originalMnemonic && ` (${c.originalMnemonic})`}</td><td>{c.unit || t("unknown")}</td><td>{c.description}</td><td>{c.finiteCount} / {data.sourceRows}</td><td>{c.nullCount}</td></tr>)}</tbody></table></div>}
    {tab === "rows" && <><p>{t("exact")}</p><form className="flex gap-2" onSubmit={e => { e.preventDefault(); openRow(Number(row)); }}><label>{t("row")} <input aria-label={t("row")} className="w-28 border bg-transparent p-1" type="number" min={1} max={data.sourceRows} value={row} onChange={e => setRow(e.target.value)} /></label><button className={button}>{t("go")}</button></form><div className="overflow-x-auto"><table className="w-full text-left font-mono text-xs"><thead><tr><th>{t("row")}</th><th>{data.depth.mnemonic} [{data.depth.unit || t("unknown")}]</th>{data.selectedColumns.map(c => <th key={c}>{data.curves[c].mnemonic} [{data.curves[c].unit || t("unknown")}]</th>)}</tr></thead><tbody>{data.rows.map(r => <tr key={r.row} id={`source-row-${r.row}`} data-source-row={r.row} className={r.row === Number(row) ? "bg-blue-500/15" : ""}><th className="border p-1">{r.row}</th><td className="border p-1">{r.depth ?? "∅"}</td>{r.values.map((v, j) => <td className="border p-1" key={j}>{v ?? "∅"}</td>)}</tr>)}</tbody></table></div><button className={button} disabled={(request.startRow ?? 1) <= 1} onClick={() => openRow(Math.max(1, (request.startRow ?? 1) - 100))}>{t("previous")}</button> <button className={button} disabled={data.nextRow === null} onClick={() => openRow(data.nextRow!)}>{t("next")}</button></>}
    {tab === "metadata" && <><p>{t("version")}: {data.version} · {t("sentinel")}: {data.nullValue ?? t("unknown")}</p><p>{t("method")}: {data.method}</p><ul className="list-disc pl-5">{data.issues.map((i, n) => <li key={n}><code>{i.code}</code>: {i.message}</li>)}</ul></>}
    <section className="space-y-2"><h4 className="font-semibold">{t("flags")}</h4><p>{flags.length ? t("candidate") : t("noFlags")}</p><ul>{flags.map((f, i) => <li key={i}><button className="text-left underline" onClick={() => openRow(f.fromRow)}><span style={{ color: FLAG_STYLE[f.kind].color }}>{FLAG_STYLE[f.kind].mark}</span> {t(f.kind)} · {t("row")} {f.fromRow}–{f.toRow}{f.column !== undefined && ` · ${data.curves[f.column]?.mnemonic}`}{f.label && ` · ${f.label}`}</button></li>)}</ul></section>
    {manifest?.sourceRow && <button className={button} onClick={() => openRow(manifest.sourceRow!)}>{t("selected")} {manifest.sourceRow}</button>}
    {manifest?.limitations.length ? <section><h4>{t("limitations")}</h4><ul>{manifest.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></section> : null}
    <footer className="flex gap-4"><a className="underline" href={download(data.path)}>{t("readSource")}</a>{manifest?.codePath && <a className="underline" href={download(manifest.codePath)}>{t("readCode")}</a>}</footer>
  </div>;
}

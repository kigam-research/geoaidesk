"use client";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { apiFetch } from "@/lib/projects";
import { GEO_INSPECTION_SCHEMA, type GeoCrs, type GeoInspection, type GeoExtent } from "../contracts/inspection";
import { inspectionText as t } from "./strings";
const ImagingViewer = lazy(() => import("@/components/viewers/imaging-viewer"));
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-2"><h3 className="font-semibold">{title}</h3>{children}</section>; }
function Crs({ value }: { value?: GeoCrs }) { return <p>{t("crs")}: {t(value?.status ?? "unknown")}{value?.authority && ` · ${value.authority}`}{value?.name && ` · ${value.name}`}{value?.axisUnits && ` · ${value.axisUnits}`}</p>; }
function Extent({ value }: { value?: GeoExtent }) { return value ? <p>{t("extent")}: {value.bbox?.join(", ") ?? t("unknown")} · {t("coordinateSpace")}: {t(value.coordinateSpace === "crs" ? "crsSpace" : value.coordinateSpace)}</p> : null; }
export default function GeoInspectionViewer(props: ViewerProps) {
  // A project/file switch unmounts old metadata, including any delayed response from the previous project.
  return <Inspection key={`${props.projectId ?? "active"}:${props.path}`} {...props} />;
}
function Inspection(props: ViewerProps) {
  const { path, projectId } = props;
  const [inspection, setInspection] = useState<GeoInspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    let live = true;
    setError(null); setInspection(null);
    apiFetch("/geo/inspect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, previewRows: 8 }), signal: ac.signal }, projectId)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail ?? t("genericError"));
        if (body.schemaVersion !== GEO_INSPECTION_SCHEMA || !body.asset || !Array.isArray(body.issues)) throw new Error(t("genericError"));
        if (live) setInspection(body);
      })
      .catch(err => { if (live) setError(err instanceof Error ? err.message : t("genericError")); })
      .finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); ac.abort(); };
  }, [path, projectId, retry]);
  if (error) return <div role="alert" className="p-4 text-sm"><p>{t("failed")}</p><p>{error}</p><button className="mt-2 rounded border px-3 py-1" onClick={() => { props.onRetry?.(); setRetry(n => n + 1); }}>{t("retry")}</button></div>;
  if (!inspection) return <div role="status" className="p-4 text-sm text-muted-foreground">{t("loading")}</div>;
  const i = inspection;
  const issues = i.issues.length ? <Section title={t("issues")}><ul className="list-disc pl-5">{i.issues.map((issue, n) => <li key={n}><code>{issue.code}</code>: {issue.message}{issue.requiredInput && ` · ${issue.requiredInput}`}</li>)}</ul></Section> : null;
  if (i.asset.format === "tiff") return <div className="flex h-full flex-col"><p className="p-3 text-xs text-muted-foreground">{t("imaging")}</p>{issues}<Suspense fallback={<div role="status">{t("loading")}</div>}><ImagingViewer {...props} /></Suspense></div>;
  return <div className="h-full space-y-4 overflow-auto p-4 text-sm" data-testid="geo-inspection">
    <Section title={props.name}><p>{t("format")}: {i.asset.format} · {t("size")}: {t("bytes", { size: i.asset.sizeBytes })}</p><Crs value={i.crs} /><Extent value={i.extent} /></Section>
    {i.dimensions?.length ? <Section title={t("dimensions")}>{i.dimensions.map(d => <p key={d.name}>{d.name}: {d.size} {d.unit}</p>)}</Section> : null}
    {i.layers?.length ? <Section title={t("layers")}>{i.layers.map((l, n) => <div key={n} className="space-y-1 rounded border p-2"><p>{l.name} · {l.geometryType} · {t("count")}: {l.featureCount ?? t("unknown")}</p><Crs value={l.crs} /><Extent value={l.extent} /><p>{t("fields")}: {l.fields?.map(f => `${f.name} (${f.type})`).join(", ") || t("unknown")}</p></div>)}</Section> : null}
    {i.bands?.length ? <Section title={t("bands")}>{i.bands.map(b => <p key={b.index}>{b.index}: {b.dtype ?? t("unknown")} · {t("nodata")}: {b.nodata ?? t("unknown")}{b.unit && ` · ${b.unit}`}{b.description && ` · ${b.description}`}{b.min !== undefined && ` · min=${b.min}`}{b.max !== undefined && ` · max=${b.max}`}</p>)}</Section> : null}
    {i.depth && <Section title={t("depth")}><p>{t("basis")}: {i.depth.basis === "unknown" ? t("unknown") : i.depth.basis} · {t("datum")}: {i.depth.datum ?? t("unknown")} · {t("unit")}: {i.depth.unit ?? t("unknown")}</p><p>{t("start")}: {i.depth.start ?? t("unknown")} · {t("stop")}: {i.depth.stop ?? t("unknown")} · {t("step")}: {i.depth.step ?? t("unknown")}</p></Section>}
    {i.curveInventory?.length ? <Section title={t("curves")}><table className="w-full text-left"><thead><tr><th>{t("curves")}</th><th>{t("unit")}</th><th>{t("description")}</th></tr></thead><tbody>{i.curveInventory.map((c, n) => <tr key={n}><td>{c.mnemonic}</td><td>{c.unit ?? t("unknown")}</td><td>{c.description}</td></tr>)}</tbody></table></Section> : null}
    {i.columns?.length ? <Section title={t("columns")}><p>{i.columns.map(c => `${c.name}${c.unit ? ` [${c.unit}]` : ""}${c.type ? ` (${c.type})` : ""}`).join(", ")}</p></Section> : null}
    {i.missingCompanions?.length ? <Section title={t("missing")}><ul>{i.missingCompanions.map(p => <li key={p}>{p}</li>)}</ul></Section> : null}
    {issues}
    {i.preview && <Section title={t("preview")}><p>{t("sampled")}: {t(i.preview.sampled ? "yes" : "no")} · {t("truncated")}: {t(i.preview.truncated ? "yes" : "no")}</p>{i.preview.method && <p>{t("method")}: {i.preview.method}</p>}{i.preview.sourceRows !== undefined && <p>{t("sourceRows")}: {i.preview.sourceRows}</p>}<p>{t("rows")}: {i.preview.displayedRows ?? i.preview.rows?.length ?? 0}</p>{i.preview.rows?.length ? <div className="overflow-x-auto"><table className="w-full text-left font-mono text-xs"><tbody>{i.preview.rows.map((r, n) => <tr key={n}>{r.map((v, j) => <td className="border px-2 py-1" key={j}>{v === null ? t("nodata") : String(v)}</td>)}</tr>)}</tbody></table></div> : null}{i.preview.headerLines?.length ? <details><summary>{t("headers")}</summary><pre className="overflow-x-auto whitespace-pre-wrap text-xs">{i.preview.headerLines.join("\n")}</pre></details> : null}</Section>}
    <Section title={t("sources")}><ul>{i.asset.sourceFiles.map(p => <li key={p}>{p}</li>)}</ul></Section>
    <footer className="text-xs text-muted-foreground">{t("inspector")}: {i.inspector.name}@{i.inspector.version}<p>{t("fingerprint")}</p></footer>
  </div>;
}

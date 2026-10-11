"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { GEO_INSPECTION_SCHEMA, type GeoInspection } from "../../contracts/inspection";
import type { MapManifest, MapManifestResponse, MapSource } from "../../contracts/maps";
import { buildRequest, canOverlay, createLayer, displayCrs, hasCrs, isVector, sampledPixel, sourceCrs, VECTOR_LIMIT, type LayerState, type MapData, type Viewport } from "./model";
import { mapPost } from "./client";
import { layerLegend } from "./colors";
import MapCanvas, { type CanvasHandle } from "./map-canvas";
import AreaPanel from "./area-panel";
import { mapText as t } from "./strings";
const InspectionViewer = lazy(() => import("../inspection-viewer"));
const button = "rounded border px-2 py-1 disabled:opacity-40";
const input = "rounded border bg-background p-1";
const textValue = (value: unknown) => value == null ? t("nodata") : typeof value === "object" ? JSON.stringify(value) : String(value);
function validateInspection(i: GeoInspection): GeoInspection {
  if (i.schemaVersion !== GEO_INSPECTION_SCHEMA || !i.asset || !Array.isArray(i.issues)) throw new Error(t("requestError"));
  return i;
}
export default function MapViewer(props: ViewerProps) {
  // A new project/file owns a fresh request graph; late responses cannot enter it.
  return <Workspace key={`${props.projectId ?? "active"}:${props.path}`} {...props} />;
}
function Workspace(props: ViewerProps) {
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [activeId, setActiveId] = useState("");
  const [manifest, setManifest] = useState<MapManifest>();
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pathToAdd, setPathToAdd] = useState("");
  const [adding, setAdding] = useState(false);
  const [viewport, setViewport] = useState<Viewport>();
  const [displayTarget, setDisplayTarget] = useState("EPSG:3857");
  const [fitVersion, setFitVersion] = useState(0);
  const [colorFields, setColorFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<{ layerId: string; row: number }>();
  const [pixel, setPixel] = useState("");
  const [exporting, setExporting] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const sequence = useRef(0);
  const overlayRequest = useRef<AbortController | null>(null);
  const active = layers.find(l => l.id === activeId) ?? layers[0];
  const crs = layers.some(l => !hasCrs(sourceCrs(l))) ? "native" : displayTarget;
  const fields = active ? active.inspection.layers?.find(l => l.name === active.source.layer)?.fields?.map(f => f.name) ?? (active.data?.kind === "vector" ? active.data.fields : []) : [];
  const data = active?.data;
  const update = (id: string, patch: Partial<LayerState>) => setLayers(current => current.map(l => l.id === id ? { ...l, ...patch } : l));
  useEffect(() => {
    const ac = new AbortController();
    setReady(false); setError(""); setLayers([]); setManifest(undefined); setFallback(false); setViewport(undefined); setSelected(undefined); setPixel("");
    async function load() {
      try {
        let initial: LayerState[];
        if (props.path.toLowerCase().endsWith(".geomap.json")) {
          const result = await mapPost<MapManifestResponse>("/geo/result", { path: props.path }, props.projectId, ac.signal);
          if (ac.signal.aborted) return;
          if (result.manifest?.kind !== "map-layer" || !result.manifest.layers.length) throw new Error(t("invalidManifest"));
          initial = result.manifest.layers.map((source, n) => {
            const inspection = result.inspections.find(i => i.asset.path === source.path);
            if (!inspection) throw new Error(t("invalidManifest"));
            return createLayer(String(n), validateInspection(inspection), source, source);
          });
          if (initial.length > 1 && initial.some(l => !hasCrs(sourceCrs(l)))) throw new Error(t("overlayBlocked"));
          setManifest(result.manifest);
        } else {
          const inspection = validateInspection(await mapPost<GeoInspection>("/geo/inspect", { path: props.path, previewRows: 8 }, props.projectId, ac.signal));
          if (ac.signal.aborted) return;
          if (inspection.asset.format === "tiff" || !["vector", "raster", "grid"].includes(inspection.asset.family)) { setFallback(true); setReady(true); return; }
          initial = [createLayer("0", inspection)];
        }
        if (ac.signal.aborted) return;
        setColorFields(Object.fromEntries(initial.filter(l => l.source.variable).map(l => [l.id, l.source.variable!])));
        sequence.current = initial.length; setDisplayTarget(displayCrs(initial[0]) === "native" ? "EPSG:3857" : displayCrs(initial[0])); setLayers(initial); setActiveId(initial[0].id); setReady(true);
      } catch (e) { if (!ac.signal.aborted) { setError(e instanceof Error ? e.message : t("requestError")); setReady(true); } }
    }
    void load();
    return () => { ac.abort(); overlayRequest.current?.abort(); };
  }, [props.path, props.projectId, retry]);
  // Exclude response/loading/opacity/style fields: responses must not recursively fetch.
  const queryKey = JSON.stringify(layers.map(l => ({ id: l.id, source: l.source, visible: l.visible, offset: l.offset, family: l.inspection.asset.family })));
  useEffect(() => {
    const ac = new AbortController();
    const requests = JSON.parse(queryKey) as { id: string; source: MapSource; visible: boolean; offset: number; family: string }[];
    setSelected(undefined); setPixel("");
    for (const request of requests.filter(l => l.visible)) {
      const layer = layers.find(l => l.id === request.id)!;
      update(layer.id, { loading: true, data: undefined, error: undefined });
      void mapPost<MapData>(isVector(layer) ? "/geo/vector-page" : "/geo/raster-window", buildRequest(layer, crs, viewport), props.projectId, ac.signal)
        .then(result => {
          if (ac.signal.aborted) return;
          if ((isVector(layer) && result.kind !== "vector") || (!isVector(layer) && result.kind !== "raster")) throw new Error(t("requestError"));
          update(layer.id, { loading: false, data: result });
        }).catch(e => { if (!ac.signal.aborted) update(layer.id, { loading: false, data: undefined, error: e instanceof Error ? e.message : t("requestError") }); });
    }
    return () => ac.abort();
    // `layers` intentionally excluded: queryKey is the request identity, not responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, crs, viewport, props.projectId]);
  async function addLayer() {
    if (!pathToAdd.trim()) return;
    overlayRequest.current?.abort(); const ac = new AbortController(); overlayRequest.current = ac;
    setAdding(true); setError("");
    try {
      const inspection = validateInspection(await mapPost<GeoInspection>("/geo/inspect", { path: pathToAdd.trim() }, props.projectId, ac.signal));
      if (ac.signal.aborted) return;
      if (inspection.asset.format === "tiff") throw new Error(t("addTiff"));
      if (!["vector", "raster", "grid"].includes(inspection.asset.family)) throw new Error(t("requestError"));
      const next = createLayer(String(sequence.current++), inspection);
      // Recheck current state inside setter, since layers may change during inspection.
      setLayers(current => {
        if (!canOverlay(current, next)) { setError(t("overlayBlocked")); return current; }
        return [...current, next];
      });
      setPathToAdd("");
    } catch (e) { if (!ac.signal.aborted) setError(e instanceof Error ? e.message : t("requestError")); }
    finally { if (!ac.signal.aborted) setAdding(false); }
  }
  function changeSource(patch: Partial<MapSource>) {
    if (!active) return;
    const candidate = { ...active, source: { ...active.source, ...patch } };
    if (layers.length > 1 && !hasCrs(sourceCrs(candidate))) { setError(t("overlayBlocked")); return; }
    setError(""); update(active.id, { source: candidate.source, data: undefined, offset: 0 });
    setSelected(undefined); setPixel("");
    if (patch.layer !== undefined) { setViewport(undefined); setFitVersion(n => n + 1); }
  }
  function moveLayer(id: string, direction: number) {
    setLayers(current => {
      const copy = [...current]; const index = copy.findIndex(l => l.id === id); const next = index + direction;
      if (next < 0 || next >= copy.length) return current;
      [copy[index], copy[next]] = [copy[next], copy[index]]; return copy;
    });
  }
  function onViewport(next: Viewport) {
    setViewport(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    setLayers(current => current.map(l => l.offset ? { ...l, offset: 0 } : l));
  }
  if (!ready) return <p role="status" className="p-4">{t("loading")}</p>;
  if (fallback) return <Suspense fallback={<p>{t("loading")}</p>}><InspectionViewer {...props} /></Suspense>;
  const selectedFeature = selected ? layers.find(l => l.id === selected.layerId)?.data : undefined;
  const properties = selectedFeature?.kind === "vector" ? selectedFeature.features.features[selected!.row]?.properties : undefined;
  return <div className="h-full space-y-3 overflow-auto p-3 text-sm" data-testid="geo-map-viewer">
    <h2 className="font-semibold">{manifest?.title ?? props.name}</h2>
    <p>{t("subset")}</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { props.onRetry?.(); setRetry(n => n + 1); }}>{t("retry")}</button><button className={button} disabled={!data} onClick={() => canvas.current?.fit()}>{t("fit")}</button><button className={button} disabled={exporting || !layers.some(l => l.visible && l.data) || layers.some(l => l.visible && l.loading)} onClick={async () => { setExporting(true); try { await canvas.current?.exportPng(); } catch (e) { setError(e instanceof Error ? e.message : t("pngError")); } finally { setExporting(false); } }}>{t("downloadPng")}</button></div>
    <p className="text-xs text-muted-foreground">{t("figureNotice")}</p>
    <MapCanvas ref={canvas} layers={layers} activeId={active?.id ?? ""} crs={crs} fitVersion={fitVersion} fields={colorFields} selected={selected} onViewport={onViewport} onError={setError} onPick={(layerId, row) => { setActiveId(layerId); setSelected({ layerId, row }); }} onCoordinate={coordinate => {
      if (data?.kind !== "raster") return;
      const value = sampledPixel(data, coordinate[0], coordinate[1]);
      setPixel(value ? t("sampledPixel", { row: value.row, col: value.col, value: value.value ?? t("nodata") }) : t("outsidePixel"));
    }} />
    <section className="space-y-2" aria-label={t("layers")}><h3 className="font-semibold">{t("layers")}</h3>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void addLayer(); }}><label>{t("addPath")} <input className={input} value={pathToAdd} onChange={e => setPathToAdd(e.target.value)} /></label><button className={button} disabled={adding || !pathToAdd.trim()}>{t("add")}</button></form>
      {layers.map((l, index) => <div className="flex flex-wrap items-center gap-2 rounded border p-2" key={l.id}>
        <button className={button} aria-pressed={active?.id === l.id} aria-label={`${t("select")}: ${l.source.path}`} onClick={() => { setActiveId(l.id); setSelected(undefined); setPixel(""); }}>{l.source.path}</button>
        <label><input type="checkbox" checked={l.visible} onChange={e => update(l.id, { visible: e.target.checked, loading: false })} /> {t("visible")}</label>
        <label>{t("opacity")} <input aria-label={`${t("opacity")}: ${l.source.path}`} type="range" min="0" max="1" step="0.05" value={l.opacity} onChange={e => update(l.id, { opacity: Number(e.target.value) })} /></label>
        <button className={button} disabled={index === 0} onClick={() => moveLayer(l.id, -1)}>{t("up")}</button><button className={button} disabled={index === layers.length - 1} onClick={() => moveLayer(l.id, 1)}>{t("down")}</button><button className={button} onClick={() => { setLayers(current => current.filter(item => item.id !== l.id)); setSelected(undefined); setPixel(""); }}>{t("remove")}</button>
        {l.loading && <span role="status">{t("loading")}</span>}{l.error && <span role="alert">{l.error}</span>}
      </div>)}
    </section>
    {active && <>
      <section className="space-y-2 rounded border p-3">
        {active.inspection.layers?.length ? <label>{t("layer")} <select className={input} value={active.source.layer ?? ""} onChange={e => changeSource({ layer: e.target.value })}>{active.inspection.layers.map(l => <option key={l.name}>{l.name}</option>)}</select></label> : null}
        {active.inspection.bands?.length ? <label>{t("band")} <select className={input} value={active.source.band} onChange={e => changeSource({ band: Number(e.target.value) })}>{active.inspection.bands.map(b => <option key={b.index} value={b.index}>{b.index}{b.description ? ` · ${b.description}` : ""}</option>)}</select></label> : null}
        {!isVector(active) && <form className="flex flex-wrap gap-2" key={active.id + active.source.layer} onSubmit={e => { e.preventDefault(); changeSource({ variable: String(new FormData(e.currentTarget).get("variable") ?? "").trim() || undefined }); }}><label>{t("variable")} <input className={input} name="variable" defaultValue={active.source.variable ?? ""} /></label><button className={button}>{t("apply")}</button></form>}
        <label><input type="checkbox" checked={!!active.source.categorical} onChange={e => changeSource({ categorical: e.target.checked })} /> {t("categorical")}</label>
        {isVector(active) && active.source.categorical && <label>{t("categoryField")} <select className={input} value={colorFields[active.id] ?? ""} onChange={e => { setColorFields(current => ({ ...current, [active.id]: e.target.value })); changeSource({ variable: e.target.value || undefined }); }}><option value="">{t("noField")}</option>{fields.map(f => <option key={f}>{f}</option>)}</select></label>}
        <p>{t("sourceCrs")}: {sourceCrs(active).authority ?? sourceCrs(active).name ?? t("unknown")} · {t(sourceCrs(active).status)}</p>
        <p>{t("displayCrs")}: {crs === "native" ? t("native") : crs}</p><p>{t("unit")}: {active.manifest?.unit ?? active.inspection.bands?.find(b => b.index === active.source.band)?.unit ?? sourceCrs(active).axisUnits ?? t("unknown")}</p><p>{t("unchanged")}</p>
        {!hasCrs(sourceCrs(active)) && <p>{t("nativeLimit")}</p>}
        {active.manifest && active.manifest.displayCrs !== crs && <p>{t("displayFallback")}</p>}
        {data && <><p>{t("extent", { crs: data.displayCrs })}: {data.bbox.join(", ")}</p><p>{t("sampling", { method: data.preview.method, sampled: t(data.preview.sampled ? "yes" : "no"), truncated: t(data.preview.truncated ? "yes" : "no") })}</p>
          {data.kind === "raster" ? <><p>{t("dimensions", { width: data.preview.width ?? data.values[0]?.length ?? 0, height: data.preview.height ?? data.values.length })}</p><p>{t("pixelHint")}</p>{pixel && <p role="status">{pixel}</p>}</> : <p>{t("featureCount", { shown: data.features.features.length, total: data.preview.totalFeatures ?? t("unknown") })}</p>}
          {data.preview.resolution && <p>{t("resolution", { resolution: data.preview.resolution })}</p>}
        </>}
        <h4>{t("legend")}</h4><ul className="max-h-48 overflow-auto">{layerLegend(active, colorFields[active.id]).map((item, n) => <li className="flex items-center gap-2" key={n}><span aria-hidden className="inline-block h-3 w-4 border" style={{ backgroundColor: item.color }} />{item.label}</li>)}<li>{t("nodata")}: {data?.nodata ?? active.manifest?.nodata ?? t("nodata")}</li></ul>
        <ul className="list-disc pl-5">{(data?.issues ?? active.inspection.issues).map((issue, n) => <li key={n}>{issue.message}{issue.requiredInput ? ` · ${issue.requiredInput}` : ""}</li>)}</ul>
      </section>
      {data?.kind === "vector" && <section aria-label={t("attributes")} className="space-y-2"><h3 className="font-semibold">{t("attributes")}</h3><p>{t("offset", { offset: active.offset })}</p><div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr>{data.fields.map(f => <th className="border p-1" key={f}>{f}</th>)}</tr></thead><tbody>{data.features.features.map((f, row) => <tr key={row} aria-selected={selected?.layerId === active.id && selected.row === row} className="cursor-pointer aria-selected:bg-muted" onClick={() => setSelected({ layerId: active.id, row })}>{data.fields.map((field, column) => <td className="border p-1" key={field}>{column === 0 ? <button className="underline" onClick={() => setSelected({ layerId: active.id, row })}>{textValue(f.properties[field])}</button> : textValue(f.properties[field])}</td>)}</tr>)}</tbody></table>{!data.features.features.length && <p>{t("empty")}</p>}</div><div className="flex gap-2"><button className={button} disabled={active.offset === 0 || active.loading} onClick={() => update(active.id, { offset: Math.max(0, active.offset - VECTOR_LIMIT) })}>{t("previous")}</button><button className={button} disabled={data.nextOffset === null || active.loading} onClick={() => update(active.id, { offset: data.nextOffset! })}>{t("next")}</button></div></section>}
      {properties && <section><h3>{t("properties")}</h3><dl>{Object.entries(properties).map(([key, value]) => <div key={key}><dt className="font-medium">{key}</dt><dd>{textValue(value)}</dd></div>)}</dl></section>}
      {isVector(active) && <AreaPanel key={`${active.id}:${active.source.layer ?? ""}`} layer={active} projectId={props.projectId} fields={fields} />}
    </>}
    {manifest && <section className="space-y-1"><h3>{t("analysis")}</h3><p>{manifest.analysis.method}</p>{manifest.analysis.tablePath && <p>{t("tablePath", { path: manifest.analysis.tablePath })}</p>}{manifest.analysis.scriptPath && <p>{t("scriptPath", { path: manifest.analysis.scriptPath })}</p>}<h4>{t("limitations")}</h4><ul>{manifest.limitations.map((limit, n) => <li key={n}>{limit}</li>)}</ul></section>}
  </div>;
}

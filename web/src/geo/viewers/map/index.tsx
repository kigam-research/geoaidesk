"use client";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";
import type { ViewerProps } from "@/lib/viewers/registry";
import { GEO_INSPECTION_SCHEMA, type GeoInspection } from "../../contracts/inspection";
import type { MapManifest, MapManifestResponse, MapSource, RasterPoint, RasterStyle, VectorPage } from "../../contracts/maps";
import { buildRequest, canOverlay, createLayer, displayCrs, hasCrs, isVector, layerView, projDefinitions, sourceCrs, styleRequest, viewCrsChoices, WEB_MERCATOR, type LayerState, type MapData, type Viewport } from "./model";
import { registerProjections } from "./view";
import { basemapAttribution, basemapLayers, DEFAULT_BASEMAP_SELECTION, useBasemapCatalog, type BasemapSelection } from "./basemaps";
import BasemapPicker, { BasemapAttributions } from "./basemaps-picker";
/** View units per pixel above which the 1:50K geology overlay is hidden (avoids hundreds of WMS requests at country scale). */
const GEOLOGY_MAX_RESOLUTION = 400;
import { mapPost } from "./client";
import MapCanvas, { type CanvasHandle } from "./map-canvas";
import AreaPanel from "./area-panel";
import AttributeTable, { textValue } from "./attribute-table";
import MapSidePanel from "./side-panel";
import { mapText as t } from "./strings";
const InspectionViewer = lazy(() => import("../inspection-viewer"));
import { MapButton, MapSelect } from "./controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const [displayTarget, setDisplayTarget] = useState(WEB_MERCATOR);
  const [fitVersion, setFitVersion] = useState(0);
  const [colorFields, setColorFields] = useState<Record<string, string>>({});
  // A selection names the response it indexes: a newer page of the same layer drops it instead of pointing at another feature.
  const [selected, setSelected] = useState<{ layerId: string; row: number; coordinate?: number[]; data?: MapData }>();
  const [pixel, setPixel] = useState<{ coordinate: number[]; text: string }>();
  const [exporting, setExporting] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const tablePane = useRef<HTMLDivElement>(null);
  const [tableFocus, setTableFocus] = useState(0);
  const sequence = useRef(0);
  const overlayRequest = useRef<AbortController | null>(null);
  const pixelRequest = useRef<AbortController | null>(null);
  const catalog = useBasemapCatalog();
  const [basemap, setBasemap] = useState<BasemapSelection>(DEFAULT_BASEMAP_SELECTION);
  const active = layers.find(l => l.id === activeId) ?? layers[0];
  const crsChoices = viewCrsChoices(layers);
  const crs = layers.some(l => !hasCrs(sourceCrs(l))) ? "native" : [...crsChoices, "EPSG:4326"].includes(displayTarget) ? displayTarget : WEB_MERCATOR;
  // Projected source CRSs become OpenLayers projections before the view uses them.
  const definitions = JSON.stringify(projDefinitions(layers));
  useMemo(() => registerProjections(JSON.parse(definitions)), [definitions]);
  // Online basemaps/overlays only with a declared CRS; "none" (default) needs no network or key.
  const backgroundLayers = useMemo(() => {
    if (crs === "native") return [];
    const built = basemapLayers(basemap, catalog.providers);
    for (const layer of built) if (layer.get("basemapId") === "kigam-geology" && crs !== "EPSG:4326") layer.setMaxResolution(GEOLOGY_MAX_RESOLUTION);
    return built;
  }, [basemap, catalog.providers, crs]);
  const attributions = crs === "native" ? [] : catalog.providers.filter(p => p.available && p.id !== "none" && (p.id === basemap.base || basemap.overlays.includes(p.id as BasemapSelection["overlays"][number]))).map(basemapAttribution);
  const select = (layerId: string, row: number, coordinate?: number[]) => { setActiveId(layerId); setPixel(undefined); setSelected({ layerId, row, coordinate, data: layers.find(l => l.id === layerId)?.data }); };
  const fields = active ? active.inspection.layers?.find(l => l.name === active.source.layer)?.fields?.map(f => f.name) ?? (active.data?.kind === "vector" ? active.data.fields : []) : [];
  const data = active?.data;
  const view = active && layerView(active);
  const update = (id: string, patch: Partial<LayerState>) => setLayers(current => current.map(l => l.id === id ? { ...l, ...patch } : l));
  useEffect(() => {
    const ac = new AbortController();
    setReady(false); setError(""); setLayers([]); setManifest(undefined); setFallback(false); setViewport(undefined); setSelected(undefined); setPixel(undefined);
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
        sequence.current = initial.length; setDisplayTarget(displayCrs(initial[0]) === "native" ? WEB_MERCATOR : displayCrs(initial[0])); setLayers(initial); setActiveId(initial[0].id); setReady(true);
      } catch (e) { if (!ac.signal.aborted) { setError(e instanceof Error ? e.message : t("requestError")); setReady(true); } }
    }
    void load();
    return () => { ac.abort(); overlayRequest.current?.abort(); };
  }, [props.path, props.projectId, retry]);
  // Exclude response/loading/opacity/style fields: responses must not recursively fetch.
  // Per layer source and view CRS: a raster loads its whole-layer style once (tiles follow),
  // a vector tries the whole layer once and falls back to viewport pages when it is too large.
  const loadKey = JSON.stringify(layers.map(l => ({ id: l.id, source: l.source, visible: l.visible, family: l.inspection.asset.family })));
  useEffect(() => {
    const ac = new AbortController();
    const requests = JSON.parse(loadKey) as { id: string; source: MapSource; visible: boolean; family: string }[];
    setSelected(undefined); setPixel(undefined);
    for (const request of requests.filter(l => l.visible)) {
      const layer = layers.find(l => l.id === request.id)!;
      const vector = isVector(layer);
      update(layer.id, { loading: true, data: undefined, style: undefined, vectorMode: undefined, offset: 0, error: undefined });
      const call = vector
        ? mapPost<VectorPage>("/geo/vector-page", buildRequest({ ...layer, vectorMode: "full" }, crs), props.projectId, ac.signal)
        : mapPost<RasterStyle>("/geo/raster-style", styleRequest(layer, crs), props.projectId, ac.signal);
      void call.then(result => {
        if (ac.signal.aborted) return;
        if (vector ? result.kind !== "vector" : result.kind !== "raster-style") throw new Error(t("requestError"));
        if (result.kind === "raster-style") update(layer.id, { loading: false, style: result });
        else if (result.full) update(layer.id, { loading: false, data: result, vectorMode: "full" });
        else update(layer.id, { loading: true, vectorMode: "viewport" });
      }).catch(e => { if (!ac.signal.aborted) update(layer.id, { loading: false, error: e instanceof Error ? e.message : t("requestError") }); });
    }
    return () => ac.abort();
    // `layers` intentionally excluded: loadKey is the request identity, not responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey, crs, props.projectId]);
  // Large vector layers only: bounded pages for the current viewport.
  const pageKey = JSON.stringify(layers.filter(l => l.visible && l.vectorMode === "viewport").map(l => ({ id: l.id, source: l.source, offset: l.offset })));
  useEffect(() => {
    const ac = new AbortController();
    for (const request of JSON.parse(pageKey) as { id: string }[]) {
      const layer = layers.find(l => l.id === request.id)!;
      update(layer.id, { loading: true, error: undefined });
      void mapPost<MapData>("/geo/vector-page", buildRequest(layer, crs, viewport), props.projectId, ac.signal)
        .then(result => {
          if (ac.signal.aborted) return;
          if (result.kind !== "vector") throw new Error(t("requestError"));
          update(layer.id, { loading: false, data: result });
        }).catch(e => { if (!ac.signal.aborted) update(layer.id, { loading: false, data: undefined, error: e instanceof Error ? e.message : t("requestError") }); });
    }
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, crs, viewport, props.projectId]);
  function readPixel(coordinate: number[]) {
    pixelRequest.current?.abort();
    setSelected(undefined); setPixel(undefined);
    if (!active?.style || active.style.displayCrs !== crs) return;
    const ac = new AbortController(); pixelRequest.current = ac;
    void mapPost<RasterPoint>("/geo/raster-point", { path: active.source.path, band: active.source.band, displayCrs: crs, coordinate }, props.projectId, ac.signal)
      .then(point => { if (!ac.signal.aborted) setPixel({ coordinate, text: point.inside ? t("sourcePixel", { row: point.row ?? 0, col: point.col ?? 0, value: point.value ?? t("nodata") }) : t("outsidePixel") }); })
      .catch(e => { if (!ac.signal.aborted) setPixel({ coordinate, text: e instanceof Error ? e.message : t("requestError") }); });
  }
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
    setSelected(undefined); setPixel(undefined);
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
    // Viewport pages restart at the first page; a whole-layer table keeps its page.
    setLayers(current => current.map(l => l.offset && l.vectorMode === "viewport" ? { ...l, offset: 0 } : l));
  }
  if (!ready) return <p role="status" className="p-4">{t("loading")}</p>;
  if (fallback) return <Suspense fallback={<p>{t("loading")}</p>}><InspectionViewer {...props} /></Suspense>;
  const selectedLayer = selected ? layers.find(l => l.id === selected.layerId) : undefined;
  const selection = selectedLayer?.data?.kind === "vector" && selectedLayer.data === selected!.data ? selected : undefined;
  const properties = selection && selectedLayer?.data?.kind === "vector" ? selectedLayer.data.features.features[selection.row]?.properties : undefined;
  const closePopup = () => { setSelected(undefined); setPixel(undefined); pixelRequest.current?.abort(); };
  const popup = properties && selectedLayer
    ? { at: "selected" as const, content: <MapPopup title={t("properties")} subtitle={t("featureIdentity", { layer: selectedLayer.source.layer ?? selectedLayer.source.path.split("/").pop() ?? "", id: selectedLayer.data?.kind === "vector" ? selectedLayer.data.features.features[selection!.row]?.id ?? selection!.row + 1 : selection!.row + 1 })} onClose={closePopup}><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">{Object.entries(properties).slice(0, 8).map(([key, value]) => <Fragment key={key}><dt className="text-muted-foreground">{key}</dt><dd className="[overflow-wrap:anywhere]">{textValue(value)}</dd></Fragment>)}</dl><MapButton variant="ghost" className="mt-2 w-full" onClick={() => { setTableFocus(n => n + 1); tablePane.current?.querySelector<HTMLElement>('[data-map-table-scroller]')?.focus(); }}>{t("allAttributes")}</MapButton></MapPopup> }
    : pixel ? { at: pixel.coordinate, content: <MapPopup title={t("pixelTitle")} subtitle={active?.source.path ?? ""} onClose={closePopup}><p role="status">{pixel.text}</p></MapPopup> } : undefined;
  return <div className="gaid-map-workspace flex h-full min-h-0 flex-col bg-gaid-face text-sm text-gaid-ink" data-testid="geo-map-viewer">
    <header className="flex shrink-0 items-center gap-2 border-b border-gaid-edge bg-gaid-chrome px-3 py-2">
      <h2 className="mr-auto min-w-0 truncate font-semibold" title={manifest?.title ?? props.name}>{manifest?.title ?? props.name}</h2>
      <MapButton title={t("figureNotice")} disabled={exporting || !layers.some(l => l.visible && layerView(l)) || layers.some(l => l.visible && l.loading)} onClick={async () => { setExporting(true); try { await canvas.current?.exportPng(); } catch (e) { setError(e instanceof Error ? e.message : t("pngError")); } finally { setExporting(false); } }}>{t("downloadPng")}</MapButton>
      <DropdownMenu><DropdownMenuTrigger asChild><MapButton className="size-7 p-0" aria-label={t("more")}><MoreHorizontal aria-hidden className="size-4" /></MapButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { props.onRetry?.(); setRetry(n => n + 1); }}>{t("retry")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </header>
    <div role="group" aria-label={t("mapDisplay")} className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-gaid-edge bg-gaid-chrome px-3 py-2 text-xs">
      {crs !== "native" ? <label className="flex min-w-0 items-center gap-2">{t("displayCrs")} <MapSelect aria-label={t("displayCrs")} className="max-w-56" value={crs} onChange={value => { setDisplayTarget(value); setViewport(undefined); }}>{[...new Set([...crsChoices, crs])].map(code => <option key={code} value={code}>{code === WEB_MERCATOR ? t("webMercator") : t("crsOption", { crs: code })}</option>)}</MapSelect></label> : <span>{t("native")}</span>}
      <BasemapPicker providers={catalog.providers} value={basemap} onChange={setBasemap} disabled={crs === "native"} />
    </div>
    {error && <div role="alert" className="shrink-0 px-3 py-1 text-xs text-gaid-danger">{t("requestError")}<details><summary>{t("technical")}</summary><p>{error}</p></details></div>}
    {catalog.error && <details className="shrink-0 px-3 text-xs"><summary>{t("basemapStatus")}</summary>{catalog.error}</details>}
    <div className="gaid-map-body min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="relative min-h-40 min-w-0 flex-1">
          <MapCanvas ref={canvas} layers={layers} activeId={active?.id ?? ""} crs={crs} projectId={props.projectId} backgroundLayers={backgroundLayers} attributions={attributions} fitVersion={fitVersion} fields={colorFields} selected={selection} popup={popup} onViewport={onViewport} onError={setError} onPick={select} onCoordinate={readPixel} onClosePopup={closePopup} />
          <BasemapAttributions providers={catalog.providers} value={basemap} disabled={crs === "native"} className="pointer-events-auto absolute bottom-8 right-2 max-w-[70%] bg-gaid-face px-2 py-1 text-right text-xs text-gaid-ink" />
        </div>
        {active && data?.kind === "vector" && <div ref={tablePane} className="gaid-map-table-pane h-80 shrink-0 overflow-hidden border-t border-gaid-frame"><AttributeTable key={`table:${active.id}:${active.source.layer ?? ""}`} focusVersion={tableFocus} data={data} full={active.vectorMode === "full"} offset={active.offset} loading={active.loading} selectedRow={selection?.layerId === active.id ? selection.row : undefined} onSelect={row => select(active.id, row)} onOffset={offset => update(active.id, { offset })} /></div>}
      </div>
      <aside aria-label={t("panel")} className="min-h-0 overflow-auto border-l border-gaid-frame bg-gaid-face p-3">
        <MapSidePanel layers={layers} active={active} crs={crs} colorFields={colorFields} fields={fields} pathToAdd={pathToAdd} adding={adding} onPathToAdd={setPathToAdd} onAdd={() => void addLayer()}
          onSelect={id => { setActiveId(id); setSelected(undefined); setPixel(undefined); }} onUpdate={update} onMove={moveLayer}
          onRemove={id => { setLayers(current => current.filter(item => item.id !== id)); setSelected(undefined); setPixel(undefined); }}
          onSource={changeSource} onColorField={field => { if (!active) return; setColorFields(current => ({ ...current, [active.id]: field })); changeSource({ variable: field || undefined }); }} />
        {active && isVector(active) && <details className="mt-3 border-t border-gaid-edge pt-3 text-xs"><summary className="cursor-pointer font-semibold text-gaid-ink-2">{t("area")}</summary><AreaPanel key={`area:${active.id}:${active.source.layer ?? ""}`} layer={active} projectId={props.projectId} fields={fields} /></details>}
        {manifest && <details className="mt-3 border-t border-gaid-edge pt-3 text-xs"><summary className="cursor-pointer font-semibold text-gaid-ink-2">{t("analysis")}</summary><section className="space-y-2 pt-3"><p>{manifest.analysis.method}</p>{manifest.analysis.tablePath && <p className="break-all">{t("tablePath", { path: manifest.analysis.tablePath })}</p>}{manifest.analysis.scriptPath && <p className="break-all">{t("scriptPath", { path: manifest.analysis.scriptPath })}</p>}<h4>{t("limitations")}</h4><ul>{manifest.limitations.map((limit, n) => <li key={n}>{limit}</li>)}</ul></section></details>}
      </aside>
    </div>
  </div>;
}
/** Mini popup drawn on the map at the selected feature or clicked pixel. */
function MapPopup({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose(): void; children: ReactNode }) {
  return <div role="dialog" aria-label={title} className="w-72 max-w-[min(288px,60vw)] rounded-md border bg-popover text-xs text-popover-foreground shadow-lg">
    <div className="flex items-start gap-2 border-b px-2 py-1.5">
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="truncate text-muted-foreground" title={subtitle}>{subtitle}</p></div>
      <MapButton variant="ghost" className="size-7 p-0" aria-label={t("closePopup")} onClick={onClose}><X aria-hidden className="size-3.5" /></MapButton>
    </div>
    <div className="max-h-64 overflow-auto px-2 py-1.5">{children}</div>
  </div>;
}

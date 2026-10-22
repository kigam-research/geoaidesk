"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import OlMap from "ol/Map";
import Overlay from "ol/Overlay";
import ScaleLine from "ol/control/ScaleLine";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { MapButton } from "./controls";
import type Feature from "ol/Feature";
import type { Geometry, LineString, MultiPolygon, Point, Polygon } from "ol/geom";
import { containsCoordinate, getCenter } from "ol/extent";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import TileImage from "ol/source/TileImage";
import TileGrid from "ol/tilegrid/TileGrid";
import { createXYZ } from "ol/tilegrid";
import { get as getProjection } from "ol/proj";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { asArray } from "ol/color";
import type BaseLayer from "ol/layer/Base";
import type { MapBBox, RasterStyle } from "../../contracts/maps";
import type { LayerState, Viewport } from "./model";
import { fitExtent, layerView, sourceCrs, tileQuery, tileResolutions, TILE_SIZE, validBBox, WEB_MERCATOR } from "./model";
import { vectorColor, layerLegend } from "./colors";
import { downloadBlob, tileUrl } from "./client";
import { mapText as t } from "./strings";
import { createMapView } from "./view";
import "ol/ol.css";

export interface CanvasHandle { exportPng(): Promise<void>; fit(): void }
interface Props {
  layers: LayerState[]; crs: string; activeId: string; projectId?: string;
  /** Basemap/overlay layers drawn under project data (their own zIndex). */
  backgroundLayers?: BaseLayer[];
  /** Source credits of the shown basemaps; written into the exported PNG. */
  attributions?: string[];
  fitVersion: number;
  fields: Record<string, string>; selected?: { layerId: string; row: number; coordinate?: number[] };
  /** Mini popup on the map: at the selected feature (click point, else the feature's anchor) or at a clicked point. */
  popup?: { at: "selected" | number[]; content: ReactNode };
  /** A click on a feature selects it; a click elsewhere reports the coordinate (raster pixel reads, closing the popup). */
  onViewport(viewport: Viewport): void; onPick(layerId: string, row: number, coordinate: number[]): void;
  onCoordinate(coordinate: number[]): void; onError(message: string): void;
  onClosePopup?(): void;
}
const MapCanvas = forwardRef<CanvasHandle, Props>(function MapCanvas(props, ref) {
  const [cursor, setCursor] = useState<number[]>();
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const current = useRef(props);
  const fitted = useRef(false);
  useEffect(() => { current.current = props; });
  const fit = () => {
    const map = mapRef.current;
    const layer = current.current.layers.find(l => l.id === current.current.activeId);
    const view = layer && layerView(layer);
    const bbox = view?.bbox && fitExtent(view.bbox);
    if (map && bbox) map.getView().fit(bbox, { padding: [24, 24, 24, 24], ...(current.current.crs === "native" ? {} : { maxZoom: 20 }) });
  };
  useImperativeHandle(ref, () => ({ fit, async exportPng() {
    const map = mapRef.current;
    if (!map) throw new Error(t("pngError"));
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { map.un("rendercomplete", ready); reject(new Error(t("pngError"))); }, 10_000);
      function ready() { clearTimeout(timeout); resolve(); }
      map.once("rendercomplete", ready); map.renderSync();
    });
    const size = map.getSize();
    const viewportElement = map.getViewport();
    if (!size || !viewportElement) throw new Error(t("pngError"));
    const layers = current.current.layers.filter(l => l.visible && layerView(l));
    const lines = [...layers.flatMap(l => [{ label: `${l.source.path} · ${t("sourceCrs")}: ${sourceCrs(l).authority ?? sourceCrs(l).name ?? t("unknown")}`, color: "" }, ...layerLegend(l, current.current.fields[l.id])]),
      ...(current.current.attributions ?? []).map(label => ({ label, color: "" }))];
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(640, size[0]); canvas.height = size[1] + 78 + lines.length * 18;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("pngError"));
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    viewportElement.querySelectorAll<HTMLCanvasElement>(".ol-layer canvas").forEach(c => {
      if (!c.width) return;
      ctx.save(); ctx.globalAlpha = Number((c.parentElement?.style.opacity || c.style.opacity) || 1);
      const transform = c.style.transform;
      if (transform) ctx.setTransform(new DOMMatrix(transform));
      ctx.drawImage(c, 0, 0); ctx.restore();
    });
    ctx.fillStyle = "#111111"; ctx.font = "13px sans-serif";
    ctx.fillText(t("figureSubset", { crs: current.current.crs }), 12, size[1] + 22);
    ctx.fillText(t("extent", { crs: current.current.crs }) + ": " + map.getView().calculateExtent(size).map(n => n.toPrecision(7)).join(", "), 12, size[1] + 42);
    ctx.fillText(t("nodata"), 12, size[1] + 62);
    lines.forEach((line, i) => {
      if (line.color) { ctx.fillStyle = line.color; ctx.fillRect(12, size[1] + 70 + i * 18, 16, 12); }
      ctx.fillStyle = "#111111"; ctx.fillText(line.label, line.color ? 36 : 12, size[1] + 80 + i * 18);
    });
    await new Promise<void>((resolve, reject) => canvas.toBlob(blob => {
      if (!blob) { reject(new Error(t("pngError"))); return; }
      downloadBlob(blob, t("figureName")); resolve();
    }, "image/png"));
  } }));
  useEffect(() => { fitted.current = false; }, [props.fitVersion]);
  // The popup element lives outside React's tree position (OpenLayers moves it into the map); React renders into it by portal.
  const popupElement = useMemo(() => typeof document === "undefined" ? null : document.createElement("div"), []);
  const overlay = useRef<Overlay | null>(null);
  useEffect(() => {
    if (!target.current) return;
    fitted.current = false;
    const map = new OlMap({ target: target.current, controls: props.crs === "native" ? [] : [new ScaleLine({ units: "metric" })], layers: [], view: createMapView(props.crs) });
    mapRef.current = map;
    setCursor(undefined);
    map.on("pointermove", event => { if (!event.dragging) setCursor(event.coordinate.slice(0, 2)); });
    map.on("moveend", () => {
      if (!fitted.current) return;
      const size = map.getSize();
      if (!size) return;
      const bbox = map.getView().calculateExtent(size);
      if (validBBox(bbox)) current.current.onViewport({ bbox, width: size[0], height: size[1] });
    });
    map.on("singleclick", event => {
      const hit = map.forEachFeatureAtPixel(event.pixel, feature => {
        if (feature.get("_layerId") === undefined) return undefined;
        current.current.onPick(feature.get("_layerId"), feature.get("_rowIndex"), event.coordinate);
        return true;
      }, { hitTolerance: 5 });
      if (!hit) current.current.onCoordinate(event.coordinate);
    });
    if (popupElement) { overlay.current = new Overlay({ element: popupElement, stopEvent: true, offset: [0, 0] }); map.addOverlay(overlay.current); }
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target.current);
    return () => { observer.disconnect(); map.setTarget(undefined); map.dispose(); mapRef.current = null; overlay.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.crs]);
  // OpenLayers layers are kept per layer identity: a tile layer keeps its tile cache across
  // re-renders (selection, opacity, order); only a new style/CRS/data object replaces it.
  const built = useRef(new Map<string, { key: unknown; layer: BaseLayer }>());
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const keep = new Set<string>();
    const rendered: BaseLayer[] = [];
    try {
      for (const [index, layer] of props.layers.entries()) {
        if (!layer.visible) continue;
        let entry = built.current.get(layer.id);
        if (layer.style) {
          const style = layer.style;
          // Stale coordinates from a different display view are never drawn.
          if (style.displayCrs !== props.crs || !validBBox(style.bbox)) continue;
          const key = `${props.crs}|${props.projectId ?? ""}|${style.path}|${style.version}|${style.band}|${style.categorical}|${style.low}|${style.high}`;
          if (entry?.key !== key) { entry?.layer.dispose(); entry = { key, layer: rasterTileLayer(map, style, layer, props.projectId) }; }
        } else if (layer.data?.kind === "vector") {
          const data = layer.data;
          if (data.displayCrs !== props.crs || !fitExtent(data.bbox)) continue;
          if (entry?.key !== data) { entry?.layer.dispose(); entry = { key: data, layer: vectorLayer(layer.id, data, current) }; }
          else entry.layer.changed(); // selection/classification are read by the style function
        } else continue;
        built.current.set(layer.id, entry);
        keep.add(layer.id);
        entry.layer.setOpacity(layer.opacity);
        entry.layer.setZIndex(props.layers.length - index); rendered.push(entry.layer);
      }
      for (const [id, entry] of built.current) if (!keep.has(id)) { entry.layer.dispose(); built.current.delete(id); }
      map.setLayers([...(props.backgroundLayers ?? []), ...rendered]);
      if (!fitted.current && props.layers.some(l => l.id === props.activeId && layerView(l) && fitExtent(layerView(l)!.bbox))) {
        fitted.current = true; fit();
      }
    } catch { current.current.onError(t("mapError")); }
  }, [props.layers, props.crs, props.fields, props.selected, props.activeId, props.fitVersion, props.projectId, props.backgroundLayers]);
  // Popup position: a clicked point, or the selected feature's anchor (a table selection). A whole-layer
  // feature outside the view is centred first; viewport layers are not panned (that would reload their page).
  const popupAt = props.popup?.at;
  useEffect(() => {
    const map = mapRef.current; const o = overlay.current;
    if (!map || !o) return;
    let position: number[] | undefined;
    if (Array.isArray(popupAt)) position = popupAt;
    else if (popupAt === "selected" && props.selected) {
      position = props.selected.coordinate;
      if (!position) {
        const layer = props.layers.find(l => l.id === props.selected!.layerId);
        const source = (built.current.get(props.selected.layerId)?.layer as VectorLayer | undefined)?.getSource?.();
        const feature = source?.getFeatures().find(f => f.get("_rowIndex") === props.selected!.row);
        position = feature && featureAnchor(feature);
        const size = map.getSize();
        if (position && size && layer?.vectorMode === "full" && !containsCoordinate(map.getView().calculateExtent(size), position)) map.getView().setCenter(position);
      }
    }
    o.setPosition(position);
    if (!position) return;
    // Open away from the nearest map edges so the popup stays inside the map without panning it.
    const pixel = map.getPixelFromCoordinate(position); const size = map.getSize();
    const below = !pixel || !size || pixel[1] < size[1] / 2;
    const side = !pixel || !size ? "center" : pixel[0] < size[0] / 3 ? "left" : pixel[0] > (size[0] * 2) / 3 ? "right" : "center";
    o.setPositioning(`${below ? "top" : "bottom"}-${side}`);
    o.setOffset([side === "left" ? -12 : side === "right" ? 12 : 0, below ? 12 : -12]);
  }, [popupAt, props.selected, props.layers, props.crs]);
  useEffect(() => {
    if (!popupElement) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") current.current.onClosePopup?.(); };
    popupElement.addEventListener("keydown", close);
    return () => popupElement.removeEventListener("keydown", close);
  }, [popupElement]);
  useEffect(() => () => { for (const entry of built.current.values()) entry.layer.dispose(); built.current.clear(); }, [props.crs]);
  return <div className="relative h-full min-h-40 w-full bg-gaid-face-2">
    <div ref={target} role="region" aria-label={t("map")} className="h-full w-full" tabIndex={0} />
    <div className="absolute left-2 top-2 flex flex-col gap-1">
      <MapButton className="size-7 bg-gaid-face p-0" aria-label={t("zoomIn")} title={t("zoomIn")} onClick={() => { const v = mapRef.current?.getView(); if (v) v.setZoom((v.getZoom() ?? 2) + 1); }}><Plus aria-hidden className="size-4" /></MapButton>
      <MapButton className="size-7 bg-gaid-face p-0" aria-label={t("zoomOut")} title={t("zoomOut")} onClick={() => { const v = mapRef.current?.getView(); if (v) v.setZoom((v.getZoom() ?? 2) - 1); }}><Minus aria-hidden className="size-4" /></MapButton>
      <MapButton className="size-7 bg-gaid-face p-0" aria-label={t("fit")} title={t("fit")} onClick={fit}><LocateFixed aria-hidden className="size-4" /></MapButton>
    </div>
    <output aria-label={t("cursorCoordinates")} className="pointer-events-none absolute bottom-2 right-2 max-w-[70%] truncate bg-gaid-face px-2 py-1 text-xs tabular-nums text-gaid-ink-2">{cursor ? t("coordinateReadout", { crs: props.crs === "native" ? t("nativeShort") : props.crs, x: cursor[0].toFixed(props.crs === "EPSG:4326" ? 5 : 1), y: cursor[1].toFixed(props.crs === "EPSG:4326" ? 5 : 1) }) : t("coordinateHint", { crs: props.crs === "native" ? t("nativeShort") : props.crs })}</output>
    {popupElement && props.popup && createPortal(props.popup.content, popupElement)}
  </div>;
});
export default MapCanvas;

/** A point on the feature for its popup: the point itself, a polygon's interior point, a line's midpoint, else the extent centre. */
function featureAnchor(feature: Feature): number[] | undefined {
  const geometry = feature.getGeometry() as Geometry | undefined;
  if (!geometry) return undefined;
  switch (geometry.getType()) {
    case "Point": return (geometry as Point).getCoordinates();
    case "Polygon": return (geometry as Polygon).getInteriorPoint().getCoordinates().slice(0, 2);
    case "MultiPolygon": return (geometry as MultiPolygon).getInteriorPoints().getCoordinates()[0]?.slice(0, 2);
    case "LineString": return (geometry as LineString).getCoordinateAt(0.5);
    default: return getCenter(geometry.getExtent());
  }
}

/** Server-rendered display tiles on a deterministic grid: standard XYZ in Web Mercator, else one grid per layer extent. */
function rasterTileLayer(map: OlMap, style: RasterStyle, layer: LayerState, projectId?: string): BaseLayer {
  const projection = map.getView().getProjection();
  const extent = style.bbox;
  const grid = style.displayCrs === WEB_MERCATOR
    ? createXYZ({ extent: getProjection(WEB_MERCATOR)!.getExtent(), maxZoom: Math.min(24, Math.max(0, Math.ceil(Math.log2(40075016.68 / TILE_SIZE / style.resolution)) + 2)), tileSize: TILE_SIZE })
    : new TileGrid({ extent, origin: [extent[0], extent[3]], resolutions: tileResolutions(extent, style.resolution), tileSize: TILE_SIZE });
  const source = new TileImage({
    projection, tileGrid: grid, crossOrigin: "anonymous", interpolate: false, transition: 0,
    tileUrlFunction: coord => tileUrl(tileQuery(layer, style, grid.getTileCoordExtent(coord) as MapBBox), projectId),
  });
  return new TileLayer({ source, extent, preload: 1 });
}

function vectorLayer(id: string, data: Extract<NonNullable<LayerState["data"]>, { kind: "vector" }>, current: { current: Props }): BaseLayer {
  const features = new GeoJSON().readFeatures(data.features);
  features.forEach((f, row) => { f.set("_layerId", id); f.set("_rowIndex", row); });
  return new VectorLayer({ source: new VectorSource({ features }), style: feature => {
    const props = current.current;
    const layer = props.layers.find(l => l.id === id);
    const field = props.fields[id];
    const selected = props.selected?.layerId === id && props.selected.row === feature.get("_rowIndex");
    const value = feature.get(field);
    const color = layer?.source.categorical && field ? vectorColor(layer, value) : "#0072b2";
    const stroke = new Stroke({ color: selected ? "#ffcc00" : color, width: selected ? 4 : 1.5, lineDash: layer?.source.categorical && value == null && field ? [4, 4] : undefined });
    const rgba = asArray(color);
    const fill = new Fill({ color: [rgba[0], rgba[1], rgba[2], rgba[3] * 0.4] });
    return new Style({ stroke, fill, image: new Circle({ radius: selected ? 7 : 5, fill, stroke }) });
  } });
}

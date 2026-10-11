"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import OlMap from "ol/Map";
import View from "ol/View";
import Projection from "ol/proj/Projection";
import GeoJSON from "ol/format/GeoJSON";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import ImageStatic from "ol/source/ImageStatic";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { asArray } from "ol/color";
import type BaseLayer from "ol/layer/Base";
import type { LayerState, Viewport } from "./model";
import { fitExtent, sourceCrs, validBBox } from "./model";
import { vectorColor, layerLegend } from "./colors";
import { downloadBlob } from "./client";
import { mapText as t } from "./strings";
import "ol/ol.css";

export interface CanvasHandle { exportPng(): Promise<void>; fit(): void }
interface Props {
  layers: LayerState[]; crs: string; activeId: string;
  fitVersion: number;
  fields: Record<string, string>; selected?: { layerId: string; row: number };
  onViewport(viewport: Viewport): void; onPick(layerId: string, row: number): void;
  onCoordinate(coordinate: number[]): void; onError(message: string): void;
}
const MapCanvas = forwardRef<CanvasHandle, Props>(function MapCanvas(props, ref) {
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);
  const current = useRef(props);
  const fitted = useRef(false);
  useEffect(() => { current.current = props; });
  const fit = () => {
    const map = mapRef.current;
    const layer = current.current.layers.find(l => l.id === current.current.activeId);
    const bbox = layer?.data?.bbox && fitExtent(layer.data.bbox);
    if (map && bbox) map.getView().fit(bbox, { padding: [24, 24, 24, 24], maxZoom: 20 });
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
    const layers = current.current.layers.filter(l => l.visible && l.data);
    const lines = layers.flatMap(l => [{ label: `${l.source.path} · ${t("sourceCrs")}: ${sourceCrs(l).authority ?? sourceCrs(l).name ?? t("unknown")}`, color: "" }, ...layerLegend(l, current.current.fields[l.id])]);
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
  useEffect(() => {
    if (!target.current) return;
    fitted.current = false;
    const projection = props.crs === "native" ? new Projection({ code: "GAID:NATIVE", units: "pixels" }) : props.crs;
    const map = new OlMap({ target: target.current, controls: [], layers: [], view: new View({ projection, center: [0, 0], zoom: 2, multiWorld: false }) });
    mapRef.current = map;
    map.on("moveend", () => {
      if (!fitted.current) return;
      const size = map.getSize();
      if (!size) return;
      const bbox = map.getView().calculateExtent(size);
      if (validBBox(bbox)) current.current.onViewport({ bbox, width: size[0], height: size[1] });
    });
    map.on("singleclick", event => {
      current.current.onCoordinate(event.coordinate);
      map.forEachFeatureAtPixel(event.pixel, feature => {
        current.current.onPick(feature.get("_layerId"), feature.get("_rowIndex"));
        return true;
      }, { hitTolerance: 5 });
    });
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target.current);
    return () => { observer.disconnect(); map.setTarget(undefined); map.dispose(); mapRef.current = null; };
  }, [props.crs]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const rendered: BaseLayer[] = [];
    try {
      for (const [index, layer] of props.layers.entries()) {
        const data = layer.data;
        if (!data || !layer.visible) continue;
        // Stale coordinates from a different display view are never drawn.
        if (data.displayCrs !== props.crs || !fitExtent(data.bbox) || (data.kind === "raster" && !validBBox(data.bbox))) continue;
        let olLayer: BaseLayer;
        if (data.kind === "raster") {
          // Raster images are inline backend previews, never browser requests to arbitrary URLs.
          const url = data.image.startsWith("data:image/png;base64,") ? data.image : `data:image/png;base64,${data.image}`;
          olLayer = new ImageLayer({ source: new ImageStatic({ url, imageExtent: data.bbox, projection: map.getView().getProjection(), interpolate: false }), opacity: layer.opacity });
        } else {
          const features = new GeoJSON().readFeatures(data.features);
          features.forEach((f, row) => { f.set("_layerId", layer.id); f.set("_rowIndex", row); });
          const field = props.fields[layer.id];
          olLayer = new VectorLayer({ source: new VectorSource({ features }), opacity: layer.opacity, style: feature => {
            const selected = props.selected?.layerId === layer.id && props.selected.row === feature.get("_rowIndex");
            const value = feature.get(field);
            const color = layer.source.categorical && field ? vectorColor(layer, value) : "#0072b2";
            const stroke = new Stroke({ color: selected ? "#ffcc00" : color, width: selected ? 4 : 1.5, lineDash: layer.source.categorical && value == null && field ? [4, 4] : undefined });
            const rgba = asArray(color);
            const fill = new Fill({ color: [rgba[0], rgba[1], rgba[2], rgba[3] * 0.4] });
            return new Style({ stroke, fill, image: new Circle({ radius: selected ? 7 : 5, fill, stroke }) });
          } });
        }
        olLayer.setZIndex(props.layers.length - index); rendered.push(olLayer);
      }
      map.getLayers().clear(); rendered.forEach(l => map.addLayer(l));
      if (!fitted.current && props.layers.some(l => l.id === props.activeId && l.data && fitExtent(l.data.bbox))) {
        fitted.current = true; fit();
      }
    } catch { current.current.onError(t("mapError")); }
    return () => { rendered.forEach(l => { map.removeLayer(l); l.dispose(); }); };
  }, [props.layers, props.crs, props.fields, props.selected, props.activeId, props.fitVersion]);
  return <div className="relative h-[360px] min-h-[280px] w-full bg-white" style={{ backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)", backgroundSize: "16px 16px" }}>
    <div ref={target} role="region" aria-label={t("map")} className="h-full w-full" tabIndex={0} />
    <div className="absolute left-2 top-2 flex flex-col gap-1 text-black">
      <button className="rounded border bg-white px-2 py-1" aria-label={t("zoomIn")} onClick={() => { const v = mapRef.current?.getView(); if (v) v.setZoom((v.getZoom() ?? 2) + 1); }}>+</button>
      <button className="rounded border bg-white px-2 py-1" aria-label={t("zoomOut")} onClick={() => { const v = mapRef.current?.getView(); if (v) v.setZoom((v.getZoom() ?? 2) - 1); }}>−</button>
    </div>
  </div>;
});
export default MapCanvas;

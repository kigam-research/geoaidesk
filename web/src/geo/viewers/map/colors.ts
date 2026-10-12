import type { MapLegendItem } from "../../contracts/maps";
import type { LayerState } from "./model";
import { mapText as t } from "./strings";
const PALETTE = ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#d55e00", "#56b4e9", "#7b61a8", "#8c564b"];
export function classColor(value: unknown): string {
  if (value == null) return "#999999";
  const key = String(value);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return PALETTE[(hash >>> 0) % PALETTE.length];
}
export function vectorColor(layer: LayerState, value: unknown): string {
  if (value == null) return classColor(value);
  return layer.manifest?.legend.find(item => item.value === value)?.color ?? classColor(value);
}
export function layerLegend(layer: LayerState, field?: string): MapLegendItem[] {
  if (layer.data?.kind === "vector" && layer.source.categorical && field) {
    const values = [...new Set(layer.data.features.features.map(f => f.properties[field]))];
    return values.map(value => ({ label: value == null ? t("nodata") : String(value), color: vectorColor(layer, value) }));
  }
  // A manifest legend without a selected classification field is not the
  // rendered vector style. Never show it as if it described the blue symbols.
  if (layer.data?.kind === "vector") return [{ label: layer.source.layer ?? layer.source.path, color: "#0072b2" }];
  if (layer.style) {
    // Nodata is listed separately by the viewer. A continuous range is the shared colour stretch of every tile.
    const items = layer.style.legend.filter(item => item.value != null);
    if (layer.style.categorical) return items;
    return items.map((item, n) => ({ ...item, label: t(n === 0 ? "rangeLow" : "rangeHigh", { value: Number(item.value).toPrecision(6) }) }));
  }
  const legend = layer.data?.legend?.length ? layer.data.legend : layer.manifest?.legend ?? [];
  return legend;
}

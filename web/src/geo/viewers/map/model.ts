import type { GeoCrs, GeoInspection } from "../../contracts/inspection";
import type { MapAreaRequest, MapAreaTable, MapBBox, MapManifest, MapRequest, MapSource, RasterWindow, VectorPage } from "../../contracts/maps";

export type MapData = RasterWindow | VectorPage;
export interface Viewport { bbox: MapBBox; width: number; height: number }
export interface LayerState {
  id: string; source: MapSource; inspection: GeoInspection;
  visible: boolean; opacity: number; offset: number;
  data?: MapData; error?: string; loading?: boolean;
  manifest?: MapManifest["layers"][number];
}
export const VECTOR_LIMIT = 500;
export const RASTER_LIMIT = 256;
export function sourceCrs(layer: Pick<LayerState, "source" | "inspection">): GeoCrs {
  const selected = layer.inspection.layers?.find(l => l.name === layer.source.layer);
  return selected?.crs ?? layer.inspection.crs ?? { status: "unknown" };
}
export function hasCrs(crs: GeoCrs): boolean {
  return crs.status === "declared" || crs.status === "user-supplied";
}
export function isVector(layer: LayerState): boolean { return layer.inspection.asset.family === "vector"; }
export function createLayer(id: string, inspection: GeoInspection, source?: MapSource, manifest?: LayerState["manifest"]): LayerState {
  // Manifest presentation/analysis fields must never leak into the transport source.
  return { id, inspection, manifest, source: { path: source?.path ?? inspection.asset.path, layer: source?.layer ?? inspection.layers?.[0]?.name, band: source?.band ?? inspection.bands?.[0]?.index ?? 1, variable: source?.variable, categorical: source?.categorical ?? (inspection.asset.family === "vector" && !!source?.variable) }, visible: true, opacity: 1, offset: 0 };
}
/** No shared placement for undeclared coordinates, even across two unknown files. */
export function canOverlay(existing: LayerState[], candidate: LayerState): boolean {
  return existing.length === 0 || (hasCrs(sourceCrs(candidate)) && existing.every(l => hasCrs(sourceCrs(l))));
}
export function displayCrs(layer: LayerState): string {
  if (!hasCrs(sourceCrs(layer))) return "native";
  const requested = layer.manifest?.displayCrs.toUpperCase();
  return requested === "EPSG:4326" ? requested : "EPSG:3857";
}
export function validBBox(bbox: number[]): bbox is MapBBox {
  return bbox.length === 4 && bbox.every(Number.isFinite) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
}
/** Single points and horizontal/vertical lines still have a usable fit extent. */
export function fitExtent(bbox: number[]): MapBBox | null {
  if (bbox.length !== 4 || !bbox.every(Number.isFinite) || bbox[0] > bbox[2] || bbox[1] > bbox[3]) return null;
  const pad = Math.max(bbox[2] - bbox[0], bbox[3] - bbox[1], 1) * 0.05;
  return [bbox[0] === bbox[2] ? bbox[0] - pad : bbox[0], bbox[1] === bbox[3] ? bbox[1] - pad : bbox[1], bbox[0] === bbox[2] ? bbox[2] + pad : bbox[2], bbox[1] === bbox[3] ? bbox[3] + pad : bbox[3]];
}
export function buildRequest(layer: LayerState, crs: string, viewport?: Viewport): MapRequest {
  const cap = (n: number) => Math.max(1, Math.min(RASTER_LIMIT, Math.round(Number.isFinite(n) ? n : RASTER_LIMIT)));
  return { ...layer.source, displayCrs: crs,
    ...(viewport && validBBox(viewport.bbox) ? { bbox: viewport.bbox } : {}),
    ...(isVector(layer) ? { offset: layer.offset, limit: VECTOR_LIMIT } : { width: cap(viewport?.width ?? RASTER_LIMIT), height: cap(viewport?.height ?? RASTER_LIMIT) }),
  };
}
export function areaRequest(layer: LayerState, classField: string, method: string, areaCrs: string): MapAreaRequest | null {
  if (!isVector(layer) || !hasCrs(sourceCrs(layer)) || !classField || (method !== "geodesic" && method !== "projected")) return null;
  if (method === "projected" && (!/^EPSG:\d+$/i.test(areaCrs.trim()) || /^EPSG:(3857|4326)$/i.test(areaCrs.trim()))) return null;
  return { ...layer.source, classField, method, ...(method === "projected" ? { areaCrs: areaCrs.trim().toUpperCase() } : {}) };
}
export function sampledPixel(data: RasterWindow, x: number, y: number): { row: number; col: number; value: number | null } | null {
  const [left, bottom, right, top] = data.bbox;
  if (x < left || x >= right || y <= bottom || y > top || !validBBox(data.bbox)) return null;
  const row = Math.floor((top - y) / (top - bottom) * data.values.length);
  const col = Math.floor((x - left) / (right - left) * (data.values[row]?.length ?? 0));
  return data.values[row]?.[col] !== undefined ? { row, col, value: data.values[row][col] } : null;
}
export function areaCsv(table: MapAreaTable, headers: string[]): string {
  const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return "\uFEFF" + [headers, ...table.rows.map(r => [r.class, r.featureCount, r.area, r.percent])].map(row => row.map(cell).join(",")).join("\r\n");
}

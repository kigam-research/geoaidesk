import type { GeoCrs, GeoInspection } from "../../contracts/inspection";
import type { MapAreaRequest, MapAreaTable, MapBBox, MapManifest, MapRequest, MapSource, RasterStyle, RasterTileQuery, RasterWindow, VectorPage } from "../../contracts/maps";

export type MapData = RasterWindow | VectorPage;
/** What the info panel and fit read: a vector page or a raster's whole-layer style. */
export type LayerView = VectorPage | RasterStyle;
/** Vector delivery: the whole layer once (`full`), or bounded pages per viewport when it is too large. */
export type VectorMode = "full" | "viewport";
export interface Viewport { bbox: MapBBox; width: number; height: number }
export interface LayerState {
  id: string; source: MapSource; inspection: GeoInspection;
  visible: boolean; opacity: number; offset: number;
  data?: MapData; error?: string; loading?: boolean;
  /** Raster layers: display style shared by every tile (replaces per-viewport windows). */
  style?: RasterStyle;
  vectorMode?: VectorMode;
  manifest?: MapManifest["layers"][number];
}
export const VECTOR_LIMIT = 500;
export const RASTER_LIMIT = 256;
export const TILE_SIZE = 256;
export const WEB_MERCATOR = "EPSG:3857";
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
/** View CRSs a layer can offer: its projected source CRS (registered from its PROJ string), and Web Mercator. */
export function viewCrsChoices(layers: LayerState[]): string[] {
  const own = layers.map(sourceCrs).filter(c => hasCrs(c) && c.projected && c.proj4 && /^EPSG:\d+$/.test(c.authority ?? "")).map(c => c.authority!);
  return [...new Set([...own, WEB_MERCATOR])];
}
/** PROJ definitions the view needs, from the layers' declared source CRSs. */
export function projDefinitions(layers: LayerState[]): Record<string, string> {
  return Object.fromEntries(layers.map(sourceCrs).filter(c => hasCrs(c) && c.authority && c.proj4).map(c => [c.authority!, c.proj4!]));
}
/** Default view: the dataset's own projected CRS when it can be registered, else Web Mercator; unknown CRS stays native. */
export function displayCrs(layer: LayerState): string {
  const crs = sourceCrs(layer);
  if (!hasCrs(crs)) return "native";
  const requested = layer.manifest?.displayCrs.toUpperCase();
  const choices = [...viewCrsChoices([layer]), "EPSG:4326"];
  if (requested && choices.includes(requested)) return requested;
  return choices[0];
}
export function layerView(layer: LayerState): LayerView | undefined {
  return layer.style ?? (layer.data?.kind === "vector" ? layer.data : undefined);
}
/** Whole-raster style request; tiles then follow from the style. */
export function styleRequest(layer: LayerState, crs: string): MapSource & { displayCrs: string } {
  return { path: layer.source.path, band: layer.source.band, categorical: layer.source.categorical, displayCrs: crs };
}
export function tileQuery(layer: LayerState, style: RasterStyle, bbox: MapBBox): RasterTileQuery {
  return { path: style.path, band: style.band, crs: style.displayCrs, bbox, size: TILE_SIZE, v: style.version,
    ...(style.categorical ? { categorical: true } : { low: style.low ?? 0, high: style.high ?? 1 }) };
}
/** Deterministic tile resolutions for a layer extent: whole extent in one tile, halving to below the source pixel size. */
export function tileResolutions(extent: MapBBox, sourceResolution: number): number[] {
  const first = Math.max(extent[2] - extent[0], extent[3] - extent[1]) / TILE_SIZE;
  const finest = Math.max(sourceResolution / 4, first / 2 ** 30);
  const out = [first];
  while (out.at(-1)! / 2 >= finest && out.length < 31) out.push(out.at(-1)! / 2);
  return out;
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
  if (isVector(layer) && layer.vectorMode !== "viewport") return { ...layer.source, displayCrs: crs, full: true };
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
export function areaCsv(table: MapAreaTable, headers: string[]): string {
  const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return "\uFEFF" + [headers, ...table.rows.map(r => [r.class, r.featureCount, r.area, r.percent])].map(row => row.map(cell).join(",")).join("\r\n");
}

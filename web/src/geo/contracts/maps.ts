/** WP05 map transport. All paths are project sandbox relative; bounds use displayCrs. */
import type { GeoCrs, GeoInspection, GeoIssue } from "./inspection";
export type MapBBox = [number, number, number, number];
export interface MapSource { path: string; layer?: string; band?: number; variable?: string; categorical?: boolean; }
export interface MapRequest extends MapSource {
  /** Default EPSG:3857 for known CRS; native for unknown CRS. Never used for area. */
  displayCrs?: string;
  bbox?: MapBBox;
  width?: number;
  height?: number;
  offset?: number;
  limit?: number;
  /** Vector: whole layer for client-side display (no bbox; bounded features/vertices, else truncated). */
  full?: boolean;
}
export interface MapPreview {
  sampled: boolean; truncated: boolean; method: string;
  displayedFeatures?: number; totalFeatures?: number;
  width?: number; height?: number; resolution?: string;
}
export interface MapLegendItem { label: string; color: string; value?: string | number | null; }
export interface MapBase {
  path: string; layer?: string; sourceCrs: GeoCrs; displayCrs: string;
  bbox: MapBBox; issues: GeoIssue[]; preview: MapPreview;
  legend: MapLegendItem[]; nodata: number | string | null;
}
export interface MapFeature {
  type: "Feature"; id?: string | number;
  geometry: { type: string; coordinates?: unknown; geometries?: unknown[] } | null;
  properties: Record<string, unknown>;
}
export interface VectorPage extends MapBase {
  kind: "vector";
  features: { type: "FeatureCollection"; features: MapFeature[] };
  fields: string[]; nextOffset: number | null;
  /** True when this is the complete layer for client-side display (a `full` request that fit its bounds). */
  full?: boolean;
}
export interface RasterWindow extends MapBase {
  kind: "raster"; band: number; image: string;
  /** Row-major display samples; null is nodata/mask. Never use as analytical full raster. */
  values: (number | null)[][];
}
/** Whole-raster display style shared by every tile of a layer (`POST /geo/raster-style`). */
export interface RasterStyle {
  kind: "raster-style"; path: string; band: number; sourceCrs: GeoCrs; displayCrs: string;
  /** Full raster extent in displayCrs. */
  bbox: MapBBox; issues: GeoIssue[]; preview: MapPreview; legend: MapLegendItem[]; nodata: number | string | null;
  categorical: boolean;
  /** Continuous colour range (2nd/98th percentile of an overview sample) and sample min/max. */
  low?: number; high?: number; min?: number; max?: number;
  /** Source pixel size in display units; bounds the finest tile level. */
  resolution: number;
  overviews: boolean; needsOverviews: boolean;
  /** Changes when the source or its companions change; part of every tile URL. */
  version: string;
}
/** `GET /geo/raster-tile` query: PNG for one exact display-CRS tile bbox. */
export interface RasterTileQuery {
  path: string; band: number; crs: string; bbox: MapBBox; size: 256 | 512;
  categorical?: boolean; low?: number; high?: number; v: string;
}
/** Original-file pixel value under a display coordinate (`POST /geo/raster-point`). */
export interface RasterPoint {
  kind: "raster-point"; band: number; inside: boolean;
  row?: number; col?: number; value?: number | string | null; sourceCoordinate?: [number, number];
}
export interface MapAreaRequest extends MapSource {
  classField: string;
  method: "projected" | "geodesic";
  /** Required for projected; must use a projected CRS with linear units. */
  areaCrs?: string;
}
export interface MapAreaTable {
  path: string; layer?: string; classField: string;
  method: string; areaCrs?: string; unit: "m²";
  rows: { class: string | number | null; featureCount: number; area: number; percent: number }[];
  totalArea: number; featureCount: number; emptyCount: number;
  scope: "full-layer"; limitations: string[];
}
/** Artifact adapter for WP06 outputs. It references data instead of embedding it. */
export interface MapManifest {
  schemaVersion: "geo-result/v1"; kind: "map-layer"; title: string;
  layers: (MapSource & { sourceCrs: string; displayCrs: string; unit: string; legend: MapLegendItem[]; nodata: number | string | null; extent: MapBBox })[];
  analysis: { method: string; tablePath?: string; scriptPath?: string };
  limitations: string[];
}
export interface MapManifestResponse { manifest: MapManifest; inspections: GeoInspection[]; }

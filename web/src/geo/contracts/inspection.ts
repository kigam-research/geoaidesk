/**
 * `geo-inspection/v1`: the one description of a geoscience file that the
 * browser viewers and the agent tools share (skill_hub geo-byok-plan §3.2).
 * IO-free and framework-free: the backend imports this file too
 * (server/src/geo/inspection.ts), so keep it inside web's Turbopack root and
 * free of runtime dependencies.
 *
 * Stability: gaid-runtime publishes it; gaid-well-tables (WP04) and gaid-maps
 * (WP05) extend it additively (new optional fields, new `format` values, new
 * issue codes). Removing or retyping a field needs the owner of the seam.
 */

export const GEO_INSPECTION_SCHEMA = "geo-inspection/v1" as const;

/** Formats the dispatcher recognizes. `unknown` is a valid answer. */
export type GeoFormat =
  | "las"
  | "shapefile"
  | "geopackage"
  | "geojson"
  | "geotiff"
  | "tiff"
  | "csv"
  | "tsv"
  | "xlsx"
  | "netcdf"
  | "text"
  | "binary"
  | "unknown";

/** What kind of reader a format needs; drives tool hints and viewers. */
export type GeoFamily = "well-log" | "vector" | "raster" | "table" | "grid" | "text" | "binary";

export interface GeoAsset {
  projectId: string;
  /** Sandbox-relative path of the primary file, `/`-separated. */
  path: string;
  /** Primary file plus companions (shapefile .shx/.dbf/.prj/.cpg, sidecars). */
  sourceFiles: string[];
  format: GeoFormat;
  family: GeoFamily;
  sizeBytes: number;
  /**
   * Cache key, NOT a content hash: size + mtime of every source file plus the
   * inspector version. Never use it as evidence that bytes are unchanged.
   */
  fingerprint: string;
  /** Present only when a full hash was actually computed. */
  sha256?: string;
}

export type CrsStatus = "declared" | "user-supplied" | "unknown" | "conflicting";

export interface GeoCrs {
  status: CrsStatus;
  /** e.g. `EPSG:5186`, when the authority is known. */
  authority?: string;
  name?: string;
  wkt?: string;
  /** PROJ string for registering the CRS as a map view projection (gaid-map-tiles). */
  proj4?: string;
  /** True for a projected (not geographic) CRS. */
  projected?: boolean;
  axisUnits?: string;
  verticalDatum?: string;
  epoch?: number;
}

export interface GeoExtent {
  /** [minX, minY, maxX, maxY] in `coordinateSpace`. */
  bbox?: [number, number, number, number];
  /** `crs` = the declared CRS units; `pixel`/`native` when no CRS is known. */
  coordinateSpace: "crs" | "pixel" | "native";
}

export interface GeoLayer {
  name: string;
  geometryType?: string;
  featureCount?: number;
  fields?: { name: string; type: string }[];
  crs?: GeoCrs;
  extent?: GeoExtent;
}

export interface GeoBand {
  index: number;
  dtype?: string;
  nodata?: number | null;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
}

export interface GeoDimension {
  name: string;
  size: number;
  unit?: string;
}

export interface GeoDepth {
  basis: "MD" | "TVD" | "elevation" | "unknown";
  datum?: string;
  unit?: string;
  start?: number;
  stop?: number;
  step?: number;
}

export interface GeoColumn {
  name: string;
  type?: string;
  unit?: string;
  nullCount?: number;
}

export interface GeoCurve {
  mnemonic: string;
  unit?: string;
  description?: string;
  /** Count of null samples (LAS `NULL` value), when computed. */
  nullCount?: number;
}

export interface GeoIssue {
  /** Stable kebab-case code, e.g. `missing-prj`, `crs-unknown`, `las-version-3`. */
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  /** File, layer, band or curve the issue concerns. */
  scope?: string;
  /** What the user must supply to resolve it (e.g. a CRS). */
  requiredInput?: string;
}

export interface GeoPreview {
  /** True when values shown come from a subset of the data. */
  sampled: boolean;
  /** True when the answer stopped at a limit. */
  truncated: boolean;
  method?: string;
  sourceRows?: number;
  displayedRows?: number;
  resolution?: string;
  /** First rows of a table/LAS data section, bounded. */
  rows?: (string | number | null)[][];
  /** Header lines (text formats), bounded. */
  headerLines?: string[];
}

/** One suggested follow-up for a user or the agent. */
export interface GeoNextAction {
  /** `tool` = an agent tool call, `python` = a script through `uv run`, `view` = open in a viewer. */
  kind: "tool" | "python" | "view";
  description: string;
  /** For `tool`: the tool name and its arguments. */
  tool?: string;
  args?: Record<string, unknown>;
  /** For `python`: a short snippet (no data). */
  code?: string;
}

export interface GeoInspection {
  schemaVersion: typeof GEO_INSPECTION_SCHEMA;
  asset: GeoAsset;
  crs?: GeoCrs;
  extent?: GeoExtent;
  layers?: GeoLayer[];
  bands?: GeoBand[];
  dimensions?: GeoDimension[];
  depth?: GeoDepth;
  columns?: GeoColumn[];
  curveInventory?: GeoCurve[];
  /** Expected companion files that are absent (e.g. `rocks.shx`). */
  missingCompanions?: string[];
  issues: GeoIssue[];
  preview?: GeoPreview;
  nextActions?: GeoNextAction[];
  /** Inspector name and version, part of the fingerprint. */
  inspector: { name: string; version: string };
}

/** Request body of `POST /geo/inspect`. */
export interface GeoInspectRequest {
  path: string;
  /** Rows/lines to include in `preview` (server caps it). */
  previewRows?: number;
}

/** Families whose raw bytes should not be read into a model context whole. */
export function isBulkFamily(family: GeoFamily): boolean {
  return family !== "text";
}

/** Extension → format guess; inspectors confirm or correct it from content. */
export function formatFromName(name: string): GeoFormat {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  switch (ext) {
    case "las":
      return "las";
    case "shp":
    case "shx":
    case "dbf":
      return "shapefile";
    case "gpkg":
      return "geopackage";
    case "geojson":
      return "geojson";
    case "tif":
    case "tiff":
      return "tiff";
    case "csv":
      return "csv";
    case "tsv":
      return "tsv";
    case "xlsx":
      return "xlsx";
    case "nc":
    case "nc4":
      return "netcdf";
    default:
      return "unknown";
  }
}

export function familyOf(format: GeoFormat): GeoFamily {
  switch (format) {
    case "las":
      return "well-log";
    case "shapefile":
    case "geopackage":
    case "geojson":
      return "vector";
    case "geotiff":
    case "tiff":
      return "raster";
    case "csv":
    case "tsv":
    case "xlsx":
      return "table";
    case "netcdf":
      return "grid";
    case "text":
      return "text";
    default:
      return "binary";
  }
}

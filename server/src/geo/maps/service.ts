import type { ProjectPaths } from "../../projects.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { inspectGeoFile, resolveGeoPath } from "../inspection.ts";
import { mapCompanions } from "./sources.ts";
import { runMapHelper } from "./process.ts";
import type { MapRequest, MapAreaRequest, RasterWindow, VectorPage, MapAreaTable } from "../../../../web/src/geo/contracts/maps.ts";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SandboxError(400, "Expected a map request object");
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || value.includes("\0")) throw new SandboxError(400, `Invalid ${name}`);
  return value;
}
function integer(value: unknown, name: string, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw new SandboxError(400, `Invalid ${name}`);
  return Math.min(value, max);
}
export function parseMapRequest(value: unknown): MapRequest {
  const body = record(value);
  if (typeof body.offset === "number" && body.offset > 100000) throw new SandboxError(400, "offset exceeds the display paging limit; use an analysis script");
  if (typeof body.band === "number" && body.band > 65535) throw new SandboxError(400, "band is out of range");
  const displayCrs = text(body.displayCrs, "displayCrs");
  if (displayCrs && !/^(EPSG:\d{3,6}|native)$/.test(displayCrs)) throw new SandboxError(400, "displayCrs must be EPSG:<code> or native");
  const bbox = body.bbox;
  if (bbox !== undefined && (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(v => typeof v === "number" && Number.isFinite(v)) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3])) throw new SandboxError(400, "bbox must have finite increasing bounds");
  if (body.categorical !== undefined && typeof body.categorical !== "boolean") throw new SandboxError(400, "Invalid categorical flag");
  return {
    path: text(body.path, "path", true)!, layer: text(body.layer, "layer"), variable: text(body.variable, "variable"),
    displayCrs, bbox: bbox as MapRequest["bbox"], categorical: body.categorical as boolean | undefined,
    band: integer(body.band, "band", 1, 65535, 1), width: integer(body.width, "width", 1, 256, 256), height: integer(body.height, "height", 1, 256, 256),
    offset: integer(body.offset, "offset", 0, 100000, 0), limit: integer(body.limit, "limit", 1, 500, 200),
  };
}
export function parseAreaRequest(value: unknown): MapAreaRequest {
  const body = record(value);
  if (body.method !== "geodesic" && body.method !== "projected") throw new SandboxError(400, "Choose an explicit projected or geodesic area method");
  const areaCrs = text(body.areaCrs, "areaCrs");
  if (body.method === "projected" && (!areaCrs || !/^EPSG:\d{3,6}$/.test(areaCrs))) throw new SandboxError(400, "Projected area requires areaCrs EPSG:<code>");
  if (areaCrs === "EPSG:3857") throw new SandboxError(400, "Web Mercator is a display CRS, not an analytical area method");
  return { path: text(body.path, "path", true)!, layer: text(body.layer, "layer"), classField: text(body.classField, "classField", true)!, method: body.method, areaCrs };
}
export async function mapOperation(projectId: string, paths: ProjectPaths, operation: "vector" | "raster" | "area", request: MapRequest | MapAreaRequest, signal?: AbortSignal): Promise<VectorPage | RasterWindow | MapAreaTable> {
  const info = await inspectGeoFile(projectId, paths, request.path, { previewRows: 0 });
  const raster = operation === "raster";
  if (raster ? info.asset.format !== "geotiff" : !["shapefile", "geopackage", "geojson"].includes(info.asset.format)) throw new SandboxError(422, raster ? "A georeferenced raster is required. Ordinary TIFF uses the image viewer." : "A supported vector layer is required");
  // Recheck instead of relying on metadata issues: GDAL may follow companions implicitly.
  await mapCompanions(paths, info.asset.path, info.asset.format);
  const primaryPath = info.asset.format === "shapefile" ? info.asset.sourceFiles.find(p => /\.shp$/i.test(p)) : info.asset.path;
  if (!primaryPath) throw new SandboxError(422, "The shapefile .shp companion is missing");
  const primary = await resolveGeoPath(paths, primaryPath);
  const result = await runMapHelper<VectorPage | RasterWindow | MapAreaTable>({ ...request, operation, path: primary.abs }, signal);
  return { ...result, path: info.asset.path };
}

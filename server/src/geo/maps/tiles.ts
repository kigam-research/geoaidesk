/**
 * Raster display tiles: one whole-raster style per layer, then PNG tiles for exact
 * display-CRS bboxes of a deterministic client tile grid. Tiles are display-only;
 * pixel values come from the original file (`rasterPoint`).
 *
 * Caches: versioned tile URLs for the browser, an in-memory LRU of recent tiles with
 * in-flight de-duplication here, derived overview VRTs on disk in the helper.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import type { ProjectPaths } from "../../projects.ts";
import { safePath, SandboxError } from "../../sandbox-fs.ts";
import { resolveGeoPath } from "../inspection.ts";
import { mapCompanions } from "./sources.ts";
import { runMapHelper } from "./process.ts";
import type { MapBBox, RasterPoint, RasterStyle } from "../../../../web/src/geo/contracts/maps.ts";

const STYLE_TIMEOUT_MS = 180_000;
const TILE_CACHE_BYTES = 96 * 1024 * 1024;
const CRS = /^(EPSG:\d{3,6}|native)$/;

interface RasterSource { rel: string; abs: string; version: string }

/** Sandbox-validated GeoTIFF plus a version over the file and its implicitly read companions. */
async function rasterSource(paths: ProjectPaths, relPath: string): Promise<RasterSource> {
  const primary = await resolveGeoPath(paths, relPath);
  if (!/\.tiff?$/i.test(primary.rel)) throw new SandboxError(422, "Display tiles are available for GeoTIFF rasters");
  const stats = [[primary.rel, primary.size, primary.mtime]];
  for (const rel of await mapCompanions(paths, primary.rel, "geotiff")) {
    const stat = await fs.stat(safePath(rel, paths.sandbox));
    stats.push([rel, stat.size, stat.mtimeMs]);
  }
  return { rel: primary.rel, abs: primary.abs, version: createHash("sha256").update(JSON.stringify(stats)).digest("hex").slice(0, 16) };
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || value.includes("\0")) throw new SandboxError(400, `Invalid ${name}`);
  return value;
}
function band(value: unknown): number {
  const n = value === undefined ? 1 : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 65535) throw new SandboxError(400, "band is out of range");
  return n;
}
function crs(value: unknown): string {
  const v = value === undefined ? "EPSG:3857" : text(value, "displayCrs");
  if (!CRS.test(v)) throw new SandboxError(400, "displayCrs must be EPSG:<code> or native");
  return v;
}
function finite(value: unknown, name: string): number {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new SandboxError(400, `Invalid ${name}`);
  return n;
}
const flag = (value: unknown) => value === true || value === "1" || value === "true";

export async function rasterStyle(paths: ProjectPaths, body: unknown, signal?: AbortSignal): Promise<RasterStyle> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SandboxError(400, "Expected a map request object");
  const b = body as Record<string, unknown>;
  const source = await rasterSource(paths, text(b.path, "path"));
  const result = await runMapHelper<Omit<RasterStyle, "version">>({
    operation: "raster-style", path: source.abs, band: band(b.band), displayCrs: crs(b.displayCrs), categorical: flag(b.categorical), prepare: true,
  }, { signal, timeoutMs: STYLE_TIMEOUT_MS });
  return { ...result, path: source.rel, version: source.version };
}

export async function rasterPoint(paths: ProjectPaths, body: unknown, signal?: AbortSignal): Promise<RasterPoint> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SandboxError(400, "Expected a map request object");
  const b = body as Record<string, unknown>;
  const source = await rasterSource(paths, text(b.path, "path"));
  const point = b.coordinate;
  if (!Array.isArray(point) || point.length !== 2) throw new SandboxError(400, "coordinate must be two finite numbers");
  return runMapHelper<RasterPoint>({ operation: "raster-point", path: source.abs, band: band(b.band), displayCrs: crs(b.displayCrs), coordinate: point.map((v, i) => finite(v, `coordinate[${i}]`)) }, { signal });
}

export interface ParsedTile { path: string; band: number; crs: string; bbox: MapBBox; size: number; categorical: boolean; low?: number; high?: number }
export function parseTileQuery(query: Record<string, unknown>): ParsedTile {
  const bbox = text(query.bbox, "bbox").split(",").map(v => finite(v, "bbox"));
  if (bbox.length !== 4 || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) throw new SandboxError(400, "bbox must have finite increasing bounds");
  const size = query.size === undefined ? 256 : Number(query.size);
  if (size !== 256 && size !== 512) throw new SandboxError(400, "size must be 256 or 512");
  const categorical = flag(query.categorical);
  return {
    path: text(query.path, "path"), band: band(query.band), crs: crs(query.crs), bbox: bbox as MapBBox, size, categorical,
    ...(categorical ? {} : { low: finite(query.low, "low"), high: finite(query.high, "high") }),
  };
}

const tiles = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
let cachedBytes = 0;
function remember(key: string, png: Buffer): void {
  tiles.set(key, png); cachedBytes += png.length;
  for (const [old, value] of tiles) {
    if (cachedBytes <= TILE_CACHE_BYTES) break;
    tiles.delete(old); cachedBytes -= value.length;
  }
}

/** PNG for one tile. Concurrent requests for the same cold tile share one helper call. */
export async function rasterTile(projectId: string, paths: ProjectPaths, tile: ParsedTile, signal?: AbortSignal): Promise<Buffer> {
  const source = await rasterSource(paths, tile.path);
  const key = JSON.stringify([projectId, source.rel, source.version, tile.band, tile.crs, tile.bbox, tile.size, tile.categorical, tile.low, tile.high]);
  const hit = tiles.get(key);
  if (hit) { tiles.delete(key); tiles.set(key, hit); return hit; }
  let work = pending.get(key);
  if (!work) {
    // The shared call is not tied to one browser request: a cancelled tile still fills the cache.
    work = runMapHelper<{ png: string }>({ operation: "raster-tile", path: source.abs, band: tile.band, displayCrs: tile.crs, bbox: tile.bbox, size: tile.size, categorical: tile.categorical, low: tile.low, high: tile.high })
      .then(result => { const png = Buffer.from(result.png, "base64"); remember(key, png); return png; })
      .finally(() => pending.delete(key));
    pending.set(key, work);
  }
  if (!signal) return work;
  return Promise.race([work, new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new SandboxError(499, "Map request cancelled"));
    signal.addEventListener("abort", () => reject(new SandboxError(499, "Map request cancelled")), { once: true });
  })]);
}

export function clearTileCache(): void { tiles.clear(); pending.clear(); cachedBytes = 0; }

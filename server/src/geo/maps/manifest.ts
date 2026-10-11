/** Read-only adapter: result artifacts stay in the existing project sandbox. */
import fs from "node:fs/promises";
import type { ProjectPaths } from "../../projects.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { inspectGeoFile, resolveGeoPath } from "../inspection.ts";
import type { MapManifest, MapManifestResponse } from "../../../../web/src/geo/contracts/maps.ts";
import { parseMapRequest } from "./service.ts";

export const MAX_MAP_MANIFEST_BYTES = 64 * 1024;
function invalid(): never { throw new SandboxError(422, "Expected a geo-result/v1 map-layer manifest with layers, CRS, legend, extent, analysis and limitations"); }
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function short(v: unknown): v is string { return typeof v === "string" && v.length > 0 && v.length <= 2048; }
export function validateMapManifest(value: unknown): MapManifest {
  if (!object(value) || value.schemaVersion !== "geo-result/v1" || value.kind !== "map-layer" || !short(value.title)
    || !Array.isArray(value.layers) || !value.layers.length || value.layers.length > 16
    || !Array.isArray(value.limitations) || value.limitations.length > 100 || !value.limitations.every(short)
    || !object(value.analysis) || !short(value.analysis.method)) invalid();
  for (const layer of value.layers) {
    if (!object(layer) || !short(layer.sourceCrs) || !short(layer.displayCrs) || typeof layer.unit !== "string" || layer.unit.length > 128
      || !Array.isArray(layer.legend) || layer.legend.length > 256 || !layer.legend.every(entry => object(entry) && short(entry.label) && typeof entry.color === "string" && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(entry.color))
      || !(layer.nodata === null || typeof layer.nodata === "string" || (typeof layer.nodata === "number" && Number.isFinite(layer.nodata)))) invalid();
    parseMapRequest({ ...layer, bbox: layer.extent });
    if (!Array.isArray(layer.extent)) invalid();
  }
  for (const key of ["tablePath", "scriptPath"] as const) if (value.analysis[key] !== undefined && !short(value.analysis[key])) invalid();
  return value as unknown as MapManifest;
}
export async function readMapManifest(projectId: string, paths: ProjectPaths, rel: string): Promise<MapManifestResponse> {
  const file = await resolveGeoPath(paths, rel);
  if (file.size > MAX_MAP_MANIFEST_BYTES) throw new SandboxError(422, "Map manifest exceeds 64 KiB; reference artifacts rather than embedding data");
  // Bounded read also covers concurrent replacement/growth after stat.
  const handle = await fs.open(file.abs, "r"); let raw: string;
  try { const buffer = Buffer.alloc(MAX_MAP_MANIFEST_BYTES + 1); const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0); if (bytesRead > MAX_MAP_MANIFEST_BYTES) throw new SandboxError(422, "Map manifest exceeds 64 KiB"); raw = buffer.subarray(0, bytesRead).toString("utf8"); }
  finally { await handle.close(); }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new SandboxError(422, "Map manifest is not valid JSON"); }
  const manifest = validateMapManifest(value);
  for (const artifact of [manifest.analysis.tablePath, manifest.analysis.scriptPath]) if (artifact) await resolveGeoPath(paths, artifact);
  const inspections = [];
  for (const layer of manifest.layers) {
    const inspection = await inspectGeoFile(projectId, paths, layer.path, { previewRows: 0 });
    if (!["vector", "raster"].includes(inspection.asset.family) || inspection.asset.format === "tiff") throw new SandboxError(422, "A map manifest layer is not a supported map dataset");
    if (layer.layer && !inspection.layers?.some(item => item.name === layer.layer)) throw new SandboxError(422, `Map layer not found: ${layer.layer}`);
    const crs = layer.layer ? inspection.layers?.find(item => item.name === layer.layer)?.crs ?? inspection.crs : inspection.crs;
    if (crs?.status === "unknown" && layer.displayCrs !== "native") throw new SandboxError(422, "Unknown source CRS requires native-coordinate display");
    // Metadata is authoritative; stale result records cannot silently relabel a source.
    if (crs?.authority && layer.sourceCrs !== crs.authority) throw new SandboxError(422, "Map manifest source CRS differs from the current dataset declaration");
    inspections.push(inspection);
  }
  return { manifest, inspections };
}

/** One bounded inspection entry point for the browser, tools and read hints. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { formatFromName, familyOf, GEO_INSPECTION_SCHEMA, type GeoFormat, type GeoInspection } from "../../../web/src/geo/contracts/inspection.ts";
import type { ProjectPaths } from "../projects.ts";
import { safePath, isUserVisible, apiRelative, SandboxError } from "../sandbox-fs.ts";
import { baselineInspector, sniffFormat } from "./inspectors/baseline.ts";

export interface GeoInspectContext {
  projectId: string;
  paths: ProjectPaths;
  relPath: string;
  absPath: string;
  sizeBytes: number;
  format: GeoFormat;
  previewRows: number;
  /** Additive IO seam: reads are sandbox-validated and share a per-file budget. */
  sourceFiles?: string[];
  readBytes?: (rel: string, offset: number, length: number) => Promise<Buffer>;
}
export interface GeoInspector {
  name: string;
  version: string;
  formats: readonly GeoFormat[];
  inspect(ctx: GeoInspectContext): Promise<GeoInspection>;
}
const inspectors = new Map<GeoFormat, GeoInspector>();
export function registerGeoInspector(inspector: GeoInspector): void {
  for (const format of inspector.formats) inspectors.set(format, inspector);
}
export function inspectorFor(format: GeoFormat): GeoInspector | undefined { return inspectors.get(format); }
export const MAX_PREVIEW_ROWS = 50;
/** Total actual IO per source file, including format sniffing and random TIFF reads. */
export const MAX_INSPECTION_BYTES = 256 * 1024;
registerGeoInspector(baselineInspector);

export async function resolveGeoPath(paths: ProjectPaths, rel: string): Promise<{ abs: string; rel: string; size: number; mtime: number }> {
  if (typeof rel !== "string" || !rel.trim() || rel.includes("\0")) throw new SandboxError(400, "A file path is required");
  const abs = safePath(rel, paths.sandbox);
  if (!isUserVisible(abs, paths.sandbox)) throw new SandboxError(404, "File not found");
  let stat;
  try { stat = await fs.stat(abs); } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new SandboxError(404, "File not found");
    throw err;
  }
  if (!stat.isFile()) throw new SandboxError(400, "Path is not a regular file");
  return { abs, rel: apiRelative(paths.sandbox, abs), size: stat.size, mtime: stat.mtimeMs };
}

export async function inspectGeoFile(projectId: string, paths: ProjectPaths, relPath: string, options: { previewRows?: number } = {}): Promise<GeoInspection> {
  const primary = await resolveGeoPath(paths, relPath);
  const consumed = new Map<string, number>();
  const readBytes = async (rel: string, offset: number, length: number): Promise<Buffer> => {
    const file = await resolveGeoPath(paths, rel);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0) throw new Error("Invalid read range");
    const count = Math.max(0, Math.min(length, MAX_INSPECTION_BYTES - (consumed.get(file.rel) ?? 0), file.size - offset));
    if (!count) return Buffer.alloc(0);
    consumed.set(file.rel, (consumed.get(file.rel) ?? 0) + count);
    const handle = await fs.open(file.abs, "r");
    try {
      const buffer = Buffer.alloc(count);
      const { bytesRead } = await handle.read(buffer, 0, count, offset);
      return buffer.subarray(0, bytesRead);
    } finally { await handle.close(); }
  };
  let format = formatFromName(primary.rel);
  const sourceFiles = [primary.rel];
  const sourceStats = [[primary.rel, primary.size, primary.mtime]];
  const issues: GeoInspection["issues"] = [];
  try { format = sniffFormat(primary.rel, await readBytes(primary.rel, 0, 512)); }
  catch { issues.push({ code: "unreadable-file", message: "The file header could not be read.", severity: "error" }); }
  if (format === "shapefile") {
    const stem = path.basename(primary.abs, path.extname(primary.abs)).toLowerCase();
    // Only same-basename companions; every candidate goes through safePath, including symlinks.
    try {
      for (const entry of (await fs.readdir(path.dirname(primary.abs))).sort()) {
        if (path.basename(entry, path.extname(entry)).toLowerCase() !== stem || !/^\.(shp|shx|dbf|prj|cpg)$/i.test(path.extname(entry))) continue;
        const rel = apiRelative(paths.sandbox, path.join(path.dirname(primary.abs), entry));
        if (rel === primary.rel) continue;
        try {
          const info = await resolveGeoPath(paths, rel);
          sourceFiles.push(info.rel); sourceStats.push([info.rel, info.size, info.mtime]);
        } catch { issues.push({ code: "unreadable-companion", message: `Companion unavailable: ${entry}`, severity: "warning", scope: rel }); }
      }
    } catch { issues.push({ code: "companions-unreadable", message: "Companion directory could not be listed.", severity: "warning" }); }
  }
  let inspector = inspectorFor(format) ?? baselineInspector;
  const fingerprintFor = (reader: GeoInspector) => createHash("sha256").update(JSON.stringify({ sources: sourceStats.sort(), inspector: [reader.name, reader.version] })).digest("hex");
  const result: GeoInspection = {
    schemaVersion: GEO_INSPECTION_SCHEMA,
    asset: { projectId, path: primary.rel, sourceFiles: sourceFiles.sort(), format, family: familyOf(format), sizeBytes: primary.size, fingerprint: fingerprintFor(inspector) },
    issues, inspector: { name: inspector.name, version: inspector.version },
  };
  const rows = options.previewRows ?? 8;
  const ctx: GeoInspectContext = { projectId, paths, relPath: primary.rel, absPath: primary.abs, sizeBytes: primary.size, format, previewRows: Number.isFinite(rows) ? Math.max(0, Math.min(MAX_PREVIEW_ROWS, Math.floor(rows))) : 8, sourceFiles, readBytes };
  try {
    let parsed = await inspector.inspect(ctx);
    // TIFF magic cannot distinguish GeoTIFF: georeference tags live in the IFD.
    // Honor a richer inspector registered for the corrected format, sharing the
    // same byte budget. Redirect once only, so disagreeing inspectors cannot loop.
    const corrected = inspectorFor(parsed.asset.format);
    // Never demote a custom broad-format reader back to a default baseline.
    if (corrected && corrected !== baselineInspector && corrected !== inspector) {
      inspector = corrected;
      result.asset.format = parsed.asset.format;
      result.asset.family = familyOf(parsed.asset.format);
      result.asset.fingerprint = fingerprintFor(inspector);
      result.inspector = { name: inspector.name, version: inspector.version };
      parsed = await inspector.inspect({ ...ctx, format: parsed.asset.format });
    }
    // The dispatcher owns source identities, even when a downstream inspector overrides a format.
    return { ...parsed, schemaVersion: GEO_INSPECTION_SCHEMA, asset: { ...parsed.asset, ...result.asset, format: parsed.asset.format, family: familyOf(parsed.asset.format) }, inspector: result.inspector, issues: [...issues, ...parsed.issues] };
  } catch {
    result.issues.push({ code: "inspection-failed", message: "Content could not be inspected within the metadata limits. Use a format-aware analysis reader.", severity: "error" });
    return result;
  }
}

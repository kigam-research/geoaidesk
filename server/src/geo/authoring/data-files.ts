/**
 * Data-file sources for hub authoring: which supplied files are geo data, and a compact summary of each read through
 * the shared inspection dispatcher (server/src/geo/inspection.ts), so the coauthor sees format, CRS, extent, columns,
 * bands and curves instead of raw bytes.
 */
import type { CodeFileEntry, DataFileSummary } from "../../../../web/src/geo/contracts/authoring.ts";
import { AUTHORING_SOURCE_LIMITS } from "../../../../web/src/geo/contracts/authoring.ts";
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
import type { ProjectPaths } from "../../projects.ts";
import { inspectGeoFile } from "../inspection.ts";

/** Files read only together with a primary file (shapefile parts, world files, raster sidecars). */
const COMPANION = /\.(shx|dbf|prj|cpg|qix|sbn|sbx|dbt|idm|ind|tfw|tifw|tiffw|wld|ovr|msk|aux\.xml)$/i;
const PRIMARY =
  /\.(csv|tsv|xlsx|las|shp|gpkg|geojson|tif|tiff|nc|nc4|grd|asc|xyz|dat)$/i;

/** True for a file name that is geo/tabular data (primary file or companion). */
export function isDataName(name: string): boolean {
  return PRIMARY.test(name) || COMPANION.test(name);
}

/** A primary data file: inspected on its own (companions are read with it). */
export function isPrimaryDataName(name: string): boolean {
  return PRIMARY.test(name) && !COMPANION.test(name);
}

/** Code-like files: a set containing any of these stays a code source. */
export const CODE_NAME = /\.(py|r|m|jl|js|ts|ipynb|sh|sql|cpp|c|h|f90|f|java|go|rs)$/i;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function summarizeInspection(insp: GeoInspection, primary: string): DataFileSummary {
  const crs = insp.crs ?? insp.layers?.find((l) => l.crs)?.crs;
  const extent = insp.extent ?? insp.layers?.find((l) => l.extent)?.extent;
  const preview = insp.preview;
  const estimated = /estimate/i.test(preview?.method ?? "");
  return {
    format: insp.asset.format,
    family: insp.asset.family,
    ...(insp.asset.sourceFiles.length > 1
      ? { companions: insp.asset.sourceFiles.filter((f) => f !== primary).slice(0, 20) }
      : {}),
    crs: crs ? (crs.authority ?? crs.name ?? crs.status) : "unknown",
    ...(extent?.bbox ? { bbox: extent.bbox, coordinateSpace: extent.coordinateSpace } : {}),
    ...(insp.layers?.length
      ? {
          layers: insp.layers.slice(0, 10).map((l) => ({
            name: l.name,
            ...(l.geometryType ? { geometryType: l.geometryType } : {}),
            ...(num(l.featureCount) !== undefined ? { featureCount: l.featureCount } : {}),
            ...(l.fields?.length ? { fields: l.fields.slice(0, 60).map((f) => `${f.name}:${f.type}`) } : {}),
          })),
        }
      : {}),
    ...(insp.bands?.length
      ? {
          bands: insp.bands.slice(0, 20).map((b) => ({
            index: b.index,
            ...(b.dtype ? { dtype: b.dtype } : {}),
            ...(b.nodata !== undefined ? { nodata: b.nodata } : {}),
            ...(num(b.min) !== undefined ? { min: b.min } : {}),
            ...(num(b.max) !== undefined ? { max: b.max } : {}),
            ...(b.unit ? { unit: b.unit } : {}),
            ...(b.description ? { description: b.description.slice(0, 200) } : {}),
          })),
        }
      : {}),
    ...(insp.dimensions?.length ? { dimensions: insp.dimensions.slice(0, 10) } : {}),
    ...(insp.depth ? { depth: insp.depth } : {}),
    ...(insp.columns?.length ? { columns: insp.columns.slice(0, 80) } : {}),
    ...(insp.curveInventory?.length
      ? {
          curves: insp.curveInventory.slice(0, 80).map((c) => ({
            mnemonic: c.mnemonic,
            ...(c.unit ? { unit: c.unit } : {}),
            ...(c.description ? { description: c.description.slice(0, 200) } : {}),
            ...(num(c.nullCount) !== undefined ? { nullCount: c.nullCount } : {}),
          })),
        }
      : {}),
    ...(num(preview?.sourceRows) !== undefined
      ? { rows: preview!.sourceRows, ...(estimated ? { rowsEstimated: true } : {}) }
      : {}),
    ...(preview?.rows?.length
      ? { preview: preview.rows.slice(0, 5).map((r) => r.slice(0, 20).map((c) => (typeof c === "string" ? c.slice(0, 80) : c))) }
      : {}),
    ...(insp.issues.length
      ? { issues: insp.issues.slice(0, 10).map((i) => ({ code: i.code, severity: i.severity, message: i.message.slice(0, 300) })) }
      : {}),
    inspector: `${insp.inspector.name} ${insp.inspector.version}`,
  };
}

/**
 * Inspect the data files of one stored source (`root` = its `files/` folder) and record the summary on each primary
 * file entry; companions are marked with their primary. At most `inspectedFiles` files per source; errors are recorded
 * as an issue, never thrown.
 */
export async function inspectDataFiles(root: string, entries: CodeFileEntry[]): Promise<number> {
  // Only `sandbox` is read by the dispatcher and the map helpers; the folder holds just this source's files.
  const paths = { id: "authoring", sandbox: root } as ProjectPaths;
  let inspected = 0;
  const byPath = new Map(entries.map((e) => [e.path, e]));
  for (const entry of entries) {
    if (!isPrimaryDataName(entry.path)) continue;
    if (inspected >= AUTHORING_SOURCE_LIMITS.inspectedFiles) break;
    inspected++;
    try {
      const insp = await inspectGeoFile("authoring", paths, entry.path, { previewRows: 5 });
      entry.data = summarizeInspection(insp, entry.path);
      for (const other of insp.asset.sourceFiles) {
        const companion = byPath.get(other);
        if (companion && other !== entry.path) companion.companionOf = entry.path;
      }
    } catch (e) {
      entry.data = {
        format: "unknown",
        family: "binary",
        issues: [{ code: "inspection-failed", severity: "error", message: String((e as Error)?.message ?? e).slice(0, 300) }],
        inspector: "none",
      };
    }
  }
  return inspected;
}

const fmt = (v: number) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(4) : String(+v.toFixed(4)));

/** Plain-text summary of a data file for the coauthor's context; anchors on the file are checked against this text. */
export function renderDataSummary(path: string, size: number, d: DataFileSummary): string {
  const lines = [`Data file ${path} (${d.format}, ${d.family}, ${size} bytes; read by ${d.inspector})`];
  if (d.companions?.length) lines.push(`Companion files: ${d.companions.join(", ")}`);
  lines.push(`CRS: ${d.crs ?? "unknown"}`);
  if (d.bbox) lines.push(`Extent (${d.coordinateSpace ?? "crs"}): ${d.bbox.map(fmt).join(", ")}`);
  for (const l of d.layers ?? [])
    lines.push(
      `Layer ${l.name}: ${l.geometryType ?? "geometry unknown"}${l.featureCount !== undefined ? `, ${l.featureCount} features` : ""}${l.fields?.length ? `; fields ${l.fields.join(", ")}` : ""}`,
    );
  for (const b of d.bands ?? [])
    lines.push(
      `Band ${b.index}: ${[b.dtype, b.description, b.unit && `unit ${b.unit}`, b.min !== undefined && `min ${fmt(b.min)}`, b.max !== undefined && `max ${fmt(b.max)}`, b.nodata !== undefined && `nodata ${b.nodata}`].filter(Boolean).join(", ")}`,
    );
  if (d.dimensions?.length) lines.push(`Dimensions: ${d.dimensions.map((x) => `${x.name}=${x.size}${x.unit ? ` ${x.unit}` : ""}`).join(", ")}`);
  if (d.depth)
    lines.push(
      `Depth: ${d.depth.basis}${d.depth.unit ? ` ${d.depth.unit}` : ""}${d.depth.start !== undefined ? ` from ${d.depth.start}` : ""}${d.depth.stop !== undefined ? ` to ${d.depth.stop}` : ""}${d.depth.step !== undefined ? ` step ${d.depth.step}` : ""}`,
    );
  if (d.columns?.length)
    lines.push(`Columns: ${d.columns.map((c) => `${c.name}${c.type ? `:${c.type}` : ""}${c.unit ? ` [${c.unit}]` : ""}`).join(", ")}`);
  if (d.curves?.length)
    lines.push(`Curves: ${d.curves.map((c) => `${c.mnemonic}${c.unit ? ` [${c.unit}]` : ""}${c.description ? ` ${c.description}` : ""}`).join("; ")}`);
  if (d.rows !== undefined) lines.push(`Rows: ${d.rows}${d.rowsEstimated ? " (estimated from the first bytes)" : ""}`);
  if (d.preview?.length) {
    lines.push("First rows:");
    for (const r of d.preview) lines.push(`  ${r.map((c) => (c === null ? "" : String(c))).join(" | ")}`);
  }
  for (const i of d.issues ?? []) lines.push(`Issue (${i.severity}) ${i.code}: ${i.message}`);
  return lines.join("\n");
}

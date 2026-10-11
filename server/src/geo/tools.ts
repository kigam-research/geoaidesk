/** Compact inspection and bounded physical-line windows; full analysis stays in Python. */
import fs from "node:fs/promises";
import { Type } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";
import type { GeoInspection } from "../../../web/src/geo/contracts/inspection.ts";
import { inspectGeoFile, resolveGeoPath } from "./inspection.ts";
import { sniffFormat, looksBinary } from "./inspectors/baseline.ts";

export const MAX_WINDOW_LINES = 200;
export const MAX_WINDOW_BYTES = 64 * 1024;
export const MAX_WINDOW_SCAN_BYTES = 4 * 1024 * 1024;
export function boundedText(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  return Buffer.from(text).subarray(0, maxBytes - 32).toString("utf8").replace(/\uFFFD$/, "") + "\n[summary truncated]";
}
export function inspectionSummary(out: GeoInspection, maxBytes = 3000): string {
  // Keep decision-relevant fields before potentially long inventories/issues.
  return boundedText([
    `${out.asset.path}: ${out.asset.format}, ${out.asset.sizeBytes} bytes`,
    `CRS: ${out.crs?.status ?? "unknown"}${out.crs?.authority ? ` (${out.crs.authority})` : ""}`,
    out.depth ? `Depth: ${JSON.stringify(out.depth)}` : "",
    out.extent ? `Extent: ${JSON.stringify(out.extent)}` : "",
    out.layers ? `Layers: ${out.layers.slice(0, 5).map(l => `${l.name} (${l.geometryType ?? "type unknown"}, ${l.featureCount ?? "unknown"} features); fields: ${l.fields?.slice(0, 8).map(f => f.name).join(", ") ?? "unknown"}`).join("; ")}` : "",
    out.bands ? `Bands: ${out.bands.slice(0, 8).map(b => `${b.index}: ${b.dtype ?? "unknown"}`).join(", ")}` : "",
    out.curveInventory ? `Curves: ${out.curveInventory.slice(0, 12).map(c => `${c.mnemonic} [${c.unit ?? "unit unknown"}]`).join(", ")}` : "",
    out.missingCompanions?.length ? `Missing companions: ${out.missingCompanions.join(", ")}` : "",
    `Inspector: ${out.inspector.name}@${out.inspector.version}; fingerprint is size/mtime, NOT a content hash.`,
    out.preview ? `Preview: sampled=${out.preview.sampled}, truncated=${out.preview.truncated}; ${out.preview.method ?? ""}` : "",
    ...out.issues.slice(0, 6).map(i => `${i.code}: ${i.message}`),
  ].filter(Boolean).join("\n"), maxBytes);
}
export function pythonAnalysisSnippet(out: GeoInspection): string {
  const file = JSON.stringify(out.asset.format === "shapefile" ? out.asset.sourceFiles.find(p => /\.shp$/i.test(p)) ?? out.asset.path : out.asset.path);
  // A here-document keeps filenames as Python literals, never shell code.
  const code = out.asset.format === "las" ? `import lasio; log = lasio.read(${file}); print(log.curves)`
    : ["geotiff", "tiff"].includes(out.asset.format) ? `import rasterio; ds = rasterio.open(${file}); print(ds.profile) # use ds.read(window=...)`
    : ["shapefile", "geopackage", "geojson"].includes(out.asset.format) ? `import pyogrio; print(pyogrio.read_info(${file})) # read selected columns/bbox for analysis`
    : ["csv", "tsv"].includes(out.asset.format) ? `import pandas as pd; chunks = pd.read_csv(${file}, sep=${JSON.stringify(out.asset.format === "tsv" ? "\t" : ",")}, chunksize=10000); print(next(chunks).describe())`
    : `from pathlib import Path; print(Path(${file}).stat().st_size) # stream the file in an analysis script`;
  return `uv run python - <<'PY'\n${code}\nPY`;
}

export async function readGeoWindow(paths: ProjectPaths, rel: string, options: { offset?: number; limit?: number } = {}, signal?: AbortSignal) {
  const offset = options.offset ?? 1, requested = options.limit ?? 50;
  if (!Number.isSafeInteger(offset) || offset < 1 || !Number.isSafeInteger(requested) || requested < 1) throw new Error("offset and limit must be positive integers (offset is a 1-based physical line)");
  const limit = Math.min(requested, MAX_WINDOW_LINES), file = await resolveGeoPath(paths, rel);
  const handle = await fs.open(file.abs, "r");
  let position = 0, lineNumber = 1, pending = Buffer.alloc(0), outputBytes = 0, partialLine = false, scanLimited = false, eof = false;
  const rows: string[] = [];
  const add = (line: Buffer): boolean => {
    if (lineNumber++ < offset) return true;
    const room = MAX_WINDOW_BYTES - outputBytes;
    if (room <= 0) return false;
    const selected = line.subarray(0, Math.max(0, room - 1));
    partialLine ||= selected.length < line.length;
    rows.push(selected.toString("utf8").replace(/\r$/, "").replace(/\uFFFD$/, "")); outputBytes += selected.length + 1;
    return !partialLine && rows.length < limit && outputBytes < MAX_WINDOW_BYTES;
  };
  try {
    while (position < Math.min(file.size, MAX_WINDOW_SCAN_BYTES) && rows.length < limit && outputBytes < MAX_WINDOW_BYTES && !partialLine) {
      signal?.throwIfAborted();
      const buffer = Buffer.alloc(Math.min(position === 0 ? 512 : MAX_WINDOW_BYTES, file.size - position, MAX_WINDOW_SCAN_BYTES - position));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      if (position === 0) {
        const header = buffer.subarray(0, bytesRead), format = sniffFormat(file.rel, header);
        if (!["las", "geojson", "csv", "tsv", "text"].includes(format) || looksBinary(header) || header.subarray(0, 4).toString() === "LASF") throw new Error("Binary data is not a text window. Use geo_inspect and a format-aware Python reader.");
      }
      position += bytesRead;
      pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
      let newline: number, from = 0, proceed = true;
      while ((newline = pending.indexOf(10, from)) !== -1) {
        proceed = add(pending.subarray(from, newline)); from = newline + 1;
        if (!proceed) break;
      }
      pending = pending.subarray(from);
      if (!proceed) break;
    }
    eof = position >= file.size;
    if (eof && pending.length && rows.length < limit && !partialLine && outputBytes < MAX_WINDOW_BYTES) add(pending);
    scanLimited = !eof && position >= MAX_WINDOW_SCAN_BYTES && rows.length < limit && !partialLine && outputBytes < MAX_WINDOW_BYTES;
    // An enormous unterminated line is still surfaced only within the output cap.
    if (scanLimited && lineNumber >= offset && pending.length && !rows.length) { add(pending); partialLine = true; }
  } finally { await handle.close(); }
  const truncated = !eof || partialLine || rows.length >= limit || outputBytes >= MAX_WINDOW_BYTES || requested > limit;
  return { path: file.rel, offset, limit, lines: rows, displayedRows: rows.length, nextOffset: !partialLine && rows.length ? offset + rows.length : undefined, sampled: true, truncated, partialLine, scanLimited, scannedBytes: position, method: "1-based physical lines; LAS header/wrapped lines are not logical samples" };
}
// Parameter types differ per tool, following the upstream custom-tool list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeGeoTools(projectId: string, paths: ProjectPaths): ToolDefinition<any, any>[] {
  const inspectParams = Type.Object({ path: Type.String() });
  const windowParams = Type.Object({ path: Type.String(), offset: Type.Optional(Type.Integer({ minimum: 1 })), limit: Type.Optional(Type.Integer({ minimum: 1 })) });
  const inspectTool: ToolDefinition<typeof inspectParams> = {
    name: "geo_inspect", label: "Inspect geo file", description: "Inspect geo/table file metadata, CRS, companions and limited preview rows without loading the full dataset.",
    promptSnippet: "geo_inspect: bounded shared geo/table metadata and preview",
    promptGuidelines: ["Inspect large or binary data before analysis; unknown CRS/depth basis must not be guessed."],
    parameters: inspectParams,
    async execute(_id, params) {
      const inspection = await inspectGeoFile(projectId, paths, params.path);
      return { content: [{ type: "text", text: inspectionSummary(inspection) }], details: { inspection } };
    },
  };
  const windowTool: ToolDefinition<typeof windowParams> = {
    name: "geo_read_window", label: "Read data window", description: "Read a bounded text/LAS/CSV/TSV physical-line window (offset is 1-based; ≤200 lines, ≤64 KiB output, ≤4 MiB scan). Far offsets require a Python analysis script.",
    promptSnippet: "geo_read_window: bounded physical lines, not full-file analysis",
    promptGuidelines: ["Use uv run python with format-aware readers for full-data analysis; display samples are not the full dataset."],
    parameters: windowParams,
    async execute(_id, params, signal) {
      const window = await readGeoWindow(paths, params.path, params, signal);
      return { content: [{ type: "text", text: boundedText(`${JSON.stringify({ ...window, lines: undefined })}\n${window.lines.join("\n")}${window.scanLimited ? "\nScan limit reached. Use uv run python for distant windows/full analysis." : ""}`, MAX_WINDOW_BYTES) }], details: { window } };
    },
  };
  return [inspectTool, windowTool];
}

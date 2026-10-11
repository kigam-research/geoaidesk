import fs from "node:fs/promises";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";
import { inspectGeoFile, resolveGeoPath } from "./inspection.ts";
import { looksBinary, sniffFormat } from "./inspectors/baseline.ts";
import { boundedText, inspectionSummary, pythonAnalysisSnippet } from "./tools.ts";

export const LARGE_TEXT_DATA_BYTES = 256 * 1024;
export const BOUNDED_READ_LINES = 200;
/** This is a read-tool usability hint, not a policy on bash or other ways of reading files. */
export function makeGeoReadHintExtension(projectId: string, paths: ProjectPaths): ExtensionFactory | null {
  return (pi) => {
    pi.on("tool_call", async event => {
      if (event.toolName !== "read") return;
      const input = event.input as { path?: unknown; limit?: unknown };
      if (typeof input.path !== "string") return;
      try {
        const file = await resolveGeoPath(paths, input.path);
        const h = await fs.open(file.abs, "r");
        const data = Buffer.alloc(512);
        let bytesRead: number;
        try { ({ bytesRead } = await h.read(data, 0, data.length, 0)); } finally { await h.close(); }
        const header = data.subarray(0, bytesRead), format = sniffFormat(file.rel, header);
        const nonTextGeo = ["shapefile", "geopackage", "tiff", "geotiff", "netcdf", "xlsx"].includes(format) || (format === "las" && (looksBinary(header) || header.subarray(0, 4).toString() === "LASF"));
        const textData = ["las", "csv", "tsv", "geojson", "text"].includes(format);
        const bounded = typeof input.limit === "number" && Number.isInteger(input.limit) && input.limit > 0 && input.limit <= BOUNDED_READ_LINES;
        if (!nonTextGeo && (!textData || file.size <= LARGE_TEXT_DATA_BYTES || bounded)) return;
        const inspection = await inspectGeoFile(projectId, paths, file.rel, { previewRows: 0 });
        // Reserve space for actions first; long paths/headers cannot hide the suggested next step.
        const actionPath = file.rel.length <= 300 ? file.rel : "<same path as the read call>";
        const actions = `Direct read blocked: use bounded inspection or a format-aware analysis reader.\ngeo_inspect ${JSON.stringify({ path: actionPath })}\ngeo_read_window ${JSON.stringify({ path: actionPath, offset: 1, limit: 50 })} (text only)\nFull-file analysis (save outputs, do not print the dataset):\n${pythonAnalysisSnippet({ ...inspection, asset: { ...inspection.asset, path: actionPath } })}`;
        const actionBytes = Buffer.byteLength(actions);
        return { block: true, reason: boundedText(`${actions}\n${inspectionSummary(inspection, Math.max(64, 1950 - actionBytes))}`, 2000) };
      } catch {
        // Path/missing-file errors belong to the read tool; do not turn them into misleading format advice.
        return;
      }
    });
  };
}

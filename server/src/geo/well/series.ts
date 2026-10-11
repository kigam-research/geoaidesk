import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { ProjectPaths } from "../../projects.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { runHelperScript } from "../../api/sci-helpers.ts";
import { inspectGeoFile, resolveGeoPath } from "../inspection.ts";
import { parseDepthManifest, type DepthWindow, type DepthWindowRequest } from "../../../../web/src/geo/contracts/depth.ts";
export const LAS_MAX_BYTES = 64 * 1024 * 1024;
const helper = fileURLToPath(new URL("./las_helper.py", import.meta.url));

export function validateSeriesRequest(body: unknown): DepthWindowRequest {
  if (!body || typeof body !== "object") throw new SandboxError(400, "Expected a LAS path and optional window");
  const b = body as DepthWindowRequest;
  if (typeof b.path !== "string" || !b.path || (b.mode !== undefined && !["rows", "display"].includes(b.mode)) || (b.columns !== undefined && (!Array.isArray(b.columns) || !b.columns.length || b.columns.length > 8 || new Set(b.columns).size !== b.columns.length || b.columns.some(c => !Number.isInteger(c) || c < 0 || c >= 128))) || [b.startRow, b.limit].some(n => n !== undefined && (!Number.isSafeInteger(n) || n < 1)) || [b.minDepth, b.maxDepth].some(n => n !== undefined && (typeof n !== "number" || !Number.isFinite(n))) || (b.minDepth !== undefined && b.maxDepth !== undefined && b.minDepth > b.maxDepth)) throw new SandboxError(400, "Invalid LAS window: use 1-based rows, 1–8 curve columns and finite ordered depth limits");
  return { path: b.path, mode: b.mode, columns: b.columns, startRow: b.startRow, limit: b.limit, minDepth: b.minDepth, maxDepth: b.maxDepth };
}
export async function readSeriesWindow(paths: ProjectPaths, request: DepthWindowRequest): Promise<DepthWindow> {
  const b = validateSeriesRequest(request);
  const file = await resolveGeoPath(paths, b.path);
  if (file.size > LAS_MAX_BYTES) throw new SandboxError(413, "LAS preview supports up to 64 MiB; use a format-aware analysis script for larger files");
  const result = await runHelperScript(helper, [file.abs, "--request", JSON.stringify(b)], 30_000);
  if (result.status !== 0) throw new SandboxError(result.status === 3 ? 503 : result.timedOut ? 504 : 422, result.stderr || "LAS preview could not be parsed");
  if (Buffer.byteLength(result.stdout) > 4 * 1024 * 1024) throw new SandboxError(413, "LAS window exceeded the response limit");
  const out = JSON.parse(result.stdout) as DepthWindow;
  // Reuse the shared header interpretation offered to agent tools: a comment
  // declaring depth basis must not mean something different in the browser.
  const metadata = await inspectGeoFile("series", paths, b.path, { previewRows: 0 });
  if (out.depth) out.depth.basis = metadata.depth?.basis ?? "unknown";
  const after = await resolveGeoPath(paths, b.path);
  if (after.size !== file.size || after.mtime !== file.mtime) throw new SandboxError(409, "The LAS changed during reading; retry the window");
  return { ...out, path: file.rel, fingerprint: createHash("sha256").update(JSON.stringify([file.rel, file.size, file.mtime, "las-window/1"])).digest("hex") };
}
export async function readDepthResult(paths: ProjectPaths, rel: string) {
  const file = await resolveGeoPath(paths, rel);
  if (file.size > 256 * 1024) throw new SandboxError(413, "Depth manifest exceeds 256 KiB");
  let manifest;
  try { manifest = parseDepthManifest(JSON.parse(await fs.readFile(file.abs, "utf8"))); }
  catch { throw new SandboxError(422, "Invalid geo-result/v1 depth-track manifest"); }
  await resolveGeoPath(paths, manifest.dataPath);
  if (manifest.codePath) await resolveGeoPath(paths, manifest.codePath);
  return manifest;
}

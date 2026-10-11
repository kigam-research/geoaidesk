import path from "node:path";
import { HELPERS_DIR } from "../../helpers-env.ts";
import { runHelperScript } from "../../api/sci-helpers.ts";
import { safePath } from "../../sandbox-fs.ts";
import type { GeoInspectContext } from "../inspection.ts";
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
/** Bounded metadata-only subprocess. Never requests vector features or raster pixels. */
export async function enrichMetadata(ctx: GeoInspectContext, out: GeoInspection): Promise<void> {
  const args = ["summarize", ctx.absPath, "--format", ctx.format];
  if (ctx.format === "shapefile") {
    const prj = ctx.sourceFiles?.find(p => /\.prj$/i.test(p));
    if (!prj) return;
    args.push("--crs-file", safePath(prj, ctx.paths.sandbox));
  }
  const result = await runHelperScript(path.join(HELPERS_DIR, "geo_inspect_helper.py"), args, 5_000);
  if (result.status !== 0) {
    out.issues.push({ code: result.status === 3 ? "geo-helper-deps-missing" : "geo-helper-unavailable", severity: "warning", message: result.status === 3 ? "Optional geo helper dependencies are missing. Use the prepared Python analysis environment for layer/CRS details." : "Optional geo metadata helper could not inspect this file; baseline metadata remains available." });
    return;
  }
  try {
    if (Buffer.byteLength(result.stdout) > 128 * 1024) throw new Error("Helper output too large");
    const extra = JSON.parse(result.stdout) as Pick<GeoInspection, "layers" | "crs" | "issues">;
    if (Array.isArray(extra.layers)) out.layers = extra.layers.slice(0, 50);
    if (extra.crs && ["declared", "unknown"].includes(extra.crs.status)) out.crs = extra.crs;
    if (Array.isArray(extra.issues)) out.issues.push(...extra.issues.slice(0, 10));
  } catch { out.issues.push({ code: "geo-helper-invalid", severity: "warning", message: "Optional geo helper returned invalid metadata." }); }
}

import type { GeoInspector } from "../inspection.ts";
import type { GeoInspection } from "../../../../web/src/geo/contracts/inspection.ts";
import { baselineInspector, base } from "../inspectors/baseline.ts";
import { safePath } from "../../sandbox-fs.ts";
import { mapCompanions } from "./sources.ts";
import { runMapHelper } from "./process.ts";

export const mapInspector: GeoInspector = {
  name: "gaid-map", version: "1.0.0", formats: ["shapefile", "geopackage", "geojson", "tiff", "geotiff"],
  async inspect(ctx) {
    await mapCompanions(ctx.paths, ctx.relPath, ctx.format);
    const out = base(ctx);
    try {
      const primary = ctx.format === "shapefile" ? ctx.sourceFiles?.find(p => /\.shp$/i.test(p)) : ctx.relPath;
      if (!primary) return await baselineInspector.inspect(ctx);
      const parsed = await runMapHelper<Partial<GeoInspection>>({ operation: "inspect", path: safePath(primary, ctx.paths.sandbox) });
      // Helper may correct TIFF classification, but never controls source identity.
      const asset = { ...out.asset, format: parsed.asset?.format ?? out.asset.format };
      return { ...out, ...parsed, asset, issues: [...(parsed.issues ?? [])], inspector: { name: "gaid-map", version: "1.0.0" } };
    } catch {
      // Do not launch both metadata readers on every successful viewport request.
      // Preserve baseline metadata only when the richer reader is unavailable.
      let fallback: GeoInspection;
      try { fallback = await baselineInspector.inspect(ctx); } catch { fallback = out; }
      fallback.issues.push({ code: "map-helper-unavailable", severity: "warning", message: "Map reader unavailable; bounded baseline metadata is shown. Prepare the geo helper environment or inspect the source issues." });
      return fallback;
    }
  },
};

/** GDAL reads adjacent companions implicitly: validate them before opening the primary. */
import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import { safePath, isUserVisible, apiRelative, SandboxError } from "../../sandbox-fs.ts";
import type { GeoFormat } from "../../../../web/src/geo/contracts/inspection.ts";
export async function mapCompanions(paths: ProjectPaths, primary: string, format: GeoFormat): Promise<string[]> {
  if (!["shapefile", "tiff", "geotiff", "geopackage"].includes(format)) return [];
  const abs = safePath(primary, paths.sandbox), name = path.basename(abs).toLowerCase(), stem = name.slice(0, -path.extname(name).length);
  const entries = await fs.readdir(path.dirname(abs));
  const names = entries.filter(entry => {
    const lower = entry.toLowerCase();
    if (lower === name) return false;
    if (format === "shapefile") return lower.startsWith(`${stem}.`) && /\.(shp|shx|dbf|prj|cpg|qix|sbn|sbx|dbt|idm|ind|xml)$/.test(lower);
    if (format === "geopackage") return lower === `${name}-wal` || lower === `${name}-shm`;
    return [".aux.xml", ".ovr", ".msk", ".msk.aux.xml", ".ovr.aux.xml"].some(suffix => lower === name + suffix)
      || [".tfw", ".tifw", ".tiffw", ".wld", ".prj"].some(suffix => lower === stem + suffix);
  });
  return names.sort().map(entry => {
    const rel = apiRelative(paths.sandbox, path.join(path.dirname(abs), entry));
    const checked = safePath(rel, paths.sandbox);
    if (!isUserVisible(checked, paths.sandbox)) throw new SandboxError(403, "A map companion is not accessible");
    return rel;
  });
}

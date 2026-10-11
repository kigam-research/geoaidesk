/**
 * Catalogue taxonomy format ids (workflow `inputRoles[].formats`) ↔ what the
 * app detects. Detection uses the shared inspection (`geo-inspection/v1`), so
 * a TIFF without georeferencing is not a `geotiff`.
 */
import type { GeoFormat } from "../../../../web/src/geo/contracts/inspection.ts";

/** Taxonomy format id → file extensions (lowercase, no dot) a file picker offers. */
export const FORMAT_EXTENSIONS: Record<string, string[]> = {
  "las-welllog": ["las"],
  shapefile: ["shp"],
  geopackage: ["gpkg"],
  geojson: ["geojson"],
  geotiff: ["tif", "tiff"],
  csv: ["csv", "tsv"],
  xlsx: ["xlsx"],
  json: ["json"],
  markdown: ["md"],
  png: ["png"],
  parquet: ["parquet"],
};

/**
 * Formats too common to suggest a task on their own: a CSV or JSON file says
 * little about the task, so these need a content signal (suggestions.ts).
 */
export const GENERIC_FORMATS = new Set(["csv", "xlsx", "json", "markdown", "png"]);

/** Files that already have their own viewer or action and are not task inputs. */
const OWN_ACTION_SUFFIXES = [".geomap.json", ".depth.json", ".geo-start.json"];

export function extensionsFor(formats: string[]): string[] {
  return [...new Set(formats.flatMap((format) => FORMAT_EXTENSIONS[format] ?? []))];
}

function extensionOf(name: string): string {
  const base = name.toLowerCase().split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1);
}

/**
 * Taxonomy format of a file from its inspected format (when inspection ran)
 * and its extension, or null when no workflow input reads it.
 */
export function taxonomyFormat(relPath: string, inspected?: GeoFormat): string | null {
  const lower = relPath.toLowerCase();
  if (OWN_ACTION_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return null;
  switch (inspected) {
    case "las":
      return "las-welllog";
    case "shapefile":
      return extensionOf(lower) === "shp" ? "shapefile" : null;
    case "geopackage":
      return "geopackage";
    case "geojson":
      return "geojson";
    case "geotiff":
      return "geotiff";
    case "tiff":
      // No georeferencing: an image, not a raster layer.
      return null;
    case "csv":
    case "tsv":
      return "csv";
    case "xlsx":
      return "xlsx";
    default:
      break;
  }
  const ext = extensionOf(lower);
  if (ext === "tif" || ext === "tiff") return null; // only an inspected GeoTIFF counts
  if (ext === "shx" || ext === "dbf") return null; // shapefile companions: the .shp is the input
  for (const [format, extensions] of Object.entries(FORMAT_EXTENSIONS)) {
    if (extensions.includes(ext)) return format;
  }
  return null;
}

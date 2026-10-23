/**
 * Sources picked or dropped together (gaid-authoring-sources): files that are read only together (a shapefile set, a
 * raster with its world file) become one source; every other file is its own source. Also the one-line summary of a
 * data source shown under its row.
 */
import type { CodeFileEntry, DataFileSummary } from "@/geo/contracts/authoring";

/** Files that belong to a primary file of the same name. */
const COMPANION = /\.(shx|dbf|prj|cpg|qix|sbn|sbx|tfw|tifw|tiffw|wld|ovr|msk|aux\.xml)$/i;
const SET_PRIMARY = /\.(shp|tif|tiff|gpkg)$/i;

/** The accept list of the source file input. */
export const SOURCE_ACCEPT = [
  ".pdf,.zip,.tar.gz,.tgz,.md,.txt,.py,.r,.ipynb",
  ".csv,.tsv,.xlsx,.las,.shp,.shx,.dbf,.prj,.cpg,.gpkg,.geojson,.tif,.tiff,.tfw,.nc,.grd,.asc,.xyz,.dat",
  "application/pdf",
].join(",");

const stem = (name: string) => name.toLowerCase().replace(/\.aux\.xml$/, "").replace(/\.[^.]+$/, "");

export type SourceUpload<F extends { name: string }> = { single: F } | { name: string; files: F[] };

/** Group files by base name when a primary file (shp, tif, gpkg) arrives with its companions. */
export function groupSourceFiles<F extends { name: string }>(files: F[]): SourceUpload<F>[] {
  const byStem = new Map<string, F[]>();
  for (const f of files) byStem.set(stem(f.name), [...(byStem.get(stem(f.name)) ?? []), f]);
  const used = new Set<F>();
  const out: SourceUpload<F>[] = [];
  for (const f of files) {
    if (used.has(f)) continue;
    const group = byStem.get(stem(f.name))!;
    const primary = group.find((g) => SET_PRIMARY.test(g.name));
    if (primary && group.length > 1 && group.every((g) => g === primary || COMPANION.test(g.name))) {
      group.forEach((g) => used.add(g));
      out.push({ name: primary.name, files: group });
    } else {
      used.add(f);
      out.push({ single: f });
    }
  }
  return out;
}

const FORMAT_LABEL: Record<string, string> = {
  csv: "CSV",
  tsv: "TSV",
  xlsx: "XLSX",
  las: "LAS",
  shapefile: "Shapefile",
  geopackage: "GeoPackage",
  geojson: "GeoJSON",
  geotiff: "GeoTIFF",
  tiff: "TIFF",
  netcdf: "NetCDF",
};

export interface DataLineParts {
  format: string;
  /** Count facts: columns, bands, curves, features. */
  facts: { key: "columns" | "bands" | "curves" | "features" | "rows"; count: number }[];
  crs: string | null;
  /** More primary data files in the same source. */
  more: number;
}

/** The research facts of a data source for its row: first data file's format, counts and CRS. */
export function dataLineParts(files: CodeFileEntry[] | undefined): DataLineParts | null {
  const data = (files ?? []).filter((f): f is CodeFileEntry & { data: DataFileSummary } => !!f.data);
  if (!data.length) return null;
  const d = data[0].data;
  const facts: DataLineParts["facts"] = [];
  const features = d.layers?.reduce((n, l) => n + (l.featureCount ?? 0), 0) ?? 0;
  if (d.columns?.length) facts.push({ key: "columns", count: d.columns.length });
  if (d.rows !== undefined && !d.rowsEstimated) facts.push({ key: "rows", count: d.rows });
  if (d.curves?.length) facts.push({ key: "curves", count: d.curves.length });
  if (d.bands?.length) facts.push({ key: "bands", count: d.bands.length });
  if (features) facts.push({ key: "features", count: features });
  const spatial = d.family === "vector" || d.family === "raster" || d.family === "grid" || !!d.bbox;
  return {
    format: FORMAT_LABEL[d.format] ?? data[0].path.split(".").pop()!.toUpperCase(),
    facts,
    crs: spatial ? (d.crs && d.crs !== "unknown" ? d.crs : "") : null,
    more: data.length - 1,
  };
}

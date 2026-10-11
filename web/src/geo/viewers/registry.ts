/**
 * GeoAIDesk viewer seam (skill_hub geo-byok-plan §7.1 "Frontend registry seam").
 *
 * `fileCategory()` (lib/use-sandbox.ts) asks `geoFileCategory()` first, and the
 * upstream viewer registry (lib/viewers/registry.ts) spreads
 * `GEO_VIEWER_REGISTRY`. Geo viewers are self-fetching (`loadMode: "none"`)
 * and read `POST /geo/inspect` (contracts/inspection.ts) before any bulk data.
 *
 * Ownership: gaid-runtime publishes this interface and the generic
 * inspection viewer. gaid-well-tables (WP04) and gaid-maps (WP05) replace the
 * entry for their category with a specialized viewer by editing only their
 * own line below (append-only otherwise); gaid-korean-workspace (WP07) owns
 * any other change.
 */
import { lazy } from "react";
import type { ViewerDef } from "@/lib/viewers/registry";

export type GeoFileCategory = "geo-welllog" | "geo-vector" | "geo-raster";

const VECTOR_EXTS = new Set(["shp", "shx", "dbf", "gpkg", "geojson"]);

/** Category from the file name; null leaves upstream dispatch unchanged. */
export function geoFileCategory(name: string): GeoFileCategory | null {
  const lower = name.toLowerCase();
  // OME-TIFF is microscopy by construction.
  if (lower.endsWith(".ome.tif") || lower.endsWith(".ome.tiff")) return null;
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (ext === "las") return "geo-welllog";
  if (VECTOR_EXTS.has(ext)) return "geo-vector";
  // A TIFF is a raster candidate: the viewer inspects georeferencing and falls
  // back to the upstream imaging viewer for an ordinary (non-geo) TIFF.
  if (ext === "tif" || ext === "tiff") return "geo-raster";
  return null;
}

const GeoInspectionViewer = lazy(() => import("@/geo/viewers/inspection-viewer"));

export const GEO_VIEWER_REGISTRY: Record<GeoFileCategory, ViewerDef> = {
  "geo-welllog": { loadMode: "none", Viewer: GeoInspectionViewer, canEditSource: false, managesOwnScroll: true },
  "geo-vector": { loadMode: "none", Viewer: GeoInspectionViewer, canEditSource: false, managesOwnScroll: true },
  "geo-raster": { loadMode: "none", Viewer: GeoInspectionViewer, canEditSource: false, managesOwnScroll: true },
};

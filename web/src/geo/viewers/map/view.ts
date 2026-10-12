import View from "ol/View";
import Projection from "ol/proj/Projection";
import { get as getProjection } from "ol/proj";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";

/** Registers declared source CRSs (EPSG code -> PROJ string from the helper) as OpenLayers projections. */
export function registerProjections(definitions: Record<string, string>): void {
  let added = false;
  for (const [code, definition] of Object.entries(definitions)) {
    if (getProjection(code) || !/^EPSG:\d+$/.test(code)) continue;
    proj4.defs(code, definition); added = true;
  }
  if (added) register(proj4);
}

export function createMapView(crs: string): View {
  if (crs === "EPSG:3857" || crs === "EPSG:4326") return new View({ projection: crs, center: [0, 0], zoom: 2, multiWorld: false });
  if (crs !== "native" && getProjection(crs)) {
    // Registered projected CRS without a declared validity extent: a free resolution range, set by fit().
    return new View({ projection: crs, center: [0, 0], resolution: 1000, minResolution: 1e-4, maxResolution: 1e6, multiWorld: false });
  }
  // Pixel/native units have no meters-per-unit definition. OpenLayers' world
  // resolution defaults would divide by undefined and produce NaN. Define a
  // purely numerical view range instead; this is not a geographic CRS guess.
  return new View({
    projection: new Projection({ code: "GAID:NATIVE", units: "pixels" }),
    center: [0, 0], resolution: 1, minResolution: 1e-12, maxResolution: 1e12,
    multiWorld: false,
  });
}

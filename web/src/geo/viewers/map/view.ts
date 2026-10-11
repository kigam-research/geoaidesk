import View from "ol/View";
import Projection from "ol/proj/Projection";

export function createMapView(crs: string): View {
  if (crs !== "native") return new View({ projection: crs, center: [0, 0], zoom: 2, multiWorld: false });
  // Pixel/native units have no meters-per-unit definition. OpenLayers' world
  // resolution defaults would divide by undefined and produce NaN. Define a
  // purely numerical view range instead; this is not a geographic CRS guess.
  return new View({
    projection: new Projection({ code: "GAID:NATIVE", units: "pixels" }),
    center: [0, 0], resolution: 1, minResolution: 1e-12, maxResolution: 1e12,
    multiWorld: false,
  });
}

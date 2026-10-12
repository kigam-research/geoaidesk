import { describe, expect, it } from "vitest";
import { transform } from "ol/proj";
import { createMapView, registerProjections } from "./view";
describe("real OpenLayers view (no canvas mocks)", () => {
  it("fits native coordinates at finite resolution without inventing geographic placement", () => {
    const view = createMapView("native");
    expect(view.getProjection().getCode()).toBe("GAID:NATIVE");
    expect(Number.isFinite(view.getResolution())).toBe(true);
    view.fit([100000, 200000, 101000, 202000], { size: [600, 400] });
    expect(view.getResolution()).toBe(5);
    const extent = view.calculateExtent([600, 400]);
    expect(extent.every(Number.isFinite)).toBe(true);
    expect(extent[0]).toBeLessThanOrEqual(100000); expect(extent[2]).toBeGreaterThanOrEqual(101000);
    expect(extent[1]).toBeLessThanOrEqual(200000); expect(extent[3]).toBeGreaterThanOrEqual(202000);
  });
  it("retains supported display projections independently of backend source CRS", () => {
    expect(createMapView("EPSG:3857").getProjection().getCode()).toBe("EPSG:3857");
    expect(createMapView("EPSG:4326").getProjection().getCode()).toBe("EPSG:4326");
  });
  it("registers a declared projected CRS as the view projection and reprojects to Web Mercator", () => {
    registerProjections({ "EPSG:5186": "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs" });
    const view = createMapView("EPSG:5186");
    expect(view.getProjection().getCode()).toBe("EPSG:5186");
    view.fit([190000, 540000, 210000, 560000], { size: [400, 400] });
    expect(view.getResolution()).toBe(50);
    const [x, y] = transform([200000, 600000], "EPSG:5186", "EPSG:4326");
    expect(x).toBeCloseTo(127, 6); expect(y).toBeCloseTo(38, 6);
  });
});

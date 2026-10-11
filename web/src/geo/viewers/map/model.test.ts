import { describe, expect, it } from "vitest";
import type { GeoInspection } from "../../contracts/inspection";
import type { MapAreaTable, RasterWindow } from "../../contracts/maps";
import { areaCsv, areaRequest, buildRequest, canOverlay, createLayer, displayCrs, fitExtent, sampledPixel, sourceCrs, validBBox } from "./model";
import { classColor, layerLegend, vectorColor } from "./colors";
const inspection = (status: "declared" | "unknown" = "declared"): GeoInspection => ({ schemaVersion: "geo-inspection/v1", asset: { path: "rocks.gpkg", projectId: "p", family: "vector", format: "geopackage", sourceFiles: ["rocks.gpkg"], sizeBytes: 100, fingerprint: "cache" }, crs: { status, authority: status === "declared" ? "EPSG:5186" : undefined }, layers: [{ name: "rocks", fields: [{ name: "class", type: "string" }] }, { name: "unknown", crs: { status: "unknown" } }], issues: [], inspector: { name: "fixture", version: "1" } });
describe("map semantics", () => {
  it("matches categorical legends to the rendered field and does not present an unused manifest palette", () => {
    const layer = createLayer("a", inspection());
    layer.source.categorical = true;
    layer.data = { kind: "vector", features: { type: "FeatureCollection", features: [{ properties: { class: 0 } }, { properties: { class: null } }] }, legend: [{ label: "unused", color: "red" }] } as unknown as import("../../contracts/maps").VectorPage;
    layer.manifest = { legend: [{ label: "zero", value: 0, color: "red" }] } as NonNullable<typeof layer.manifest>;
    expect(layerLegend(layer)[0].color).toBe("#0072b2");
    expect(layerLegend(layer, "class").map(i => i.color)).toEqual(["red", classColor(null)]);
    expect(vectorColor(layer, 0)).toBe("red"); expect(vectorColor(layer, null)).not.toBe("red");
  });
  it("fits single points/flat lines while rejecting nonfinite or inverted extents", () => {
    expect(validBBox(fitExtent([4, 4, 4, 4])!)).toBe(true);
    expect(validBBox(fitExtent([4, 4, 10, 4])!)).toBe(true);
    expect(fitExtent([10, 4, 4, 4])).toBeNull();
    expect(fitExtent([4, 4, Infinity, 4])).toBeNull();
  });
  it("keeps source CRS separate from display CRS and respects per-GPKG-layer unknown declarations", () => {
    const layer = createLayer("a", inspection());
    expect(sourceCrs(layer).authority).toBe("EPSG:5186"); expect(displayCrs(layer)).toBe("EPSG:3857");
    layer.source.layer = "unknown";
    expect(sourceCrs(layer).status).toBe("unknown"); expect(displayCrs(layer)).toBe("native");
    expect(canOverlay([createLayer("b", inspection())], layer)).toBe(false);
    expect(canOverlay([createLayer("b", inspection("unknown"))], layer)).toBe(false);
    expect(canOverlay([], layer)).toBe(true);
  });
  it("caps requests and sends the selected source, viewport and pagination without mutating it", () => {
    const layer = createLayer("a", inspection(), { path: "rocks.gpkg", layer: "rocks" }); layer.offset = 500;
    expect(buildRequest(layer, "EPSG:3857", { bbox: [1, 2, 3, 4], width: 999, height: 400 })).toMatchObject({ path: "rocks.gpkg", layer: "rocks", limit: 500, offset: 500, bbox: [1, 2, 3, 4], displayCrs: "EPSG:3857" });
    layer.inspection.asset.family = "raster"; layer.source.band = 3; layer.source.variable = "elevation";
    expect(buildRequest(layer, "native", { bbox: [1, 2, 3, 4], width: 999, height: 0 })).toEqual({ ...layer.source, displayCrs: "native", bbox: [1, 2, 3, 4], width: 256, height: 1 });
    expect(buildRequest(layer, "native").bbox).toBeUndefined();
  });
  it("requires explicit area method/CRS, never preview bbox or Web Mercator", () => {
    const layer = createLayer("a", inspection());
    expect(areaRequest(layer, "class", "", "")).toBeNull();
    expect(areaRequest(layer, "class", "projected", "EPSG:3857")).toBeNull();
    expect(areaRequest(layer, "class", "projected", "EPSG:4326")).toBeNull();
    expect(areaRequest(layer, "class", "projected", "epsg:5186")).toMatchObject({ areaCrs: "EPSG:5186", method: "projected" });
    const request = areaRequest(layer, "class", "geodesic", "EPSG:3857");
    expect(request).toMatchObject({ classField: "class", method: "geodesic" }); expect(request).not.toHaveProperty("bbox"); expect(request).not.toHaveProperty("areaCrs");
    layer.source.layer = "unknown"; expect(areaRequest(layer, "class", "geodesic", "")).toBeNull();
  });
  it("distinguishes low/zero values from nodata and rejects clicks outside sampled cells", () => {
    const raster = { bbox: [0, 0, 20, 20], values: [[0, null], [-3, 12]] } as RasterWindow;
    expect(sampledPixel(raster, 5, 15)?.value).toBe(0);
    expect(sampledPixel(raster, 15, 15)?.value).toBeNull();
    expect(sampledPixel(raster, 5, 5)).toEqual({ row: 1, col: 0, value: -3 });
    expect(sampledPixel(raster, 20, 10)).toBeNull(); expect(sampledPixel(raster, 2, 0)).toBeNull();
  });
  it("exports full numerical values and quoted classes without replacing missing class with zero", () => {
    const table = { rows: [{ class: 'a,"b', featureCount: 2, area: 123.456789, percent: 100 }, { class: null, featureCount: 1, area: 0, percent: 0 }] } as MapAreaTable;
    const csv = areaCsv(table, ["Class", "Count", "Area (m²)", "%"]);
    expect(csv).toContain('"a,""b"'); expect(csv).toContain('"123.456789"'); expect(csv).toContain('"","1","0","0"');
  });
});

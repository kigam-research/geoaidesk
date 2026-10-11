import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGeoMapRoutes } from "../src/geo/routes/maps.ts";
import { inspectGeoFile, registerGeoInspector } from "../src/geo/inspection.ts";
import { baselineInspector } from "../src/geo/inspectors/baseline.ts";
import { parseMapRequest, parseAreaRequest } from "../src/geo/maps/service.ts";
import { validateMapManifest, readMapManifest } from "../src/geo/maps/manifest.ts";
import { runMapHelper } from "../src/geo/maps/process.ts";
import { mapInspector } from "../src/geo/maps/inspector.ts";
import { resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { sandboxFixture, tiff } from "./fixtures/geo/factories.ts";
vi.mock("../src/geo/maps/process.ts", () => ({ runMapHelper: vi.fn() }));
vi.mock("../src/api/sci-helpers.ts", () => ({ runHelperScript: vi.fn(async () => ({ status: 3, stdout: "", stderr: "missing", timedOut: false })) }));
let f: ReturnType<typeof sandboxFixture>;
const geojson = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { rock: "a" }, geometry: { type: "Polygon", coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } }] });
beforeEach(() => { f = sandboxFixture(); vi.resetAllMocks(); registerGeoInspector(baselineInspector); });
afterEach(() => { f.cleanup(); registerGeoInspector(mapInspector); });
const manifest = () => ({ schemaVersion: "geo-result/v1", kind: "map-layer", title: "Synthetic map", layers: [{ path: "rocks.geojson", sourceCrs: "EPSG:4326", displayCrs: "EPSG:3857", unit: "class", legend: [{ label: "a", color: "#ff0000" }], nodata: null, extent: [0,0,1,1] }], analysis: { method: "geodesic", tablePath: "areas.csv" }, limitations: ["Sum of feature areas; overlaps count twice"] });

describe("map transport bounds and scientific scope", () => {
  it("caps viewport payload and strips undeclared options/project overrides", () => {
    expect(parseMapRequest({ path: "a.tif", width: 9999, height: 5000, limit: 3000, projectId: "other", assumeCrs: "EPSG:4326" })).toMatchObject({ width: 256, height: 256, limit: 500 });
    expect(parseMapRequest({ path: "a.tif", projectId: "other" })).not.toHaveProperty("projectId");
    expect(() => parseMapRequest({ path: "a.geojson", offset: 100001 })).toThrow(/paging limit/);
    for (const extra of [{ bbox: [0,0,0,1] }, { bbox: [0,0,Infinity,1] }, { width: -1 }, { limit: "1" }, { categorical: "yes" }, { displayCrs: "guessed" }]) expect(() => parseMapRequest({ path: "x", ...extra })).toThrow();
  });
  it("requires explicit analytical method and does not forward a viewport/sample into area", () => {
    expect(() => parseAreaRequest({ path: "x", classField: "rock" })).toThrow(/explicit/);
    expect(() => parseAreaRequest({ path: "x", classField: "rock", method: "projected" })).toThrow(/areaCrs/);
    expect(() => parseAreaRequest({ path: "x", classField: "rock", method: "projected", areaCrs: "EPSG:3857" })).toThrow(/Web Mercator/);
    const request = parseAreaRequest({ path: "x", classField: "rock", method: "geodesic", bbox: [0,0,1,1], limit: 1 });
    expect(request).not.toHaveProperty("bbox"); expect(request).not.toHaveProperty("limit");
  });
  it("invalidates raster fingerprint on sidecar edit, addition and deletion", async () => {
    f.write("map.tif", tiff(true));
    const first = await inspectGeoFile("p", f.paths, "map.tif");
    f.write("map.tif.aux.xml", "<PAMDataset/>");
    const second = await inspectGeoFile("p", f.paths, "map.tif");
    expect(second.asset.sourceFiles).toContain("map.tif.aux.xml"); expect(second.asset.fingerprint).not.toBe(first.asset.fingerprint);
    f.write("map.tif.aux.xml", "<PAMDataset>changed</PAMDataset>");
    const third = await inspectGeoFile("p", f.paths, "map.tif"); expect(third.asset.fingerprint).not.toBe(second.asset.fingerprint);
    fs.rmSync(path.join(f.root, "map.tif.aux.xml"));
    expect((await inspectGeoFile("p", f.paths, "map.tif")).asset.fingerprint).toBe(first.asset.fingerprint);
  });
  it("never invokes an implicit map reader for an escaped sidecar", async () => {
    f.write("map.tif", tiff(true)); fs.symlinkSync("/etc/hosts", path.join(f.root, "map.tif.aux.xml"));
    registerGeoInspector(mapInspector);
    const info = await inspectGeoFile("p", f.paths, "map.tif");
    expect(info.issues.some(i => i.code === "unreadable-companion")).toBe(true); expect(runMapHelper).not.toHaveBeenCalled();
  });
});
describe("map manifest adapter", () => {
  it("accepts real point and axis-aligned line extents without accepting inverted bounds", () => {
    for (const extent of [[1,2,1,2], [1,2,1,5], [1,2,5,2]]) expect(validateMapManifest({ ...manifest(), layers: [{ ...manifest().layers[0], extent }] }).layers[0].extent).toEqual(extent);
    expect(() => validateMapManifest({ ...manifest(), layers: [{ ...manifest().layers[0], extent: [2,2,1,1] }] })).toThrow();
  });
  it("loads artifact references in the active sandbox and preserves numerical-table reference", async () => {
    f.write("rocks.geojson", geojson); f.write("areas.csv", "class,area_m2\na,1\n"); f.write("result.geomap.json", JSON.stringify(manifest()));
    const out = await readMapManifest("p", f.paths, "result.geomap.json");
    expect(out.manifest.analysis.tablePath).toBe("areas.csv"); expect(out.inspections[0].asset.projectId).toBe("p");
  });
  it("rejects absent, escaping, oversized and stale-CRS result references", async () => {
    f.write("rocks.geojson", geojson); f.write("areas.csv", "a");
    for (const change of [{ analysis: { method: "geodesic", tablePath: "../outside.csv" } }, { analysis: { method: "geodesic", tablePath: "missing.csv" } }, { layers: [{ ...manifest().layers[0], sourceCrs: "EPSG:5186" }] }]) {
      f.write("map.geomap.json", JSON.stringify({ ...manifest(), ...change })); await expect(readMapManifest("p", f.paths, "map.geomap.json")).rejects.toThrow();
    }
    f.write("big.geomap.json", " ".repeat(65537)); await expect(readMapManifest("p", f.paths, "big.geomap.json")).rejects.toThrow(/64 KiB/);
    expect(() => validateMapManifest({ ...manifest(), layers: Array(17).fill(manifest().layers[0]) })).toThrow();
  });
});

describe("project-scoped map routes", () => {
  it("resolves active-project bytes, prevents path escapes and exposes full-layer area response", async () => {
    const app = Fastify();
    app.addHook("onRequest", (req, _reply, done) => withActiveProject(String(req.headers["x-project-id"] ?? "maps-a"), done));
    await registerGeoMapRoutes(app);
    for (const id of ["maps-a", "maps-b"]) { fs.mkdirSync(resolvePaths(id).sandbox, { recursive: true }); fs.writeFileSync(path.join(resolvePaths(id).sandbox, "rocks.geojson"), geojson); }
    vi.mocked(runMapHelper).mockResolvedValue({ kind: "vector", features: { type: "FeatureCollection", features: [] } });
    try {
      const res = await app.inject({ method: "POST", url: "/geo/vector-page", headers: { "x-project-id": "maps-b" }, payload: { path: "rocks.geojson", projectId: "maps-a", limit: 9000 } });
      expect(res.statusCode).toBe(200);
      expect(runMapHelper).toHaveBeenLastCalledWith(expect.objectContaining({ path: path.join(resolvePaths("maps-b").sandbox, "rocks.geojson"), limit: 500 }), expect.any(AbortSignal));
      expect(res.json().path).toBe("rocks.geojson");
      for (const [payload, expected] of [[{ path: "../bad" },403], [{ path: ".pi/x" },404], [{ path: "missing" },404], [{ path: "rocks.geojson", width: 0 },400]] as const) expect((await app.inject({ method: "POST", url: "/geo/vector-page", payload })).statusCode).toBe(expected);
      vi.mocked(runMapHelper).mockResolvedValue({ scope: "full-layer", rows: [{ class: "a", area: 10000 }], unit: "m²" });
      const area = await app.inject({ method: "POST", url: "/geo/area-table", payload: { path: "rocks.geojson", classField: "rock", method: "geodesic", bbox: [0,0,1,1] } });
      expect(area.statusCode).toBe(200); expect(area.json()).toMatchObject({ scope: "full-layer", rows: [{ area: 10000 }] });
      expect(vi.mocked(runMapHelper).mock.calls.at(-1)![0]).not.toHaveProperty("bbox");
    } finally { await app.close(); for (const id of ["maps-a", "maps-b"]) fs.rmSync(resolvePaths(id).root, { recursive: true, force: true }); }
  });
});

/** Real fixture → shared inspector → HTTP window/area pipeline (no model/network calls). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import Fastify from "fastify";
import { beforeAll, afterAll, expect, it } from "vitest";
import { registerGeoMapRoutes } from "../src/geo/routes/maps.ts";
import { registerGeoInspectionRoutes } from "../src/geo/routes/inspection.ts";
import { registerGeoInspector } from "../src/geo/inspection.ts";
import { mapInspector } from "../src/geo/maps/inspector.ts";
import { resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
const root = fileURLToPath(new URL("../../", import.meta.url));
const project = "maps-integration", paths = resolvePaths(project);
const app = Fastify();
app.addHook("onRequest", (_req, _reply, done) => withActiveProject(project, done));
await registerGeoInspectionRoutes(app); await registerGeoMapRoutes(app);
beforeAll(() => {
  registerGeoInspector(mapInspector);
  fs.mkdirSync(paths.sandbox, { recursive: true });
  const result = spawnSync("uv", ["run", "--frozen", "--no-sync", "--project", path.join(root, "server/src/helpers"), "python", "-I", path.join(root, "geo/tests/fixtures/maps_fixture.py"), paths.sandbox], { encoding: "utf8", timeout: 30000 });
  expect(result.status, result.stderr).toBe(0);
}, 35000);
afterAll(async () => { await app.close(); fs.rmSync(paths.root, { recursive: true, force: true }); });
async function post(url: string, payload: unknown) { return app.inject({ method: "POST", url, payload: payload as object }); }
it("keeps raster/vector display and exact full-layer numerical area aligned across actual routes", async () => {
  const inspection = await post("/geo/inspect", { path: "classes.tif" });
  expect(inspection.statusCode).toBe(200); expect(inspection.json().asset.format).toBe("geotiff"); expect(inspection.json().inspector.name).toBe("gaid-map");
  const raster = await post("/geo/raster-window", { path: "classes.tif", displayCrs: "native", categorical: true, width: 8, height: 8 });
  expect(raster.statusCode, raster.body).toBe(200); expect(raster.json().path).toBe("classes.tif");
  expect(new Set(raster.json().values.flat())).toEqual(new Set([1,2,null]));
  const vector = await post("/geo/vector-page", { path: "rectangle.gpkg", layer: "rectangles", variable: "class", displayCrs: "native", limit: 1 });
  expect(vector.statusCode, vector.body).toBe(200); expect(vector.json().preview.truncated).toBe(true); expect(vector.json().nextOffset).toBe(1);
  const area = await post("/geo/area-table", { path: "rectangle.gpkg", layer: "rectangles", classField: "class", method: "projected", areaCrs: "EPSG:32631", limit: 1, bbox: [0,0,1,1] });
  expect(area.statusCode, area.body).toBe(200); expect(area.json()).toMatchObject({ scope: "full-layer", totalArea: 20000, featureCount: 2 });
  expect(area.json().rows.map((r: { area: number }) => r.area)).toEqual([10000,10000]);
}, 30000);
it("preserves missing CRS and ordinary image fallback through the API, not just Python", async () => {
  const missing = await post("/geo/inspect", { path: "missing.dbf" });
  expect(missing.json().crs.status).toBe("unknown"); expect(missing.json().asset.sourceFiles).toContain("missing.shp");
  const native = await post("/geo/vector-page", { path: "missing.dbf" });
  expect(native.statusCode, native.body).toBe(200); expect(native.json().displayCrs).toBe("native");
  const refused = await post("/geo/area-table", { path: "missing.shp", classField: "class", method: "geodesic" });
  expect(refused.statusCode).toBe(422);
  const plain = await post("/geo/inspect", { path: "plain.tif" }); expect(plain.json().asset.format).toBe("tiff");
  expect((await post("/geo/raster-window", { path: "plain.tif" })).statusCode).toBe(422);
  const gpkg = await post("/geo/inspect", { path: "multi.gpkg" }); expect(gpkg.json().layers).toHaveLength(2);
  expect((await post("/geo/vector-page", { path: "multi.gpkg" })).statusCode).toBe(422);
  const selected = await post("/geo/vector-page", { path: "multi.gpkg", layer: "points" });
  expect(selected.statusCode, selected.body).toBe(200); expect(selected.json().features.features).toHaveLength(2);
}, 30000);

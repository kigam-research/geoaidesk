import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, expect, it } from "vitest";
import { HELPERS_DIR, helperPython } from "../src/helpers-env.ts";
import { runHelperScript } from "../src/api/sci-helpers.ts";
import { sandboxFixture } from "./fixtures/geo/factories.ts";
const f = sandboxFixture();
afterAll(() => f.cleanup());
const script = path.join(HELPERS_DIR, "geo_inspect_helper.py");
it("helper follows not-found and bad-value exit codes", async () => {
  expect((await runHelperScript(script, ["summarize", path.join(f.root, "missing.gpkg"), "--format", "geopackage"])).status).toBe(4);
});
const probe = spawnSync(helperPython(), ["-c", "import pyogrio, rasterio, pyproj"], { encoding: "utf8", timeout: 10_000 });
it.skipIf(probe.status !== 0)("optional pyogrio/rasterio/pyproj helper: GeoPackage layer/field/CRS metadata (skipped when geo modules are absent)", async () => {
  const file = path.join(f.root, "layers.gpkg");
  const create = spawnSync(helperPython(), ["-c", `import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as db:
 db.execute('PRAGMA application_id=1196444487')
 db.execute('CREATE TABLE gpkg_contents(table_name TEXT,data_type TEXT,srs_id INTEGER,min_x REAL,min_y REAL,max_x REAL,max_y REAL)')
 db.execute('CREATE TABLE gpkg_spatial_ref_sys(srs_id INTEGER, definition TEXT)')
 db.execute('CREATE TABLE gpkg_geometry_columns(table_name TEXT,geometry_type_name TEXT)')
 db.execute('CREATE TABLE rocks(id INTEGER,label TEXT)')
 db.execute("INSERT INTO gpkg_contents VALUES('rocks','features',4326,1,2,3,4)")
 db.execute("INSERT INTO gpkg_spatial_ref_sys VALUES(4326,'EPSG:4326')")
 db.execute("INSERT INTO gpkg_geometry_columns VALUES('rocks','POINT')")
`, file], { encoding: "utf8", timeout: 5000 });
  expect(create.status, create.stderr).toBe(0);
  const result = await runHelperScript(script, ["summarize", file, "--format", "geopackage"], 5000);
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ layers: [{ name: "rocks", geometryType: "POINT", crs: { status: "declared", authority: "EPSG:4326" }, fields: [{ name: "id", type: "INTEGER" }, { name: "label", type: "TEXT" }] }] });
  // Metadata helper never fabricates a scanned geometry feature count.
  expect(JSON.parse(result.stdout).layers[0].featureCount).toBeUndefined();
  f.write("invalid.gpkg", "not sqlite"); expect((await runHelperScript(script, ["summarize", path.join(f.root, "invalid.gpkg"), "--format", "geopackage"])).status).toBe(5);
});

import { describe, expect, it } from "vitest";

import { dataLineParts, groupSourceFiles } from "./source-files";

const f = (name: string) => ({ name });

describe("source files", () => {
  it("groups a shapefile set and a raster with its world file, keeps other files apart", () => {
    const groups = groupSourceFiles([
      f("drill.shp"), f("drill.dbf"), f("paper.pdf"), f("drill.shx"), f("drill.prj"),
      f("dem.tif"), f("dem.tfw"), f("obs.csv"), f("obs.prj"),
    ]);
    expect(groups).toEqual([
      { name: "drill.shp", files: [f("drill.shp"), f("drill.dbf"), f("drill.shx"), f("drill.prj")] },
      { single: f("paper.pdf") },
      { name: "dem.tif", files: [f("dem.tif"), f("dem.tfw")] },
      // A CSV is not read with a .prj: both stay separate sources.
      { single: f("obs.csv") },
      { single: f("obs.prj") },
    ]);
    expect(groupSourceFiles([f("only.shp")])).toEqual([{ single: f("only.shp") }]);
  });

  it("summarises the first data file with its counts and CRS", () => {
    const entry = (path: string, data?: object, companionOf?: string) =>
      ({ path, size: 1, sha256: "x", text: false, ...(data ? { data } : {}), ...(companionOf ? { companionOf } : {}) }) as never;
    expect(
      dataLineParts([
        entry("a.shp", { format: "shapefile", family: "vector", crs: "EPSG:5186", layers: [{ name: "a", featureCount: 12 }], inspector: "x" }),
        entry("a.dbf", undefined, "a.shp"),
        entry("b.csv", { format: "csv", family: "table", columns: [{ name: "x" }], inspector: "x" }),
      ]),
    ).toEqual({ format: "Shapefile", facts: [{ key: "features", count: 12 }], crs: "EPSG:5186", more: 1 });
    expect(
      dataLineParts([entry("c.csv", { format: "csv", family: "table", columns: [{ name: "x" }, { name: "y" }], rows: 900, rowsEstimated: true, inspector: "x" })]),
    ).toEqual({ format: "CSV", facts: [{ key: "columns", count: 2 }], crs: null, more: 0 });
    expect(dataLineParts([entry("d.tif", { format: "geotiff", family: "raster", crs: "unknown", bands: [{ index: 1 }], inspector: "x" })])?.crs).toBe("");
    expect(dataLineParts([entry("e.py")])).toBeNull();
  });
});

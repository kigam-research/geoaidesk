import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectGeoFile, registerGeoInspector, MAX_INSPECTION_BYTES } from "../src/geo/inspection.ts";
import { baselineInspector } from "../src/geo/inspectors/baseline.ts";
import { runHelperScript } from "../src/api/sci-helpers.ts";
import { sandboxFixture, las2, shapeSet, tiff } from "./fixtures/geo/factories.ts";
vi.mock("../src/api/sci-helpers.ts", () => ({ runHelperScript: vi.fn(async () => ({ status: 3, stdout: "", stderr: "missing", timedOut: false })) }));
let f: ReturnType<typeof sandboxFixture>;
beforeEach(() => { f = sandboxFixture(); vi.clearAllMocks(); });
afterEach(() => { f.cleanup(); registerGeoInspector(baselineInspector); });
const inspect = (name: string, previewRows?: number) => inspectGeoFile("p", f.paths, name, { previewRows });
describe("shared bounded inspection", () => {
  it("parses LAS 2 headers, original units, NULL rows, while keeping depth basis unknown", async () => {
    f.write("log.LAS", las2);
    const out = await inspect("log.LAS");
    expect(out).toMatchObject({ schemaVersion: "geo-inspection/v1", asset: { format: "las", family: "well-log" }, depth: { basis: "unknown", start: 100, stop: 101, step: 0.5, unit: "M" }, curveInventory: [{ mnemonic: "DEPT", unit: "M" }, { mnemonic: "GR", unit: "API" }], preview: { rows: [[100, 12], [100.5, null], [101, 14]] } });
    expect(out.preview!.headerLines!.join("\n")).toContain("VERS. 2.0");
  });
  it("reports LAS 3, wrapped logs and binary LiDAR without treating them as ordinary numeric logs", async () => {
    f.write("v3.las", las2.replace("VERS. 2.0", "VERS. 3.0"));
    expect((await inspect("v3.las")).issues.some(i => i.code === "las-version-3")).toBe(true);
    f.write("wrap.las", las2.replace("WRAP. NO", "WRAP. YES"));
    expect(await inspect("wrap.las")).toMatchObject({ preview: { rows: [] }, issues: expect.arrayContaining([expect.objectContaining({ code: "las-wrapped" })]) });
    f.write("points.las", Buffer.concat([Buffer.from("LASF"), Buffer.alloc(128)]));
    expect((await inspect("points.las")).issues[0].code).toBe("lidar-las-unsupported");
  });
  it("bounds large LAS, caps rows, handles partial lines and preserves no full-hash claim", async () => {
    f.write("large.las", las2 + "102 20\n".repeat(100000));
    const out = await inspect("large.las", 10000);
    expect(out.preview!.rows!.length).toBe(50); expect(out.preview!.truncated).toBe(true); expect(out.asset.sha256).toBeUndefined();
    expect(out.asset.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    f.write("header.las", "~V\nVERS. 2.0\n" + "#header\n".repeat(50000));
    expect((await inspect("header.las")).issues.some(i => i.code === "las-data-not-reached")).toBe(true);
  });
  it("groups case-insensitive companions, parses features/fields/CRS/extent, fingerprints all sources", async () => {
    shapeSet(f);
    const out = await inspect("Rock.SHP");
    expect(out.asset.sourceFiles).toHaveLength(5);
    expect(out.layers![0]).toMatchObject({ geometryType: "Point", featureCount: 2, fields: [{ name: "ROCK", type: "C" }] });
    expect(out.crs).toMatchObject({ status: "declared", authority: "EPSG:4326", name: "WGS 84" });
    expect(out.extent).toEqual({ bbox: [1, 2, 3, 4], coordinateSpace: "crs" });
    f.write("rock.PRJ", 'GEOGCS["modified",AUTHORITY["EPSG","4326"]]');
    expect((await inspect("rock.ShX")).asset.fingerprint).not.toBe(out.asset.fingerprint);
    // Same primary path: a companion-only modification must invalidate the key.
    expect((await inspect("Rock.SHP")).asset.fingerprint).not.toBe(out.asset.fingerprint);
  });
  it("keeps missing PRJ unknown and lists all missing companions without guessing coordinates", async () => {
    shapeSet(f, false); fs.rmSync(path.join(f.root, "rock.ShX"));
    const out = await inspect("Rock.SHP");
    expect(out.crs).toEqual({ status: "unknown" }); expect(out.extent!.coordinateSpace).toBe("native");
    expect(out.missingCompanions).toEqual(expect.arrayContaining(["Rock.shx", "Rock.prj"]));
    expect(out.issues.map(i => i.code)).toContain("missing-prj"); expect(out.layers![0].featureCount).toBeUndefined();
  });
  it("does not promote nested geographic/method EPSG IDs to the dataset CRS", async () => {
    shapeSet(f); f.write("rock.PRJ", 'PROJCS["Local TM",GEOGCS["WGS 84",AUTHORITY["EPSG","4326"]],PROJECTION["TM",ID["EPSG",9807]]]');
    const out = await inspect("Rock.SHP"); expect(out.crs!.status).toBe("declared"); expect(out.crs!.authority).toBeUndefined();
  });
  it("keeps depth basis unknown when TVD is merely another curve, and honors explicit BASIS", async () => {
    f.write("curves.las", las2.replace("GR.API : gamma ray", "TVD.M : another curve"));
    expect((await inspect("curves.las")).depth!.basis).toBe("unknown");
    f.write("basis.las", las2.replace("RUN. 1", "BASIS. TVD : depth basis\nRUN. 1"));
    expect((await inspect("basis.las")).depth!.basis).toBe("TVD");
  });
  it.each([false, true])("recognizes GeoTIFF metadata/magic including big-endian=%s", async bigEndian => {
    f.write("image.bin", tiff(true, true, bigEndian));
    const out = await inspect("image.bin");
    expect(out.asset.format).toBe("geotiff"); expect(out.crs).toEqual({ status: "declared", authority: "EPSG:5186" });
    expect(out.dimensions).toEqual([{ name: "width", size: 2 }, { name: "height", size: 3 }]);
    expect(out.extent).toEqual({ bbox: [100, 170, 120, 200], coordinateSpace: "crs" });
    expect(out.bands).toEqual([{ index: 1, dtype: "uint16" }]);
  });
  it("distinguishes plain TIFF from tags without CRS and degrades visibly when helper is missing", async () => {
    f.write("plain.tif", tiff()); expect((await inspect("plain.tif")).asset.format).toBe("tiff");
    f.write("unknown.tif", tiff(true, false)); const out = await inspect("unknown.tif");
    expect(out.asset.format).toBe("geotiff"); expect(out.crs!.status).toBe("unknown");
    expect(out.issues.map(i => i.code)).toContain("geo-helper-deps-missing");
  });
  it("dispatches corrected GeoTIFF to a format-only registered inspector and fingerprints its version", async () => {
    f.write("raster.tif", tiff(true)); f.write("plain.tif", tiff());
    const baseline = await inspect("raster.tif");
    const richer = vi.fn(async (ctx) => {
      expect(ctx.format).toBe("geotiff");
      return { ...baseline, bands: [{ index: 1, dtype: "richer" }] };
    });
    registerGeoInspector({ name: "map-inspector", version: "2", formats: ["geotiff"], inspect: richer });
    const out = await inspect("raster.tif");
    expect(richer).toHaveBeenCalledTimes(1); expect(out.inspector).toEqual({ name: "map-inspector", version: "2" });
    expect(out.bands![0].dtype).toBe("richer"); expect(out.asset.fingerprint).not.toBe(baseline.asset.fingerprint);
    expect((await inspect("plain.tif")).asset.format).toBe("tiff"); expect(richer).toHaveBeenCalledTimes(1);
  });
  it("returns an issue with corrected format when a registered richer inspector fails", async () => {
    f.write("raster.tif", tiff(true));
    registerGeoInspector({ name: "map-inspector", version: "bad", formats: ["geotiff"], async inspect() { throw new Error("bad content"); } });
    const out = await inspect("raster.tif");
    expect(out.asset.format).toBe("geotiff"); expect(out.issues.map(i => i.code)).toContain("inspection-failed");
  });
  it("reports BigTIFF and malformed IFDs instead of throwing content errors", async () => {
    f.write("big.tif", Buffer.from([73, 73, 43, 0, 8, 0, 0, 0]));
    expect((await inspect("big.tif")).issues.map(i => i.code)).toContain("bigtiff-unsupported");
    f.write("bad.tif", Buffer.from([73, 73, 42, 0, 255, 255, 255, 255]));
    expect((await inspect("bad.tif")).issues.map(i => i.code)).toContain("inspection-failed");
  });
  it("uses RFC 7946 explicitly only after complete GeoJSON parsing, with legacy and large-structure handling", async () => {
    const doc = { type: "FeatureCollection", features: [{ type: "Feature", properties: { rock: "a" }, geometry: { type: "Point", coordinates: [1, 2] } }] };
    f.write("geo.json", JSON.stringify(doc)); let out = await inspect("geo.json");
    expect(out.asset.format).toBe("geojson"); expect(out.layers![0].featureCount).toBe(1); expect(out.crs!.name).toContain("RFC 7946");
    f.write("legacy.geojson", JSON.stringify({ ...doc, crs: { properties: { name: "EPSG:5186" } } }));
    expect((await inspect("legacy.geojson")).crs!.authority).toBe("EPSG:5186");
    f.write("big.geojson", JSON.stringify({ ...doc, padding: " ".repeat(MAX_INSPECTION_BYTES + 100) }));
    out = await inspect("big.geojson"); expect(out.crs!.status).toBe("unknown"); expect(out.preview!.truncated).toBe(true);
    f.write("bad.geojson", '{"type":"FeatureCollection",'); expect((await inspect("bad.geojson")).issues[0].code).toBe("inspection-failed");
  });
  it("summarizes CSV/TSV/text and quoted/multiline cells without inventing exact row counts for large prefixes", async () => {
    f.write("table.csv", 'hole,value\n"a,b",2\n"multi\nline",3\n');
    expect(await inspect("table.csv")).toMatchObject({ columns: [{ name: "hole" }, { name: "value" }], preview: { rows: [["a,b", "2"], ["multi\nline", "3"]], sourceRows: 2 } });
    f.write("table.tsv", "x\ty\n1\t2\n"); expect((await inspect("table.tsv")).preview!.rows).toEqual([["1", "2"]]);
    f.write("a.txt", "one\ntwo\n"); expect((await inspect("a.txt")).preview!.rows).toEqual([["one"], ["two"]]);
    f.write("big.csv", "x,y\n" + "1,2\n".repeat(100000)); expect((await inspect("big.csv")).preview!.method).toContain("estimate");
  });
  it("validates GeoPackage application id and uses metadata helper for layers", async () => {
    const header = Buffer.alloc(100); header.write("SQLite format 3\0"); header.writeUInt32BE(0x47504b47, 68); f.write("layers.gpkg", header);
    let out = await inspect("layers.gpkg"); expect(out.asset.format).toBe("geopackage"); expect(out.issues[0].code).toBe("geo-helper-deps-missing");
    vi.mocked(runHelperScript).mockResolvedValueOnce({ status: 0, stdout: JSON.stringify({ layers: [{ name: "rocks", crs: { status: "unknown" }, fields: [{ name: "id", type: "INTEGER" }] }] }), stderr: "", timedOut: false });
    out = await inspect("layers.gpkg"); expect(out.layers![0].name).toBe("rocks");
    header.writeUInt32BE(0, 68); f.write("wrong.gpkg", header); expect((await inspect("wrong.gpkg")).asset.format).toBe("binary");
  });
  it("rejects escapes, symlink escapes, dot directories, absent paths and directories", async () => {
    f.write(".hidden/x.csv", "x\n1");
    for (const [name, statusCode] of [["../x", 403], [".hidden/x.csv", 404], ["missing", 404], [".", 400]] as const) await expect(inspect(name)).rejects.toMatchObject({ statusCode });
    fs.symlinkSync("/etc/passwd", path.join(f.root, "escape")); await expect(inspect("escape")).rejects.toMatchObject({ statusCode: 403 });
    shapeSet(f); fs.rmSync(path.join(f.root, "rock.PRJ")); fs.symlinkSync("/etc/passwd", path.join(f.root, "rock.PRJ"));
    const out = await inspect("Rock.SHP"); expect(out.asset.sourceFiles).not.toContain("rock.PRJ"); expect(out.crs!.status).toBe("unknown");
  });
  it("shares actual byte caps with registered inspectors and includes their version in fingerprints", async () => {
    f.write("a.txt", "x".repeat(MAX_INSPECTION_BYTES * 2));
    const first = await inspect("a.txt");
    registerGeoInspector({ name: "test-reader", version: "2", formats: ["text"], async inspect(ctx) {
      const data = await ctx.readBytes!(ctx.relPath, 0, MAX_INSPECTION_BYTES * 10);
      const second = await ctx.readBytes!(ctx.relPath, 0, 10);
      expect(data.length).toBe(MAX_INSPECTION_BYTES - 512); expect(second.length).toBe(0);
      return { ...first, inspector: { name: "ignored", version: "ignored" } };
    } });
    const second = await inspect("a.txt"); expect(second.inspector).toEqual({ name: "test-reader", version: "2" }); expect(second.asset.fingerprint).not.toBe(first.asset.fingerprint);
  });
});

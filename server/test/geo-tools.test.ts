import { beforeEach, afterEach, expect, it } from "vitest";
import { makeGeoTools, readGeoWindow, MAX_WINDOW_BYTES, MAX_WINDOW_SCAN_BYTES } from "../src/geo/tools.ts";
import { sandboxFixture, las2, tiff } from "./fixtures/geo/factories.ts";
let f: ReturnType<typeof sandboxFixture>;
beforeEach(() => { f = sandboxFixture(); }); afterEach(() => f.cleanup());
it("returns compact text and the same full shared inspection in details", async () => {
  f.write("a.las", las2);
  const tools = makeGeoTools("p", f.paths);
  const inspect = tools.find(t => t.name === "geo_inspect")!;
  const result = await inspect.execute("tc", { path: "a.las" }, undefined, undefined, {} as never);
  expect(Buffer.byteLength((result.content[0] as { text: string }).text)).toBeLessThanOrEqual(3000);
  expect(result.details.inspection).toMatchObject({ schemaVersion: "geo-inspection/v1", asset: { path: "a.las" }, depth: { basis: "unknown" } });
  expect(inspect.promptSnippet).toContain("geo_inspect");
});
it("uses 1-based line offsets and returns bounded LAS/CSV/text windows", async () => {
  f.write("a.csv", "h,x\n1,2\n3,4\n5,6\n");
  expect(await readGeoWindow(f.paths, "a.csv", { offset: 2, limit: 2 })).toMatchObject({ lines: ["1,2", "3,4"], nextOffset: 4, sampled: true, truncated: true });
  f.write("a.las", las2); expect((await readGeoWindow(f.paths, "a.las", { limit: 2 })).lines).toEqual(["~Version Information", "VERS. 2.0 : CWLS"]);
  f.write("a.txt", "α\nβ\nγ"); expect((await readGeoWindow(f.paths, "a.txt", { offset: 2 })).lines).toEqual(["β", "γ"]);
});
it("caps lines, byte output and scan work independently", async () => {
  f.write("many.csv", "x,y\n".repeat(1000));
  expect((await readGeoWindow(f.paths, "many.csv", { limit: 100000 })).lines).toHaveLength(200);
  f.write("long.txt", "한".repeat(100000));
  const tool = makeGeoTools("p", f.paths).find(t => t.name === "geo_read_window")!;
  const result = await tool.execute("tc", { path: "long.txt", limit: 200 }, undefined, undefined, {} as never);
  expect(Buffer.byteLength((result.content[0] as { text: string }).text)).toBeLessThanOrEqual(MAX_WINDOW_BYTES);
  expect(result.details.window.partialLine).toBe(true);
  f.write("far.csv", "x,y\n".repeat(1500000));
  const far = await readGeoWindow(f.paths, "far.csv", { offset: 1400000 });
  expect(far.lines).toEqual([]); expect(far.scannedBytes).toBeLessThanOrEqual(MAX_WINDOW_SCAN_BYTES); expect(far.scanLimited).toBe(true);
});
it("rejects binary windows, unsafe paths, invalid bounds and honors abort", async () => {
  f.write("r.tif", tiff()); await expect(readGeoWindow(f.paths, "r.tif")).rejects.toThrow(/Binary data/);
  await expect(readGeoWindow(f.paths, "../outside")).rejects.toMatchObject({ statusCode: 403 });
  for (const options of [{ offset: 0 }, { limit: 0 }, { offset: 1.5 }, { limit: Infinity }]) await expect(readGeoWindow(f.paths, "r.tif", options)).rejects.toThrow(/positive integers/);
  f.write("a.txt", "one\n"); await expect(readGeoWindow(f.paths, "a.txt", {}, AbortSignal.abort())).rejects.toThrow();
});

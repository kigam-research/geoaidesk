import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGeoMapRoutes } from "../src/geo/routes/maps.ts";
import { clearTileCache, parseTileQuery } from "../src/geo/maps/tiles.ts";
import { parseMapRequest } from "../src/geo/maps/service.ts";
import { runMapHelper } from "../src/geo/maps/process.ts";
import { resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
vi.mock("../src/geo/maps/process.ts", () => ({ runMapHelper: vi.fn() }));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const ids = ["tiles-a", "tiles-b"];

async function app() {
  const server = Fastify();
  server.addHook("onRequest", (req, _reply, done) => withActiveProject(String(req.headers["x-project-id"] ?? (req.query as { project?: string }).project ?? "tiles-a"), done));
  await registerGeoMapRoutes(server);
  return server;
}
const tileUrl = (extra = "") => `/geo/raster-tile?project=tiles-b&path=dem.tif&band=1&crs=EPSG%3A5186&bbox=0,0,10,10&size=256&low=0&high=5&v=x${extra}`;
beforeEach(() => {
  vi.resetAllMocks(); clearTileCache();
  for (const id of ids) { fs.mkdirSync(resolvePaths(id).sandbox, { recursive: true }); fs.writeFileSync(path.join(resolvePaths(id).sandbox, "dem.tif"), id); }
});
afterEach(() => { for (const id of ids) fs.rmSync(resolvePaths(id).root, { recursive: true, force: true }); });

describe("raster display tiles", () => {
  it("validates tile queries: finite ordered bbox, two sizes, an explicit colour range unless categorical", () => {
    expect(parseTileQuery({ path: "a.tif", bbox: "0,0,1,1", low: "0", high: "1" })).toMatchObject({ band: 1, crs: "EPSG:3857", size: 256, bbox: [0, 0, 1, 1], low: 0, high: 1 });
    expect(parseTileQuery({ path: "a.tif", bbox: "0,0,1,1", categorical: "1" })).not.toHaveProperty("low");
    for (const bad of [{ bbox: "0,0,0,1" }, { bbox: "0,0,1" }, { bbox: "0,0,1,Infinity" }, { size: "300" }, { crs: "+proj=x" }, { low: "a" }, { band: "0" }]) {
      expect(() => parseTileQuery({ path: "a.tif", bbox: "0,0,1,1", low: "0", high: "1", ...bad })).toThrow();
    }
  });
  it("serves cacheable PNG tiles from the requested project, shares one helper call per cold tile", async () => {
    const server = await app();
    let release!: () => void;
    vi.mocked(runMapHelper).mockImplementation(() => new Promise(resolve => { release = () => resolve({ png: PNG.toString("base64") } as never); }));
    try {
      const pending = [server.inject({ url: tileUrl() }), server.inject({ url: tileUrl() })];
      await vi.waitFor(() => expect(runMapHelper).toHaveBeenCalledTimes(1));
      release();
      for (const res of await Promise.all(pending)) {
        expect(res.statusCode).toBe(200); expect(res.headers["content-type"]).toBe("image/png");
        expect(res.headers["cache-control"]).toBe("private, max-age=86400"); expect(res.rawPayload.equals(PNG)).toBe(true);
      }
      expect(vi.mocked(runMapHelper).mock.calls[0][0]).toMatchObject({ operation: "raster-tile", path: path.join(resolvePaths("tiles-b").sandbox, "dem.tif"), displayCrs: "EPSG:5186", bbox: [0, 0, 10, 10], low: 0, high: 5 });
      expect((await server.inject({ url: tileUrl() })).statusCode).toBe(200);
      expect(runMapHelper).toHaveBeenCalledTimes(1);
      // A changed source is a new cache identity even under the same URL.
      fs.writeFileSync(path.join(resolvePaths("tiles-b").sandbox, "dem.tif"), "changed bytes");
      vi.mocked(runMapHelper).mockResolvedValue({ png: PNG.toString("base64") } as never);
      expect((await server.inject({ url: tileUrl() })).statusCode).toBe(200);
      expect(runMapHelper).toHaveBeenCalledTimes(2);
      expect((await server.inject({ url: tileUrl().replace("path=dem.tif", "path=..%2Fx.tif") })).statusCode).toBe(403);
      expect((await server.inject({ url: tileUrl() + "&path=other.tif" })).statusCode).toBe(400);
      fs.writeFileSync(path.join(resolvePaths("tiles-b").sandbox, "notes.txt"), "text");
      expect((await server.inject({ url: tileUrl().replace("dem.tif", "notes.txt") })).statusCode).toBe(422);
    } finally { await server.close(); }
  });
  it("style and point read the original file and never accept another project's path", async () => {
    const server = await app();
    vi.mocked(runMapHelper).mockResolvedValueOnce({ kind: "raster-style", bbox: [0, 0, 1, 1] } as never).mockResolvedValueOnce({ kind: "raster-point", inside: true, value: 0 } as never);
    try {
      const style = await server.inject({ method: "POST", url: "/geo/raster-style", headers: { "x-project-id": "tiles-a" }, payload: { path: "dem.tif", displayCrs: "EPSG:5186", projectId: "tiles-b" } });
      expect(style.statusCode).toBe(200); expect(style.json()).toMatchObject({ path: "dem.tif", version: expect.any(String) });
      expect(vi.mocked(runMapHelper).mock.calls[0][0]).toMatchObject({ operation: "raster-style", prepare: true, path: path.join(resolvePaths("tiles-a").sandbox, "dem.tif") });
      expect(vi.mocked(runMapHelper).mock.calls[0][1]).toMatchObject({ timeoutMs: 180000 });
      const point = await server.inject({ method: "POST", url: "/geo/raster-point", headers: { "x-project-id": "tiles-a" }, payload: { path: "dem.tif", coordinate: [1, 2] } });
      expect(point.json()).toMatchObject({ value: 0 });
      expect((await server.inject({ method: "POST", url: "/geo/raster-point", payload: { path: "dem.tif", coordinate: [1, "x"] } })).statusCode).toBe(400);
    } finally { await server.close(); }
  });
  it("a whole-layer vector request has no bbox and a larger, bounded limit", () => {
    expect(parseMapRequest({ path: "a.gpkg", full: true })).toMatchObject({ full: true, limit: 20000, offset: 0 });
    expect(parseMapRequest({ path: "a.gpkg", full: true, limit: 999999 })).toMatchObject({ limit: 20000 });
    expect(() => parseMapRequest({ path: "a.gpkg", full: true, bbox: [0, 0, 1, 1] })).toThrow(/no bbox/);
    expect(() => parseMapRequest({ path: "a.gpkg", full: "yes" })).toThrow();
  });
});

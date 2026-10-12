import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createKeyResolver, parseMapKeys } from "../src/geo/basemaps/keys.ts";
import { ngiiMatrixSize, providerCatalog, validateKigam, validateNgii } from "../src/geo/basemaps/providers.ts";
import { fetchImage, redactBasemapUrl, validateUpstream } from "../src/geo/basemaps/upstream.ts";
import { registerGeoBasemapRoutes } from "../src/geo/basemaps/routes.ts";
import { registerRequestGuard } from "../src/request-guard.ts";
import { registerAuth, resetAuthForTests } from "../src/auth.ts";
import { isCorsOriginAllowed } from "../src/cors.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
const image = () => new Response(png, { headers: { "Content-Type": "image/png" } });
const upstreamUrl = new URL("https://map.ngii.go.kr/openapi/Gettile.do?apikey=secret");
const cleanups: string[] = [];
const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map(a => a.close()));
  await Promise.all(cleanups.splice(0).map(p => rm(p, { recursive: true, force: true })));
  vi.unstubAllEnvs(); resetAuthForTests();
});
async function temp() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gaid-basemaps-")); cleanups.push(dir); return dir;
}

describe("map credentials", () => {
  it("parses supported aliases only, quotes, export and Unicode names without evaluating shell text", () => {
    expect(parseMapKeys('# comment\nexport NGII_KEY="one=two"\n활용URL=\'https://example.org/\'\nClient_Secret=ignored\nKIGAM_KEY=$(not-executed)')).toEqual({
      NGII_KEY: "one=two", 활용URL: "https://example.org/", KIGAM_KEY: "$(not-executed)",
    });
  });
  it("prioritizes process aliases, first existing file, then reloads changed files", async () => {
    const home = await temp();
    const selected = path.join(home, "selected.conf");
    await mkdir(path.join(home, "gaid"));
    await mkdir(path.join(home, ".config", "map_env"), { recursive: true });
    await writeFile(path.join(home, "gaid", "map-keys.env"), "NGII_API_KEY=home-key\nKIGAM_API_KEY=home-geology");
    await writeFile(path.join(home, ".config", "map_env", "map-keys.env"), "NGII_API_KEY=fallback-key");
    const env = { GAID_MAP_KEYS_FILE: selected, GAID_HOME: path.join(home, "gaid"), NGII_KEY: "process-key" };
    const keys = createKeyResolver(env, home);
    expect(await keys()).toEqual({ ngii: "process-key", kigam: "home-geology", referer: undefined });
    await writeFile(selected, "GAID_NGII_API_KEY=file-key\n활용URL=https://example.org/\nKIGAM_KEY=geology-one");
    expect(await keys()).toEqual({ ngii: "process-key", kigam: "geology-one", referer: "https://example.org/" });
    await writeFile(selected, "KIGAM_KEY=geology-two");
    await utimes(selected, new Date(), new Date(Date.now() + 2000));
    expect((await keys()).kigam).toBe("geology-two");
    await writeFile(selected, "");
    expect((await keys()).kigam).toBeUndefined(); // Empty first file does not merge subsequent files.
    await rm(selected);
    delete (env as Record<string, unknown>).GAID_HOME;
    expect((await keys()).ngii).toBe("process-key");
    delete (env as Record<string, unknown>).NGII_KEY;
    expect((await keys()).ngii).toBe("fallback-key");
  });
  it("orders aliases, treats empty aliases as absent, rejects unusable referers", async () => {
    const home = await temp();
    const keys = createKeyResolver({ GAID_NGII_API_KEY: " ", NGII_API_KEY: "preferred", NGII_KEY: "later", NGII_REFERER: "javascript:bad" }, home);
    expect(await keys()).toEqual({ ngii: "preferred", referer: undefined, kigam: undefined });
  });
  it("returns only safe status metadata with missing-key/referer reasons", () => {
    const missing = providerCatalog({ ngii: "ngii-sensitive-value", kigam: "kigam-sensitive-value" });
    expect(missing.providers.find(p => p.id === "ngii-base")).toMatchObject({ available: false, reason: "missing-referer" });
    expect(missing.providers.find(p => p.id === "kigam-geology")).toMatchObject({ available: true });
    expect(JSON.stringify(missing)).not.toMatch(/sensitive-value|apikey|openapi/);
    expect(providerCatalog({}).providers.filter(p => p.available).map(p => p.id)).toEqual(["none", "osm"]);
  });
});

describe("provider bounds and upstream", () => {
  it("enforces NGII matrix indices at both ends of the zoom range", () => {
    for (const z of [5, 13, 18]) {
      expect(() => validateNgii("korean_map", z, ngiiMatrixSize(z) - 1, 0)).not.toThrow();
      expect(() => validateNgii("korean_map", z, ngiiMatrixSize(z), 0)).toThrow();
    }
    for (const v of [[4, 0, 0], [19, 0, 0], [5, -1, 0], [5, 0, 1.5], [NaN, 0, 0]]) expect(() => validateNgii("korean_map", ...v as [number, number, number])).toThrow();
    expect(() => validateNgii("unlisted", 13, 981, 553)).toThrow();
  });
  it("bounds KIGAM bbox and pixel dimensions", () => {
    expect(() => validateKigam([200000, 500000, 260000, 560000], 1024, 1)).not.toThrow();
    for (const box of [[], [0, 0, 0, 1], [0, 0, 60001, 1], [0, 0, 1, Infinity], [NaN, 0, 1, 1]]) expect(() => validateKigam(box, 256, 256)).toThrow();
    for (const size of [0, 1025, 1.2, NaN]) expect(() => validateKigam([0, 0, 1, 1], size, 256)).toThrow();
  });
  it("allowlists exact HTTPS host/path pairs and redacts query credentials", () => {
    expect(() => validateUpstream(upstreamUrl)).not.toThrow();
    for (const url of ["http://map.ngii.go.kr/openapi/Gettile.do", "https://map.ngii.go.kr.evil.test/openapi/Gettile.do", "https://map.ngii.go.kr/other", "https://data.kigam.re.kr/mgeo/geoserver/geoOpen/wfs", "https://user:pass@map.ngii.go.kr/openapi/Gettile.do", "https://map.ngii.go.kr:444/openapi/Gettile.do"]) expect(() => validateUpstream(new URL(url))).toThrow();
    expect(redactBasemapUrl("https://example.org/?APIKEY=abc&key=def&z=13")).toBe("https://example.org/?APIKEY=[redacted]&key=[redacted]&z=13");
  });
  it("checks magic and content type, caps streamed bytes, never exposes upstream errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(image());
    expect((await fetchImage(upstreamUrl, {}, fetcher)).type).toBe("image/png");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    for (const response of [new Response("secret-body", { status: 403 }), new Response("<error>secret-body</error>", { headers: { "content-type": "image/png" } }), new Response(png, { headers: { "content-type": "text/html" } }), new Response(png, { headers: { "content-type": "image/png", "content-length": String(5 * 1024 * 1024) } })]) {
      await expect(fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toMatchObject({ status: 502 });
    }
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(4 * 1024 * 1024)); c.enqueue(new Uint8Array(1)); c.close(); } });
    await expect(fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)))).rejects.toThrow("response limit");
    await expect(fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockRejectedValue(new Error("https://bad/?apikey=secret")))).rejects.toThrow("request failed or timed out");
    const jpeg = () => new Response(Buffer.from([255, 216, 255, 1]), { headers: { "content-type": "image/jpeg" } });
    expect((await fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockResolvedValue(jpeg()))).type).toBe("image/jpeg");
    // NGII satellite tiles are JPEG bytes labelled image/png: the bytes decide the served type.
    const mislabelled = new Response(Buffer.from([255, 216, 255, 1]), { headers: { "content-type": "image/png" } });
    expect((await fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockResolvedValue(mislabelled))).type).toBe("image/jpeg");
    await expect(fetchImage(upstreamUrl, {}, vi.fn<typeof fetch>().mockResolvedValue(jpeg()), true)).rejects.toThrow("invalid image");
  });
});

describe("HTTP image routes", () => {
  async function appWith(keys = { ngii: "ngii-test-value", referer: "https://registered.example/", kigam: "kigam-test-value" }) {
    const app = Fastify(); apps.push(app);
    registerRequestGuard(app);
    await app.register(cors, { origin: (origin, cb) => cb(null, isCorsOriginAllowed(origin)), credentials: true });
    registerAuth(app);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => image());
    await registerGeoBasemapRoutes(app, { keys: async () => keys, fetch: fetcher });
    return { app, fetcher };
  }
  it("accepts query-token images from the allowed UI with CORS; keeps keys server-side", async () => {
    vi.stubEnv("KADY_AUTH_TOKEN", "test-access-token-12345"); resetAuthForTests();
    const { app, fetcher } = await appWith();
    expect((await app.inject("/geo/basemaps")).statusCode).toBe(401);
    const response = await app.inject({ url: "/geo/basemap/ngii/korean_map/13/981/553?kady_token=test-access-token-12345", headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "image" } });
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload).toEqual(png);
    expect(response.headers).toMatchObject({ "content-type": "image/png", "cache-control": "private, max-age=86400", "access-control-allow-origin": "http://localhost:3000" });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("tilematrix")).toBe("L13");
    expect(url.searchParams.get("apikey")).toBe("ngii-test-value");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Referer: "https://registered.example/" });
    const status = await app.inject("/geo/basemaps?kady_token=test-access-token-12345");
    expect(status.body).not.toMatch(/ngii-test-value|kigam-test-value|registered.example/);
  });
  it("maps invalid/unconfigured/upstream responses and requests KIGAM transparent WMS only", async () => {
    vi.stubEnv("KADY_REQUIRE_AUTH", "0"); resetAuthForTests();
    const { app, fetcher } = await appWith();
    for (const route of ["/geo/basemap/ngii/korean_map/4/0/0", "/geo/basemap/ngii/korean_map/5/0/99", "/geo/basemap/ngii/korean_map/5/0/1e1", "/geo/basemap/kigam?bbox=0,0,60001,1&width=256&height=256", "/geo/basemap/kigam?bbox=0,,1,1&width=256&height=256"]) expect((await app.inject(route)).statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    const response = await app.inject("/geo/basemap/kigam?bbox=190000,550000,191000,551000&width=128&height=128");
    expect(response.statusCode).toBe(200);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/openapi/wms");
    expect(url.searchParams.get("TRANSPARENT")).toBe("TRUE");
    expect(url.searchParams.get("srs")).toBe("EPSG:5186");
    fetcher.mockRejectedValueOnce(new Error("secret-key-error"));
    const failed = await app.inject("/geo/basemap/ngii/korean_map/13/981/553");
    expect(failed.statusCode).toBe(502); expect(failed.body).not.toContain("secret");
    const empty = await appWith({ ngii: "", referer: "", kigam: "" });
    expect((await empty.app.inject("/geo/basemap/ngii/korean_map/13/981/553")).statusCode).toBe(404);
    expect((await empty.app.inject("/geo/basemap/kigam?bbox=0,0,1,1&width=1&height=1")).statusCode).toBe(404);
    expect((await app.inject({ url: "/geo/basemaps", headers: { origin: "https://untrusted.example" } })).statusCode).toBe(403);
  });
});

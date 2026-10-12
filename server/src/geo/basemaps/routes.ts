import type { FastifyInstance, FastifyReply } from "fastify";
import { createKeyResolver, type MapKeys } from "./keys.ts";
import { BasemapError, providerCatalog, validateKigam, validateNgii } from "./providers.ts";
import { BROWSER_UA, fetchImage } from "./upstream.ts";

interface Options { keys?: () => Promise<MapKeys>; fetch?: typeof fetch }
export async function registerGeoBasemapRoutes(app: FastifyInstance, options: Options = {}): Promise<void> {
  const keys = options.keys ?? createKeyResolver();
  const send = async (reply: FastifyReply, load: () => ReturnType<typeof fetchImage>) => {
    try {
      const image = await load();
      return reply.type(image.type).header("Cache-Control", "private, max-age=86400").send(image.body);
    } catch (error) {
      const failure = error instanceof BasemapError ? error : new BasemapError(502, "Basemap request failed.");
      return reply.code(failure.status).header("Cache-Control", "no-store").send({ detail: failure.message });
    }
  };
  app.get("/geo/basemaps", async (_req, reply) => reply.header("Cache-Control", "no-store").send(providerCatalog(await keys())));
  app.get<{ Params: { layer: string; z: string; row: string; col: string } }>("/geo/basemap/ngii/:layer/:z/:row/:col", async (req, reply) => send(reply, async () => {
    const { layer } = req.params;
    const coords = [req.params.z, req.params.row, req.params.col];
    const [z, row, col] = coords.map(v => /^\d+$/.test(v) ? Number(v) : NaN);
    validateNgii(layer, z, row, col);
    const k = await keys();
    if (!k.ngii || !k.referer) throw new BasemapError(404, "NGII is not configured.");
    const url = new URL("https://map.ngii.go.kr/openapi/Gettile.do");
    url.search = new URLSearchParams({ apikey: k.ngii, service: "WMTS", request: "GetTile", version: "1.0.0", layer,
      style: "korean", format: "image/png", tilematrixset: "korean", tilematrix: `L${String(z).padStart(2, "0")}`, tilerow: String(row), tilecol: String(col) }).toString();
    return fetchImage(url, { Referer: k.referer, "User-Agent": BROWSER_UA }, options.fetch);
  }));
  app.get<{ Querystring: { bbox?: string; width?: string; height?: string } }>("/geo/basemap/kigam", async (req, reply) => send(reply, async () => {
    const bbox = typeof req.query.bbox === "string" ? req.query.bbox.split(",").map(v => v.trim() ? Number(v) : NaN) : [];
    const width = typeof req.query.width === "string" && /^\d+$/.test(req.query.width) ? Number(req.query.width) : NaN;
    const height = typeof req.query.height === "string" && /^\d+$/.test(req.query.height) ? Number(req.query.height) : NaN;
    validateKigam(bbox, width, height);
    const k = await keys();
    if (!k.kigam) throw new BasemapError(404, "KIGAM is not configured.");
    const url = new URL("https://data.kigam.re.kr/openapi/wms");
    url.search = new URLSearchParams({ key: k.kigam, service: "WMS", REQUEST: "GetMap", version: "1.1.1", layers: "L_50K_Geology_Map",
      srs: "EPSG:5186", bbox: bbox.join(","), width: String(width), height: String(height), FORMAT: "image/png", TRANSPARENT: "TRUE" }).toString();
    return fetchImage(url, { "User-Agent": BROWSER_UA }, options.fetch, true);
  }));
}

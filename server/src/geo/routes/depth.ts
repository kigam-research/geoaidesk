import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { readSeriesWindow, readDepthResult, validateSeriesRequest } from "../well/series.ts";
export async function registerGeoDepthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/geo/series-window", async (req, reply) => {
    try { return await readSeriesWindow(activePaths(), validateSeriesRequest(req.body)); }
    catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      req.log.error({ err }, "LAS window failed");
      return reply.code(500).send({ detail: "LAS window could not be read" });
    }
  });
  // Package-specific route until WP07 composes the three geo-result kinds.
  app.post("/geo/depth-result", async (req, reply) => {
    const body = req.body as { path?: unknown } | null;
    if (!body || typeof body.path !== "string") return reply.code(400).send({ detail: "Expected { path }" });
    try { return await readDepthResult(activePaths(), body.path); }
    catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      return reply.code(500).send({ detail: "Depth manifest could not be read" });
    }
  });
}

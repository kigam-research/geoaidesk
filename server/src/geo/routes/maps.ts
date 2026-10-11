import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { mapOperation, parseMapRequest, parseAreaRequest } from "../maps/service.ts";
import { readMapManifest } from "../maps/manifest.ts";
export async function registerGeoMapRoutes(app: FastifyInstance): Promise<void> {
  for (const [url, operation] of [["/geo/vector-page", "vector"], ["/geo/raster-window", "raster"], ["/geo/area-table", "area"]] as const) {
    app.post(url, async (req, reply) => {
      const ac = new AbortController();
      const cancel = () => { if (!reply.raw.writableEnded) ac.abort(); };
      reply.raw.on("close", cancel);
      try {
        const body = operation === "area" ? parseAreaRequest(req.body) : parseMapRequest(req.body);
        return await mapOperation(currentProjectId(), activePaths(), operation, body, ac.signal);
      } catch (err) {
        if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
        req.log.error({ err }, "map request failed");
        return reply.code(500).send({ detail: "The map could not be read" });
      } finally { reply.raw.off("close", cancel); }
    });
  }
  app.post("/geo/result", async (req, reply) => {
    try {
      const body = req.body as { path?: unknown } | null;
      if (!body || typeof body.path !== "string") throw new SandboxError(400, "A manifest path is required");
      return await readMapManifest(currentProjectId(), activePaths(), body.path);
    } catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      req.log.error({ err }, "map result failed");
      return reply.code(500).send({ detail: "The map result could not be read" });
    }
  });
}

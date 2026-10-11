import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { inspectTable } from "../tables/index.ts";
export async function registerGeoTableRoutes(app: FastifyInstance): Promise<void> {
  app.post("/geo/tables/inspect", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    try { return await inspectTable(currentProjectId(), activePaths(), req.body); }
    catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      req.log.error({ err }, "geo table assessment failed");
      return reply.code(500).send({ detail: "Table assessment failed; no checks completed" });
    }
  });
}

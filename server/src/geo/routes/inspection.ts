import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import { SandboxError } from "../../sandbox-fs.ts";
import { inspectGeoFile } from "../inspection.ts";

export async function registerGeoInspectionRoutes(app: FastifyInstance): Promise<void> {
  app.post("/geo/inspect", async (req, reply) => {
    const body = req.body as { path?: unknown; previewRows?: unknown } | null;
    if (!body || typeof body.path !== "string" || (body.previewRows !== undefined && (!Number.isInteger(body.previewRows) || (body.previewRows as number) < 0))) return reply.code(400).send({ detail: "Expected { path, previewRows?: non-negative integer }" });
    try { return await inspectGeoFile(currentProjectId(), activePaths(), body.path, { previewRows: body.previewRows as number | undefined }); }
    catch (err) {
      if (err instanceof SandboxError) return reply.code(err.statusCode).send({ detail: err.message });
      req.log.error({ err }, "geo inspection path failure");
      return reply.code(500).send({ detail: "File metadata could not be accessed" });
    }
  });
}

import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { buildHandoff, HandoffError, previewHandoff } from "../hub-handoff/builder.ts";

export async function registerGeoHubHandoffRoutes(app: FastifyInstance): Promise<void> {
  const failure = (error: unknown, reply: import("fastify").FastifyReply) => {
    if (error instanceof HandoffError) return reply.code(error.status).send({ code: error.code, detail: error.message });
    throw error;
  };
  app.post<{ Body: { sessionId?: unknown } }>("/geo/hub/handoff/preview", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try { return previewHandoff(activePaths(), req.body?.sessionId); }
    catch (error) { return failure(error, reply); }
  });
  app.post<{ Body: { sessionId?: unknown; files?: unknown; note?: unknown } }>("/geo/hub/handoff", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const result = await buildHandoff(activePaths(), req.body ?? {});
      return reply.type("application/gzip").header("Content-Disposition", `attachment; filename="${result.filename}"`).send(result.archive);
    } catch (error) { return failure(error, reply); }
  });
}

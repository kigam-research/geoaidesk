import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { buildHandoff, HandoffError, previewHandoff } from "../hub-handoff/builder.ts";
import { sendHandoff } from "../hub-handoff/send.ts";

/**
 * The API is cross-origin to the UI, so the browser reads only exposed headers. Add the bundle's file name and the
 * delivery path to what the global CORS setup already exposes (server/src/index.ts), without touching that list.
 */
function exposeHandoffHeaders(reply: import("fastify").FastifyReply): void {
  const current = String(reply.getHeader("Access-Control-Expose-Headers") ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  const names = [...current];
  for (const name of ["Content-Disposition", "X-GAID-Handoff-Path"]) if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
  reply.header("Access-Control-Expose-Headers", names.join(", "));
}

export async function registerGeoHubHandoffRoutes(app: FastifyInstance, options: Parameters<typeof sendHandoff>[2] = {}): Promise<void> {
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
    exposeHandoffHeaders(reply);
    try {
      const result = await buildHandoff(activePaths(), req.body ?? {});
      return reply.header("X-GAID-Handoff-Path", "download").type("application/gzip").header("Content-Disposition", `attachment; filename="${result.filename}"`).send(result.archive);
    } catch (error) { return failure(error, reply); }
  });
  app.post<{ Body: { sessionId?: unknown; files?: unknown; note?: unknown; siteId?: unknown } }>("/geo/hub/handoff/send", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    exposeHandoffHeaders(reply);
    try {
      const result = await buildHandoff(activePaths(), req.body ?? {});
      try {
        const sent = await sendHandoff(result.archive, req.body?.siteId, options);
        return reply.code(201).header("X-GAID-Handoff-Path", "direct").send(sent);
      } catch {
        // The response may have been lost after the hub created a draft. Do not
        // retry the upload; provide the exact bytes as the required fallback.
        return reply.header("X-GAID-Handoff-Path", "download-fallback").type("application/gzip")
          .header("Content-Disposition", `attachment; filename="${result.filename}"`).send(result.archive);
      }
    } catch (error) { return failure(error, reply); }
  });
}

/** GeoAIDesk local-model routes (see docs/tasks/gaid-runtime.md for the owning package). */
import type { FastifyInstance } from "fastify";
import { configureLocalModel, localModelStatus, LocalModelError, type LocalModelOptions } from "../local-model.ts";

export async function registerGeoLocalModelRoutes(app: FastifyInstance, options: LocalModelOptions = {}): Promise<void> {
  app.get("/geo/local-model/status", () => localModelStatus(options));
  app.post("/geo/local-model/configure", async (req, reply) => {
    try { return await configureLocalModel(req.body, options); }
    catch (error) {
      if (!(error instanceof LocalModelError)) throw error;
      return reply.code(error.statusCode).send({ detail: error.message });
    }
  });
}

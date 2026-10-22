import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { connectionMap, ConnectionError, type ConnectionOptions } from "../connections/index.ts";

export async function registerGeoConnectionRoutes(app: FastifyInstance, options: ConnectionOptions & { paths?: () => ProjectPaths } = {}): Promise<void> {
  app.get<{ Querystring: { focus?: string; depth?: string; locale?: string } }>("/geo/connections", async (req, reply) => {
    try {
      return await connectionMap((options.paths ?? activePaths)(), req.query.focus ?? "", req.query.depth === undefined ? 1 : Number(req.query.depth), { ...options, locale: req.query.locale === "en" ? "en" : "ko" });
    } catch (error) {
      if (error instanceof ConnectionError) return reply.code(error.statusCode).send({ detail: error.message });
      throw error;
    }
  });
}

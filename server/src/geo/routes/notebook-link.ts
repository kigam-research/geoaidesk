import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { NotebookLinkError, parseNotebookLinkBody, readNotebookLink, writeNotebookLink } from "../workspace/notebook-link.ts";

export async function registerGeoNotebookLinkRoutes(app: FastifyInstance, options: { paths?: () => ProjectPaths } = {}): Promise<void> {
  const pathsOf = options.paths ?? activePaths;
  app.get("/geo/notebook-link", async (_req, reply) => {
    try { return readNotebookLink(pathsOf()); }
    catch (error) {
      if (error instanceof NotebookLinkError) return reply.code(error.statusCode).send({ detail: error.message });
      throw error;
    }
  });
  app.put("/geo/notebook-link", async (req, reply) => {
    try { return writeNotebookLink(pathsOf(), parseNotebookLinkBody(req.body)); }
    catch (error) {
      if (error instanceof NotebookLinkError) return reply.code(error.statusCode).send({ detail: error.message });
      throw error;
    }
  });
}

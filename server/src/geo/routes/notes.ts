import type { FastifyInstance } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { getResearchNote, listResearchNotes, ResearchNoteError, setResearchNoteStatus } from "../notes/store.ts";

export async function registerGeoNoteRoutes(app: FastifyInstance, options: { paths?: () => ProjectPaths } = {}): Promise<void> {
  const pathsOf = options.paths ?? activePaths;
  app.get("/geo/notes", async () => listResearchNotes(pathsOf()));
  app.get<{ Params: { id: string } }>("/geo/notes/:id", async (req, reply) => {
    try { return getResearchNote(pathsOf(), req.params.id); }
    catch (error) {
      if (error instanceof ResearchNoteError) return reply.code(error.statusCode).send({ detail: error.message });
      throw error;
    }
  });
  app.post<{ Params: { id: string } }>("/geo/notes/:id/status", { bodyLimit: 1024 }, async (req, reply) => {
    const body = req.body as { status?: unknown } | null;
    try { return setResearchNoteStatus(pathsOf(), req.params.id, body?.status); }
    catch (error) {
      if (error instanceof ResearchNoteError) return reply.code(error.statusCode).send({ detail: error.message });
      throw error;
    }
  });
}

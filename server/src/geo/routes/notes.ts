import type { FastifyInstance, FastifyReply } from "fastify";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { getResearchNote, listResearchNotes, ResearchNoteError, setResearchNoteStatus } from "../notes/store.ts";
import { buildNoteBundle, buildPublicExport, localeOf, previewNoteBundle, previewPublicExport, type NoteExportOptions } from "../notes/export.ts";

export async function registerGeoNoteRoutes(app: FastifyInstance, options: { paths?: () => ProjectPaths } & NoteExportOptions = {}): Promise<void> {
  const pathsOf = options.paths ?? activePaths;
  const fail = (error: unknown, reply: FastifyReply) => {
    if (error instanceof ResearchNoteError) return reply.code(error.statusCode).send({ detail: error.message });
    const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) return reply.code(status).send({ detail: (error as Error).message });
    throw error;
  };
  const zip = (reply: FastifyReply, out: { zip: Buffer; sha256: string; fileName: string }) => reply
    .header("Content-Type", "application/zip")
    .header("Content-Length", out.zip.length)
    .header("Content-Disposition", `attachment; filename="note-export.zip"; filename*=UTF-8''${encodeURIComponent(out.fileName)}`)
    .header("X-Content-SHA256", out.sha256)
    .send(out.zip);
  app.get("/geo/notes", async () => listResearchNotes(pathsOf()));
  app.get<{ Params: { id: string } }>("/geo/notes/:id", async (req, reply) => {
    try { return getResearchNote(pathsOf(), req.params.id); }
    catch (error) { return fail(error, reply); }
  });
  app.post<{ Params: { id: string } }>("/geo/notes/:id/status", { bodyLimit: 1024 }, async (req, reply) => {
    const body = req.body as { status?: unknown } | null;
    try { return setResearchNoteStatus(pathsOf(), req.params.id, body?.status); }
    catch (error) { return fail(error, reply); }
  });
  app.get<{ Params: { id: string }; Querystring: { locale?: string } }>("/geo/notes/:id/bundle", async (req, reply) => {
    try { return await previewNoteBundle(pathsOf(), req.params.id, localeOf(req.query.locale), options); }
    catch (error) { return fail(error, reply); }
  });
  app.post<{ Params: { id: string } }>("/geo/notes/:id/bundle", { bodyLimit: 4096 }, async (req, reply) => {
    try { return zip(reply, await buildNoteBundle(pathsOf(), req.params.id, (req.body ?? {}) as Record<string, unknown>, options)); }
    catch (error) { return fail(error, reply); }
  });
  app.get<{ Params: { id: string }; Querystring: { locale?: string } }>("/geo/notes/:id/public-export", async (req, reply) => {
    try { return await previewPublicExport(pathsOf(), req.params.id, localeOf(req.query.locale), options); }
    catch (error) { return fail(error, reply); }
  });
  app.post<{ Params: { id: string } }>("/geo/notes/:id/public-export", { bodyLimit: 16 * 1024 }, async (req, reply) => {
    try { return zip(reply, await buildPublicExport(pathsOf(), req.params.id, (req.body ?? {}) as Record<string, unknown>, options)); }
    catch (error) { return fail(error, reply); }
  });
}

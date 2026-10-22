import type { FastifyInstance, FastifyReply } from "fastify";
import fs from "node:fs";
import { activePaths, type ProjectPaths } from "../../projects.ts";
import { SandboxError, safePath } from "../../sandbox-fs.ts";
import { ResearchNoteError } from "../notes/store.ts";
import { FigureError, SKILL_DIR, figureRecord, journalProfiles, listFigures, setFigureKind, setFigureTarget } from "../figures/store.ts";
import { checkFigure } from "../figures/check.ts";
import { FIGURE_CHECKS_DIR, type FigureCheckBody, type FigureKindBody, type FigureTargetBody } from "../../../../web/src/geo/contracts/figures.ts";

export async function registerGeoFigureRoutes(app: FastifyInstance, options: { paths?: () => ProjectPaths; skillDir?: string } = {}): Promise<void> {
  const pathsOf = options.paths ?? activePaths, skillDir = options.skillDir ?? SKILL_DIR;
  async function respond(reply: FastifyReply, action: () => unknown) {
    try { return await action(); }
    catch (error) {
      if (error instanceof FigureError || error instanceof SandboxError || error instanceof ResearchNoteError) {
        return reply.code(error.statusCode).send({ code: error instanceof FigureError ? error.code : "figure-path", detail: error.message });
      }
      throw error;
    }
  }
  app.get<{ Querystring: { note?: string } }>("/geo/figures", (req, reply) => respond(reply, () => listFigures(pathsOf(), req.query.note, skillDir)));
  app.get<{ Querystring: { path: string } }>("/geo/figures/record", (req, reply) => respond(reply, () => ({ figure: figureRecord(pathsOf(), req.query.path, null, null, skillDir) })));
  app.get<{ Querystring: { sha256: string; variant: string } }>("/geo/figures/check-preview", (req, reply) => respond(reply, () => {
    const { sha256, variant } = req.query;
    if (!/^[a-f0-9]{64}$/.test(sha256 ?? "") || !["deuteranopia", "protanopia", "tritanopia"].includes(variant)) throw new FigureError(400, "figure-preview", "Invalid figure preview");
    const file = safePath(`${FIGURE_CHECKS_DIR}/${sha256}-cvd-${variant}.png`, pathsOf().sandbox);
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error("Not a preview file");
    } catch { throw new FigureError(404, "figure-preview-missing", "Figure preview not found"); }
    return reply.type("image/png").header("Cache-Control", "private, no-cache").send(fs.createReadStream(file));
  }));
  app.get("/geo/figures/journals", (_req, reply) => respond(reply, () => ({ journals: journalProfiles(skillDir).map(j => ({
    id: j.id, name: j.name, widths: j.widths, rulesCheckedAt: j.rulesCheckedAt || null, sourceUrl: j.sources[0]?.url ?? null,
  })) })));
  app.put<{ Body: FigureKindBody }>("/geo/figures/kind", { bodyLimit: 8192 }, (req, reply) => respond(reply, () => ({ figure: setFigureKind(pathsOf(), req.body?.path, req.body?.sha256, req.body?.kind, skillDir) })));
  app.put<{ Body: FigureTargetBody }>("/geo/figures/target", { bodyLimit: 4096 }, (req, reply) => respond(reply, () => ({ target: setFigureTarget(pathsOf(), req.body?.journalId, req.body?.width, skillDir) })));
  app.post<{ Body: FigureCheckBody }>("/geo/figures/check", { bodyLimit: 8192 }, (req, reply) => respond(reply, async () => ({ figure: await checkFigure(pathsOf(), req.body, skillDir) })));
}

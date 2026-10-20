import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { SkillOperationFailure } from "../../agent/skills-install.ts";
import { AuthoringError } from "../authoring/store.ts";
import { listHubMethods, previewSkillHub, readSkillHubSites, SKILL_HUB_LIMITS, skillHubCatalogue, SkillHubError } from "../skill-hub.ts";

export async function registerGeoSkillHubRoutes(app: FastifyInstance): Promise<void> {
  app.get("/geo/skill-hub", () => ({ sites: readSkillHubSites(), catalogue: skillHubCatalogue(), limits: SKILL_HUB_LIMITS }));
  // gaid-hub-integration: method drafts the configured hubs offer (read-only listing).
  app.get("/geo/skill-hub/methods", async () => ({ hubs: await listHubMethods() }));
  app.post<{ Body: { url?: unknown; scope?: unknown; hubEntry?: { id: string; revision: number } }; Querystring: { scope?: string } }>("/geo/skill-hub/preview", async (req, reply) => {
    try {
      if (req.isMultipart()) {
        const file = await req.file({ limits: { files: 1, fields: 0, fileSize: SKILL_HUB_LIMITS.compressed } });
        if (!file || !file.filename.endsWith(".tar.gz")) throw new SkillHubError("input", "Choose a .tar.gz skill package");
        const archive = await file.toBuffer();
        if (file.file.truncated) throw new SkillHubError("size", "Package exceeds the compressed size limit");
        return await previewSkillHub(activePaths(), { archive, scope: req.query.scope });
      }
      if (!req.body || (req.body.url !== undefined && typeof req.body.url !== "string") || (req.body.scope !== undefined && typeof req.body.scope !== "string") || (req.body.hubEntry !== undefined && (!req.body.hubEntry || typeof req.body.hubEntry !== "object"))) throw new SkillHubError("input", "Provide a skill page URL or hub entry");
      return await previewSkillHub(activePaths(), { url: req.body.url as string | undefined, hubEntry: req.body.hubEntry, scope: req.body.scope as string | undefined });
    } catch (error) {
      if (error instanceof SkillHubError) return reply.code(error.code === "download" ? 502 : error.code === "size" ? 413 : 400).send({ code: error.code, detail: error.message });
      if (error instanceof SkillOperationFailure) return reply.code(error.status).send({ detail: error.detail });
      if (error instanceof AuthoringError) return reply.code(error.status).send({ code: "input", detail: error.message });
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ code: "size", detail: "Package exceeds the compressed size limit" });
      throw error;
    }
  });
}

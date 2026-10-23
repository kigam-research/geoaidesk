/** Read-only draft Workflow document. No generation, packaging or project writes. */
import type { FastifyInstance } from "fastify";
import type { AuthoringStore } from "../authoring/store.ts";
import { AuthoringError } from "../authoring/store.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { procedureSteps, workflowDocFor } from "../workflow-doc.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";

export async function registerGeoWorkflowViewRoutes(app: FastifyInstance, options: { store?: AuthoringStore } = {}): Promise<void> {
  const store = options.store ?? getAuthoringStore(app);
  app.get<{ Params: { id: string; rev: string } }>("/geo/authoring/projects/:id/drafts/:rev/workflow", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const revision = Number(req.params.rev);
      if (!Number.isSafeInteger(revision) || revision < 1) throw new AuthoringError("초안 번호를 확인해 주세요.", 400);
      const project = await store.read(req.params.id);
      const draft = project.drafts.find((d) => d.revision === revision);
      if (!draft) throw new AuthoringError("초안 판을 찾을 수 없습니다.", 404);
      return { doc: draft.workflow ? workflowDocFor(draft.workflow as unknown as GeoWorkflow, {
        version: null, skills: [{ name: draft.slug, source: "bundled" }], procedure: procedureSteps(draft.profile),
      }) : null };
    } catch (error) {
      if (error instanceof AuthoringError) return reply.code(error.status).send({ error: error.message });
      req.log.error(error);
      return reply.code(500).send({ error: "Workflow를 읽지 못했습니다." });
    }
  });
}

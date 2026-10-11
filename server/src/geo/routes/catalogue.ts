/**
 * Catalogue and context routes:
 *   GET /geo/catalogue          pinned catalogue status, skills and workflows (no archive bytes)
 *   GET /geo/context/settings   project default exposure for new chats
 *   PUT /geo/context/settings   { newChatExposure: "all" | "catalogue" | "workflow:<id>" }
 *   GET /geo/context?sessionId= initial prompt budget and exposure of one chat
 */
import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import { getSession } from "../../agent/session-registry.ts";
import { listDisabledSkills, listProjectSkills } from "../../agent/skills.ts";
import { geoCatalogueActive, geoCatalogueStatus, loadGeoCatalogue } from "../catalogue.ts";
import {
  exposureModeIssue,
  promptBudget,
  readProjectContext,
  readSessionExposure,
  writeProjectContext,
  type ExposureMode,
} from "../context.ts";

export async function registerGeoCatalogueRoutes(app: FastifyInstance): Promise<void> {
  app.get("/geo/catalogue", async () => {
    const status = geoCatalogueStatus();
    if (status.state !== "ready") return { status, skills: [], workflows: [] };
    const catalogue = loadGeoCatalogue();
    return {
      status,
      skills: catalogue.index.skills.map((skill) => ({
        id: skill.id,
        runtimeName: skill.runtimeName,
        origin: skill.origin,
        title: skill.title,
        taskLine: skill.taskLine ?? null,
        inputFormats: skill.inputFormats ?? [],
        workflowIds: skill.workflowIds ?? [],
        environmentIds: skill.environmentIds ?? [],
        compatibilityRefs: skill.compatibilityRefs ?? [],
      })),
      workflows: catalogue.workflows.map((workflow) => ({
        id: workflow.id,
        title: workflow.title,
        description: workflow.description ?? null,
        skillIds: workflow.skillIds,
        environmentProfile: workflow.environmentProfile,
      })),
    };
  });

  app.get("/geo/context/settings", async () => readProjectContext(activePaths()));

  app.put<{ Body: { newChatExposure?: unknown } }>("/geo/context/settings", async (req, reply) => {
    const mode = req.body?.newChatExposure;
    const catalogue = geoCatalogueActive() ? loadGeoCatalogue() : null;
    const issue = exposureModeIssue(mode, catalogue);
    if (issue) {
      reply.code(400);
      return { detail: issue };
    }
    return writeProjectContext(activePaths(), { newChatExposure: mode as ExposureMode });
  });

  app.get<{ Querystring: { sessionId?: string } }>("/geo/context", async (req, reply) => {
    const sessionId = req.query.sessionId?.trim();
    if (!sessionId) {
      reply.code(400);
      return { detail: "sessionId is required" };
    }
    const paths = activePaths();
    const session = await getSession(currentProjectId(), paths, sessionId);
    if (!session) {
      reply.code(404);
      return { detail: `No such session: ${sessionId}` };
    }
    const exposure = readSessionExposure(paths, sessionId);
    const enabled = listProjectSkills(paths);
    const installed = enabled.length + listDisabledSkills(paths).length;
    const exposed = exposure?.skills
      ? enabled.filter((skill) => exposure.skills!.includes(skill.name) && !skill.disableModelInvocation).length
      : enabled.filter((skill) => !skill.disableModelInvocation).length;
    return {
      exposure,
      budget: promptBudget(session, { mode: exposure?.mode ?? "all", exposed, installed }),
    };
  });
}

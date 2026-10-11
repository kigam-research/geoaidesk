/**
 * Catalogue and context routes:
 *   GET /geo/catalogue          pinned catalogue status, skills and workflows (no archive bytes)
 *   GET /geo/context/settings   project default exposure for new chats
 *   PUT /geo/context/settings   { newChatExposure: "all" | "catalogue" | "workflow:<id>" }
 *   GET /geo/context/preview?model=     the same for a chat not created yet (new-chat settings;
 *                               measured on a throwaway session that is disposed and leaves no record)
 *   GET /geo/context?sessionId=&model=  initial prompt budget and exposure of one chat
 *                               (`model`: the picker's ref, when it differs from the session's)
 */
import type { FastifyInstance } from "fastify";
import { activePaths } from "../../projects.ts";
import { currentProjectId } from "../../scope.ts";
import fs from "node:fs";
import { createSession, disposeSession, getModelRegistry, getSession } from "../../agent/session-registry.ts";
import { resolveModel } from "../../agent/models.ts";
import { listDisabledSkills, listProjectSkills } from "../../agent/skills.ts";
import type { ProjectPaths } from "../../projects.ts";
import { geoCatalogueActive, geoCatalogueStatus, loadGeoCatalogue } from "../catalogue.ts";
import {
  exposureFile,
  exposureModeIssue,
  promptBudget,
  readProjectContext,
  readSessionExposure,
  writeProjectContext,
  type ExposureMode,
} from "../context.ts";

type BudgetModel = { provider: string; id: string; contextWindow: number; maxTokens: number };

function pickerModel(ref: string | undefined): BudgetModel | undefined {
  if (!ref?.trim()) return undefined;
  try {
    return resolveModel(ref.trim(), getModelRegistry());
  } catch {
    // An unresolvable picker entry (e.g. Fusion): report the session's model.
    return undefined;
  }
}

function skillCounts(paths: ProjectPaths, exposed: string[] | undefined): { exposed: number; installed: number } {
  const enabled = listProjectSkills(paths);
  const installed = enabled.length + listDisabledSkills(paths).length;
  const offered = enabled.filter((skill) => !skill.disableModelInvocation && (!exposed || exposed.includes(skill.name)));
  return { exposed: offered.length, installed };
}

/** Previews are cached briefly: each one opens and disposes a full session. */
const PREVIEW_TTL_MS = 60_000;
const previews = new Map<string, { at: number; value: unknown }>();

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

  app.get<{ Querystring: { sessionId?: string; model?: string } }>("/geo/context", async (req, reply) => {
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
    return {
      exposure,
      budget: promptBudget(
        session,
        { mode: exposure?.mode ?? "all", ...skillCounts(paths, exposure?.skills) },
        pickerModel(req.query.model),
      ),
    };
  });

  app.get<{ Querystring: { model?: string } }>("/geo/context/preview", async (req) => {
    const projectId = currentProjectId();
    const paths = activePaths();
    const mode = readProjectContext(paths).newChatExposure;
    const skillsStamp = [paths.skillsDir, `${paths.sandbox}/.pi/skills-disabled`]
      .map((dir) => {
        try {
          return `${fs.statSync(dir).mtimeMs}`;
        } catch {
          return "-";
        }
      })
      .join("/");
    const key = [projectId, mode, req.query.model ?? "", skillsStamp].join("\0");
    const hit = previews.get(key);
    if (hit && Date.now() - hit.at < PREVIEW_TTL_MS) return hit.value;
    const session = await createSession(projectId, paths);
    const id = session.sessionId;
    try {
      const exposure = readSessionExposure(paths, id);
      const value = {
        exposure: exposure ? { ...exposure, preview: true } : null,
        budget: promptBudget(
          session,
          { mode: exposure?.mode ?? mode, ...skillCounts(paths, exposure?.skills) },
          pickerModel(req.query.model),
        ),
      };
      previews.set(key, { at: Date.now(), value });
      return value;
    } finally {
      await disposeSession(projectId, id);
      // A session with no messages leaves no file; drop its exposure record too.
      fs.rmSync(exposureFile(paths, id), { force: true });
    }
  });
}

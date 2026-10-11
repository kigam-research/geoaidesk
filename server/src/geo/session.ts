/**
 * Everything GeoAIDesk adds to a lead chat session, in one place so
 * `agent/session-registry.ts` carries a single seam per hook:
 *   - `skillsOverride` for the DefaultResourceLoader (task exposure, context.ts)
 *   - extension factories (read hints for unsuitable large-file reads)
 *   - custom tools (geo inspection and bounded windows)
 */
import type { ExtensionFactory, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";
import { applyExposure, resolveSessionExposure, type ExposableSkill, type SessionExposure } from "./context.ts";
import { makeGeoReadHintExtension } from "./read-hints.ts";
import { makeGeoTools } from "./tools.ts";

export interface GeoSessionContext {
  projectId: string;
  paths: ProjectPaths;
  /** Pi session id, known before the session object exists. */
  sessionId: string;
  /** True for a session file with no entries yet (a brand-new chat). */
  isNew: boolean;
}

export interface GeoSessionParts {
  exposure: SessionExposure | null;
  skillsOverride: <T extends { skills: ExposableSkill[] }>(base: T) => T;
  extensionFactories: ExtensionFactory[];
  // Tool parameter schemas differ per tool, as in session-registry's own list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customTools: ToolDefinition<any, any>[];
}

export function geoSessionParts(ctx: GeoSessionContext): GeoSessionParts {
  let exposure: SessionExposure | null = null;
  try {
    exposure = ctx.sessionId ? resolveSessionExposure(ctx.paths, ctx.sessionId, { isNew: ctx.isNew }) : null;
  } catch (err) {
    console.warn(`[gaid] skill exposure unavailable for ${ctx.sessionId}: ${(err as Error).message}`);
  }
  return {
    exposure,
    skillsOverride: (base) => ({ ...base, skills: applyExposure(base.skills, exposure) }),
    extensionFactories: [makeGeoReadHintExtension(ctx.projectId, ctx.paths)].filter(
      (factory): factory is ExtensionFactory => factory !== null,
    ),
    customTools: makeGeoTools(ctx.projectId, ctx.paths),
  };
}

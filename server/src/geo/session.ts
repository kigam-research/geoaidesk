/**
 * Everything GeoAIDesk adds to a lead chat session, in one place so
 * `agent/session-registry.ts` carries a single seam per hook:
 *   - `skillsOverride` for the DefaultResourceLoader (task exposure, context.ts)
 *   - `appendSystemPromptOverride` (concise geo guidance, instructions.ts)
 *   - extension factories (read hints for unsuitable large-file reads,
 *     Markdown image-path and research-note format checks after write/edit)
 *   - custom tools (geo inspection and bounded windows; library search/read of the project's attached papers)
 *   - the research-note citation check (keys must be in the researcher's library)
 *   - the research-note style skill, seeded before Pi loads skills (note-style.ts)
 */
import type { ExtensionFactory, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../projects.ts";
import { applyExposure, resolveSessionExposure, type ExposableSkill, type ExposureMode, type SessionExposure } from "./context.ts";
import { geoCatalogueActive } from "./catalogue.ts";
import { appendGeoInstructions } from "./instructions.ts";
import { makeGeoReadHintExtension } from "./read-hints.ts";
import { markdownImageExtension } from "./markdown-images.ts";
import { makeResearchNoteExtension } from "./notes/extension.ts";
import { entryLanguageExtension } from "./entry-language.ts";
import { makeGeoTools } from "./tools.ts";
import { makeLibraryTools, makeNoteCitationExtension } from "./library/tools.ts";
import { seedShippedSkills } from "./shipped-skills.ts";

export interface GeoSessionContext {
  projectId: string;
  paths: ProjectPaths;
  /** Pi session id, known before the session object exists. */
  sessionId: string;
  /** True for a session file with no entries yet (a brand-new chat). */
  isNew: boolean;
  /** Exposure a brand-new chat records instead of the project default (a started task). */
  mode?: ExposureMode;
}

export interface GeoSessionParts {
  exposure: SessionExposure | null;
  skillsOverride: <T extends { skills: ExposableSkill[] }>(base: T) => T;
  /** Geo guidance appended to the system prompt in geo catalogue mode. */
  appendSystemPromptOverride: ((base: string[]) => string[]) | undefined;
  extensionFactories: ExtensionFactory[];
  // Tool parameter schemas differ per tool, as in session-registry's own list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customTools: ToolDefinition<any, any>[];
}

export function geoSessionParts(ctx: GeoSessionContext): GeoSessionParts {
  const geoMode = geoCatalogueActive();
  if (geoMode) seedShippedSkills(ctx.paths);
  let exposure: SessionExposure | null = null;
  try {
    exposure = ctx.sessionId ? resolveSessionExposure(ctx.paths, ctx.sessionId, { isNew: ctx.isNew, mode: ctx.mode }) : null;
  } catch (err) {
    console.warn(`[gaid] skill exposure unavailable for ${ctx.sessionId}: ${(err as Error).message}`);
  }
  return {
    exposure,
    skillsOverride: (base) => ({ ...base, skills: applyExposure(base.skills, exposure) }),
    appendSystemPromptOverride: geoMode ? appendGeoInstructions : undefined,
    extensionFactories: [
      makeGeoReadHintExtension(ctx.projectId, ctx.paths),
      markdownImageExtension,
      makeResearchNoteExtension(ctx.paths, ctx.sessionId),
      makeNoteCitationExtension(ctx.paths),
      entryLanguageExtension,
    ].filter(
      (factory): factory is ExtensionFactory => factory !== null,
    ),
    customTools: [...makeGeoTools(ctx.projectId, ctx.paths), ...makeLibraryTools(ctx.paths)],
  };
}

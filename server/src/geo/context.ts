/**
 * Task exposure and the initial prompt budget (plan §3.8 "Context
 * configuration", "Catalogue size versus exposure").
 *
 * Exposure decides which installed skills a chat offers the model in its
 * system prompt. It never moves, edits or disables skill files: hidden skills
 * get Pi's `disableModelInvocation` at the session's resource-loading
 * boundary (`skillsOverride`), so they stay listed in Settings and remain
 * usable with `/skill:<name>`. Each chat records its exposed set once, when it
 * is created; later changes apply to new chats only, like upstream's "live
 * sessions keep their skill set". Chats without a record (created before this
 * feature, or with mode `all`) behave exactly as upstream.
 *
 * Files (project `.kady/geo/`):
 *   context.json                 { schemaVersion, newChatExposure }
 *   exposure/<sessionId>.json    SessionExposure, written once per chat
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { ProjectPaths } from "../projects.ts";
import { getSkillOrigins } from "../agent/skills-sync.ts";
import { geoCatalogueActive, loadGeoCatalogue, runtimeNameFor, type GeoCatalogue } from "./catalogue.ts";

export type ExposureMode = "all" | "catalogue" | `workflow:${string}`;

export interface SessionExposure {
  schemaVersion: "gaid-exposure/v1";
  mode: ExposureMode;
  /** Skill names offered to the model; absent for `all`. */
  skills?: string[];
  /** Catalogue the set was derived from. */
  catalogueLabel?: string;
  recordedAt: string;
}

export interface ProjectContextSettings {
  schemaVersion: "gaid-context/v1";
  /** Exposure a new chat starts with. */
  newChatExposure: ExposureMode;
}

const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WORKFLOW_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function geoStateDir(paths: ProjectPaths): string {
  return path.join(paths.kadyDir, "geo");
}

function contextFile(paths: ProjectPaths): string {
  return path.join(geoStateDir(paths), "context.json");
}

export function exposureFile(paths: ProjectPaths, sessionId: string): string {
  if (!SESSION_ID_RE.test(sessionId)) throw new Error(`Invalid session id "${sessionId}"`);
  return path.join(geoStateDir(paths), "exposure", `${sessionId}.json`);
}

/** `null` when valid, else the reason. */
export function exposureModeIssue(mode: unknown, catalogue?: GeoCatalogue | null): string | null {
  if (mode === "all" || mode === "catalogue") return null;
  if (typeof mode !== "string" || !mode.startsWith("workflow:")) {
    return 'exposure must be "all", "catalogue" or "workflow:<id>"';
  }
  const id = mode.slice("workflow:".length);
  if (!WORKFLOW_ID_RE.test(id)) return `invalid workflow id "${id}"`;
  if (catalogue && !catalogue.workflows.some((workflow) => workflow.id === id)) {
    return `unknown workflow "${id}" in catalogue ${catalogue.version}`;
  }
  return null;
}

function writeJsonAtomic(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, file);
}

function defaultMode(): ExposureMode {
  return geoCatalogueActive() ? "catalogue" : "all";
}

export function readProjectContext(paths: ProjectPaths): ProjectContextSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(contextFile(paths), "utf-8")) as Partial<ProjectContextSettings>;
    if (exposureModeIssue(raw.newChatExposure) === null) {
      return { schemaVersion: "gaid-context/v1", newChatExposure: raw.newChatExposure as ExposureMode };
    }
  } catch {
    // Missing or unreadable: defaults.
  }
  return { schemaVersion: "gaid-context/v1", newChatExposure: defaultMode() };
}

export function writeProjectContext(paths: ProjectPaths, settings: { newChatExposure: ExposureMode }): ProjectContextSettings {
  const next: ProjectContextSettings = { schemaVersion: "gaid-context/v1", newChatExposure: settings.newChatExposure };
  writeJsonAtomic(contextFile(paths), next);
  return next;
}

export function readSessionExposure(paths: ProjectPaths, sessionId: string): SessionExposure | null {
  try {
    const raw = JSON.parse(fs.readFileSync(exposureFile(paths, sessionId), "utf-8")) as SessionExposure;
    if (raw.schemaVersion === "gaid-exposure/v1" && exposureModeIssue(raw.mode) === null) return raw;
  } catch {
    // No record.
  }
  return null;
}

function tryCatalogue(): GeoCatalogue | null {
  if (!geoCatalogueActive()) return null;
  try {
    return loadGeoCatalogue();
  } catch {
    return null;
  }
}

/** `exposureModeIssue` against the active catalogue (for request bodies). */
export function geoExposureIssue(mode: unknown): string | null {
  return exposureModeIssue(mode, tryCatalogue());
}

let supportSkills: string[] | null = null;

/**
 * Skills the app's own runtime seeds into every project (pi-subagents'
 * delegation guidance, agent/subagent-resources.ts). They describe how to use
 * the app's tools rather than a scientific method, so every mode keeps them.
 */
export function runtimeSupportSkillNames(): string[] {
  if (supportSkills) return supportSkills;
  try {
    const dir = path.join(path.dirname(createRequire(import.meta.url).resolve("pi-subagents")), "skills");
    supportSkills = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    supportSkills = [];
  }
  return supportSkills;
}

/**
 * Skill names a mode exposes. `catalogue`: every catalogue skill plus skills
 * the user installed or wrote (`registry`/`local` origin). `workflow:<id>`:
 * that workflow's skills. Both keep the runtime support skills.
 */
export function exposedSkillNames(
  paths: ProjectPaths,
  mode: ExposureMode,
  catalogue: GeoCatalogue | null = tryCatalogue(),
): string[] | undefined {
  if (mode === "all") return undefined;
  const names = new Set<string>(runtimeSupportSkillNames());
  if (mode === "catalogue") {
    for (const skill of catalogue?.manifest.runtimeSkills ?? []) names.add(skill.runtimeName);
    for (const [name, origin] of Object.entries(getSkillOrigins(paths))) {
      if (origin === "registry" || origin === "local") names.add(name);
    }
  } else {
    const id = mode.slice("workflow:".length);
    const workflow = catalogue?.workflows.find((candidate) => candidate.id === id);
    for (const atlasId of workflow?.skillIds ?? []) {
      const name = catalogue ? runtimeNameFor(catalogue, atlasId) : undefined;
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * The exposure a session runs with. A recorded one wins. A brand-new chat
 * records the project's new-chat mode (or `mode` when given, e.g. starting a
 * workflow). A chat with history and no record keeps upstream behaviour.
 */
export function resolveSessionExposure(
  paths: ProjectPaths,
  sessionId: string,
  options: { isNew: boolean; mode?: ExposureMode },
): SessionExposure | null {
  const recorded = readSessionExposure(paths, sessionId);
  if (recorded) return recorded;
  if (!options.isNew) return null;
  const mode = options.mode ?? readProjectContext(paths).newChatExposure;
  const catalogue = tryCatalogue();
  const skills = exposedSkillNames(paths, mode, catalogue);
  const record: SessionExposure = {
    schemaVersion: "gaid-exposure/v1",
    mode,
    ...(skills ? { skills } : {}),
    ...(catalogue ? { catalogueLabel: catalogue.label } : {}),
    recordedAt: new Date().toISOString(),
  };
  try {
    writeJsonAtomic(exposureFile(paths, sessionId), record);
  } catch (err) {
    console.warn(`[gaid] could not record skill exposure for ${sessionId}: ${(err as Error).message}`);
  }
  return record;
}

/** Minimal skill shape (Pi's `Skill`). */
export interface ExposableSkill {
  name: string;
  disableModelInvocation: boolean;
}

/** Pi `skillsOverride` body: hide non-exposed skills from the model only. */
export function applyExposure<T extends ExposableSkill>(skills: T[], exposure: SessionExposure | null): T[] {
  if (!exposure?.skills) return skills;
  const visible = new Set(exposure.skills);
  return skills.map((skill) =>
    visible.has(skill.name) || skill.disableModelInvocation ? skill : { ...skill, disableModelInvocation: true },
  );
}

// --- initial prompt budget ------------------------------------------------

/** What `promptBudget` needs from a live Pi `AgentSession`. */
export interface BudgetSession {
  readonly systemPrompt: string;
  getActiveToolNames(): string[];
  getAllTools(): { name: string; description?: string; parameters?: unknown }[];
  readonly model?: { provider: string; id: string; contextWindow: number; maxTokens: number } | undefined;
  getContextUsage(): { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
}

export interface PromptBudget {
  schemaVersion: "gaid-prompt-budget/v1";
  model: { ref: string; contextWindow: number; maxOutputTokens: number } | null;
  /** Estimate of the request before any conversation: system prompt + declared tool schemas. */
  initialPrompt: {
    systemPromptChars: number;
    toolSchemaChars: number;
    tools: number;
    estimatedTokens: number;
    method: "chars/4";
  };
  /** `installed`: skills the session loaded (project, user-level, ambient); `exposed`: offered to the model. */
  skills: { mode: ExposureMode; exposed: number; installed: number };
  /** contextWindow − initial estimate − output reserve; null without a model. */
  remainingTokens: number | null;
  /** remainingTokens / contextWindow. The plan's tuning target is ≥ 0.5. */
  remainingFraction: number | null;
  /** Pi's measured usage after a response, when available. */
  observed: { tokens: number | null; percent: number | null } | null;
}

/** Pi's own rough heuristic for unmeasured text (compaction estimates). */
export const CHARS_PER_TOKEN = 4;

export function promptBudget(
  session: BudgetSession,
  skills: { mode: ExposureMode; exposed: number; installed: number },
  /** The model the next run will use when it differs from the session's (the picker). */
  modelOverride?: BudgetSession["model"],
): PromptBudget {
  const active = new Set(session.getActiveToolNames());
  const tools = session.getAllTools().filter((tool) => active.has(tool.name));
  const toolSchemaChars = tools.reduce(
    (sum, tool) =>
      sum + tool.name.length + (tool.description?.length ?? 0) + JSON.stringify(tool.parameters ?? {}).length,
    0,
  );
  const systemPromptChars = session.systemPrompt.length;
  const estimatedTokens = Math.ceil((systemPromptChars + toolSchemaChars) / CHARS_PER_TOKEN);
  const model = modelOverride ?? session.model;
  const remaining = model ? model.contextWindow - estimatedTokens - model.maxTokens : null;
  // Measured usage belongs to the session's own model; omit it for another one.
  const usage = modelOverride ? undefined : session.getContextUsage();
  return {
    schemaVersion: "gaid-prompt-budget/v1",
    model: model
      ? { ref: `${model.provider}/${model.id}`, contextWindow: model.contextWindow, maxOutputTokens: model.maxTokens }
      : null,
    initialPrompt: { systemPromptChars, toolSchemaChars, tools: tools.length, estimatedTokens, method: "chars/4" },
    skills,
    remainingTokens: remaining,
    remainingFraction: model && remaining !== null ? remaining / model.contextWindow : null,
    observed: usage ? { tokens: usage.tokens, percent: usage.percent } : null,
  };
}

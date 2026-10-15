/**
 * LocalMethods (`GET /geo/methods`; contract web/src/geo/contracts/methods.ts):
 * installed skills that carry `gaid-method.json`, with their workflows in the
 * same summary shape (and readiness rules) as catalogue workflows, so the
 * existing TaskSetup starts them. Nothing here installs, prepares or runs.
 */
import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import { globalSkillRoot, projectSkillRoot, type SkillRoot } from "../../agent/skills.ts";
import { getSkillBaseHash, getSkillProvenance, hashDirectory } from "../../agent/skills-sync.ts";
import type {
  LocalMethodSummary,
  LocalMethodWorkflow,
  MethodLifecycle,
} from "../../../../web/src/geo/contracts/methods.ts";
import { LOCAL_SKILL_PREFIX } from "../../../../web/src/geo/contracts/methods.ts";
import type { WorkflowSkillState } from "../../../../web/src/geo/contracts/workspace.ts";
import type { GeoCatalogue } from "../catalogue.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";
import type { EnvironmentReadiness, GeoEnvironmentService } from "../environments.ts";
import { environmentState, projectSkillState, readinessOf, summarizeWorkflow } from "../workspace/workflows.ts";
import { readMethodFile, type MethodFile } from "./method-file.ts";
import { originOfSource, packageStore } from "./package-origin.ts";

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_METHODS = 200;

export interface InstalledMethod {
  key: string;
  scope: "project" | "global";
  runtimeName: string;
  dir: string;
  enabled: boolean;
  file: ReturnType<typeof readMethodFile>;
}

/** `method:<runtimeName>:<workflowId>`. */
export function methodExposure(runtimeName: string, workflowId: string): string {
  return `method:${runtimeName}:${workflowId}`;
}

export function parseMethodExposure(mode: string): { runtimeName: string; workflowId: string } | null {
  const match = /^method:([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9][a-z0-9-]{0,63})$/.exec(mode);
  return match && match[1].length <= 64 ? { runtimeName: match[1], workflowId: match[2] } : null;
}

function skillDirs(root: SkillRoot): { name: string; dir: string; enabled: boolean }[] {
  const out: { name: string; dir: string; enabled: boolean }[] = [];
  for (const [base, enabled] of [[root.skillsDir, true], [root.disabledDir, false]] as const) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !NAME.test(entry.name)) continue;
      const dir = path.join(base, entry.name);
      if (fs.existsSync(path.join(dir, "SKILL.md"))) out.push({ name: entry.name, dir, enabled });
    }
  }
  return out;
}

/** Installed method folders in the project (first, as Pi resolves them) and the user scope. */
export function installedMethods(paths: ProjectPaths, roots: SkillRoot[] = [projectSkillRoot(paths), globalSkillRoot()]): InstalledMethod[] {
  const out: InstalledMethod[] = [];
  for (const root of roots) {
    const scope = root.kind === "global" ? "global" : "project";
    for (const { name, dir, enabled } of skillDirs(root)) {
      const file = readMethodFile(dir, name);
      if (!file.present) continue;
      out.push({ key: `${scope}:${name}`, scope, runtimeName: name, dir, enabled, file });
      if (out.length >= MAX_METHODS) return out;
    }
  }
  return out;
}

export function findInstalledMethod(paths: ProjectPaths, runtimeName: string, roots?: SkillRoot[]): InstalledMethod | null {
  // Project entries shadow user-scope entries of the same name (Pi's first-wins rule).
  return installedMethods(paths, roots).find((method) => method.runtimeName === runtimeName) ?? null;
}

function skillStates(paths: ProjectPaths, catalogue: GeoCatalogue | null, method: InstalledMethod, file: MethodFile, workflow: GeoWorkflow): WorkflowSkillState[] {
  return workflow.skillIds.map((id) => {
    if (id.startsWith(LOCAL_SKILL_PREFIX)) {
      return { id, runtimeName: method.runtimeName, title: file.title, installed: true, enabled: method.enabled };
    }
    const entry = catalogue?.index.skills.find((skill) => skill.id === id);
    const runtimeName = entry?.runtimeName ?? null;
    const state = runtimeName ? projectSkillState(paths, runtimeName) : { installed: false, enabled: false };
    return { id, runtimeName, title: entry?.title ?? null, ...state };
  });
}

export async function listLocalMethods(
  paths: ProjectPaths,
  catalogue: GeoCatalogue | null,
  service: Pick<GeoEnvironmentService, "readiness">,
  options: { roots?: SkillRoot[]; store?: string } = {},
): Promise<LocalMethodSummary[]> {
  const methods = installedMethods(paths, options.roots);
  const profiles = new Set(methods.flatMap((method) => method.file.method?.workflows.map((workflow) => workflow.environmentProfile) ?? []));
  const probes = new Map<string, EnvironmentReadiness | Error | undefined>();
  const data = catalogue?.environments;
  await Promise.all([...profiles].map(async (envId) => {
    const env = data?.environments.find((candidate) => candidate.id === envId);
    if (!data || !env?.targets.includes("project")) return;
    try {
      probes.set(envId, await service.readiness(data, envId, "project", paths.sandbox));
    } catch (error) {
      probes.set(envId, error as Error);
    }
  }));
  return methods.map((method): LocalMethodSummary => {
    const root = method.scope === "global" ? globalSkillRoot() : projectSkillRoot(paths);
    const provenance = getSkillProvenance(root, method.runtimeName);
    const { origin, record } = originOfSource(provenance?.source, options.store ?? packageStore());
    const treeHash = hashDirectory(method.dir);
    const file = method.file.method;
    // Only a hub descriptor's value counts; the package's own claim never promotes it.
    const lifecycle: MethodLifecycle = origin.kind === "skill-hub" && record?.hub?.lifecycle ? record.hub.lifecycle : "draft";
    const workflows: LocalMethodWorkflow[] = (file?.workflows ?? []).map((workflow) => {
      const skills = skillStates(paths, catalogue, method, file!, workflow);
      const environment = catalogue
        ? environmentState(catalogue, workflow.environmentProfile, probes.get(workflow.environmentProfile))
        : { id: workflow.environmentProfile, title: null, state: "unknown" as const, missing: [], detail: "The geo catalogue is not active" };
      return { ...summarizeWorkflow(workflow, readinessOf(workflow, skills, environment)), exposure: methodExposure(method.runtimeName, workflow.id) };
    });
    return {
      key: method.key,
      scope: method.scope,
      runtimeName: method.runtimeName,
      enabled: method.enabled,
      methodId: file?.methodId ?? null,
      revision: file?.revision ?? null,
      version: file?.version ?? null,
      title: file?.title ?? { ko: method.runtimeName },
      summary: file?.summary ?? null,
      lifecycle,
      lifecycleClaimed: file && file.lifecycle !== lifecycle ? file.lifecycle : null,
      implementation: file?.implementation ?? null,
      codeOrigin: file?.codeOrigin ?? null,
      origin,
      editedLocally: (() => { const base = getSkillBaseHash(root, method.runtimeName); return Boolean(base && base !== treeHash); })(),
      treeHash,
      sources: file?.sources ?? [],
      hubChecks: file?.checks ?? null,
      authoring: file?.authoring ?? null,
      workflows,
      recipes: file?.recipes ?? [],
      issues: method.file.issues,
    };
  });
}

/**
 * Skills a `method:<name>:<workflow>` chat offers the model: the runtime
 * support skills plus that Workflow's skills (its own `local:` skill and the
 * catalogue skills it names). Every other skill, including a catalogue skill
 * for the same task, stays hidden from the model, so a trial exercises the
 * method package rather than whatever the model would pick.
 */
export function methodExposedSkills(paths: ProjectPaths, mode: string, catalogue: GeoCatalogue | null, support: string[]): string[] {
  const names = new Set(support);
  const ref = parseMethodExposure(mode);
  const method = ref ? findInstalledMethod(paths, ref.runtimeName) : null;
  const workflow = method?.file.method?.workflows.find((candidate) => candidate.id === ref!.workflowId);
  for (const id of workflow?.skillIds ?? []) {
    if (id.startsWith(LOCAL_SKILL_PREFIX)) names.add(method!.runtimeName);
    else {
      const name = catalogue?.index.skills.find((skill) => skill.id === id)?.runtimeName;
      if (name) names.add(name);
    }
  }
  return [...names].sort();
}

/** `null` when a per-chat `method:` exposure names an installed method Workflow, else the reason. */
export function methodExposureIssue(paths: ProjectPaths, mode: string): string | null {
  const ref = parseMethodExposure(mode);
  if (!ref) return `invalid method exposure "${mode}"`;
  const method = findInstalledMethod(paths, ref.runtimeName);
  if (!method?.file.method) return `no installed method "${ref.runtimeName}"`;
  if (!method.file.method.workflows.some((workflow) => workflow.id === ref.workflowId)) return `method "${ref.runtimeName}" has no Workflow "${ref.workflowId}"`;
  return null;
}

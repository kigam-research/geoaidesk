/**
 * First-run and per-version provisioning of the geo catalogue into projects.
 *
 * Upstream seeds a new project by copying another project's skills or the
 * downloaded catalogue, and lets the daily sync record hashes afterwards. With
 * a pinned archive and automatic refresh off, that would leave projects with
 * no applied hashes, so explicit updates could never tell an unedited skill
 * from an edited one. Here every project goes through `skills-sync.ts`, the
 * only installer: new skills are installed, unedited ones follow the pinned
 * version, edited, user-installed, deleted and non-catalogue skills are left as
 * they are. A project is re-synced only when the pinned catalogue changed.
 */
import { SKILLS_REPO } from "../config.ts";
import {
  geoCatalogueActive,
  geoCatalogueSkillDirs,
  loadGeoCatalogue,
  type LoadGeoCatalogueOptions,
} from "./catalogue.ts";
import type { ProjectPaths } from "../projects.ts";
import {
  applyDefaultSkillStates,
  enableSkill,
  isSkillDefaultDisabled,
  listDisabledSkills,
  listProjectSkills,
  seedProjectSkills,
} from "../agent/skills.ts";
import {
  getSkillSyncStatus,
  syncProjectSkillsFromCatalogue,
  type SkillSyncResult,
} from "../agent/skills-sync.ts";
import type { CatalogueSkill } from "../agent/skills-fetch.ts";
import { SHIPPED_SKILLS, seedShippedSkills } from "./shipped-skills.ts";

export interface GeoProvisionResult {
  /** `applied`: synced now; `current`: already on the pinned catalogue. */
  state: "applied" | "current" | "unavailable";
  label?: string;
  result?: SkillSyncResult;
  error?: string;
}

/** Apply the pinned catalogue to one project when it is not already applied. */
export function provisionGeoCatalogue(paths: ProjectPaths, options: LoadGeoCatalogueOptions = {}): GeoProvisionResult {
  let catalogue;
  try {
    catalogue = loadGeoCatalogue(options);
  } catch (err) {
    return { state: "unavailable", error: (err as Error).message };
  }
  const status = getSkillSyncStatus(paths);
  // skills-sync records SKILLS_REPO (the geo identity in geo mode) as the manifest repo.
  if (status.repo === SKILLS_REPO && status.upstreamCommit === catalogue.label) {
    return { state: "current", label: catalogue.label };
  }
  const skills = new Map<string, CatalogueSkill>();
  for (const [name, dir] of geoCatalogueSkillDirs(catalogue)) skills.set(name, { dir });
  const result = syncProjectSkillsFromCatalogue(paths, skills, catalogue.label);
  return { state: "applied", label: catalogue.label, result };
}

/**
 * Drop-in for `seedProjectSkills` at the prep and sandbox-init call sites:
 * the geo catalogue when active, upstream seeding otherwise. Returns the
 * number of installed skills like the upstream function.
 */
export async function provisionProjectSkills(
  paths: ProjectPaths,
  allowRemote = true,
  options: LoadGeoCatalogueOptions = {},
): Promise<number> {
  if (!geoCatalogueActive(options.env, options.repoRoot)) return seedProjectSkills(paths, allowRemote);
  // A chat may already seed the shipped skills; they do not make a project non-fresh.
  const fresh = [...listProjectSkills(paths), ...listDisabledSkills(paths)].every((skill) => (SHIPPED_SKILLS as readonly string[]).includes(skill.name));
  const outcome = provisionGeoCatalogue(paths, options);
  if (outcome.state === "unavailable") {
    console.warn(`[gaid] geo catalogue unavailable for project ${paths.id}: ${outcome.error}`);
  } else if (outcome.state === "applied" && outcome.result) {
    const { added, updated, preserved } = outcome.result.counts;
    console.info(
      `[gaid] ${outcome.label} applied to project ${paths.id}: ${added} added, ${updated} updated, ${preserved} kept as edited`,
    );
  }
  applyDefaultSkillStates(paths);
  if (fresh && outcome.state === "applied") enableWorkflowSkills(paths, options);
  seedShippedSkills(paths, options.repoRoot);
  return listProjectSkills(paths).length + listDisabledSkills(paths).length;
}

/**
 * `POST /projects` in geo mode: the new project gets the pinned catalogue
 * before the reply, so any client (the UI dialog, scripts, the release-proof
 * harness) sees its skills without an app restart or a separate
 * `sandbox/init` call. Outside geo mode it does nothing and returns null:
 * upstream seeding may download, so it stays on the explicit init route.
 */
export async function provisionCreatedProject(
  paths: ProjectPaths,
  options: LoadGeoCatalogueOptions = {},
): Promise<number | null> {
  if (!geoCatalogueActive(options.env, options.repoRoot)) return null;
  return provisionProjectSkills(paths, false, options);
}

/**
 * Upstream seeds package-reference skills (e.g. `geopandas`) disabled. A skill
 * that a shipped workflow binds is part of that task's exposure set, so a new
 * project starts with it enabled; otherwise the workflow could never be ready
 * without a manual step. Runs once, for a project's first provisioning only:
 * a skill the user disables later stays disabled.
 */
export function enableWorkflowSkills(paths: ProjectPaths, options: LoadGeoCatalogueOptions = {}): string[] {
  let catalogue;
  try {
    catalogue = loadGeoCatalogue(options);
  } catch {
    return [];
  }
  const bound = new Set(catalogue.workflows.flatMap((workflow) => workflow.skillIds));
  const enabled: string[] = [];
  for (const skill of catalogue.index.skills) {
    if (!bound.has(skill.id) || !isSkillDefaultDisabled(skill.runtimeName)) continue;
    if (enableSkill(paths, skill.runtimeName).ok) enabled.push(skill.runtimeName);
  }
  return enabled;
}

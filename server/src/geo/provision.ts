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
export async function provisionProjectSkills(paths: ProjectPaths, allowRemote = true): Promise<number> {
  if (!geoCatalogueActive()) return seedProjectSkills(paths, allowRemote);
  const outcome = provisionGeoCatalogue(paths);
  if (outcome.state === "unavailable") {
    console.warn(`[gaid] geo catalogue unavailable for project ${paths.id}: ${outcome.error}`);
  }
  applyDefaultSkillStates(paths);
  return listProjectSkills(paths).length + listDisabledSkills(paths).length;
}

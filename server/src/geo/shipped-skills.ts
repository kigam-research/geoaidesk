/** GAID-owned skills: seed once, follow unedited versions, preserve user edits/deletion/disablement. */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config.ts";
import type { ProjectPaths } from "../projects.ts";
import { skillsDisabledDir } from "../agent/skills.ts";
import { hashDirectory } from "../agent/skills-sync.ts";
import { isRegenerableCache } from "./regenerable-cache.ts";
import { atomicJson } from "../atomic-json.ts";

export const SHIPPED_SKILLS = ["gaid-note-style", "gaid-figures"] as const;
export type ShippedSkill = typeof SHIPPED_SKILLS[number];
export type ShippedSkillSeed = "seeded" | "updated" | "current" | "kept" | "absent" | "unavailable";
interface SkillState { schemaVersion: string; sha256: string }

export function shippedSkillSource(skill: ShippedSkill, repoRoot = REPO_ROOT): string {
  return path.join(repoRoot, "geo", "skills", skill);
}

// Keep the original receipt in place: existing deletion/disablement must not reseed.
function stateFile(paths: ProjectPaths, skill: ShippedSkill): string {
  return path.join(paths.kadyDir, "geo", skill === "gaid-note-style" ? "note-style.json" : `shipped-${skill}.json`);
}
const schema = (skill: ShippedSkill) => skill === "gaid-note-style" ? "gaid-note-style/v1" : "gaid-shipped-skill/v1";

function readState(paths: ProjectPaths, skill: ShippedSkill): SkillState | null {
  try {
    const value = JSON.parse(fs.readFileSync(stateFile(paths, skill), "utf8")) as SkillState;
    return value.schemaVersion === schema(skill) && typeof value.sha256 === "string" ? value : null;
  } catch { return null; }
}

function install(source: string, target: string): void {
  const staging = `${target}.gaid-${process.pid}-${Date.now()}`;
  const old = `${staging}.old`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.cpSync(source, staging, { recursive: true, filter: (file) => !isRegenerableCache(path.basename(file)) });
    if (fs.existsSync(target)) fs.renameSync(target, old);
    try { fs.renameSync(staging, target); }
    catch (error) { if (fs.existsSync(old)) fs.renameSync(old, target); throw error; }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(old, { recursive: true, force: true });
  }
}

/** A missing skill must not prevent a chat from starting. Never overwrite the user's skill. */
export function seedShippedSkill(paths: ProjectPaths, skill: ShippedSkill, repoRoot = REPO_ROOT): ShippedSkillSeed {
  try {
    const source = shippedSkillSource(skill, repoRoot);
    if (!fs.existsSync(path.join(source, "SKILL.md"))) return "unavailable";
    const shipped = hashDirectory(source);
    const target = path.join(paths.skillsDir, skill);
    const state = readState(paths, skill);
    const present = fs.existsSync(target);
    if (fs.existsSync(path.join(skillsDisabledDir(paths), skill))) return "kept";
    if (!state) {
      if (present) return "kept";
      install(source, target);
      atomicJson(stateFile(paths, skill), { schemaVersion: schema(skill), sha256: shipped });
      return "seeded";
    }
    if (!present) return "absent";
    if (state.sha256 === shipped) return "current";
    if (hashDirectory(target) !== state.sha256) return "kept";
    install(source, target);
    atomicJson(stateFile(paths, skill), { schemaVersion: schema(skill), sha256: shipped });
    return "updated";
  } catch (error) {
    console.warn(`[gaid] shipped skill ${skill} not seeded for project ${paths.id}: ${(error as Error).message}`);
    return "unavailable";
  }
}

export function seedShippedSkills(paths: ProjectPaths, repoRoot = REPO_ROOT): Record<ShippedSkill, ShippedSkillSeed> {
  return Object.fromEntries(SHIPPED_SKILLS.map((skill) => [skill, seedShippedSkill(paths, skill, repoRoot)])) as Record<ShippedSkill, ShippedSkillSeed>;
}

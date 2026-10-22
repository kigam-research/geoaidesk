/** Compatibility entry point; existing note-style receipts are preserved by shipped-skills. */
import { REPO_ROOT } from "../config.ts";
import type { ProjectPaths } from "../projects.ts";
import { seedShippedSkill, shippedSkillSource, type ShippedSkillSeed } from "./shipped-skills.ts";

export const NOTE_STYLE_SKILL = "gaid-note-style";
export type NoteStyleSeed = ShippedSkillSeed;
export const noteStyleSource = (repoRoot = REPO_ROOT): string => shippedSkillSource(NOTE_STYLE_SKILL, repoRoot);
export const seedNoteStyleSkill = (paths: ProjectPaths, repoRoot = REPO_ROOT): NoteStyleSeed =>
  seedShippedSkill(paths, NOTE_STYLE_SKILL, repoRoot);

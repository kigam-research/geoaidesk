/**
 * The research-note style skill (gaid-output-style): GAID ships
 * `geo/skills/gaid-note-style/` and copies it into each geo project's
 * `.pi/skills/`, where Pi loads it like any project skill. RESEARCH_NOTE_RULE
 * tells the lead to read it before writing a note, and `applyExposure` keeps
 * it offered in every chat, whatever task selection the chat has.
 *
 * The copy is the project's: it is seeded once, follows a new shipped version
 * only while it is unedited, and a deleted or disabled copy stays that way.
 * State: project `.kady/geo/note-style.json` = { schemaVersion, sha256 } of
 * the tree last written here.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config.ts";
import type { ProjectPaths } from "../projects.ts";
import { hashDirectory } from "../agent/skills-sync.ts";
import { skillsDisabledDir } from "../agent/skills.ts";
import { atomicJson } from "../atomic-json.ts";

export const NOTE_STYLE_SKILL = "gaid-note-style";

interface NoteStyleState {
  schemaVersion: "gaid-note-style/v1";
  /** hashDirectory() of the tree this module last wrote. */
  sha256: string;
}

export type NoteStyleSeed = "seeded" | "updated" | "current" | "kept" | "absent" | "unavailable";

export function noteStyleSource(repoRoot = REPO_ROOT): string {
  return path.join(repoRoot, "geo", "skills", NOTE_STYLE_SKILL);
}

function stateFile(paths: ProjectPaths): string {
  return path.join(paths.kadyDir, "geo", "note-style.json");
}

function readState(paths: ProjectPaths): NoteStyleState | null {
  try {
    const value = JSON.parse(fs.readFileSync(stateFile(paths), "utf8")) as Partial<NoteStyleState>;
    return value.schemaVersion === "gaid-note-style/v1" && typeof value.sha256 === "string" ? (value as NoteStyleState) : null;
  } catch {
    return null;
  }
}

/** Replace `target` with a copy of `source` without leaving a half-written skill. */
function install(source: string, target: string): void {
  const staging = `${target}.gaid-${process.pid}-${Date.now()}`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, staging, { recursive: true });
  const old = fs.existsSync(target) ? `${staging}.old` : null;
  if (old) fs.renameSync(target, old);
  fs.renameSync(staging, target);
  if (old) fs.rmSync(old, { recursive: true, force: true });
}

/**
 * Seed or update the project's copy. Never throws: a failure leaves the
 * project as it was, and chats still start (the rule then names a skill the
 * model cannot find, which it reports).
 */
export function seedNoteStyleSkill(paths: ProjectPaths, repoRoot = REPO_ROOT): NoteStyleSeed {
  try {
    const source = noteStyleSource(repoRoot);
    if (!fs.existsSync(path.join(source, "SKILL.md"))) return "unavailable";
    const shipped = hashDirectory(source);
    const target = path.join(paths.skillsDir, NOTE_STYLE_SKILL);
    const state = readState(paths);
    const present = fs.existsSync(target);
    if (!state) {
      // A skill of this name that we did not write (or a disabled one) is the user's.
      if (present || fs.existsSync(path.join(skillsDisabledDir(paths), NOTE_STYLE_SKILL))) return "kept";
      install(source, target);
      atomicJson(stateFile(paths), { schemaVersion: "gaid-note-style/v1", sha256: shipped } satisfies NoteStyleState);
      return "seeded";
    }
    if (!present) return "absent";
    if (state.sha256 === shipped) return "current";
    if (hashDirectory(target) !== state.sha256) return "kept";
    install(source, target);
    atomicJson(stateFile(paths), { schemaVersion: "gaid-note-style/v1", sha256: shipped } satisfies NoteStyleState);
    return "updated";
  } catch (err) {
    console.warn(`[gaid] note style skill not seeded for project ${paths.id}: ${(err as Error).message}`);
    return "unavailable";
  }
}

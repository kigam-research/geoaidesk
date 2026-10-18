import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { applyExposure } from "../src/geo/context.ts";
import { GEO_INSTRUCTIONS, REPLY_LANGUAGE_RULE, REPLY_STYLE_RULE, RESEARCH_NOTE_RULE } from "../src/geo/instructions.ts";
import { NOTE_STYLE_SKILL, noteStyleSource, seedNoteStyleSkill } from "../src/geo/note-style.ts";

// gaid-output-style: chat answers follow a compact Attention Control rule; research
// notes are polished with the shipped gaid-note-style skill.
let paths: ProjectPaths;
let repo: string;

/** A repo root whose shipped skill the test can change. */
function shipped(text: string): void {
  const dir = noteStyleSource(repo);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${NOTE_STYLE_SKILL}\ndescription: test\n---\n${text}\n`);
}
const copy = () => path.join(paths.skillsDir, NOTE_STYLE_SKILL, "SKILL.md");

beforeEach(() => {
  paths = resolvePaths("note-style-test");
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.mkdirSync(paths.sandbox, { recursive: true });
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-note-style-"));
  shipped("v1");
});
afterEach(() => {
  fs.rmSync(paths.root, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("output style rules", () => {
  it("the geo system prompt carries the reply style after the reply language", () => {
    expect(GEO_INSTRUCTIONS).toContain(`- ${REPLY_LANGUAGE_RULE}\n- ${REPLY_STYLE_RULE}`);
    expect(REPLY_STYLE_RULE).toMatch(/start with the result/);
    expect(REPLY_STYLE_RULE).toMatch(/합니다체/);
    // Every line rides every request; local models run with a 64K context.
    expect(REPLY_STYLE_RULE.length).toBeLessThan(900);
  });

  it("the note rule names the shipped skill", () => {
    expect(RESEARCH_NOTE_RULE).toContain(`read the \`${NOTE_STYLE_SKILL}\` skill`);
    expect(GEO_INSTRUCTIONS).toContain(`- ${RESEARCH_NOTE_RULE}`);
  });

  it("ships a loadable, attributed and compact skill", () => {
    const dir = noteStyleSource();
    const text = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
    expect(text).toMatch(new RegExp(`^---\\nname: ${NOTE_STYLE_SKILL}\\n`));
    expect(text).toContain("blader/humanizer");
    expect(Buffer.byteLength(text)).toBeLessThan(8 * 1024);
    expect(fs.readFileSync(path.join(dir, "LICENSE"), "utf8")).toContain("Copyright (c) 2025 Siqi Chen");
  });

  it("keeps the skill offered under any task selection", () => {
    const skills = [{ name: "geo-map-and-crs" }, { name: "other" }, { name: NOTE_STYLE_SKILL }];
    const out = applyExposure(skills, { schemaVersion: "gaid-exposure/v1", mode: "workflow:x", skills: ["geo-map-and-crs"], recordedAt: "" });
    expect(out.map((s) => [s.name, Boolean((s as { disableModelInvocation?: boolean }).disableModelInvocation)])).toEqual([
      ["geo-map-and-crs", false], ["other", true], [NOTE_STYLE_SKILL, false],
    ]);
  });
});

describe("seedNoteStyleSkill", () => {
  it("seeds once and follows a new shipped version while unedited", () => {
    expect(seedNoteStyleSkill(paths, repo)).toBe("seeded");
    expect(fs.readFileSync(copy(), "utf8")).toContain("v1");
    expect(seedNoteStyleSkill(paths, repo)).toBe("current");
    shipped("v2");
    expect(seedNoteStyleSkill(paths, repo)).toBe("updated");
    expect(fs.readFileSync(copy(), "utf8")).toContain("v2");
    expect(fs.readdirSync(paths.skillsDir)).toEqual([NOTE_STYLE_SKILL]);
  });

  it("keeps an edited copy and does not recreate a deleted one", () => {
    seedNoteStyleSkill(paths, repo);
    fs.appendFileSync(copy(), "my rule\n");
    shipped("v2");
    expect(seedNoteStyleSkill(paths, repo)).toBe("kept");
    expect(fs.readFileSync(copy(), "utf8")).toContain("my rule");
    fs.rmSync(path.dirname(copy()), { recursive: true });
    expect(seedNoteStyleSkill(paths, repo)).toBe("absent");
    expect(fs.existsSync(copy())).toBe(false);
  });

  it("leaves a same-named skill it did not write, or a disabled one, alone", () => {
    fs.mkdirSync(path.dirname(copy()), { recursive: true });
    fs.writeFileSync(copy(), "mine");
    expect(seedNoteStyleSkill(paths, repo)).toBe("kept");
    expect(fs.readFileSync(copy(), "utf8")).toBe("mine");

    fs.rmSync(paths.root, { recursive: true, force: true });
    fs.mkdirSync(path.join(paths.sandbox, ".pi", "skills-disabled", NOTE_STYLE_SKILL), { recursive: true });
    expect(seedNoteStyleSkill(paths, repo)).toBe("kept");
    expect(fs.existsSync(copy())).toBe(false);
  });

  it("does nothing without a shipped skill", () => {
    fs.rmSync(noteStyleSource(repo), { recursive: true });
    expect(seedNoteStyleSkill(paths, repo)).toBe("unavailable");
    expect(fs.existsSync(paths.skillsDir) && fs.readdirSync(paths.skillsDir).length).toBeFalsy();
  });
});

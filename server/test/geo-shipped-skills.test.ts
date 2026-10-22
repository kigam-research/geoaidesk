import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePaths, type ProjectPaths } from "../src/projects.ts";
import { SHIPPED_SKILLS, seedShippedSkill, seedShippedSkills, shippedSkillSource } from "../src/geo/shipped-skills.ts";
import { hashDirectory } from "../src/agent/skills-sync.ts";
import { applyExposure } from "../src/geo/context.ts";
import { FIGURE_RULE, GEO_INSTRUCTIONS } from "../src/geo/instructions.ts";

let dir: string;
let repo: string;
let paths: ProjectPaths;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-shipped-skills-"));
  repo = path.join(dir, "repo");
  const sandbox = path.join(dir, "sandbox");
  paths = { ...resolvePaths("shipped-test"), sandbox, kadyDir: path.join(dir, ".kady"), skillsDir: path.join(sandbox, ".pi/skills") };
  for (const skill of SHIPPED_SKILLS) {
    const source = shippedSkillSource(skill, repo);
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "SKILL.md"), `---\nname: ${skill}\ndescription: test\n---\nVersion one\n`);
    fs.mkdirSync(path.join(source, "scripts"));
    fs.writeFileSync(path.join(source, "scripts", "check.py"), "v1\n");
  }
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe.each(SHIPPED_SKILLS)("shipped %s", (skill) => {
  const target = () => path.join(paths.skillsDir, skill);
  const source = () => shippedSkillSource(skill, repo);
  it("updates the entire unedited tree and keeps per-skill state independent", () => {
    expect(seedShippedSkills(paths, repo)).toEqual({ "gaid-note-style": "seeded", "gaid-figures": "seeded" });
    fs.writeFileSync(path.join(source(), "scripts", "check.py"), "v2\n");
    expect(seedShippedSkill(paths, skill, repo)).toBe("updated");
    expect(fs.readFileSync(path.join(target(), "scripts", "check.py"), "utf8")).toBe("v2\n");
    expect(seedShippedSkill(paths, skill, repo)).toBe("current");
    const other = SHIPPED_SKILLS.find((s) => s !== skill)!;
    expect(seedShippedSkill(paths, other, repo)).toBe("current");
  });
  it("preserves custom code and deliberate deletion across shipped upgrades", () => {
    seedShippedSkill(paths, skill, repo);
    fs.appendFileSync(path.join(target(), "scripts", "check.py"), "user edit\n");
    fs.appendFileSync(path.join(source(), "SKILL.md"), "v2\n");
    expect(seedShippedSkill(paths, skill, repo)).toBe("kept");
    expect(fs.readFileSync(path.join(target(), "scripts", "check.py"), "utf8")).toContain("user edit");
    fs.rmSync(target(), { recursive: true });
    expect(seedShippedSkill(paths, skill, repo)).toBe("absent");
    expect(fs.existsSync(target())).toBe(false);
  });
  it("does not mistake Python runtime caches for user edits or ship those caches", () => {
    fs.mkdirSync(path.join(source(), "scripts/__pycache__"));
    fs.writeFileSync(path.join(source(), "scripts/__pycache__/check.pyc"), "generated source cache");
    expect(seedShippedSkill(paths, skill, repo)).toBe("seeded");
    expect(fs.existsSync(path.join(target(), "scripts/__pycache__"))).toBe(false);
    fs.mkdirSync(path.join(target(), "scripts/__pycache__"));
    fs.writeFileSync(path.join(target(), "scripts/__pycache__/check.pyc"), "generated runtime cache");
    fs.appendFileSync(path.join(source(), "SKILL.md"), "v2\n");
    expect(seedShippedSkill(paths, skill, repo)).toBe("updated");
  });
  it("preserves disablement before first seed and after an upgrade", () => {
    const disabled = path.join(paths.sandbox, ".pi/skills-disabled", skill);
    fs.mkdirSync(disabled, { recursive: true });
    fs.writeFileSync(path.join(disabled, "SKILL.md"), "disabled by user");
    expect(seedShippedSkill(paths, skill, repo)).toBe("kept");
    expect(fs.existsSync(target())).toBe(false);
    fs.rmSync(disabled, { recursive: true });
    expect(seedShippedSkill(paths, skill, repo)).toBe("seeded");
    fs.renameSync(target(), disabled);
    fs.appendFileSync(path.join(source(), "SKILL.md"), "v2\n");
    expect(seedShippedSkill(paths, skill, repo)).toBe("kept");
    expect(fs.existsSync(target())).toBe(false);
  });
});

it("reads an existing note-style receipt and does not reseed a previously deleted copy", () => {
  fs.mkdirSync(path.join(paths.kadyDir, "geo"), { recursive: true });
  fs.writeFileSync(path.join(paths.kadyDir, "geo/note-style.json"), JSON.stringify({
    schemaVersion: "gaid-note-style/v1", sha256: hashDirectory(shippedSkillSource("gaid-note-style", repo)),
  }));
  expect(seedShippedSkills(paths, repo)).toEqual({ "gaid-note-style": "absent", "gaid-figures": "seeded" });
});

it("always offers both shipped skills but respects explicit model-invocation disablement", () => {
  const skills = [{ name: "selected" }, { name: "other" }, ...SHIPPED_SKILLS.map((name) => ({ name })),
    { name: "gaid-figures", disableModelInvocation: true }];
  const out = applyExposure(skills, { schemaVersion: "gaid-exposure/v1", mode: "workflow:x", skills: ["selected"], recordedAt: "" });
  expect(out.map((s) => [s.name, Boolean((s as { disableModelInvocation?: boolean }).disableModelInvocation)])).toEqual([
    ["selected", false], ["other", true], ["gaid-note-style", false], ["gaid-figures", false], ["gaid-figures", true],
  ]);
  expect(GEO_INSTRUCTIONS).toContain(FIGURE_RULE);
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PROJECTS_ROOT, SKILLS_REPO } from "../src/config.ts";
import { resetGeoCatalogueCache } from "../src/geo/catalogue.ts";
import { enableWorkflowSkills, provisionCreatedProject, provisionGeoCatalogue } from "../src/geo/provision.ts";
import {
  getSkillSyncStatus,
  hashDirectory,
  markSkillRemoved,
  recordSkillOrigin,
} from "../src/agent/skills-sync.ts";
import { listDisabledSkills, listProjectSkills, skillsDisabledDir } from "../src/agent/skills.ts";
import { ensureProjectExists } from "../src/projects.ts";
import { buildFixtureCatalogue, defaultSkills, writeFixtureArchive } from "./helpers/geo-catalogue-fixture.ts";

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-provision-cache-"));

function options(fixture: ReturnType<typeof buildFixtureCatalogue>) {
  const archive = writeFixtureArchive(fixture);
  return {
    env: { HOME: os.homedir(), GAID_CATALOGUE_ARCHIVE: archive, TASK_ASSETS_DIR: cacheDir } as NodeJS.ProcessEnv,
    cacheDir,
    pin: { version: fixture.version, archive: path.basename(archive), sha256: fixture.sha256 },
  };
}

function writeSkill(base: string, name: string, body: string): void {
  fs.mkdirSync(path.join(base, name), { recursive: true });
  fs.writeFileSync(path.join(base, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${body}\n---\n\n${body}\n`);
}

const names = (paths: ReturnType<typeof ensureProjectExists>) =>
  [...listProjectSkills(paths), ...listDisabledSkills(paths)].map((s) => s.name).sort();

beforeEach(() => {
  resetGeoCatalogueCache();
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
});
afterAll(() => fs.rmSync(cacheDir, { recursive: true, force: true }));

describe("provisionGeoCatalogue", () => {
  it("installs a new project through skills-sync and records the applied catalogue", () => {
    const paths = ensureProjectExists("geo-new");
    const fixture = buildFixtureCatalogue();
    const outcome = provisionGeoCatalogue(paths, options(fixture));
    expect(outcome.state).toBe("applied");
    expect(names(paths)).toEqual(["geo-map-and-crs", "well-log-qc-quicklook"]);
    const status = getSkillSyncStatus(paths);
    expect(status.repo).toBe(SKILLS_REPO);
    expect(status.upstreamCommit).toBe(outcome.label);
    // Same pinned catalogue again: nothing to do.
    resetGeoCatalogueCache();
    expect(provisionGeoCatalogue(paths, options(fixture)).state).toBe("current");
  });

  it("adds the catalogue to an existing project without touching its other skills", () => {
    const paths = ensureProjectExists("geo-existing");
    // An upstream-era project: K-Dense catalogue skills (one disabled), a
    // user-installed registry skill, and a local skill the user wrote.
    writeSkill(paths.skillsDir, "scanpy", "bio skill");
    writeSkill(skillsDisabledDir(paths), "rdkit", "disabled bio skill");
    writeSkill(paths.skillsDir, "my-registry-skill", "installed by the user");
    writeSkill(paths.skillsDir, "my-notes", "written here");
    recordSkillOrigin(paths, "my-registry-skill", { origin: "registry", source: "someone/skills" });
    recordSkillOrigin(paths, "my-notes", { origin: "local" });
    const before = Object.fromEntries(
      ["scanpy", "my-registry-skill", "my-notes"].map((n) => [n, hashDirectory(path.join(paths.skillsDir, n))]),
    );
    const disabledBefore = hashDirectory(path.join(skillsDisabledDir(paths), "rdkit"));

    const outcome = provisionGeoCatalogue(paths, options(buildFixtureCatalogue()));
    expect(outcome.state).toBe("applied");
    expect(outcome.result?.counts.added).toBe(2);
    expect(names(paths)).toEqual(
      ["geo-map-and-crs", "my-notes", "my-registry-skill", "rdkit", "scanpy", "well-log-qc-quicklook"].sort(),
    );
    for (const [name, hash] of Object.entries(before)) {
      expect(hashDirectory(path.join(paths.skillsDir, name))).toBe(hash);
    }
    expect(hashDirectory(path.join(skillsDisabledDir(paths), "rdkit"))).toBe(disabledBefore);
    expect(listDisabledSkills(paths).map((s) => s.name)).toEqual(["rdkit"]);
  });

  it("follows a new pinned version for unedited skills only and keeps deletions", () => {
    const paths = ensureProjectExists("geo-update");
    provisionGeoCatalogue(paths, options(buildFixtureCatalogue({ version: "1.0.0" })));
    // The user edits one catalogue skill and deletes the other.
    const edited = path.join(paths.skillsDir, "well-log-qc-quicklook", "SKILL.md");
    fs.appendFileSync(edited, "\nMy local note.\n");
    fs.rmSync(path.join(paths.skillsDir, "geo-map-and-crs"), { recursive: true });
    markSkillRemoved(paths, "geo-map-and-crs");

    const v2skills = defaultSkills().map((skill) => ({
      ...skill,
      files: { ...skill.files, "CHANGELOG.md": "2.0.0\n" },
    }));
    v2skills.push({
      id: "kigam/new-skill",
      name: "new-skill",
      files: { "SKILL.md": "---\nname: new-skill\ndescription: Added in 2.0.0.\n---\n" },
    });
    resetGeoCatalogueCache();
    const outcome = provisionGeoCatalogue(paths, options(buildFixtureCatalogue({ version: "2.0.0", skills: v2skills })));
    expect(outcome.state).toBe("applied");
    expect(fs.readFileSync(edited, "utf-8")).toMatch(/My local note/);
    expect(fs.existsSync(path.join(paths.skillsDir, "well-log-qc-quicklook", "CHANGELOG.md"))).toBe(false);
    expect(fs.existsSync(path.join(paths.skillsDir, "geo-map-and-crs"))).toBe(false);
    expect(fs.existsSync(path.join(paths.skillsDir, "new-skill", "SKILL.md"))).toBe(true);
    const status = getSkillSyncStatus(paths);
    expect(status.updatesAvailable).toEqual(["well-log-qc-quicklook"]);
    expect(status.removed).toEqual(["geo-map-and-crs"]);
    expect(status.upstreamCommit).toMatch(/^geo-catalogue@2\.0\.0\+/);
  });

  it("reports an unavailable catalogue without installing anything", () => {
    const paths = ensureProjectExists("geo-missing");
    const outcome = provisionGeoCatalogue(paths, {
      env: { HOME: os.homedir(), TASK_ASSETS_DIR: cacheDir } as NodeJS.ProcessEnv,
      cacheDir,
      pin: { version: "3.0.0", archive: "geo-catalogue-3.0.0.tar.gz", sha256: "b".repeat(64) },
    });
    expect(outcome.state).toBe("unavailable");
    expect(outcome.error).toMatch(/was not found/);
    expect(names(paths)).toEqual([]);
  });
});

describe("enableWorkflowSkills", () => {
  it("enables default-disabled skills that a workflow binds and leaves the others", () => {
    const paths = ensureProjectExists("geo-workflow-skills");
    const skill = (name: string) => ({ id: `k-dense/${name}`, name, files: { "SKILL.md": `---\nname: ${name}\ndescription: ${name}\n---\n` } });
    const fixture = buildFixtureCatalogue({
      skills: [...defaultSkills(), skill("geopandas"), skill("matplotlib")],
      workflows: [{ id: "geo-map-and-crs", title: { ko: "지도" }, skillIds: ["kigam/geo-map-and-crs", "k-dense/geopandas"], environmentProfile: "geo-core" }],
    });
    const opts = options(fixture);
    for (const name of ["geopandas", "matplotlib"]) writeSkill(skillsDisabledDir(paths), name, name);
    expect(enableWorkflowSkills(paths, opts)).toEqual(["geopandas"]);
    expect(listProjectSkills(paths).map((s) => s.name)).toContain("geopandas");
    expect(listDisabledSkills(paths).map((s) => s.name)).toEqual(["matplotlib"]);
  });
});

describe("provisionCreatedProject", () => {
  it("installs the pinned catalogue into a project created while the app runs", async () => {
    const paths = ensureProjectExists("geo-created");
    expect(names(paths)).toEqual([]);
    const count = await provisionCreatedProject(paths, options(buildFixtureCatalogue()));
    // + the shipped research-note style skill (gaid-output-style).
    expect(count).toBe(3);
    expect(names(paths)).toEqual(["gaid-note-style", "geo-map-and-crs", "well-log-qc-quicklook"]);
  });

  it("does nothing outside geo catalogue mode", async () => {
    const paths = ensureProjectExists("geo-created-off");
    const opts = options(buildFixtureCatalogue());
    const count = await provisionCreatedProject(paths, { ...opts, env: { ...opts.env, GAID_CATALOGUE: "off" } });
    expect(count).toBeNull();
    expect(names(paths)).toEqual([]);
  });
});

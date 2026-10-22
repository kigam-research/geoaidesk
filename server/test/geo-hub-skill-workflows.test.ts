/** A Workflow pinning a hub skill: installing it brings the pinned revision; registration refuses unusable pins. */
import crypto from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { HubSkillStore, previewHubSkill, registerHubSkill } from "../src/geo/hub-skills/index.ts";
import { reviewHubSkill } from "../src/geo/hub-skills/review.ts";
import { installPackageBytes } from "../src/geo/authoring/install.ts";
import { hubPinProblems } from "../src/geo/methods/hub-pin-install.ts";
import { hubSkillInstallState } from "../src/geo/methods/hub-pins.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";

const dirs: string[] = [], projects: string[] = [];
afterEach(async () => {
  for (const id of projects.splice(0)) deleteProject(id);
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
  delete process.env.GAID_HUB_SHARED_DIR;
});
const work = async () => { const d = await mkdtemp(join(tmpdir(), "hub-skill-wf-")); dirs.push(d); return d; };
const project = () => { const p = createProject({ name: "Hub skill Workflow" }); projects.push(p.id); return p; };
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const catalogue = () => ({ available: true, skills: [] });

async function shelf() {
  const root = await work(), agentDir = await work();
  process.env.GAID_HUB_SHARED_DIR = root;
  const store = new HubSkillStore(root);
  await store.initialize();
  const author = project();
  const dir = join(resolvePaths(author.id).skillsDir, "las-qc");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), "---\nname: las-qc\ndescription: LAS curve checks\n---\n\n# LAS QC\n");
  const source = { from: "project", projectId: author.id, name: "las-qc" } as const;
  const preview = await previewHubSkill(store, source, "Author", { agentDir, catalogue });
  const skill = await registerHubSkill(store, { ...source, treeHash: preview.treeHash, note: "first", folderId: "general" }, "Author", { agentDir, catalogue });
  return { store, agentDir, pin: { skillId: "las-qc", revision: 1, treeHash: skill.revisions[0].treeHash } };
}

function workflowPackage(pin: { skillId: string; revision: number; treeHash: string }) {
  const skillMd = Buffer.from("---\nname: grid-method\ndescription: Grid method.\n---\n\n# Grid method\n");
  const files = [{ path: "SKILL.md", sha256: sha(skillMd), size: skillMd.length }];
  const method = {
    schemaVersion: "gaid-method/v1", methodId: "local/grid-method", revision: 1, version: "0.1.0", lifecycle: "draft", implementation: "descriptive",
    title: { ko: "격자 방법" }, summary: { ko: "요약" }, sources: [],
    workflows: [{
      schemaVersion: "gaid-workflow/v1", id: "run", title: { ko: "실행" }, skillIds: ["local:grid-method"], environmentProfile: "geo-core", prompt: { ko: "" },
      skills: [{ name: "grid-method", source: "bundled", role: "primary" }, { name: "las-qc", source: "hub", role: "supporting", hub: pin }],
      steps: [{ id: "qc", title: { ko: "점검" }, does: { ko: "곡선을 점검합니다." }, skill: "las-qc" }],
    }],
    recipes: [], files, packageDigest: sha(Buffer.from(files.map((f) => `${f.path}\0${f.sha256}\n`).join(""))),
  };
  const archive = tarGz([{ path: "grid-method/SKILL.md", data: skillMd }, { path: "grid-method/gaid-method.json", data: Buffer.from(JSON.stringify(method)) }]);
  return { archive, pkg: { slug: "grid-method", methodId: "local/grid-method", revision: 1, manifest: method } };
}

it("installs the pinned hub skill revision together with the Workflow, once", async () => {
  const { pin, agentDir } = await shelf();
  const target = project();
  const { archive, pkg } = workflowPackage(pin);
  const result = await installPackageBytes(archive, pkg, { projectId: target.id, acknowledged: true }, { agentDir });
  expect(result.hubSkills).toEqual([{ name: "las-qc", revision: 1, state: "installed", outcome: "installed" }]);
  expect(hubSkillInstallState(projectSkillRoot(resolvePaths(target.id)), pin, { agentDir })).toBe("installed");
  const again = await installPackageBytes(archive, pkg, { projectId: target.id, acknowledged: true }, { agentDir });
  expect(again.hubSkills?.[0]).toMatchObject({ outcome: "present" });
}, 60_000);

it("reports missing, changed and suspended pins before registration", async () => {
  const { store, pin } = await shelf();
  const skills = (p: typeof pin) => [{ name: p.skillId, source: "hub", hub: p }];
  expect(await hubPinProblems(skills(pin), store)).toEqual([]);
  expect((await hubPinProblems(skills({ ...pin, treeHash: "0".repeat(64) }), store))[0]).toContain("다릅니다");
  expect((await hubPinProblems(skills({ ...pin, revision: 9 }), store))[0]).toContain("찾을 수 없습니다");
  await reviewHubSkill(store, "las-qc", 1, { state: "suspended", note: "script writes outside the project" }, "Reviewer");
  expect((await hubPinProblems(skills(pin), store))[0]).toContain("사용 중지");
}, 60_000);

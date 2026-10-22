// Workflow side of hub-managed skills (gaid-hub-skills, ADR docs/adr/2026-10-22-hub-managed-skills.md): a gaid-workflow/v1
// Workflow pins a hub skill revision; readiness compares the project copy with the pinned tree and the chat offers it.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewSkillHub } from "../src/geo/skill-hub.ts";
import { installStagedSkills } from "../src/agent/skills-install.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { clearStaging, cacheKeyForSource } from "../src/agent/skills-fetch.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { listLocalMethods, methodExposedSkills } from "../src/geo/methods/local-methods.ts";
import { methodTreeHash } from "../src/geo/methods/tree-hash.ts";
import type { ProjectPaths } from "../src/projects.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";

const sha = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const skillMd = Buffer.from("---\nname: grid-method\ndescription: Grid method.\n---\n\n# Grid method\n");
const hubSkillMd = "---\nname: las-qc\ndescription: LAS curve checks.\n---\n\n# LAS QC\n";
let root: string;
let paths: ProjectPaths;
let agentDir: string;
const sources: string[] = [];

function hubTree(dir: string, body = hubSkillMd) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), body);
  return dir;
}
function method(treeHash: string, skillId = "las-qc") {
  const files = [{ path: "SKILL.md", sha256: sha(skillMd), size: skillMd.length }];
  const packageDigest = sha(Buffer.from(files.map((f) => `${f.path}\0${f.sha256}\n`).join("")));
  return {
    schemaVersion: "gaid-method/v1", methodId: "local/grid-method", revision: 1, version: "0.1.0", lifecycle: "draft", implementation: "descriptive",
    title: { ko: "격자 방법" }, summary: { ko: "요약" }, sources: [],
    workflows: [{
      schemaVersion: "gaid-workflow/v1", id: "run", title: { ko: "실행" }, skillIds: ["local:grid-method"], environmentProfile: "geo-core", prompt: { ko: "" },
      skills: [
        { name: "grid-method", source: "bundled", role: "primary" },
        { name: "las-qc", source: "hub", role: "supporting", hub: { skillId, revision: 2, treeHash } },
      ],
      steps: [{ id: "qc", title: { ko: "검층 점검" }, does: { ko: "곡선을 점검합니다." }, skill: "las-qc" }],
    }],
    recipes: [], files, packageDigest,
  };
}
const catalogue = { index: { skills: [] }, environments: { environments: [{ id: "geo-core", title: { ko: "기본" }, targets: ["project"], packages: [], tools: [] }] } } as unknown as GeoCatalogue;
const ready = { readiness: vi.fn().mockResolvedValue({ ready: true, distributions: [], imports: [], tools: [] }) };

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-hub-pins-"));
  agentDir = path.join(root, "agent");
  const sandbox = path.join(root, "sandbox");
  paths = { id: "p", sandbox, kadyDir: path.join(sandbox, ".kady"), skillsDir: path.join(sandbox, ".pi/skills"), provenanceDir: path.join(sandbox, ".kady/provenance") } as ProjectPaths;
});
afterEach(() => { for (const source of sources.splice(0)) clearStaging(cacheKeyForSource(source)); fs.rmSync(root, { recursive: true, force: true }); });

async function installMethod(treeHash: string) {
  const archive = tarGz([
    { path: "grid-method/SKILL.md", data: skillMd },
    { path: "grid-method/gaid-method.json", data: Buffer.from(JSON.stringify(method(treeHash))) },
  ]);
  const preview = await previewSkillHub(paths, { archive }, { agentDir, catalogue: { available: false, skills: [] } });
  sources.push(preview.source);
  await installStagedSkills(paths, { source: preview.source, names: ["grid-method"], stagingToken: preview.stagingToken, acknowledged: true });
}
const list = (hubSuspended?: (id: string, revision: number) => boolean) =>
  listLocalMethods(paths, catalogue, ready, { roots: [projectSkillRoot(paths)], store: path.join(agentDir, "skill-hub/packages"), hubSuspended });

it("validates a hub pin: skillId equals the name, revision and a tree hash", () => {
  const good = parseMethodFile(method("a".repeat(64)), "grid-method");
  expect(good.issues).toEqual([]);
  const bad = parseMethodFile(method("short", "other"), "grid-method");
  expect(bad.issues.map((i) => i.subject)).toContain("workflows[0].skills[1].hub");
});

it("reports pinned hub skill states in readiness and offers the skill to the Workflow's chat", async () => {
  const pinned = methodTreeHash(hubTree(path.join(root, "pinned")));
  await installMethod(pinned);

  let wf = (await list())[0].workflows[0];
  expect(wf.readiness.state).toBe("missing-skills");
  expect(wf.readiness.skills.find((s) => s.source === "hub")).toMatchObject({ installed: false, hub: { skillId: "las-qc", revision: 2, state: "missing" } });
  expect(wf.doc?.skills.find((s) => s.name === "las-qc")).toMatchObject({ source: "hub", hub: { revision: 2 } });

  // The exact pinned tree counts as installed even without a hub install record.
  hubTree(path.join(paths.skillsDir, "las-qc"));
  wf = (await list())[0].workflows[0];
  expect(wf.readiness.skills.find((s) => s.source === "hub")?.hub?.state).toBe("installed");
  expect(wf.readiness.state).toBe("ready");

  // A different skill of the same name from elsewhere blocks; a suspended revision blocks.
  fs.writeFileSync(path.join(paths.skillsDir, "las-qc/SKILL.md"), hubSkillMd + "\nother\n");
  wf = (await list())[0].workflows[0];
  expect(wf.readiness.skills.find((s) => s.source === "hub")).toMatchObject({ installed: false, hub: { state: "conflict" } });
  expect(wf.readiness.state).toBe("missing-skills");
  wf = (await list(() => true))[0].workflows[0];
  expect(wf.readiness.skills.find((s) => s.source === "hub")?.hub?.state).toBe("suspended");

  expect(methodExposedSkills(paths, "method:grid-method:run", catalogue, [])).toEqual(["grid-method", "las-qc"]);
}, 30_000);

it("asks the hub-skill question once with matching shelf skills and binds only chosen ones", async () => {
  const { standardQuestions } = await import("../src/geo/authoring/agent.ts");
  const { chosenHubSkills, HUB_SKILLS_KEY } = await import("../src/geo/authoring/hub-skills.ts");
  const candidates = ["las-qc", "raster-stats", "grid-merge", "kriging-cv"].map((name) => ({ name, description: `${name.replace("-", " ")} tool`, revision: 1, treeHash: "b".repeat(64) }));
  const project = { title: "LAS QC for wells", goal: "check las curves", findings: [], decisions: [], questions: [], sources: [], extractions: {}, drafts: [] } as never;
  const questions = standardQuestions(project, [], "a1", candidates);
  const hub = questions.find((q) => q.key === HUB_SKILLS_KEY)!;
  expect(hub.options.map((o) => o.id)).toEqual(["las-qc", "none"]);
  expect(hub.recommendedOptionId).toBeUndefined();
  const decided = { ...(project as object), decisions: [{ key: HUB_SKILLS_KEY, optionId: undefined, response: "las-qc 와 grid-merge 를 씁니다", status: "answered" }] } as never;
  expect(chosenHubSkills(decided, candidates).map((c) => c.name)).toEqual(["las-qc", "grid-merge"]);
  const none = { ...(project as object), decisions: [{ key: HUB_SKILLS_KEY, optionId: "none", response: "새 스킬만 쓰기", status: "answered" }] } as never;
  expect(chosenHubSkills(none, candidates)).toEqual([]);
  expect(standardQuestions({ ...(project as object), questions: [hub] } as never, [], "a2", candidates).some((q) => q.key === HUB_SKILLS_KEY)).toBe(false);
});

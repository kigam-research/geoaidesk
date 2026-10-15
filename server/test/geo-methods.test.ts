import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previewSkillHub, readSkillHubSites, resolveDescriptorUrl } from "../src/geo/skill-hub.ts";
import { installStagedSkills } from "../src/agent/skills-install.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { clearStaging, cacheKeyForSource } from "../src/agent/skills-fetch.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { listLocalMethods, parseMethodExposure } from "../src/geo/methods/local-methods.ts";
import { assessMethodTrial, getMethodTrial, listMethodTrials, recordMethodTrial } from "../src/geo/methods/trials.ts";
import type { ProjectPaths } from "../src/projects.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";

const hub = { id: "hub", url: "http://127.0.0.1:4310/", packages: "api/catalog/packages", authoring: "api/gaid/packages" };
const skillMd = Buffer.from("---\nname: pu-nested-cv\ndescription: Nested spatial CV for PU prospectivity.\n---\n\n# PU nested CV\n");
const workflow = {
  id: "paper-reproduction",
  title: { ko: "논문 재현", en: "Paper reproduction" },
  inputRoles: [{ id: "grid", label: { ko: "격자 자료" }, formats: ["csv"], required: true }],
  requiredScientificChoices: [{ id: "block_km", label: { ko: "평가 블록 크기" }, options: ["50"] }],
  prompt: { ko: "격자 자료로 nested CV를 실행하세요." },
  skillIds: ["local:pu-nested-cv"],
  environmentProfile: "geo-core",
  expectedArtifacts: [{ id: "metrics", label: { ko: "평가 지표" }, required: true, files: ["metrics*.csv"] }],
  boundary: { ko: "독립 전이 검증이 아닙니다." },
};
const methodJson = (over: Record<string, unknown> = {}) => ({
  schemaVersion: "gaid-method/v1", methodId: "drafts/d1", revision: "r3", lifecycle: "published", implementation: "implemented",
  title: { ko: "PU nested CV", en: "PU nested CV" }, sources: [{ kind: "doi", ref: "10.1007/s11053-026-10778-w" }],
  checks: [{ name: "atlas", state: "pass" }], workflows: [workflow], ...over,
});
const pkg = (method: unknown = methodJson()) => tarGz([
  { path: "pu-nested-cv/SKILL.md", data: skillMd },
  { path: "pu-nested-cv/gaid-method.json", data: Buffer.from(JSON.stringify(method)) },
  { path: "pu-nested-cv/scripts/run.py", data: Buffer.from("print('ok')\n") },
]);
const descriptor = (bytes: Buffer, over: Record<string, unknown> = {}) => ({
  schemaVersion: "gaid-hub-package/v1", methodId: "drafts/d1", revision: "r3", lifecycle: "draft",
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"), size: bytes.length, packageUrl: "api/gaid/files/d1-r3.tar.gz", ...over,
});
const catalogue = { index: { skills: [] }, environments: { environments: [{ id: "geo-core", title: { ko: "기본" }, targets: ["project"], packages: [], tools: [] }] } } as unknown as GeoCatalogue;
const readyService = { readiness: vi.fn().mockResolvedValue({ ready: true, distributions: [], imports: [], tools: [] }) };

let root: string;
let paths: ProjectPaths;
let agentDir: string;
const sources: string[] = [];
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-methods-"));
  agentDir = path.join(root, "agent");
  const sandbox = path.join(root, "sandbox");
  paths = { id: "p", sandbox, kadyDir: path.join(sandbox, ".kady"), skillsDir: path.join(sandbox, ".pi/skills"), provenanceDir: path.join(sandbox, ".kady/provenance") } as ProjectPaths;
});
afterEach(() => { for (const source of sources.splice(0)) clearStaging(cacheKeyForSource(source)); fs.rmSync(root, { recursive: true, force: true }); });

async function install(input: { url?: string; archive?: Buffer }, fetcher?: typeof fetch) {
  const preview = await previewSkillHub(paths, input, { sites: [hub], agentDir, fetcher, catalogue: { available: false, skills: [] } });
  sources.push(preview.source);
  await installStagedSkills(paths, { source: preview.source, names: ["pu-nested-cv"], stagingToken: preview.stagingToken, acknowledged: true });
  return preview;
}
const list = () => listLocalMethods(paths, catalogue, readyService, { roots: [projectSkillRoot(paths)], store: path.join(agentDir, "skill-hub/packages") });

describe("gaid-method/v1 file", () => {
  it("accepts a valid launch contract and reports precise issues otherwise", () => {
    expect(parseMethodFile(methodJson(), "pu-nested-cv")).toMatchObject({ issues: [], method: { methodId: "drafts/d1", workflows: [{ id: "paper-reproduction" }] } });
    const bad = parseMethodFile(methodJson({ lifecycle: "approved", workflows: [{ ...workflow, skillIds: ["local:other", "Bad Id"] }] }), "pu-nested-cv");
    expect(bad.method).toBeNull();
    expect(bad.issues.map((issue) => issue.subject)).toEqual(expect.arrayContaining(["lifecycle", "workflows[0].skillIds"]));
  });
  it("parses method exposures", () => {
    expect(parseMethodExposure("method:pu-nested-cv:paper-reproduction")).toEqual({ runtimeName: "pu-nested-cv", workflowId: "paper-reproduction" });
    expect(parseMethodExposure("workflow:x")).toBeNull();
  });
});

describe("hub sites", () => {
  it("accepts loopback http hubs with an authoring path and still refuses remote http", () => {
    const dir = fs.mkdtempSync(path.join(root, "repo-"));
    fs.mkdirSync(path.join(dir, "geo"));
    fs.writeFileSync(path.join(dir, "geo/distribution.json"), JSON.stringify({ skillHub: { sites: [hub] } }));
    expect(readSkillHubSites(dir)).toEqual([hub]);
    fs.writeFileSync(path.join(dir, "geo/distribution.json"), JSON.stringify({ skillHub: { sites: [{ ...hub, url: "http://hub.example/" }] } }));
    expect(() => readSkillHubSites(dir)).toThrow(/HTTPS/);
    expect(resolveDescriptorUrl("http://127.0.0.1:4310/api/gaid/packages/d1/r3?token=secret", [hub])).toMatchObject({ siteId: "hub", displayUrl: "http://127.0.0.1:4310/api/gaid/packages/d1/r3" });
    expect(resolveDescriptorUrl("http://127.0.0.1:4310/api/other/d1", [hub])).toBeNull();
  });
});

describe("hub draft install → LocalMethod", () => {
  it("installs through the descriptor, verifies bytes and shows the hub lifecycle, not the package claim", async () => {
    const bytes = pkg();
    const fetcher = vi.fn<typeof fetch>(async (url) => String(url).includes("/api/gaid/packages/") ? new Response(JSON.stringify(descriptor(bytes))) : new Response(bytes));
    const preview = await install({ url: "http://127.0.0.1:4310/api/gaid/packages/d1/r3?token=t" }, fetcher);
    expect(fetcher.mock.calls[1][0]).toBe("http://127.0.0.1:4310/api/gaid/files/d1-r3.tar.gz");
    expect(preview.skillHub).toMatchObject({ draft: { methodId: "drafts/d1", revision: "r3", lifecycle: "draft" } });
    const [method] = await list();
    expect(method).toMatchObject({
      key: "project:pu-nested-cv", lifecycle: "draft", lifecycleClaimed: "published", implementation: "implemented", editedLocally: false,
      origin: { kind: "skill-hub", siteId: "hub", descriptorUrl: "http://127.0.0.1:4310/api/gaid/packages/d1/r3" },
      hubChecks: [{ name: "atlas", state: "pass" }],
      workflows: [{ id: "paper-reproduction", exposure: "method:pu-nested-cv:paper-reproduction", readiness: { state: "ready" }, expectedArtifacts: [{ files: ["metrics*.csv"] }] }],
    });
    expect(JSON.stringify(method)).not.toContain("token");
    fs.appendFileSync(path.join(paths.skillsDir, "pu-nested-cv/SKILL.md"), "edit\n");
    expect((await list())[0].editedLocally).toBe(true);
  }, 30_000);

  it("refuses byte, size, revision and off-hub mismatches", async () => {
    const bytes = pkg();
    const run = (desc: unknown, body = bytes) => previewSkillHub(paths, { url: "http://127.0.0.1:4310/api/gaid/packages/d1/r3" }, {
      sites: [hub], agentDir, catalogue: { available: false, skills: [] },
      fetcher: vi.fn<typeof fetch>(async (url) => String(url).includes("/api/gaid/packages/") ? new Response(JSON.stringify(desc)) : new Response(body)),
    });
    await expect(run(descriptor(bytes, { sha256: "0".repeat(64) }))).rejects.toMatchObject({ code: "archive" });
    await expect(run(descriptor(bytes, { revision: "r4" }))).rejects.toMatchObject({ code: "archive" });
    await expect(run(descriptor(bytes, { packageUrl: "https://elsewhere.test/p.tar.gz" }))).rejects.toMatchObject({ code: "download" });
    await expect(run({ ...descriptor(bytes), schemaVersion: "other" })).rejects.toMatchObject({ code: "download" });
  });

  it("caps an uploaded package at draft and lists invalid method files with issues and no workflows", async () => {
    await install({ archive: pkg(methodJson({ workflows: [{ ...workflow, environmentProfile: "Not An Id" }] })) });
    const [method] = await list();
    expect(method).toMatchObject({ lifecycle: "draft", origin: { kind: "upload" }, workflows: [], methodId: null });
    expect(method.issues[0].subject).toBe("workflows[0].environmentProfile");
  }, 30_000);
});

describe("trials", () => {
  it("pins the method revision at session start and observes outputs from provenance only", async () => {
    await install({ archive: pkg() });
    expect(recordMethodTrial(paths, "s1", "catalogue")).toBeNull();
    const record = recordMethodTrial(paths, "s1", "method:pu-nested-cv:paper-reproduction", new Date("2026-10-15T00:00:00Z"), path.join(agentDir, "skill-hub/packages"));
    expect(record).toMatchObject({ methodId: "drafts/d1", revision: "r3", workflowId: "paper-reproduction", packageSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const steps = path.join(paths.provenanceDir, "s1", "steps.jsonl");
    fs.mkdirSync(path.dirname(steps), { recursive: true });
    const step = (id: string, extra: object) => JSON.stringify({ schemaVersion: 1, id, sessionId: "s1", timestamp: Date.parse("2026-10-15T00:01:00Z"), toolName: "bash", role: "agent", model: "kigam-qwen/qwen3.8-flash-next", inputs: [], outputs: [], ...extra });
    fs.writeFileSync(steps, [
      step("a", { inputs: [{ path: "user_data/grid.csv", size: 10, mtimeMs: 1, change: "read", confidence: "observed", sha256: "f".repeat(64) }] }),
      step("b", { isError: true, degraded: "scan-failed", outputs: [{ path: "out/metrics_fold1.csv", size: 5, mtimeMs: 2, change: "created", confidence: "inferred" }] }),
      "{truncated",
    ].join("\n") + "\n");
    const trial = getMethodTrial(paths, "s1");
    expect(trial).toMatchObject({
      methodChanged: false,
      observed: { toolCalls: 2, failedToolCalls: 1, degradedSteps: 1, models: ["kigam-qwen/qwen3.8-flash-next"], inputs: [{ path: "user_data/grid.csv" }], outputs: [{ path: "out/metrics_fold1.csv" }] },
      expected: [{ id: "metrics", found: ["out/metrics_fold1.csv"] }],
    });
    expect(trial.assessment).toBeUndefined();
    expect(() => assessMethodTrial(paths, "s1", { outcome: "great" })).toThrow(/outcome/);
    expect(assessMethodTrial(paths, "s1", { outcome: "needs-revision", note: " 블록 크기 질문 누락 " }).assessment).toMatchObject({ outcome: "needs-revision", note: "블록 크기 질문 누락" });
    fs.appendFileSync(path.join(paths.skillsDir, "pu-nested-cv/SKILL.md"), "edit\n");
    expect(listMethodTrials(paths, { runtimeName: "pu-nested-cv" })).toMatchObject([{ sessionId: "s1", methodChanged: true }]);
    expect(recordMethodTrial(paths, "s1", "method:pu-nested-cv:paper-reproduction")?.startedAt).toBe("2026-10-15T00:00:00.000Z");
  }, 30_000);
});

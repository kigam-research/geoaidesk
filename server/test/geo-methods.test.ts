import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listHubMethods, previewSkillHub, readSkillHubSites, resolveDescriptorUrl } from "../src/geo/skill-hub.ts";
import { installStagedSkills } from "../src/agent/skills-install.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { clearStaging, cacheKeyForSource } from "../src/agent/skills-fetch.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { listLocalMethods, parseMethodExposure } from "../src/geo/methods/local-methods.ts";
import { assessMethodTrial, getMethodTrial, listMethodTrials, recordMethodTrial } from "../src/geo/methods/trials.ts";
import type { ProjectPaths } from "../src/projects.ts";
import { exposureModeIssue, resolveSessionExposure, runtimeSupportSkillNames } from "../src/geo/context.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import { tarGz } from "./helpers/geo-catalogue-fixture.ts";

const hub = { id: "hub", url: "http://127.0.0.1:4317/", packages: "api/catalog/packages", authoring: "api/gaid/" };
const DESCRIPTOR_URL = "http://127.0.0.1:4317/api/gaid/packages/local/pu-nested-cv/3";
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
const sha = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const tree = [{ path: "SKILL.md", data: skillMd }, { path: "scripts/run.py", data: Buffer.from("print('ok')\n") }];
const files = tree.map((f) => ({ path: f.path, sha256: sha(f.data), size: f.data.length }));
const digest = sha(Buffer.from(files.map((f) => `${f.path}\0${f.sha256}\n`).join("")));
const methodJson = (over: Record<string, unknown> = {}) => ({
  schemaVersion: "gaid-method/v1", methodId: "local/pu-nested-cv", revision: 3, version: "0.3.0", lifecycle: "published", implementation: "implemented", codeOrigin: "generated",
  title: { ko: "PU nested CV", en: "PU nested CV" }, summary: { ko: "요약" }, sources: [{ kind: "doi", ref: "10.1007/s11053-026-10778-w" }],
  workflows: [workflow], recipes: [{ id: "paper-50km", workflowId: "paper-reproduction", title: { ko: "논문 설정" }, choices: { block_km: "50" }, unresolvedChoices: [] }],
  checks: { passed: true, checker: "skill_hub@abc", checkedAt: "2026-10-15T00:00:00Z", items: [{ id: "atlas", status: "pass" }], warnings: [] },
  provenance: { hub: { url: "http://127.0.0.1:4317/", projectId: "p1", draftRevision: 4 }, decisions: 2, openQuestions: [{ id: "q3", text: "새 지역 적용 범위" }], attempts: [] },
  files, packageDigest: digest, ...over,
});
const pkg = (method: unknown = methodJson(), extra: { path: string; data: Buffer }[] = []) => tarGz([
  ...tree.map((f) => ({ path: `pu-nested-cv/${f.path}`, data: f.data })),
  { path: "pu-nested-cv/gaid-method.json", data: Buffer.from(JSON.stringify(method)) },
  ...extra,
]);
const descriptor = (bytes: Buffer, over: Record<string, unknown> = {}) => ({
  schemaVersion: "gaid-hub-package/v1", methodId: "local/pu-nested-cv", revision: 3, version: "0.3.0", lifecycle: "draft", implementation: "implemented",
  title: { ko: "PU nested CV" }, sha256: sha(bytes), size: bytes.length, packageDigest: digest, createdAt: "2026-10-15T00:00:00Z",
  packageUrl: `${DESCRIPTOR_URL}/pu-nested-cv.tar.gz`, manifestUrl: `${DESCRIPTOR_URL}/gaid-method.json`, pageUrl: "http://127.0.0.1:4317/#/author/p1", ...over,
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
    expect(parseMethodFile(methodJson(), "pu-nested-cv")).toMatchObject({ issues: [], method: { methodId: "local/pu-nested-cv", revision: 3, workflows: [{ id: "paper-reproduction" }], recipes: [{ id: "paper-50km" }] } });
    const recipe = parseMethodFile(methodJson({ recipes: [{ id: "r", workflowId: "paper-reproduction", title: { ko: "r" }, choices: { block_km: "50", other: 1 }, unresolvedChoices: ["block_km"] }] }), "pu-nested-cv");
    expect(recipe.issues.map((issue) => issue.subject)).toEqual(["recipes[0].choices.other", "recipes[0].unresolvedChoices"]);
    expect(parseMethodFile(methodJson({ methodId: "local/other" }), "pu-nested-cv").issues[0].subject).toBe("methodId");
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
    expect(resolveDescriptorUrl(`${DESCRIPTOR_URL}?token=secret`, [hub])).toMatchObject({ siteId: "hub", displayUrl: DESCRIPTOR_URL });
    for (const bad of ["http://127.0.0.1:4317/api/other/local/x/1", `${DESCRIPTOR_URL}/extra`, "http://127.0.0.1:4317/api/gaid/packages/local/x/0", "http://127.0.0.1:9999/api/gaid/packages/local/x/1"]) expect(resolveDescriptorUrl(bad, [hub])).toBeNull();
  });
});

describe("hub draft install → LocalMethod", () => {
  it("installs through the descriptor, verifies bytes and shows the hub lifecycle, not the package claim", async () => {
    const bytes = pkg();
    const fetcher = vi.fn<typeof fetch>(async (url) => String(url).endsWith(".tar.gz") ? new Response(bytes) : new Response(JSON.stringify(descriptor(bytes))));
    const preview = await install({ url: `${DESCRIPTOR_URL}?token=t` }, fetcher);
    expect(fetcher.mock.calls[1][0]).toBe(`${DESCRIPTOR_URL}/pu-nested-cv.tar.gz`);
    expect(preview.skillHub).toMatchObject({ draft: { methodId: "local/pu-nested-cv", revision: 3, lifecycle: "draft" } });
    const [method] = await list();
    expect(method).toMatchObject({
      key: "project:pu-nested-cv", lifecycle: "draft", lifecycleClaimed: "published", implementation: "implemented", editedLocally: false,
      origin: { kind: "skill-hub", siteId: "hub", descriptorUrl: DESCRIPTOR_URL }, codeOrigin: "generated", version: "0.3.0",
      hubChecks: { checker: "skill_hub@abc", items: [{ id: "atlas", status: "pass" }] },
      authoring: { projectId: "p1", draftRevision: 4, openQuestions: [{ id: "q3" }] }, recipes: [{ id: "paper-50km", choices: { block_km: "50" } }],
      workflows: [{ id: "paper-reproduction", exposure: "method:pu-nested-cv:paper-reproduction", readiness: { state: "ready" }, expectedArtifacts: [{ files: ["metrics*.csv"] }] }],
    });
    expect(JSON.stringify(method)).not.toContain("token");
    fs.appendFileSync(path.join(paths.skillsDir, "pu-nested-cv/SKILL.md"), "edit\n");
    expect((await list())[0].editedLocally).toBe(true);
  }, 30_000);

  it("refuses byte, size, revision and off-hub mismatches", async () => {
    const bytes = pkg();
    const run = (desc: unknown, body = bytes) => previewSkillHub(paths, { url: DESCRIPTOR_URL }, {
      sites: [hub], agentDir, catalogue: { available: false, skills: [] },
      fetcher: vi.fn<typeof fetch>(async (url) => String(url).endsWith(".tar.gz") ? new Response(body) : new Response(JSON.stringify(desc))),
    });
    await expect(run(descriptor(bytes, { sha256: "0".repeat(64) }))).rejects.toMatchObject({ code: "archive" });
    await expect(run(descriptor(bytes, { revision: 4 }))).rejects.toMatchObject({ code: "archive" });
    const tampered = pkg(methodJson(), [{ path: "pu-nested-cv/scripts/extra.py", data: Buffer.from("x") }]);
    await expect(run(descriptor(tampered), tampered)).rejects.toMatchObject({ code: "archive" });
    await expect(run(descriptor(bytes, { packageUrl: "https://elsewhere.test/p.tar.gz" }))).rejects.toMatchObject({ code: "download" });
    await expect(run({ ...descriptor(bytes), schemaVersion: "other" })).rejects.toMatchObject({ code: "download" });
  });

  it("caps an uploaded package at draft and lists invalid method files with issues and no workflows", async () => {
    await install({ archive: pkg(methodJson({ workflows: [{ ...workflow, environmentProfile: "Not An Id" }], recipes: [] })) });
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
    expect(record).toMatchObject({ methodId: "local/pu-nested-cv", revision: 3, workflowId: "paper-reproduction", packageSha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
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

describe("hub method listing", () => {
  it("lists valid descriptors with their descriptor URL and reports an unreachable hub", async () => {
    const bytes = pkg();
    const ok = await listHubMethods([hub, { id: "pages", url: "https://example.test/", packages: "p" }], vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ schemaVersion: "gaid-hub-methods/v1", methods: [descriptor(bytes), { bad: true }] }))));
    expect(ok).toEqual([expect.objectContaining({ siteId: "hub", state: "ok", methods: [expect.objectContaining({ methodId: "local/pu-nested-cv", descriptorUrl: DESCRIPTOR_URL })] })]);
    const down = await listHubMethods([hub], vi.fn<typeof fetch>().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(down[0]).toMatchObject({ state: "error", methods: [] });
  });
});

describe("method exposure", () => {
  it("offers only the method's skills to a new chat and pins its trial; never a project default", async () => {
    await install({ archive: pkg() });
    fs.mkdirSync(path.join(paths.skillsDir, "spatial-pu-workflow"), { recursive: true });
    fs.writeFileSync(path.join(paths.skillsDir, "spatial-pu-workflow/SKILL.md"), "---\nname: spatial-pu-workflow\ndescription: withheld\n---\n");
    const exposure = resolveSessionExposure(paths, "s2", { isNew: true, mode: "method:pu-nested-cv:paper-reproduction" });
    expect(exposure?.skills).toEqual([...new Set([...runtimeSupportSkillNames(), "pu-nested-cv"])].sort());
    expect(exposure?.skills).not.toContain("spatial-pu-workflow");
    expect(getMethodTrial(paths, "s2")).toMatchObject({ runtimeName: "pu-nested-cv", workflowId: "paper-reproduction", revision: 3 });
    expect(exposureModeIssue("method:pu-nested-cv:paper-reproduction")).not.toBeNull();
    expect(exposureModeIssue("method:pu-nested-cv:paper-reproduction", undefined, { allowMethod: true })).toBeNull();
  }, 30_000);
});

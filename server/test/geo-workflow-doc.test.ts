import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { listLocalMethods, methodExposedSkills } from "../src/geo/methods/local-methods.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import type { ProjectPaths } from "../src/projects.ts";
import { catalogueProcedure, packageProcedure, workflowDocFor, workflowDocSay } from "../src/geo/workflow-doc.ts";
import { renderWorkflowDocument } from "../../web/src/geo/contracts/workflow-doc.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { GeoWorkflow } from "../src/geo/catalogue-types.ts";

const base = {
  id: "grid-priority",
  title: { ko: "격자 탐사 우선순위" },
  inputRoles: [{ id: "grid", label: { ko: "격자 CSV" }, formats: ["csv"], required: true }],
  requiredScientificChoices: [{ id: "alpha", label: { ko: "alpha" }, options: ["0.15"] }],
  prompt: { ko: "첫 시험은 줄인 설정으로 하세요." },
  skillIds: ["local:grid-priority"],
  environmentProfile: "geo-core",
  expectedArtifacts: [{ id: "zones", label: { ko: "구역 표" }, required: true, files: ["outputs/zones.csv"] }],
  boundary: { ko: "새 지역 성공률은 보장하지 않습니다." },
};
const structured = {
  ...base,
  schemaVersion: "gaid-workflow/v1",
  skills: [
    { name: "grid-priority", source: "bundled", role: "primary", purpose: { ko: "PU 학습 코드" } },
    { name: "geo-tools", source: "imported", role: "supporting", ref: "example/geo-tools@v1" },
  ],
  steps: [
    { id: "qa", title: { ko: "자료 점검" }, does: { ko: "격자를 점검합니다." }, skill: "geo-tools", checks: [{ ko: "좌표계" }] },
    { id: "zones", title: { ko: "구역 분류" }, does: { ko: "구역을 나눕니다." }, skill: "grid-priority", read: { ko: "구역 분류" }, choiceIds: ["alpha"], outputs: ["zones"] },
  ],
};
const method = (workflow: unknown) => ({
  schemaVersion: "gaid-method/v1", methodId: "local/grid-priority", revision: 2, version: "0.2.0", lifecycle: "draft", implementation: "implemented",
  title: { ko: "격자 탐사 우선순위" }, sources: [], workflows: [workflow], recipes: [],
  checks: { passed: true, checker: "gaid-hub", checkedAt: "2026-10-20T00:00:00Z", items: [], warnings: [] },
  provenance: { hub: { url: "gaid-local:", projectId: "p", draftRevision: 1 }, decisions: 0, openQuestions: [], attempts: [] },
  files: [], packageDigest: "0".repeat(64),
});

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-wfdoc-")); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("gaid-workflow/v1 in gaid-method.json", () => {
  it("accepts skills and steps that refer to this Workflow", () => {
    expect(parseMethodFile(method(structured), "grid-priority").issues).toEqual([]);
  });

  it("reports steps that name unknown skills, choices or outputs", () => {
    const bad = { ...structured, steps: [{ id: "x", title: { ko: "x" }, does: { ko: "x" }, skill: "other", choiceIds: ["nope"], outputs: ["nope"] }] };
    const subjects = parseMethodFile(method(bad), "grid-priority").issues.map((issue) => issue.subject);
    expect(subjects).toEqual(expect.arrayContaining(["workflows[0].steps[0].skill", "workflows[0].steps[0].choiceIds", "workflows[0].steps[0].outputs"]));
  });

  it("requires steps and keeps a bundled skill to this package", () => {
    const noSteps = parseMethodFile(method({ ...structured, steps: [] }), "grid-priority").issues.map((issue) => issue.subject);
    expect(noSteps).toContain("workflows[0].steps");
    const foreign = parseMethodFile(method({ ...structured, skills: [{ name: "other", source: "bundled", role: "primary" }], steps: [] }), "grid-priority").issues.map((i) => i.subject);
    expect(foreign).toContain("workflows[0].skills[0].name");
  });

  it("accepts an empty prompt only in gaid-workflow/v1 and renders no instructions section", () => {
    expect(parseMethodFile(method({ ...structured, prompt: { ko: "" } }), "grid-priority").issues).toEqual([]);
    expect(parseMethodFile(method({ ...base, prompt: { ko: "" } }), "grid-priority").issues.map((i) => i.subject)).toContain("workflows[0].prompt");
    const doc = workflowDocFor({ ...structured, prompt: { ko: "" } } as unknown as GeoWorkflow, { skills: [] });
    expect(doc.instructions).toBeNull();
  });

  it("still accepts a geo-workflow/v1 Workflow without steps", () => {
    expect(parseMethodFile(method(base), "grid-priority").issues).toEqual([]);
  });
});

describe("workflowDocFor", () => {
  const context = { revision: 2, skills: [{ name: "grid-priority", source: "bundled" as const }] };

  it("uses a gaid-workflow/v1 Workflow's own steps and skills", () => {
    const doc = workflowDocFor(structured as unknown as GeoWorkflow, context);
    expect(doc).toMatchObject({ kind: "structured", revision: 2, instructions: { ko: "첫 시험은 줄인 설정으로 하세요." } });
    expect(doc.skills.map((skill) => [skill.name, skill.source, skill.role])).toEqual([["grid-priority", "bundled", "primary"], ["geo-tools", "imported", "supporting"]]);
    const text = renderWorkflowDocument(doc, { locale: "ko", target: "chat", say: workflowDocSay("ko"), settings: { inputs: { grid: "user_data/g.csv" }, choices: { alpha: "0.15" } } });
    expect(text).toContain("- geo-tools (가져온 스킬, example/geo-tools@v1) 1단계에서 씁니다.");
    expect(text).toContain("2. 구역 분류 [연구자 결정: alpha]: 구역을 나눕니다.");
    expect(text).toContain("   스킬: grid-priority (먼저 읽을 곳: 구역 분류)");
  });

  it("derives steps for an older Workflow from the package's atlas.yaml", () => {
    fs.writeFileSync(path.join(root, "atlas.yaml"), [
      "procedure:",
      "  nodes:",
      "    - id: intake",
      "      label: {ko: 데이터 입력}",
      "      summary: {ko: 격자를 읽습니다.}",
      "      checks:",
      "        - ko: 좌표계 확인",
      "    - id: broken",
      "",
    ].join("\n"));
    const doc = workflowDocFor(base as unknown as GeoWorkflow, { ...context, procedure: packageProcedure(root) });
    expect(doc.kind).toBe("legacy");
    expect(doc.steps).toEqual([expect.objectContaining({ id: "intake", skill: "grid-priority", checks: [{ ko: "좌표계 확인" }] })]);
  });

  it("reads a catalogue skill's procedure and ignores unsafe ids", () => {
    const details = path.join(root, "catalogue", "details", "kigam");
    fs.mkdirSync(details, { recursive: true });
    fs.writeFileSync(path.join(details, "well-qc.json"), JSON.stringify({ profile: { procedure: { nodes: [{ id: "a", label: { ko: "목록" }, summary: { ko: "곡선 목록" } }] } } }));
    const catalogue = { root } as GeoCatalogue;
    expect(catalogueProcedure(catalogue, "kigam/well-qc")).toEqual([expect.objectContaining({ id: "a", label: { ko: "목록" } })]);
    expect(catalogueProcedure(catalogue, "../kigam/well-qc")).toBeNull();
    expect(catalogueProcedure(catalogue, "kigam/missing")).toBeNull();
    expect(packageProcedure(path.join(root, "none"))).toBeNull();
  });
});

describe("imported skills of an installed gaid-workflow/v1 Workflow", () => {
  it("count toward readiness with their source and are offered to the Workflow's chat", async () => {
    const sandbox = path.join(root, "sandbox");
    const paths = { id: "p", sandbox, kadyDir: path.join(sandbox, ".kady"), skillsDir: path.join(sandbox, ".pi/skills"), provenanceDir: path.join(sandbox, ".kady/provenance") } as ProjectPaths;
    const dir = path.join(paths.skillsDir, "grid-priority");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: grid-priority\ndescription: x\n---\n");
    fs.writeFileSync(path.join(dir, "gaid-method.json"), JSON.stringify(method(structured)));
    const service = { readiness: async () => ({ ready: true, distributions: [], imports: [], tools: [] }) };
    const catalogue = { index: { skills: [] }, environments: { environments: [{ id: "geo-core", title: { ko: "기본" }, targets: ["project"], packages: [], tools: [] }] } } as unknown as GeoCatalogue;
    const list = () => listLocalMethods(paths, catalogue, service as never, { roots: [projectSkillRoot(paths)], store: path.join(root, "store") });
    let [wf] = (await list())[0].workflows;
    expect(wf.readiness.skills.map((skill) => [skill.runtimeName, skill.source, skill.enabled, skill.ref ?? null])).toEqual([
      ["grid-priority", "bundled", true, null], ["geo-tools", "imported", false, "example/geo-tools@v1"],
    ]);
    expect(wf.readiness.state).toBe("missing-skills");
    expect(wf.doc?.kind).toBe("structured");
    fs.mkdirSync(path.join(paths.skillsDir, "geo-tools"), { recursive: true });
    fs.writeFileSync(path.join(paths.skillsDir, "geo-tools", "SKILL.md"), "---\nname: geo-tools\ndescription: y\n---\n");
    [wf] = (await list())[0].workflows;
    expect(wf.readiness.state).toBe("ready");
    expect(methodExposedSkills(paths, "method:grid-priority:grid-priority", catalogue, ["support"])).toEqual(["geo-tools", "grid-priority", "support"]);
  });
});

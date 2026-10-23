import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { listLocalMethods } from "../src/geo/methods/local-methods.ts";
import { prepareExamples } from "../src/geo/methods/examples.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { workflowDocFor, workflowDocSay } from "../src/geo/workflow-doc.ts";
import { renderWorkflowDocument } from "../../web/src/geo/contracts/workflow-doc.ts";
import { examplePath } from "../../web/src/geo/contracts/workflow-examples.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { GeoWorkflow } from "../src/geo/catalogue-types.ts";
import type { ProjectPaths } from "../src/projects.ts";
import { recordUpload } from "../src/provenance/user-steps.ts";

vi.mock("../src/provenance/user-steps.ts", () => ({ recordUpload: vi.fn().mockResolvedValue(null) }));

const sha = (data: Buffer) => crypto.createHash("sha256").update(data).digest("hex");
const grid = Buffer.from("x,y,tmi\n0,0,12.5\n250,0,13.1\n");
const holes = Buffer.alloc(4096, 7);
const workflow = (example: unknown, holesExample?: unknown) => ({
  schemaVersion: "gaid-workflow/v1",
  id: "mag-inversion",
  title: { ko: "자력 역산" },
  inputRoles: [
    { id: "grid", label: { ko: "항공자력 격자" }, formats: ["csv"], required: true, example },
    { id: "holes", label: { ko: "시추 대자율" }, formats: ["csv"], required: false, ...(holesExample ? { example: holesExample } : {}) },
  ],
  requiredScientificChoices: [],
  prompt: { ko: "" },
  skillIds: ["local:mag-inv"],
  environmentProfile: "geo-core",
  expectedArtifacts: [{ id: "model", label: { ko: "대자율 모델" }, required: true }],
  boundary: { ko: "예제 지역의 결과입니다." },
  exampleCaseIds: [],
  skills: [{ name: "mag-inv", source: "bundled", role: "primary" }],
  steps: [{ id: "invert", title: { ko: "역산" }, does: { ko: "역산합니다." }, skill: "mag-inv", outputs: ["model"] }],
});
const bundled = {
  title: { ko: "공개 항공자력 격자" },
  source: { ko: "예시 기관 공개 자료" },
  license: "CC-BY-4.0",
  files: [{ name: "tmi.csv", sha256: sha(grid), size: grid.length, path: "examples/grid/tmi.csv" }],
};
const catalogue = { index: { skills: [] }, environments: { environments: [{ id: "geo-core", title: { ko: "기본" }, targets: ["project"], packages: [], tools: [] }] } } as unknown as GeoCatalogue;
const readyService = { readiness: vi.fn().mockResolvedValue({ ready: true, distributions: [], imports: [], tools: [] }) };

let root: string;
let paths: ProjectPaths;
let server: http.Server | null = null;

function installMethod(wf: unknown, files: Record<string, Buffer> = { "examples/grid/tmi.csv": grid }) {
  const dir = path.join(paths.skillsDir, "mag-inv");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: mag-inv\ndescription: Use when inverting magnetic data.\n---\n\n# 자력 역산\n");
  for (const [rel, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), data);
  }
  fs.writeFileSync(path.join(dir, "gaid-method.json"), JSON.stringify({
    schemaVersion: "gaid-method/v1", methodId: "local/mag-inv", revision: 1, lifecycle: "draft", implementation: "descriptive",
    title: { ko: "자력 역산" }, workflows: [wf],
  }));
}
const list = async () => (await listLocalMethods(paths, catalogue, readyService, { roots: [projectSkillRoot(paths)] }))[0];

async function serve(body: Buffer): Promise<string> {
  server = http.createServer((_req, res) => { res.writeHead(200, { "content-length": body.length }); res.end(body); });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/holes.csv`;
}

beforeEach(() => {
  vi.mocked(recordUpload).mockClear();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-examples-"));
  const sandbox = path.join(root, "sandbox");
  fs.mkdirSync(sandbox, { recursive: true });
  paths = { id: "p", sandbox, kadyDir: path.join(sandbox, ".kady"), skillsDir: path.join(sandbox, ".pi/skills"), provenanceDir: path.join(sandbox, ".kady/provenance") } as ProjectPaths;
});
afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = null;
  fs.rmSync(root, { recursive: true, force: true });
});

describe("Workflow example data declaration", () => {
  it("accepts bundled and remote examples and reports bad ones", () => {
    const remote = { title: { ko: "시추" }, source: { ko: "공개" }, files: [{ name: "holes.csv", sha256: sha(holes), size: holes.length, url: "https://example.org/holes.csv" }] };
    expect(parseMethodFile({ schemaVersion: "gaid-method/v1", methodId: "local/mag-inv", revision: 1, lifecycle: "draft", implementation: "descriptive", title: { ko: "t" }, workflows: [workflow(bundled, remote)] }, "mag-inv").issues).toEqual([]);
    const bad = parseMethodFile({ schemaVersion: "gaid-method/v1", methodId: "local/mag-inv", revision: 1, lifecycle: "draft", implementation: "descriptive", title: { ko: "t" },
      workflows: [workflow({ ...bundled, files: [{ ...bundled.files[0], path: "data/tmi.csv" }] }, { ...remote, files: [{ ...remote.files[0], url: "http://example.org/holes.csv" }] })] }, "mag-inv");
    expect(bad.method).toBeNull();
    expect(bad.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "example.files[0].path must be examples/grid/<name>",
      "example.files[0].url must be a public https URL",
    ]));
  });
});

describe("example data in a project", () => {
  it("reports state, copies a bundled example once and records it as an upload", async () => {
    installMethod(workflow(bundled));
    const before = (await list()).workflows[0].inputRoles[0].example!;
    expect(before).toMatchObject({ state: "bundled", size: grid.length, download: 0, synthetic: false, license: "CC-BY-4.0" });
    const target = examplePath("mag-inv", "grid", bundled as never);
    expect(before.path).toBe(target);
    expect((await list()).workflows[0].inputRoles[1].example).toBeUndefined();

    const first = await prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid"] });
    expect(first).toEqual({ inputs: { grid: target }, written: [target] });
    expect(fs.readFileSync(path.join(paths.sandbox, target))).toEqual(grid);
    expect((await list()).workflows[0].inputRoles[0].example!.state).toBe("present");
    expect(await prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid"] })).toEqual({ inputs: { grid: target }, written: [] });
    // One provenance upload step, for the call that wrote the file.
    expect(recordUpload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordUpload).mock.calls[0][2]).toEqual([path.join(fs.realpathSync(paths.sandbox), target)]);
  });

  it("never overwrites a different file and refuses a changed bundled file", async () => {
    installMethod(workflow(bundled), { "examples/grid/tmi.csv": Buffer.from("changed") });
    expect((await list()).workflows[0].inputRoles[0].example).toMatchObject({ state: "broken" });
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid"] })).rejects.toThrow(/missing or differs/);

    installMethod(workflow(bundled));
    const target = path.join(paths.sandbox, examplePath("mag-inv", "grid", bundled as never));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "researcher edit");
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid"] })).rejects.toThrow(/not overwritten/);
    expect(fs.readFileSync(target, "utf8")).toBe("researcher edit");
  });

  it("downloads a remote example with size and hash checks", async () => {
    const url = await serve(holes);
    const remote = { title: { ko: "시추 대자율" }, source: { ko: "공개 시추 자료" }, synthetic: true, files: [{ name: "holes.csv", sha256: sha(holes), size: holes.length, url }] };
    installMethod(workflow(bundled, remote));
    expect((await list()).workflows[0].inputRoles[1].example).toMatchObject({ state: "remote", download: holes.length, synthetic: true });
    const result = await prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid", "holes"] });
    expect(result.written).toHaveLength(2);
    expect(fs.readFileSync(path.join(paths.sandbox, result.inputs.holes))).toEqual(holes);
    expect((await list()).workflows[0].inputRoles[1].example!.state).toBe("present");

    // A declared hash that does not match what the server sends leaves nothing behind.
    const wrong = { ...remote, files: [{ ...remote.files[0], name: "other.csv", sha256: sha(Buffer.from("x")) }] };
    installMethod(workflow(bundled, wrong));
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["holes"] })).rejects.toThrow(/sha256/);
    const folder = path.dirname(path.join(paths.sandbox, examplePath("mag-inv", "holes", wrong as never)));
    expect(fs.readdirSync(folder)).toEqual([]);

    // More bytes than declared stop the download.
    const short = { ...remote, files: [{ ...remote.files[0], name: "short.csv", size: 100 }] };
    installMethod(workflow(bundled, short));
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["holes"] })).rejects.toThrow(/expected 100|larger than/);
  });

  it("rejects unknown roles and Workflows", async () => {
    installMethod(workflow(bundled));
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: ["holes"] })).rejects.toThrow(/no example/);
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "nope", roleIds: ["grid"] })).rejects.toThrow(/not found/);
    await expect(prepareExamples(paths, "p", { method: "mag-inv", workflowId: "mag-inversion", roleIds: [] })).rejects.toThrow(/roleIds/);
  });
});

describe("Workflow 지침 with example data", () => {
  const doc = () => workflowDocFor(workflow(bundled) as unknown as GeoWorkflow, { skills: [{ name: "mag-inv", source: "bundled" }] });
  it("keeps the declaration without authoring fields", () => {
    const withFrom = workflow({ ...bundled, files: [{ ...bundled.files[0], from: { upload: true } }] });
    expect(workflowDocFor(withFrom as unknown as GeoWorkflow, { skills: [{ name: "mag-inv", source: "bundled" }] }).inputRoles[0].example!.files[0]).not.toHaveProperty("from");
  });
  it("says in chat, preview and CLI that example data is used", () => {
    const say = workflowDocSay("ko");
    const path = examplePath("mag-inv", "grid", bundled as never);
    const chat = renderWorkflowDocument(doc(), { locale: "ko", target: "chat", say, settings: { inputs: { grid: path }, choices: {}, examples: ["grid"] } });
    expect(chat).toContain(`- 항공자력 격자: ${path} (Workflow의 예제 자료: 공개 항공자력 격자. 출처: 예시 기관 공개 자료)`);
    expect(chat).toContain("다음 입력은 연구자의 자료가 아니라 Workflow가 제공한 예제 자료입니다: 항공자력 격자");
    const own = renderWorkflowDocument(doc(), { locale: "ko", target: "chat", say, settings: { inputs: { grid: "user_data/my.csv" }, choices: {} } });
    expect(own).not.toContain("예제 자료");
    expect(renderWorkflowDocument(doc(), { locale: "ko", target: "preview", say })).toContain("고르지 않으면 Workflow의 예제 자료를 씁니다: 공개 항공자력 격자");
    const cli = renderWorkflowDocument(doc(), { locale: "en", target: "cli", say: workflowDocSay("en") });
    expect(cli).toContain("examples/grid/tmi.csv in the folder of skill mag-inv");
  });
});

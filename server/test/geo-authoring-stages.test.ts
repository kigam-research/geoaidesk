/**
 * Analysis-flow stages in authoring (gaid-workflow-stages): the draft keeps inputIds / multiple / default, stage
 * warnings ask for the one bounded repair, the package check warns (never blocks) on older drafts, and installed
 * methods validate and summarise the new fields.
 */
import { afterEach, describe, expect, it } from "vitest";
import { runOperation, STAGE_ERROR_PREFIX } from "../src/geo/authoring/agent.ts";
import { buildPackage, checkMethod, type PackageContext } from "../src/geo/authoring/package.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { summarizeWorkflow } from "../src/geo/workspace/workflows.ts";
import type { GeoWorkflow } from "../src/geo/catalogue-types.ts";
import { analysis, cleanup, config, draftReply, fixture, reply, testVocabulary } from "./helpers/geo-authoring.ts";

afterEach(cleanup);

const staged = {
  ...draftReply,
  workflow: {
    ...draftReply.workflow,
    inputRoles: [{ id: "grid", label: "격자 표", formats: ["csv"], required: true, multiple: true }],
    requiredScientificChoices: [
      ...draftReply.workflow.requiredScientificChoices,
      { id: "trees", label: "나무 수 (논문: 500)", why: "결과의 안정성이 달라집니다.", default: "500" },
    ],
    steps: draftReply.workflow.steps.map((s) => (s.id === "evaluate" ? { ...s, choiceIds: ["block-size", "trees"] } : s)),
  },
};

/** Eight item-by-item steps, no inputIds: the form written before stages. */
const itemSplit = {
  ...draftReply,
  workflow: {
    ...draftReply.workflow,
    steps: ["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => ({
      id: `s-${id}`,
      title: i === 0 ? "격자 표" : i === 1 ? "block 크기" : i === 2 ? "양성 정의" : `단계 ${id}`,
      does: "처리합니다.",
      skill: "pu-nested-cv-method",
      read: i === 0 ? "격자 표" : i === 1 ? "block 크기" : i === 2 ? "양성 정의" : `단계 ${id}`,
      checks: [],
      inputIds: i === 0 ? ["grid"] : [],
      choiceIds: i === 1 ? ["block-size"] : i === 2 ? ["label-def"] : [],
      outputs: i === 7 ? ["scores"] : [],
    })),
  },
};

async function draft(...contents: unknown[]) {
  const f = await fixture();
  await runOperation(f.store, f.projectId, "analyze", "op-st-analyze", { chat: reply(analysis), config, vocabulary: testVocabulary() });
  const attempt = await runOperation(f.store, f.projectId, "draft", "op-st-draft", { chat: reply(...contents), config, vocabulary: testVocabulary() });
  const project = await f.store.read(f.projectId);
  const ctx: PackageContext = { store: f.store, vocabulary: testVocabulary(), checker: "gaid-hub@test" };
  return { ...f, attempt, project, ctx };
}

describe("analysis-flow stages in authoring", () => {
  it("keeps inputIds, multiple and default; a defaulted choice is not left to decide", async () => {
    const { attempt, project } = await draft(staged);
    expect(attempt.outcome).toBe("accepted");
    const d = project.drafts.at(-1)!;
    expect(d.workflow!.inputRoles[0].multiple).toBe(true);
    expect(d.workflow!.steps![0].inputIds).toEqual(["grid"]);
    expect(d.workflow!.requiredScientificChoices.find((c) => c.id === "trees")!.default).toBe("500");
    // "trees" has a default; the other two have no researcher answer in this fixture.
    expect(d.recipe!.unresolvedChoices).toEqual(["block-size", "label-def"]);
  });

  it("refuses a default that is not one of the choice's options and an unknown input reference", async () => {
    const bad = {
      ...staged,
      workflow: {
        ...staged.workflow,
        requiredScientificChoices: staged.workflow.requiredScientificChoices.map((c) => (c.id === "block-size" ? { ...c, default: "km99" } : c)),
        steps: staged.workflow.steps.map((s) => (s.id === "report" ? { ...s, inputIds: ["nope"] } : s)),
      },
    };
    const { attempt } = await draft(bad, bad);
    expect(attempt.outcome).toBe("rejected");
    const errors = attempt.validationErrors!.flat();
    expect(errors.some((e) => e.includes('default "km99" must be one of its option ids'))).toBe(true);
    expect(errors.some((e) => e.includes("inputIds: unknown input nope"))).toBe(true);
  });

  it("sends stage warnings to the one repair round and takes the regrouped reply", async () => {
    const { attempt, project } = await draft(itemSplit, staged);
    expect(attempt.validationErrors![0].filter((e) => e.startsWith(STAGE_ERROR_PREFIX)).length).toBeGreaterThan(0);
    expect(attempt.outcome).toBe("repaired");
    expect(project.drafts.at(-1)!.workflow!.steps).toHaveLength(3);
  });

  it("keeps a draft whose repair still splits item by item; the package check warns but does not block", async () => {
    const { attempt, project, ctx } = await draft(itemSplit, itemSplit);
    expect(attempt.outcome).toMatch(/accepted|repaired/);
    const d = project.drafts.at(-1)!;
    expect(d.workflow!.steps).toHaveLength(8);
    const findings = await checkMethod(project, d, ctx);
    const stages = findings.filter((f) => f.code === "workflow-stages");
    expect(stages.length).toBeGreaterThanOrEqual(2);
    expect(stages.every((f) => f.level === "warning" && f.check === "workflow")).toBe(true);
    expect(stages.map((f) => f.message).join("\n")).toMatch(/Workflow 단계가 8개입니다[\s\S]*「격자 표」/);
    const built = await buildPackage(project, d, ctx);
    if (!("record" in built)) throw Error(JSON.stringify(built));
    expect(built.record.manifest.checks?.warnings.some((w) => w.code === "workflow-stages")).toBe(true);
  });

  it("packages the new fields and GAID's method reader accepts them", async () => {
    const { project, ctx } = await draft(staged);
    const built = await buildPackage(project, project.drafts.at(-1)!, ctx);
    if (!("record" in built)) throw Error(JSON.stringify(built));
    const manifest = built.record.manifest;
    expect(manifest.checks?.warnings.some((w) => w.code === "workflow-stages")).toBe(false);
    expect(parseMethodFile(manifest, "pu-nested-cv-method").issues).toEqual([]);
    const workflow = manifest.workflows[0] as unknown as GeoWorkflow;
    const summary = summarizeWorkflow(workflow, { state: "ready", missingSkills: [], environment: null } as never);
    expect(summary.inputRoles[0].multiple).toBe(true);
    expect(summary.requiredScientificChoices.find((c) => c.id === "trees")!.default).toBe("500");
  });

  it("method reader rejects a bad multiple, a default outside the options and a step naming an unknown input", async () => {
    const { project, ctx } = await draft(staged);
    const built = await buildPackage(project, project.drafts.at(-1)!, ctx);
    if (!("record" in built)) throw Error(JSON.stringify(built));
    const manifest = structuredClone(built.record.manifest) as unknown as { workflows: Record<string, unknown>[] };
    const w = manifest.workflows[0] as { inputRoles: Record<string, unknown>[]; requiredScientificChoices: Record<string, unknown>[]; steps: Record<string, unknown>[] };
    w.inputRoles[0].multiple = "yes";
    w.requiredScientificChoices.find((c) => c.id === "block-size")!.default = "km99";
    w.steps[1].inputIds = ["nope"];
    const subjects = parseMethodFile(manifest, "pu-nested-cv-method").issues.map((i) => i.subject);
    expect(subjects).toEqual(expect.arrayContaining([
      "workflows[0].inputRoles[0].multiple",
      "workflows[0].requiredScientificChoices[0].default",
      "workflows[0].steps[1].inputIds",
    ]));
  });
});

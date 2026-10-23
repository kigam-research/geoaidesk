import { describe, expect, it } from "vitest";
import { MAX_RAIL, stageWarnings, workflowStages, type WorkflowStageShape } from "./workflow-stages";

const ko = (value: string) => ({ ko: value });
const roles = (...ids: string[]) => ids.map((id) => ({ id, label: ko(id) }));
const choices = (...ids: string[]) => ids.map((id) => ({ id, label: ko(id) }));

describe("workflowStages", () => {
  it("puts each step's inputs and choices on one page and drops steps with nothing to set", () => {
    const shape: WorkflowStageShape = {
      inputRoles: roles("lines", "base", "cores"),
      choices: [...choices("weights", "boundary"), { id: "mesh", label: ko("mesh"), default: "25" }],
      steps: [
        { id: "prepare", title: ko("자료 준비"), inputIds: ["lines", "base", "cores"] },
        { id: "model", title: ko("역산"), choiceIds: ["weights", "mesh"] },
        { id: "evaluate", title: ko("평가"), choiceIds: ["boundary"] },
        { id: "report", title: ko("해석·결과") },
      ],
    };
    const result = workflowStages(shape);
    expect(result.kind).toBe("flow");
    expect(result.stages.map((stage) => stage.id)).toEqual(["prepare", "model", "evaluate"]);
    expect(result.stages[1]).toMatchObject({ choiceIds: ["weights"], defaultIds: ["mesh"] });
  });

  it("adds unnamed inputs to the first page with inputs and unnamed choices to the first page", () => {
    const result = workflowStages({
      inputRoles: roles("a", "b"),
      choices: choices("x", "y"),
      steps: [{ id: "s1", title: ko("준비"), choiceIds: ["x"] }, { id: "s2", title: ko("처리"), inputIds: ["b"] }, { id: "s3", title: ko("평가") }],
    });
    expect(result.stages.find((stage) => stage.id === "s2")?.inputIds).toEqual(["a", "b"]);
    expect(result.stages[0].choiceIds).toEqual(["x", "y"]);
  });

  it("shows two pages for a Workflow whose steps name nothing", () => {
    const result = workflowStages({ inputRoles: roles("a"), choices: choices("x"), steps: [{ id: "s1", title: ko("준비") }] });
    expect(result).toEqual({ kind: "grouped", stages: [
      { id: "inputs", title: null, inputIds: ["a"], choiceIds: [], defaultIds: [] },
      { id: "choices", title: null, inputIds: [], choiceIds: ["x"], defaultIds: [] },
    ] });
  });

  it("falls back to two pages when more than five steps carry settings (Pocheon-like, ~20 items)", () => {
    const inputs = roles("i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8");
    const conditions = choices("c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10");
    const steps = conditions.map((choice, n) => ({ id: `s${n}`, title: ko(`단계 ${n}`), choiceIds: [choice.id] }));
    const result = workflowStages({ inputRoles: inputs, choices: conditions, steps });
    expect(result.kind).toBe("grouped");
    expect(result.stages.length + 2).toBeLessThanOrEqual(MAX_RAIL);
  });
});

describe("stageWarnings", () => {
  it("flags step count, required choices, unmapped inputs and item-by-item splitting", () => {
    const shape: WorkflowStageShape = {
      inputRoles: roles("lines", "base", "cores", "dem"),
      choices: choices("c1", "c2", "c3", "c4", "c5", "c6", "c7"),
      steps: [
        { id: "a", title: ko("lines 입력"), inputIds: ["lines"] },
        { id: "b", title: ko("base"), inputIds: ["base"] },
        { id: "c", title: ko("cores 확인"), inputIds: ["cores", "nope"] },
        { id: "d", title: ko("c1 정하기"), choiceIds: ["c1"] },
        { id: "e", title: ko("c2"), choiceIds: ["c2"] },
        { id: "f", title: ko("나머지"), choiceIds: ["c3", "c4"] },
      ],
    };
    expect(stageWarnings(shape).map((warning) => warning.code).sort()).toEqual(["item-split", "required-choices", "stage-count", "unknown-input", "unmapped-input"]);
  });

  it("accepts a 3-5 stage analysis flow", () => {
    expect(stageWarnings({
      inputRoles: roles("lines", "base"),
      choices: [...choices("c1", "c2"), { id: "c3", label: ko("c3"), default: "a" }],
      steps: [
        { id: "prepare", title: ko("자료 준비"), inputIds: ["lines", "base"] },
        { id: "model", title: ko("처리·모델링"), choiceIds: ["c1", "c3"] },
        { id: "evaluate", title: ko("평가"), choiceIds: ["c2"] },
      ],
    })).toEqual([]);
  });
});

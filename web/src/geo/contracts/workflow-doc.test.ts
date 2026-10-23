import { describe, expect, it } from "vitest";
import { t } from "../i18n";
import { legacyWorkflowDoc, parseWorkflowBlock, renderWorkflowDocument, workflowBlock, type WorkflowDoc, type WorkflowDocSay } from "./workflow-doc";

const sayIn = (locale: "ko" | "en"): WorkflowDocSay => (key, values) => t(`workflowDoc.${key}`, values ?? {}, locale);
const ko = { locale: "ko" as const, say: sayIn("ko") };

const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1",
  kind: "structured",
  id: "conformal-grid-priority",
  title: { ko: "격자 탐사 우선순위", en: "Grid exploration priority" },
  revision: 1,
  purpose: { ko: "격자 표로 탐사 우선순위 구역을 만듭니다." },
  inputRoles: [{ id: "grid-csv", label: { ko: "집계 격자 CSV" }, formats: ["csv"], required: true }],
  choices: [
    { id: "alpha", label: { ko: "순응 보정 alpha" }, options: ["paper-015", "custom"], optionLabels: { "paper-015": { ko: "0.15" } } },
    { id: "scale", label: { ko: "계산 설정 규모" }, options: ["reduced", "full"] },
  ],
  skills: [{ name: "conformal-grid-priority", source: "bundled", role: "primary", purpose: { ko: "PU 학습과 순응 보정 코드" } }],
  steps: [
    { id: "qa", title: { ko: "데이터 입력·QA" }, does: { ko: "격자 CSV를 점검합니다." }, skill: "conformal-grid-priority", read: { ko: "1단계" }, checks: [{ ko: "좌표계" }, { ko: "결측률" }], choiceIds: [], outputs: [] },
    { id: "zones", title: { ko: "순응 보정·구역 분류" }, does: { ko: "구역을 나눕니다." }, skill: "conformal-grid-priority", checks: [], choiceIds: ["alpha"], outputs: ["zone-table"] },
  ],
  artifacts: [{ id: "zone-table", label: { ko: "구역 등급 표" }, required: true, files: ["outputs/zone_table.csv"] }],
  boundary: { ko: "새 지역의 탐사 성공률은 보장하지 않습니다." },
  instructions: null,
};

describe("renderWorkflowDocument", () => {
  it("fills the researcher's settings for the chat and lists unresolved conditions", () => {
    const text = renderWorkflowDocument(doc, { ...ko, target: "chat", settings: { inputs: { "grid-csv": "user_data/grid.csv" }, choices: { alpha: "paper-015" } } });
    expect(text.split("\n")[0]).toBe("# Workflow: 격자 탐사 우선순위 (1판)");
    expect(text).toContain("- 집계 격자 CSV: user_data/grid.csv");
    expect(text).toContain("- 순응 보정 alpha: 0.15");
    // The sentences after the settings list start after a blank line, so Markdown does not join them to the last item.
    expect(text).toContain("- 순응 보정 alpha: 0.15\n\n정하지 않은 조건: 계산 설정 규모");
    expect(text).toContain("- conformal-grid-priority (Workflow에 딸린 스킬, 주 스킬): PU 학습과 순응 보정 코드 1, 2단계에서 씁니다.");
    expect(text).toContain("2. 순응 보정·구역 분류 [연구자 결정: 순응 보정 alpha]: 구역을 나눕니다.");
    expect(text).toContain("   스킬: conformal-grid-priority (먼저 읽을 곳: 1단계)");
    expect(text).toContain("   만드는 결과: 구역 등급 표");
    expect(text).toContain("- outputs/zone_table.csv: 구역 등급 표 (필수)");
    expect(text).not.toContain("$ARGUMENTS");
  });

  it("tells the agent to run through when every condition is set", () => {
    const choices = Object.fromEntries(doc.choices.map((c) => [c.id, c.options?.[0] ?? "x"]));
    const all = renderWorkflowDocument(doc, { ...ko, target: "chat", settings: { inputs: {}, choices } });
    expect(all).toContain("정하지 않은 조건: 없음");
    expect(all).toContain("연구자가 조건을 모두 정했습니다.");
    expect(all).not.toContain("정하지 않은 조건은 해당 조건을 쓰는 단계 전에");
    const open = renderWorkflowDocument(doc, { ...ko, target: "chat", settings: { inputs: {}, choices: {} } });
    expect(open).toContain("정하지 않은 조건은 해당 조건을 쓰는 단계 전에");
  });

  it("shows choices with their options in a preview without settings", () => {
    const text = renderWorkflowDocument(doc, { ...ko, target: "preview" });
    expect(text).toContain("- 집계 격자 CSV: 연구자가 고릅니다");
    expect(text).toContain("- 순응 보정 alpha: 연구자가 고릅니다 (선택지: 0.15 / custom)");
    expect(text).not.toContain("정하지 않은 조건:");
  });

  it("takes settings from the command arguments in the CLI file", () => {
    const text = renderWorkflowDocument(doc, { ...ko, target: "cli", settings: { inputs: { "grid-csv": "x.csv" }, choices: {} } });
    expect(text).toContain("$ARGUMENTS");
    expect(text).not.toContain("x.csv");
    expect(text).toContain("- 집계 격자 CSV (필수)");
  });

  it("is deterministic and renders English", () => {
    const options = { locale: "en" as const, say: sayIn("en"), target: "preview" as const };
    expect(renderWorkflowDocument(doc, options)).toBe(renderWorkflowDocument(doc, options));
    expect(renderWorkflowDocument(doc, options).split("\n")[0]).toBe("# Workflow: Grid exploration priority (revision 1)");
  });
});

describe("workflow chat block", () => {
  it("round-trips with the researcher's added text", () => {
    const body = renderWorkflowDocument(doc, { ...ko, target: "chat", settings: { inputs: {}, choices: {} } });
    const message = `${workflowBlock(doc, body, "ko")}\n\n첫 시험은 북쪽 절반만 써 주세요.`;
    const parsed = parseWorkflowBlock(message);
    expect(parsed).toEqual({ id: "conformal-grid-priority", revision: 1, title: "격자 탐사 우선순위", body, tail: "첫 시험은 북쪽 절반만 써 주세요.", example: false });
  });

  it("keeps attribute values on one line without quotes", () => {
    const block = workflowBlock({ id: "a", revision: null, title: { ko: '이름 "따옴표"\n둘째 줄' } }, "본문", "ko");
    expect(parseWorkflowBlock(block)).toMatchObject({ id: "a", revision: null, title: "이름  따옴표  둘째 줄", body: "본문" });
  });
});

describe("legacyWorkflowDoc", () => {
  it("derives steps from the primary skill's procedure and keeps the old prompt as instructions", () => {
    const legacy = legacyWorkflowDoc({
      id: "conformal-grid-priority",
      title: { ko: "격자 탐사 우선순위" },
      description: null,
      inputRoles: doc.inputRoles,
      requiredScientificChoices: doc.choices,
      prompt: { ko: "첫 시험은 줄인 설정으로 하세요." },
      expectedArtifacts: doc.artifacts,
      boundary: null,
      revision: 2,
      skills: [{ name: "conformal-grid-priority", source: "bundled" }, { name: "geopandas", source: "catalogue" }],
      procedure: [{ id: "block", label: { ko: "블록 크기 산정" }, summary: { ko: "블록 크기를 정합니다." }, decisionIds: ["alpha", "unknown"] }],
    });
    expect(legacy.kind).toBe("legacy");
    expect(legacy.skills.map((s) => s.role)).toEqual(["primary", "supporting"]);
    expect(legacy.steps[0]).toMatchObject({ skill: "conformal-grid-priority", choiceIds: ["alpha"] });
    const text = renderWorkflowDocument(legacy, { ...ko, target: "preview" });
    expect(text).toContain("이전 형식의 Workflow입니다. 단계별 자세한 방법은 스킬 conformal-grid-priority의 지침에 있는 처리 절차를 따르세요.");
    expect(text).toContain("## 작성자의 추가 지시\n첫 시험은 줄인 설정으로 하세요.");
  });
});

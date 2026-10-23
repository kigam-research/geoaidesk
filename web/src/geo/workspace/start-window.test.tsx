import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoWorkflowSummary, WorkflowInputRole } from "@/geo/contracts/workspace";
import type { WorkflowDoc } from "@/geo/contracts/workflow-doc";
import type { Workflow } from "@/components/workflows-panel";
import { TaskSetup, initialInputs } from "./task-setup";
import { UpstreamStart } from "./upstream-start";
import { nameMatches, rankFiles } from "./setup-steps";
import { onStartGeoTask } from "./events";

vi.mock("@/lib/projects", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/projects")>(), apiFetch: vi.fn() }));

beforeEach(() => { Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] }); });

// Inputs as in the Pocheon trial (F17): six optional CSV inputs, each with its own file in the project.
const role = (id: string, en: string, required = false): WorkflowInputRole => ({ id, label: { ko: id, en }, formats: ["csv"], extensions: ["csv"], required });
const roles = [role("aeromag-lines", "Aeromagnetic lines"), role("base-station", "Base station"), role("boreholes", "Boreholes"), role("core-samples", "Core susceptibility samples"), role("dem", "DEM", true)];
const projectFiles = ["user_data/aeromag_lines.csv", "user_data/base_station.csv", "user_data/boreholes.csv", "user_data/core_samples.csv", "user_data/README.md"];

const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "structured", id: "pgi", title: { ko: "자철석 광체 추정" }, version: "0.1.1", purpose: { ko: "항공자력과 시추 자료로 광체를 추정합니다." },
  inputRoles: [], choices: [{ id: "cell", label: { ko: "격자 크기" }, options: ["50", "100"] }], skills: [{ name: "pgi", source: "bundled", role: "primary" }],
  steps: [{ id: "a", title: { ko: "자료 점검" }, does: { ko: "점검" }, skill: "pgi", read: null, checks: [], choiceIds: [], outputs: [] },
    { id: "b", title: { ko: "역산" }, does: { ko: "역산" }, skill: "pgi", read: null, checks: [], choiceIds: ["cell"], outputs: [] }],
  artifacts: [], boundary: { ko: "추정이며 검토 전입니다." }, instructions: null,
};
const summary = (inputRoles: WorkflowInputRole[]): GeoWorkflowSummary => ({
  id: "pgi", title: { ko: "자철석 광체 추정" }, description: null, disciplines: [], inputRoles,
  requiredScientificChoices: [{ id: "cell", label: { ko: "격자 크기" }, options: ["50", "100"] }], prompt: null, skillIds: [], environmentProfile: "geo-core",
  expectedArtifacts: [{ id: "model", label: { ko: "감수율 모델" }, required: true }] as GeoWorkflowSummary["expectedArtifacts"], boundary: null, exampleCaseIds: [],
  readiness: { state: "ready", skills: [], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null },
  doc,
});

const tabs = (dialog: HTMLElement) => within(dialog).getAllByRole("tab").map((tab) => tab.getAttribute("aria-label")!.replace(/^\d+단계: /, ""));

describe("file candidates (F17, decision 3)", () => {
  it("binds each input to the one file whose name matches it, required or optional", () => {
    expect(nameMatches(roles, projectFiles)).toEqual({ "aeromag-lines": "user_data/aeromag_lines.csv", "base-station": "user_data/base_station.csv", boreholes: "user_data/boreholes.csv", "core-samples": "user_data/core_samples.csv" });
    const answers = initialInputs(summary(roles), projectFiles, {});
    expect(answers["base-station"]).toEqual({ mode: "file", path: "user_data/base_station.csv" });
    // No name match and several fitting files: a required input stays open for the researcher.
    expect(answers.dem).toBeUndefined();
    // Two equally good names are not guessed between.
    expect(nameMatches([role("boreholes", "Boreholes")], ["a/boreholes.csv", "b/boreholes.csv"])).toEqual({});
  });
  it("lists the best name match first", () => {
    expect(rankFiles(roles[2], projectFiles.filter((path) => path.endsWith(".csv")))[0]).toBe("user_data/boreholes.csv");
  });
});

describe("GAID Workflow start window", () => {
  it("opens on what the Workflow does, groups files and flags an unused fitting file in the summary", async () => {
    render(<TaskSetup workflow={summary([role("dem", "DEM", true), role("boreholes", "Boreholes")])} projectId="p1" open onOpenChange={vi.fn()} onRefresh={vi.fn()}
      availableFiles={["user_data/dem.csv", "user_data/holes.csv", "outputs/dem_resampled.csv"]} source="허브 Workflow" />);
    const dialog = await screen.findByRole("dialog");
    // Introduction: purpose, inputs, conditions, outputs, steps, limits; every step named in the step list.
    const intro = within(dialog).getByRole("region", { name: "Workflow 소개" });
    expect(within(intro).getByText("항공자력과 시추 자료로 광체를 추정합니다.")).toBeInTheDocument();
    expect(within(intro).getAllByText("감수율 모델")[0]).toBeVisible();
    expect(within(intro).getByTitle("역산")).toBeInTheDocument();
    expect(within(intro).getAllByText("추정이며 검토 전입니다.")[0]).toBeVisible();
    expect(within(dialog).getByText("허브 Workflow")).toBeInTheDocument(); expect(within(dialog).getByText("version 0.1.1")).toBeInTheDocument();
    // The steps name only the condition: the inputs join the first step's page (gaid-workflow-stages).
    expect(tabs(dialog)).toEqual(["Workflow 소개", "자료 점검", "역산", "요약"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByText("분석 단계 1 / 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "dem" })).toBeInTheDocument(); expect(within(dialog).getByRole("heading", { name: "boreholes" })).toBeInTheDocument();
    // Own data first with the name match selected; earlier results folded.
    const dem = within(dialog).getByRole("region", { name: "dem" });
    expect(within(dem).getByRole("radio", { name: /dem\.csv/ })).toHaveAttribute("aria-checked", "true");
    // Several inputs on one page: a chosen file is shown alone, the other candidates one click away.
    expect(within(dem).queryByText("이전 결과")).not.toBeInTheDocument();
    await userEvent.click(within(dem).getByRole("button", { name: /다른 파일 고르기/ }));
    expect(within(dem).getByText("이전 결과").closest("details")).not.toHaveAttribute("open");
    await userEvent.click(within(dialog).getByRole("tab", { name: /요약$/ }));
    expect(within(dialog).getByText("맞는 형식의 파일이 있지만 쓰지 않습니다")).toBeInTheDocument();
  });
});

const upstream: Workflow = {
  id: "write-paper", name: "Write a Paper", description: "Draft a full manuscript", category: "paper", icon: "FileText", requiresFiles: true,
  prompt: "Write a paper on {topic}.", placeholders: [{ key: "topic", label: "Paper topic / title", required: true }],
};

describe("일반 Workflow in the same window", () => {
  it("walks intro, data, inputs and summary, keeps the instructions collapsed and editable, and starts a draft", async () => {
    render(<UpstreamStart workflow={upstream} open onOpenChange={vi.fn()} availableFiles={["user_data/data.csv", "outputs/old.csv"]} availableFolders={["user_data"]} />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("일반 Workflow")).toBeInTheDocument();
    expect(within(dialog).getByText("논문 작성")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Model picker|모델/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByRole("button", { name: "다음 단계" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /data\.csv/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "다음 단계" }));
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Ore bodies" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "요약 보기" }));
    const details = within(dialog).getByText(/^AI agent가 받는 지침/).closest("details")!;
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(within(dialog).getByText(/^AI agent가 받는 지침/));
    await userEvent.click(within(details).getByRole("button", { name: "지침 편집" }));
    fireEvent.change(within(details).getByRole("textbox"), { target: { value: "Write a short paper on Ore bodies." } });
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
      await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      const detail = handoff.mock.calls[0][0];
      expect(detail).toMatchObject({ title: "논문 작성", attachedFiles: ["user_data/data.csv"], skills: [] });
      expect(detail.geoExposure).toBeUndefined();
      expect(detail.text).toMatch(/^Write a short paper on Ore bodies\./);
      expect(detail.text).toContain("user_data/data.csv");
    } finally { off(); }
  });
});

// --- Analysis-flow stages (gaid-workflow-stages) -------------------------------------------------------------------
const L = (ko: string) => ({ ko, en: ko });
const docStep = (id: string, title: string, choiceIds: string[] = [], inputIds?: string[]): WorkflowDoc["steps"][number] =>
  ({ id, title: L(title), does: L(`${title}을 합니다.`), skill: null, read: null, checks: [], choiceIds, ...(inputIds ? { inputIds } : {}), outputs: [] });
const choice = (id: string, label: string, extra: Partial<GeoWorkflowSummary["requiredScientificChoices"][number]> = {}) => ({ id, label: L(label), options: ["a", "b"], ...extra });
function staged(inputRoles: WorkflowInputRole[], choices: GeoWorkflowSummary["requiredScientificChoices"], steps: WorkflowDoc["steps"]): GeoWorkflowSummary {
  return { ...summary(inputRoles), requiredScientificChoices: choices,
    doc: { ...doc, inputRoles: inputRoles.map((r) => ({ id: r.id, label: r.label, formats: r.formats, required: r.required, ...(r.multiple ? { multiple: true } : {}) })), choices, steps } };
}
const open = (workflow: GeoWorkflowSummary, files: string[]) => {
  render(<TaskSetup workflow={workflow} projectId="p1" open onOpenChange={vi.fn()} onRefresh={vi.fn()} availableFiles={files} source="허브 Workflow" />);
  return screen.findByRole("dialog");
};

describe("start window by analysis-flow stage", () => {
  it("keeps a Pocheon-like Workflow (6 inputs, 15 conditions, 10 steps) to four entries, sub-heading the conditions by step", async () => {
    const inputs = ["aeromag", "base", "terrain", "boreholes", "cores", "reference-body"].map((id, i) => role(id, id, i < 5));
    const ids = Array.from({ length: 15 }, (_, i) => `c${i + 1}`);
    const groups = [[0, 2], [2, 6], [6, 9], [9, 11], [11, 12], [], [12, 13], [13, 14], [14, 15], []];
    const steps = groups.map(([from, to], i) => docStep(`s${i + 1}`, `단계 ${i + 1}`, from === undefined ? [] : ids.slice(from, to)));
    const dialog = await open(staged(inputs, ids.map((id) => choice(id, `조건 ${id}`)), steps), ["user_data/aeromag.csv", "user_data/aeromag_2.csv"]);
    // Eight steps would hold something: more than five pages, so the Workflow is shown as 입력 자료 + 분석 조건.
    expect(tabs(dialog)).toEqual(["Workflow 소개", "입력 자료", "분석 조건", "요약"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByText("시작 설정 1 / 2")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(inputs.map((r) => r.id));
    // Required inputs without a file block the next page and are named on the summary.
    expect(within(dialog).getByRole("button", { name: "다음 단계" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("tab", { name: /^3단계:/ }));
    expect(within(dialog).getAllByRole("heading", { level: 4 })).toHaveLength(15);
    for (const title of ["단계 1", "단계 2", "단계 9"]) expect(within(dialog).getByText(title)).toBeInTheDocument();
    expect(within(dialog).queryByText("단계 6")).not.toBeInTheDocument();
  });

  it("shows a catalogue Workflow with older steps (PU-like: no step names its conditions) as 입력 자료 and 분석 조건", async () => {
    const inputs = [role("grid", "Grid table", true), role("metadata", "Metadata", true)];
    const choices = [choice("evaluation-purpose", "평가 목적"), choice("label-definition", "양성 라벨 정의"), choice("block-design", "공간 block 크기")];
    const steps = ["연구·자료 계약", "지질학적 EDA", "공간 진단", "공간 평가 설계", "모델·PU 비교", "안정성·보정", "지도·탐사 구역"].map((title, i) => docStep(`m${i}`, title));
    const dialog = await open(staged(inputs, choices, steps), ["user_data/grid.csv", "user_data/metadata.csv"]);
    expect(tabs(dialog)).toEqual(["Workflow 소개", "입력 자료", "분석 조건", "요약"]);
    await userEvent.click(within(dialog).getByRole("tab", { name: /^3단계:/ }));
    // Three conditions: no sub-heads, one condition after another.
    expect(within(dialog).getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["평가 목적", "양성 라벨 정의", "공간 block 크기"]);
  });

  it("walks a new-form Workflow stage by stage: several files for one input, defaults folded and listed in the summary", async () => {
    const lines = { ...role("survey-lines", "Survey lines", true), multiple: true };
    const inputs = [lines, role("base-station", "Base station", true), role("dem", "DEM")];
    const choices = [
      choice("filter", "보정 방법"),
      choice("spacing", "재표본화 간격", { options: undefined, default: "50 m" }),
      choice("mesh", "격자 크기", { options: ["fine", "coarse"], default: "coarse" }),
      choice("target", "목표 광체"),
    ];
    const steps = [docStep("prepare", "자료 준비", [], ["survey-lines", "base-station"]), docStep("process", "보정과 재표본화", ["filter", "spacing"], ["dem"]),
      docStep("model", "역산 모델링", ["mesh"]), docStep("interpret", "해석", ["target"])];
    const files = ["user_data/line_a.csv", "user_data/line_b.csv", "user_data/base.csv", "user_data/dem.csv"];
    const dialog = await open(staged(inputs, choices, steps), files);
    expect(tabs(dialog)).toEqual(["Workflow 소개", "자료 준비", "보정과 재표본화", "역산 모델링", "해석", "요약"]);
    expect(within(dialog).getByText("분석 단계")).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /자료 준비/ })).toHaveTextContent("자료 2개");
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByText("분석 단계 1 / 4")).toBeInTheDocument();
    const survey = within(dialog).getByRole("region", { name: "survey-lines" });
    expect(within(survey).getByText(/여러 파일을 고를 수 있습니다/)).toBeInTheDocument();
    await userEvent.click(within(survey).getByRole("checkbox", { name: /line_a\.csv/ }));
    await userEvent.click(within(survey).getByRole("checkbox", { name: /line_b\.csv/ }));
    await userEvent.click(within(within(dialog).getByRole("region", { name: "base-station" })).getByRole("radio", { name: /base\.csv/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "다음 단계" }));
    // The second stage: its input, its condition and its default folded.
    const page = within(dialog).getByRole("region", { name: "보정과 재표본화" });
    expect(within(page).getByRole("heading", { name: "dem" })).toBeInTheDocument(); expect(within(page).getByRole("heading", { name: "보정 방법" })).toBeInTheDocument();
    const fold = within(page).getByText("기본값이 있는 조건 1개").closest("details")!;
    expect(fold).not.toHaveAttribute("open");
    await userEvent.click(within(dialog).getByRole("tab", { name: /요약$/ }));
    expect(within(dialog).getByText("line_a.csv 외 1개")).toBeInTheDocument();
    expect(within(dialog).getByText("기본값이 있는 조건")).toBeInTheDocument();
    expect(within(dialog).getByText("50 m")).toBeInTheDocument(); expect(within(dialog).getByText("coarse")).toBeInTheDocument();
    expect(within(dialog).getAllByText("기본값")).toHaveLength(2);
    // Edit on a default opens its stage page with the fold open.
    await userEvent.click(within(dialog).getByRole("button", { name: "재표본화 간격 수정" }));
    expect(within(dialog).getByText("기본값이 있는 조건 1개").closest("details")).toHaveAttribute("open");
    await userEvent.click(within(dialog).getByRole("tab", { name: /요약$/ }));
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
      await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      const detail = handoff.mock.calls[0][0];
      expect(detail.attachedFiles).toEqual(["user_data/line_a.csv", "user_data/line_b.csv", "user_data/base.csv", "user_data/dem.csv"]);
      // Both files of the multiple input are in the rendered start message; defaults are set values.
      expect(detail.workflowBlock).toContain("user_data/line_a.csv, user_data/line_b.csv");
      expect(detail.workflowBlock).toContain("50 m");
    } finally { off(); }
  });
});

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
    expect(within(dialog).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Workflow 소개", "dem", "boreholes", "격자 크기", "요약"]);
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByText("입력 자료 1 / 2")).toBeInTheDocument();
    // Own data first with the name match selected; earlier results folded.
    expect(within(dialog).getByRole("radio", { name: /dem\.csv/ })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByText("이전 결과").closest("details")).not.toHaveAttribute("open");
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

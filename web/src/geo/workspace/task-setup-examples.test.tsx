import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoWorkflowSummary, WorkflowInputRole } from "@/geo/contracts/workspace";
import type { WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { parseWorkflowBlock } from "@/geo/contracts/workflow-doc";
import { TaskSetup, initialInputs } from "./task-setup";
import { onStartGeoTask } from "./events";

const apiFetch = vi.fn();
vi.mock("@/lib/projects", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/projects")>(), apiFetch: (...args: unknown[]) => apiFetch(...args) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const EXAMPLE_PATH = "user_data/examples/mag-inv/grid-0a1b2c3d/tmi.csv";
const example = (state: "bundled" | "remote" | "present" | "broken" = "bundled"): NonNullable<WorkflowInputRole["example"]> => ({
  title: { ko: "공개 항공자력 격자" }, source: { ko: "예시 기관" }, license: "CC-BY-4.0", synthetic: false,
  size: 2048, download: state === "remote" ? 2048 : 0, path: EXAMPLE_PATH, state,
});
const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "structured", id: "mag-inversion", title: { ko: "자력 역산" }, revision: 1, purpose: null,
  inputRoles: [{ id: "grid", label: { ko: "항공자력 격자" }, formats: ["csv"], required: true,
    example: { title: { ko: "공개 항공자력 격자" }, source: { ko: "예시 기관" }, files: [{ name: "tmi.csv", sha256: "a".repeat(64), size: 2048, path: "examples/grid/tmi.csv" }] } }],
  choices: [], skills: [{ name: "mag-inv", source: "bundled", role: "primary" }],
  steps: [{ id: "invert", title: { ko: "역산" }, does: { ko: "역산합니다." }, skill: "mag-inv", read: null, checks: [], choiceIds: [], outputs: [] }],
  artifacts: [], boundary: null, instructions: null,
};
const workflow = (state?: "bundled" | "remote" | "present" | "broken"): GeoWorkflowSummary => ({
  id: "mag-inversion", title: { ko: "자력 역산" }, description: null, disciplines: [],
  inputRoles: [{ id: "grid", label: { ko: "항공자력 격자" }, formats: ["csv"], extensions: ["csv"], required: true, ...(state ? { example: example(state) } : {}) }],
  requiredScientificChoices: [], prompt: null, skillIds: ["local:mag-inv"], environmentProfile: "geo-core", expectedArtifacts: [], boundary: null, exampleCaseIds: [],
  readiness: { state: "ready", skills: [], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "recorded", compatibilityRef: null },
  doc,
});
const setup = (summary: GeoWorkflowSummary, files: string[] = []) => render(
  <TaskSetup workflow={summary} projectId="p1" availableFiles={files} open onOpenChange={vi.fn()} onRefresh={vi.fn()} exposure="method:mag-inv:mag-inversion" />,
);

beforeEach(() => {
  Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] });
  apiFetch.mockReset().mockImplementation(async (path: string) => {
    if (path === "/geo/methods/examples") return json({ inputs: { grid: EXAMPLE_PATH }, written: [EXAMPLE_PATH] });
    if (path === "/sandbox/upload") return json({ uploaded: ["user_data/my-grid.csv"], renamed: [] });
    throw new Error(`Unexpected request: ${path}`);
  });
});

describe("start settings with example data", () => {
  it("selects the example when the researcher has no file, prepares it on start and marks the chat", async () => {
    setup(workflow("bundled"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/예제 자료가 있습니다: 공개 항공자력 격자/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    const card = within(dialog).getByRole("radio", { name: /예제 자료 사용: 공개 항공자력 격자/ });
    expect(card).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByText("Workflow에 들어 있습니다 (2.0 KB). 시작할 때 프로젝트에 복사합니다.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "요약 보기" }));
    expect(within(dialog).getByText("예제 자료: 공개 항공자력 격자")).toBeInTheDocument();
    expect(within(dialog).getByText(/입력 1개에 Workflow의 예제 자료를 씁니다/)).toBeInTheDocument();
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
      await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      expect(apiFetch).toHaveBeenCalledWith("/geo/methods/examples", expect.objectContaining({ method: "POST", body: JSON.stringify({ method: "mag-inv", workflowId: "mag-inversion", roleIds: ["grid"] }) }), "p1");
      const detail = handoff.mock.calls[0][0];
      expect(detail.attachedFiles).toEqual([EXAMPLE_PATH]);
      const block = parseWorkflowBlock(detail.workflowBlock)!;
      expect(block.example).toBe(true);
      expect(block.body).toContain(`${EXAMPLE_PATH} (Workflow의 예제 자료: 공개 항공자력 격자. 출처: 예시 기관)`);
    } finally { off(); }
  });

  it("prefers the researcher's own file and keeps example folders out of the file list", () => {
    const summary = workflow("present");
    expect(initialInputs(summary, ["user_data/mine.csv", EXAMPLE_PATH], {})).toEqual({ grid: { mode: "file", path: "user_data/mine.csv" } });
    expect(initialInputs(summary, [EXAMPLE_PATH], {})).toEqual({ grid: { mode: "example" } });
    expect(initialInputs(summary, [], { grid: EXAMPLE_PATH })).toEqual({ grid: { mode: "example" } });
    // A broken example is not selected; without examples nothing changes.
    expect(initialInputs(workflow("broken"), [], {})).toEqual({});
    expect(initialInputs(workflow(), ["a.csv"], {})).toEqual({ grid: { mode: "file", path: "a.csv" } });
  });

  it("uploads the researcher's file from the input step and selects it", async () => {
    setup(workflow("remote"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/예제 자료가 있습니다: 공개 항공자력 격자/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    expect(within(dialog).getByText("시작할 때 2.0 KB를 내려받고 해시를 확인합니다.")).toBeInTheDocument();
    const input = within(dialog).getByLabelText("내 파일 올리기", { selector: "input" });
    await userEvent.upload(input, new File(["x,y\n"], "my-grid.csv", { type: "text/csv" }));
    await waitFor(() => expect(within(dialog).getByRole("radio", { name: /my-grid\.csv/ })).toHaveAttribute("aria-checked", "true"));
    expect(within(dialog).getByRole("radio", { name: /예제 자료 사용/ })).toHaveAttribute("aria-checked", "false");
  });
});

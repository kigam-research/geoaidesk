import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoWorkflowSummary, WorkflowInputRole } from "@/geo/contracts/workspace";
import { parseWorkflowBlock, renderWorkflowDocument, workflowBlock, type WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { workflowDocSay, workflowStartMessage } from "@/geo/workflow/render";
import { TaskSetup } from "./task-setup";
import { onStartGeoTask } from "./events";

vi.mock("@/lib/projects", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/projects")>(), apiFetch: vi.fn() }));

beforeEach(() => { Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] }); });

const L = (ko: string) => ({ ko, en: ko });
const role = (id: string, required = true): WorkflowInputRole => ({ id, label: L(id), formats: ["csv"], extensions: ["csv"], required });
const roles = [role("dem"), role("holes"), role("props")];
const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "structured", id: "pgi", title: L("자철석 광체 추정"), version: "0.1.1", purpose: L("광체를 추정합니다."),
  inputRoles: roles.map((r) => ({ id: r.id, label: r.label, formats: r.formats, required: r.required })), choices: [],
  skills: [], steps: [{ id: "a", title: L("자료 준비"), does: L("준비합니다."), skill: null, read: null, checks: [], inputIds: ["dem", "holes", "props"], choiceIds: [], outputs: [] }],
  artifacts: [], boundary: null, instructions: null,
};
const workflow: GeoWorkflowSummary = {
  id: "pgi", title: L("자철석 광체 추정"), description: null, disciplines: [], inputRoles: roles, requiredScientificChoices: [], prompt: null, skillIds: [],
  environmentProfile: "geo-core", expectedArtifacts: [], boundary: null, exampleCaseIds: [],
  readiness: { state: "ready", skills: [], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null },
  doc,
};
const say = workflowDocSay("ko");

describe("Workflow 지침 for inputs without data (gaid-input-fallback)", () => {
  it("names each input's fallback, its folder and only the rules of the kinds used", () => {
    const text = renderWorkflowDocument(doc, { locale: "ko", target: "chat", say, settings: {
      inputs: { holes: "user_data/holes.csv" }, choices: {},
      fallbacks: { dem: { kind: "search", note: "경기 북부, 30 m" }, props: { kind: "instruction", note: "물성은 문헌값 표를 만들어 쓰세요." } },
    } });
    expect(text).toContain("- dem: 자료 없음. AI agent가 비슷한 공개 자료를 찾습니다");
    expect(text).toContain("- holes: user_data/holes.csv");
    expect(text).toContain("## 자료가 없는 입력");
    expect(text).toContain("- dem (자료 없음. AI agent가 비슷한 공개 자료를 찾습니다): 파일 위치: `toy_data/dem/`. 연구자 메모: 경기 북부, 30 m");
    expect(text).toContain("지시: 물성은 문헌값 표를 만들어 쓰세요.");
    expect(text).toContain("interview 도구로");
    expect(text).toContain("100 MB를 넘는 자료는 받지 말고");
    expect(text).toContain("별도 지시: 연구자의 지시를 따르세요.");
    expect(text).not.toContain("합성 자료 만들기:");
    expect(text).toContain("toy 자료");
  });

  it("leaves documents without fallbacks unchanged and ignores a fallback for an input that has a file", () => {
    const base = renderWorkflowDocument(doc, { locale: "ko", target: "chat", say, settings: { inputs: { dem: "a.csv" }, choices: {} } });
    const withFile = renderWorkflowDocument(doc, { locale: "ko", target: "chat", say, settings: { inputs: { dem: "a.csv" }, choices: {}, fallbacks: { dem: { kind: "synthetic" } } } });
    expect(withFile).toBe(base);
    expect(base).not.toContain("자료가 없는 입력");
    expect(renderWorkflowDocument(doc, { locale: "ko", target: "cli", say, settings: { inputs: {}, choices: {}, fallbacks: { dem: { kind: "search" } } } })).not.toContain("자료가 없는 입력");
  });

  it("marks the block with role=kind pairs and parses older blocks with no fallbacks", () => {
    const message = workflowStartMessage(doc, {}, {}, [], [], { dem: { kind: "search" }, holes: { kind: "synthetic" } });
    expect(message.split("\n")[0]).toBe('<workflow id="pgi" version="0.1.1" title="자철석 광체 추정" fallback="dem=search;holes=synthetic">');
    expect(parseWorkflowBlock(message)!.fallbacks).toEqual({ dem: "search", holes: "synthetic" });
    const older = workflowBlock(doc, "본문", "ko", { example: true });
    expect(parseWorkflowBlock(older)).toMatchObject({ example: true, fallbacks: {}, body: "본문" });
  });
});

describe("start settings: 내 자료가 없을 때", () => {
  it("offers the three choices for an input with no file, shows them in the summary and records them in the start message", async () => {
    render(<TaskSetup workflow={workflow} projectId="p1" open onOpenChange={vi.fn()} onRefresh={vi.fn()} availableFiles={[]} />);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    const region = (id: string) => within(dialog).getByRole("region", { name: id });
    expect(within(region("dem")).getByText("내 자료가 없을 때")).toBeInTheDocument();
    // Nothing is pre-selected: the page stays blocked until each required input has an answer.
    expect(within(dialog).getByRole("button", { name: "요약 보기" })).toBeDisabled();
    await userEvent.click(within(region("dem")).getByRole("radio", { name: /AI agent가 비슷한 공개 자료 찾기/ }));
    fireEvent.change(within(region("dem")).getByRole("textbox", { name: "찾을 자료의 조건" }), { target: { value: "경기 북부" } });
    await userEvent.click(within(region("holes")).getByRole("radio", { name: /AI agent가 합성 자료 만들기/ }));
    await userEvent.click(within(region("props")).getByRole("radio", { name: /별도로 지시하기/ }));
    // A separate instruction needs its text.
    expect(within(dialog).getByRole("button", { name: "요약 보기" })).toBeDisabled();
    fireEvent.change(within(region("props")).getByRole("textbox"), { target: { value: "문헌값 표를 만들어 쓰세요." } });
    await userEvent.click(within(dialog).getByRole("button", { name: "요약 보기" }));
    expect(within(dialog).getAllByText("AI agent가 비슷한 공개 자료 찾기")[0]).toBeInTheDocument();
    expect(within(dialog).getByText("AI agent가 합성 자료 만들기")).toBeInTheDocument();
    expect(within(dialog).getByText("별도 지시: 문헌값 표를 만들어 쓰세요.")).toBeInTheDocument();
    expect(within(dialog).getByText(/입력 3개는 내 자료 없이 시작합니다/)).toBeInTheDocument();
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
      await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      const detail = handoff.mock.calls[0][0];
      expect(detail.attachedFiles).toEqual([]);
      const block = parseWorkflowBlock(detail.workflowBlock)!;
      expect(block.fallbacks).toEqual({ dem: "search", holes: "synthetic", props: "instruction" });
      expect(block.body).toContain("연구자 메모: 경기 북부");
      expect(block.body).toContain("`synthetic_data/holes/`");
    } finally { off(); }
  }, 30_000);

  it("folds the choices when the project has a fitting file", async () => {
    render(<TaskSetup workflow={workflow} projectId="p1" open onOpenChange={vi.fn()} onRefresh={vi.fn()} availableFiles={["user_data/dem.csv", "user_data/other.csv"]} />);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "입력 자료 고르기" }));
    const fold = within(within(dialog).getByRole("region", { name: "holes" })).getByText("내 자료가 없을 때").closest("details")!;
    expect(fold).not.toHaveAttribute("open");
  });
});

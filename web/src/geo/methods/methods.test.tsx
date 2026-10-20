import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import type { LocalMethodSummary, LocalMethodWorkflow, MethodTrial } from "@/geo/contracts/methods";
import { MethodDetail, MethodTrials, TrialCard, methodRows, useMethodRows } from "./methods";
import { onStartGeoTask } from "@/geo/workspace/events";
vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const workflow: LocalMethodWorkflow = {
  id: "trial", exposure: "method:paper-method:trial", trials: { count: 0, lastOutcome: null }, title: { ko: "논문 방법 시험", en: "Paper method trial" },
  description: { ko: "사용자 자료로 시험합니다." }, disciplines: [], inputRoles: [], requiredScientificChoices: [
    { id: "folds", label: { ko: "Fold 수" } }, { id: "cutoff", label: { ko: "Threshold" } },
  ], prompt: null, boundary: null, skillIds: ["local:paper-method"], environmentProfile: "geo-core", expectedArtifacts: [], exampleCaseIds: [],
  readiness: { state: "ready", skills: [{ id: "local:paper-method", runtimeName: "paper-method", title: null, installed: true, enabled: true }], environment: { id: "geo-core", title: null, state: "ready", missing: [] }, runRecord: "none", compatibilityRef: null },
};
const method: LocalMethodSummary = {
  key: "project:paper-method", scope: "project", runtimeName: "paper-method", enabled: true, methodId: "local/paper-method", revision: 2, version: "0.2.0", title: { ko: "논문 기반 방법" }, summary: { ko: "시험할 분석 방법입니다." },
  lifecycle: "draft", lifecycleClaimed: "published", implementation: "implemented", codeOrigin: "generated", origin: { kind: "upload", pageUrl: "https://hub.test/method" }, editedLocally: true, treeHash: "abc",
  sources: [{ kind: "doi", ref: "10.1234/paper", title: "Paper" }], hubChecks: { checker: "hub-check", checkedAt: "2026-10-15T10:00:00Z", items: [{ id: "manifest", status: "pass" }], warnings: [{ code: "untested", path: "scripts", message: "No run recorded" }] },
  authoring: { hubUrl: "https://hub.test", projectId: "p1", draftRevision: 2, decisions: 1, openQuestions: [{ id: "q1", text: "대조 자료는 미정입니다." }], attempts: [] },
  workflows: [workflow], recipes: [{ id: "r1", workflowId: "trial", title: { ko: "Fold 5 레시피" }, choices: { folds: 5, cutoff: 0.7 }, unresolvedChoices: ["cutoff"] }], issues: [],
};
const trial: MethodTrial = {
  sessionId: "session-one", methodKey: method.key, runtimeName: method.runtimeName, workflowId: "trial", methodId: method.methodId, revision: 1, packageSha256: "abc", treeHash: "previous", startedAt: "2026-10-15T11:00:00Z", methodChanged: true,
  observed: { toolCalls: 3, failedToolCalls: 1, models: ["local/qwen"], inputs: [], outputs: [{ path: "results/report.md" }], degradedSteps: 1, lastStepAt: "2026-10-15T11:10:00Z" },
  expected: [{ id: "report", label: { ko: "보고서" }, required: true, files: ["results/report.md"], found: ["results/report.md"] }, { id: "map", label: { ko: "지도" }, required: true, files: ["results/map.png"], found: [] }],
};
beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => {
    if (path === "/geo/methods") return json({ methods: [method] });
    if (path === "/skills") return json([{ id: "skill-1", name: "paper-method", description: "Method" }]);
    if (path.startsWith("/geo/methods/trials?")) return json({ trials: [trial] });
    if (path.endsWith("/assessment")) return json({ ...trial, assessment: { outcome: "useful", note: "검토 전", recordedAt: "now" } });
    throw new Error(`Unexpected: ${path}`);
  });
});
function Catalogue({ projectId = "p1" }: { projectId?: string }) {
  const { category, rows, dialogs, notice } = useMethodRows(projectId, []);
  return <><h2>{category.label}</h2>{notice}{rows.map((row) => <div key={row.id}><button onClick={row.onSelect}>{row.name}{row.badges}</button>{row.detail && <button onClick={row.detail.onSelect}>{row.detail.label}</button>}</div>)}{dialogs}</>;
}
it("provides Workflow and recipe rows with at most three badges: trials, lifecycle, local edit", () => {
  const select = vi.fn(); const rows = methodRows([method], select);
  // A Workflow with a single 레시피 is one row that starts from the 레시피; a second 레시피 brings back separate rows.
  expect(rows.map((row) => row.id)).toEqual(["method:project:paper-method:workflow:trial"]);
  render(<>{rows[0].badges}</>);
  // Each badge names its scope: the hub package stage, GAID trials in this project (novice review round 3).
  expect(screen.getByText("허브 초안")).toHaveAttribute("title", "허브에 기록된 Workflow 파일 묶음의 단계입니다. 현재 프로젝트의 준비·시험 상태와 별개입니다.");
  expect(screen.queryByText("허브 공개됨")).not.toBeInTheDocument();
  expect(screen.getByText("GAID에서 수정됨")).toBeInTheDocument();
  expect(screen.getByText("미시험")).toHaveAttribute("title", "현재 프로젝트에서 해당 Workflow를 GAID로 시험한 기록이 없습니다.");

  // The implementation badge moves to the method details (UI guide G2: at most three badges per row).
  expect(screen.queryByText("코드 포함")).not.toBeInTheDocument();
  rows[0].onSelect(); expect(select).toHaveBeenCalledWith(method, workflow, method.recipes[0]);
  const two = { ...method, recipes: [...method.recipes, { ...method.recipes[0], id: "r2", title: { ko: "Fold 3 레시피" } }] };
  expect(methodRows([two], select).map((row) => row.id)).toEqual(["method:project:paper-method:workflow:trial", "method:project:paper-method:recipe:r1", "method:project:paper-method:recipe:r2"]);
});
it("scopes every row badge and leaves the fixed required-input property to the inputs line", () => {
  const needsData = { ...workflow, inputRoles: [{ id: "grid", label: { ko: "격자 표" }, formats: ["csv"], extensions: ["csv"], required: true }], readiness: { ...workflow.readiness, state: "needs-environment" as const } };
  render(<>{methodRows([{ ...method, editedLocally: false, workflows: [needsData] }], vi.fn())[0].badges}</>);
  expect(screen.getByText("환경 준비 필요")).toHaveAttribute("title", "현재 프로젝트에서 해당 Workflow를 시작하는 데 필요한 준비 상태입니다.");
  expect(screen.getByText("허브 초안")).toBeInTheDocument();
  expect(screen.queryByText("사용자 자료 필요")).not.toBeInTheDocument();
});
it("shows GAID trial counts and the latest assessment instead of the untested badge", () => {
  const tried = { ...method, workflows: [{ ...workflow, trials: { count: 2, lastOutcome: "needs-revision" as const } }] };
  render(<>{methodRows([tried], vi.fn())[0].badges}</>);
  expect(screen.getByText("GAID 시험 2회 · 평가: 수정 필요")).toBeInTheDocument(); expect(screen.queryByText("미시험")).not.toBeInTheDocument();
});
it("keeps an invalid method as a detail row and exposes its issues", async () => {
  const invalid = { ...method, workflows: [], recipes: [], issues: [{ subject: "gaid-method.json", message: "Invalid revision" }] };
  expect(methodRows([invalid], vi.fn())).toHaveLength(1);
  render(<MethodDetail method={invalid} projectId="p1" onClose={vi.fn()} onSetup={vi.fn()} />);
  expect(screen.getByText(/Invalid revision/)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "시작 설정 열기" })).not.toBeInTheDocument();
  await screen.findByText(/도구 호출 3회/);
});
it("shows origin, revision, check receipt, unresolved hub questions, source DOI and trial observations", async () => {
  render(<MethodDetail method={method} projectId="p1" onClose={vi.fn()} onSetup={vi.fn()} />);
  expect(screen.getByText("설치 출처: 파일 업로드")).toBeInTheDocument(); expect(screen.getByText("2판")).toBeInTheDocument();
  expect(screen.getByText(/경고 1개/)).toBeInTheDocument(); expect(screen.getByText("manifest: 통과")).toBeInTheDocument(); expect(screen.getByText("허브에서 미해결인 질문")).toBeInTheDocument(); expect(screen.getByText("대조 자료는 미정입니다.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Paper" })).toHaveAttribute("href", "https://doi.org/10.1234/paper");
  expect(await screen.findByText("도구 호출 3회 · 실패 1회")).toBeInTheDocument();
  expect(screen.getByText(/현재 파일은 해당 시험에 포함되지 않습니다/)).toBeInTheDocument();
  expect(screen.getByText("지도 · 필수")).toBeInTheDocument(); expect(screen.getByText("파일 일치 없음: results/map.png")).toBeInTheDocument(); expect(screen.getByText("발견됨: results/report.md")).toBeInTheDocument();
  expect(screen.getByText(/과학적 검토 결과가 아닙니다/)).toBeInTheDocument();
});
it("opens recipe choices as editable setup and forwards method exposure only when creating a chat draft", async () => {
  const start = vi.fn((detail) => { detail.result = "opened"; }); const off = onStartGeoTask(start);
  try {
    render(<Catalogue />);
    fireEvent.click(await screen.findByRole("button", { name: /^논문 방법 시험/ }));
    // The recipe opens at the summary: its Fold value, its unresolved Threshold left to the chat.
    const dialog = screen.getByRole("dialog"); expect(within(dialog).getByText("5")).toBeInTheDocument(); expect(within(dialog).getByText("작업 중 결정")).toBeInTheDocument(); expect(start).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
    await waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(start.mock.calls[0][0].geoExposure).toBe("method:paper-method:trial");
    expect(start.mock.calls[0][0].skills[0].name).toBe("paper-method");
  } finally { off(); }
});
it("provides detail actions alongside Workflow rows without starting a task", async () => {
  render(<Catalogue />); fireEvent.click(await screen.findByRole("button", { name: "Workflow 상세 보기: 논문 기반 방법" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("허브 검사 기록");
  await screen.findByText("도구 호출 3회 · 실패 1회");
});
it("stores a researcher assessment verbatim in the current project", async () => {
  render(<TrialCard trial={trial} projectId="p1" />);
  expect(screen.getByRole("button", { name: "평가 저장" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("시험 평가"), { target: { value: "needs-revision" } });
  fireEvent.change(screen.getByLabelText("평가 메모"), { target: { value: " 검토 전\n입력 확인 필요 " } });
  fireEvent.click(screen.getByRole("button", { name: "평가 저장" }));
  expect(await screen.findByRole("status")).toHaveTextContent("평가를 저장했습니다.");
  expect(apiFetch).toHaveBeenLastCalledWith("/geo/methods/trials/session-one/assessment", expect.objectContaining({ method: "PUT", body: JSON.stringify({ outcome: "needs-revision", note: " 검토 전\n입력 확인 필요 " }) }), "p1");
});
it("keeps assessment fields on save failure and reports the error", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(json({ detail: "Cannot write" }, 409));
  render(<TrialCard trial={trial} projectId="p1" />);
  fireEvent.change(screen.getByLabelText("시험 평가"), { target: { value: "failed" } }); fireEvent.change(screen.getByLabelText("평가 메모"), { target: { value: "다시 확인" } }); fireEvent.click(screen.getByRole("button", { name: "평가 저장" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cannot write"); expect(screen.getByLabelText("평가 메모")).toHaveValue("다시 확인");
});
it("filters trial records to the selected scope and can refresh observed steps", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(json({ trials: [{ ...trial, methodKey: "global:paper-method" }] }));
  render(<MethodTrials projectId="p1" runtimeName="paper-method" methodKey={method.key} />);
  expect(await screen.findByText("GAID 시험 기록이 없습니다.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "목록 새로고침" }));
  expect(await screen.findByText("도구 호출 3회 · 실패 1회")).toBeInTheDocument();
});
it("ignores a pending list response after unmount", async () => {
  let resolve!: (value: Response) => void;
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = render(<Catalogue />); view.unmount();
  await act(async () => { resolve(json({ methods: [method] })); });
  expect(screen.queryByText("논문 방법 시험")).not.toBeInTheDocument();
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoSuggestion, GeoWorkflowSummary, WorkflowReadinessState } from "@/geo/contracts/workspace";
import { GeoTaskCatalogue } from "./task-catalogue";
import { WorkflowsPanel } from "@/components/workflows-panel";
import { GeoFileActions } from "./file-actions";
import { GeoResultBody } from "./result-card";
import { onStartGeoTask } from "./events";
import { onChatPrefill } from "@/lib/chat-prefill";
import { setApiToken } from "@/lib/api-auth";

const apiFetch = vi.fn();
vi.mock("@/lib/projects", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/projects")>(), apiFetch: (...args: unknown[]) => apiFetch(...args) }));
// A short upstream list keeps role queries fast; the panel code is the real one.
vi.mock("@/data/workflows.json", () => ({ default: [
  { id: "review-paper", name: "Review a Paper", description: "Critical review", category: "paper", icon: "ClipboardCheck", prompt: "Review", placeholders: [], requiresFiles: true },
  { id: "plot", name: "Make a Plot", description: "Plot data", category: "data", icon: "BarChart3", prompt: "Plot", placeholders: [], requiresFiles: false },
] }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function workflow(state: WorkflowReadinessState = "ready", id = "well-qc"): GeoWorkflowSummary {
  return {
    id, title: { ko: `Well log QC ${id}`, en: `Well-log QC ${id}` }, description: { ko: "Curve와 결측값을 확인합니다.", en: "Check curves and missing values." }, disciplines: ["well"],
    inputRoles: [{ id: "log", label: { ko: "Well log" }, formats: ["las-welllog"], extensions: ["las"], required: true }],
    requiredScientificChoices: [{ id: "depth", label: { ko: "심도 기준" }, options: ["MD", "TVD"], why: { ko: "심도 기준을 유지합니다." } }, { id: "units", label: { ko: "단위" } }],
    prompt: { ko: "원본 Well log를 확인하세요.", en: "Check the source well log." }, skillIds: ["geo/well"], environmentProfile: "geo-core",
    expectedArtifacts: [{ id: "report", label: { ko: "QC 보고서" }, required: true }], boundary: { ko: "해석 결과가 아닙니다." }, exampleCaseIds: [],
    readiness: { state, skills: [{ id: "geo/well", runtimeName: "well-skill", title: null, installed: state !== "missing-skills", enabled: state !== "missing-skills" }], environment: { id: "geo-core", title: { ko: "Geo core" }, state: state === "ready" ? "ready" : "missing", missing: ["lasio"], detail: state === "unavailable" ? "uv unavailable" : undefined }, runRecord: "none", compatibilityRef: null },
  };
}
function suggestion(w: GeoWorkflowSummary): GeoSuggestion {
  return { workflowId: w.id, title: w.title, match: { roleId: "log", roleLabel: { ko: "Well log" }, format: "las-welllog", required: true }, needs: [{ ko: "심도 기준" }], readiness: w.readiness };
}
let rows: GeoWorkflowSummary[];
let suggestions: GeoSuggestion[];
let catalogueState: string;
let recipeResult: unknown;
let prepareResult: Response | null;
let saved: { categories: { id: string; label: string }[]; recipes: unknown[] };
const okRecipe = { schemaVersion: "geo-start/v1", workflowId: "well-qc", catalogueVersion: "0.2.0", skillIds: ["geo/well"], choices: { depth: "MD" }, unresolvedChoices: ["units"] };
const okSetup = { workflowId: "well-qc", choices: { depth: "MD" }, unresolvedChoices: ["units"], skillIds: ["geo/well"], exampleId: null };
beforeEach(() => {
  window.localStorage.clear(); Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] });
  rows = [workflow()]; suggestions = rows.map(suggestion); catalogueState = "ready";
  recipeResult = { ok: false, issues: [{ code: "catalogue-version", subject: "0.1.0", message: "Version does not match" }] }; prepareResult = null; saved = { categories: [], recipes: [] };
  apiFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/geo/recipes" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const category = body.newCategory ? "user-1" : body.category;
      if (body.newCategory) saved.categories = [{ id: "user-1", label: body.newCategory }];
      saved.recipes = [...saved.recipes, { id: "00000000-0000-4000-8000-000000000001", title: body.title, category, recipe: body.recipe, savedAt: "2026-10-12T00:00:00Z", check: { ok: true, issues: [], setup: okSetup } }];
      return json(saved);
    }
    if (path === "/geo/recipes") return json(saved);
    if (path.startsWith("/geo/recipes/") && init?.method === "DELETE") { saved = { categories: [], recipes: [] }; return json(saved); }
    if (path === "/geo/workflows") return json({ catalogue: { state: catalogueState, version: "0.2.0" }, workflows: rows });
    if (path === "/geo/suggestions") return json({ path: "logs/A.LAS", format: "las-welllog", suggestions });
    if (path === "/geo/recipes/check") return json(recipeResult);
    if (path.startsWith("/sandbox/file?")) return new Response(JSON.stringify({ schemaVersion: "geo-start/v1", workflowId: "well-qc" }));
    if (path === "/sandbox/tree") return json({ name: "", path: "", type: "directory", children: [{ name: "other.las", path: "other.las", type: "file" }] });
    if (path === "/skills") return json([{ id: "skill-1", name: "well-skill", description: "QC" }]);
    if (path === "/skills/create") return json({ name: "my-qc" });
    if (path === "/skills/well-skill/enable") { rows = [workflow()]; return json({ ok: true }); }
    if (path.endsWith("/prepare")) { rows = [workflow()]; return prepareResult ?? json({ ready: true }); }
    throw new Error(`Unexpected request: ${path}`);
  });
});
function catalogue() {
  return render(<GeoTaskCatalogue projectId="p1" availableFiles={["logs/A.LAS", "table.csv"]}>
    {(extension) => <WorkflowsPanel extension={extension} onLaunch={vi.fn()} availableFiles={[]} availableFolders={[]} filesReady />}
  </GeoTaskCatalogue>);
}
async function openSetup(name: RegExp = /^Well log QC well-qc/) {
  await userEvent.click(await screen.findByRole("button", { name })); return screen.findByRole("dialog");
}
// Steps of the test workflow: 1 Well log, 2 심도 기준, 3 단위, 4 요약.
async function step(dialog: HTMLElement, n: number) { await userEvent.click(within(dialog).getByRole("tab", { name: new RegExp(`^${n}단계:`) })); }
const radio = (dialog: HTMLElement, name: string | RegExp) => within(dialog).getByRole("radio", { name });

describe("task catalogue and setup", () => {
  it.each(["ready", "missing-skills", "needs-environment", "unavailable"] as const)("separates run record from readiness: %s", async (state) => {
    rows = [workflow(state)]; catalogue();
    const row = await screen.findByRole("button", { name: /^Well log QC well-qc/ });
    expect(within(row).getByText("미시험")).toHaveAttribute("title", "미시험 · GAID 실행 기록 없음");
    if (state === "ready") expect(within(row).queryByText("준비됨")).not.toBeInTheDocument();
    else expect(within(row).getByText({ "missing-skills": "스킬 필요", "needs-environment": "환경 준비 필요", unavailable: "사용 불가" }[state])).toBeInTheDocument();
    expect(within(row).queryByText("사용자 자료 필요")).not.toBeInTheDocument();
    const dialog = await openSetup();
    expect(within(dialog).getByText("미시험")).toHaveAttribute("title", "미시험 · GAID 실행 기록 없음");
    if (state === "missing-skills") expect(within(dialog).getByText("프로젝트에 설치되지 않은 스킬: well-skill. 설정 → 스킬에서 설치하세요.")).toBeInTheDocument();
    if (state === "needs-environment") expect(within(dialog).getByText("준비되지 않은 실행 환경: Geo core")).toBeInTheDocument();
    if (state === "unavailable") { expect(within(dialog).getByText("지금은 선택한 Workflow를 쓸 수 없습니다.")).toBeInTheDocument(); expect(within(dialog).getByText("uv unavailable")).not.toBeVisible(); }
    if (state === "ready") expect(within(dialog).queryByText(/환경이 아직|쓸 수 없습니다|설치되지 않은/)).not.toBeInTheDocument();
    // The only fitting file is preselected; a file of another format is not offered as a choice.
    expect(radio(dialog, /A\.LAS/)).toHaveAttribute("aria-checked", "true"); expect(within(dialog).queryByRole("radio", { name: /table\.csv/ })).not.toBeInTheDocument();
    await step(dialog, 4);
    const start = within(dialog).getByRole("button", { name: "시작 초안 만들기" });
    if (state === "ready") expect(start).toBeEnabled(); else expect(start).toBeDisabled();
  });
  it("asks one question per step, keeps answers after close/reopen, hands off answers, files, skill and exposure, then clears", async () => {
    catalogue(); let dialog = await openSetup();
    expect(within(dialog).getByRole("heading", { name: "Well log" })).toBeInTheDocument(); expect(within(dialog).queryByText("심도 기준")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "다음 단계" }));
    expect(within(dialog).getByRole("heading", { name: "심도 기준" })).toBeInTheDocument(); expect(within(dialog).getByText("심도 기준을 유지합니다.")).toBeInTheDocument();
    // Known catalogue option ids get a readable label; nothing is preselected without a source (UI guide Q2).
    expect(radio(dialog, "측정 심도(MD)")).toHaveAttribute("aria-checked", "false"); await userEvent.click(radio(dialog, "측정 심도(MD)"));
    await userEvent.click(within(dialog).getByRole("button", { name: "대화상자 닫기" })); dialog = await openSetup();
    expect(radio(dialog, "측정 심도(MD)")).toHaveAttribute("aria-checked", "true");
    await step(dialog, 3); await userEvent.click(radio(dialog, "직접 입력")); await userEvent.type(within(dialog).getByRole("textbox", { name: "단위" }), "m");
    await userEvent.click(within(dialog).getByRole("button", { name: "요약 보기" }));
    expect(within(dialog).getByText("A.LAS")).toBeInTheDocument(); expect(within(dialog).getByText("측정 심도(MD)")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "단위 수정" })); await userEvent.click(radio(dialog, /^작업 중 결정/)); await step(dialog, 4);
    expect(within(dialog).getByText("작업 중 결정")).toBeInTheDocument();
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" })); await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      expect(handoff.mock.calls[0][0]).toMatchObject({ title: "Well log QC well-qc", attachedFiles: ["logs/A.LAS"], skills: [{ id: "skill-1", name: "well-skill", description: "QC" }], geoExposure: "workflow:well-qc" });
      expect(handoff.mock.calls[0][0].text).toContain("심도 기준: MD"); expect(handoff.mock.calls[0][0].text).toContain("작업 중 결정할 조건: 단위"); expect(handoff.mock.calls[0][0].text).toContain("해석 결과가 아닙니다.");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); dialog = await openSetup();
      expect(within(dialog).getByRole("heading", { name: "Well log" })).toBeInTheDocument(); await step(dialog, 2); expect(radio(dialog, "측정 심도(MD)")).toHaveAttribute("aria-checked", "false");
      expect(apiFetch).toHaveBeenCalledWith("/skills", {}, "p1");
    } finally { off(); }
  });
  it("disables the next step until a required file is chosen", async () => {
    render(<GeoTaskCatalogue projectId="p1" availableFiles={["logs/A.LAS", "logs/B.las"]}>
      {(extension) => <WorkflowsPanel extension={extension} onLaunch={vi.fn()} availableFiles={[]} availableFolders={[]} filesReady />}
    </GeoTaskCatalogue>);
    const dialog = await openSetup();
    expect(within(dialog).getByRole("button", { name: "다음 단계" })).toBeDisabled(); expect(within(dialog).getByText("다음 단계로 가려면 파일을 고르세요.")).toBeInTheDocument();
    await userEvent.click(radio(dialog, /B\.las/)); expect(within(dialog).getByRole("button", { name: "다음 단계" })).toBeEnabled();
    await step(dialog, 4); expect(within(dialog).getByText("B.las")).toBeInTheDocument();
  });
  it("keeps inputs on tab limit and does not pin a skill absent from /skills", async () => {
    apiFetch.mockImplementation(async (path) => path === "/geo/workflows" ? json({ catalogue: { state: "ready" }, workflows: rows }) : path === "/geo/recipes" ? json(saved) : json([]));
    catalogue(); const dialog = await openSetup(); await step(dialog, 4);
    const off = onStartGeoTask((detail) => { expect(detail.skills).toEqual([]); detail.result = "tab-limit"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "시작 초안 만들기" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("채팅 탭이 가득 찼습니다"); expect(within(dialog).getByText("A.LAS")).toBeInTheDocument();
    } finally { off(); }
  });
  it("lists 지구과학 first, folds other fields until asked, searches both, and keeps upstream when geo is off", async () => {
    const view = catalogue(); await screen.findByRole("button", { name: /^Well log QC well-qc/ });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings[0]).toMatch(/^지구과학/); expect(headings).not.toContainEqual(expect.stringMatching(/^논문·원고/));
    expect(screen.getByRole("button", { name: "지구과학" })).toBeInTheDocument();
    // Built-in workflows of other fields stay folded until asked for.
    fireEvent.click(screen.getByRole("button", { name: /^다른 분야 Workflow 보기/ }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toContainEqual(expect.stringMatching(/^논문·원고/));
    fireEvent.click(screen.getByRole("button", { name: "다른 분야 Workflow 접기" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).not.toContainEqual(expect.stringMatching(/^논문·원고/));
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow 검색" }), { target: { value: "las" } });
    expect(screen.getByRole("button", { name: /^Well log QC well-qc/ })).toBeInTheDocument(); expect(screen.queryByRole("button", { name: /^논문 검토/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Workflow 검색" }), { target: { value: "review a paper" } });
    expect(screen.queryByRole("button", { name: /^Well log QC well-qc/ })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: /^논문 검토/ })).toBeInTheDocument();
    view.unmount(); catalogueState = "off"; catalogue(); expect(await screen.findByText(/Geo 카탈로그 상태: off/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^논문 검토/ })).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "레시피 가져오기" })).not.toBeInTheDocument();
  });
  it("explicitly prepares the project environment and refreshes readiness", async () => {
    rows = [workflow("needs-environment")]; catalogue(); const dialog = await openSetup(); within(dialog).getByText("준비되지 않은 실행 환경: Geo core"); expect(apiFetch.mock.calls.some(([path]) => path.endsWith("/prepare"))).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "환경 준비" })); expect(await within(dialog).findByText("준비를 마쳤습니다. 시작 초안을 만들 수 있습니다.")).toBeInTheDocument();
    expect(await screen.findByText("환경을 준비했습니다. 패키지를 불러올 수 있습니다.")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/geo/environments/geo-core/prepare", expect.objectContaining({ method: "POST", body: JSON.stringify({ target: "project" }) }), "p1");
  });
  it("shows preparation failure in research terms with the raw output behind 기술 정보", async () => {
    rows = [workflow("needs-environment")]; prepareResult = json({ detail: "Install failed", output: "uv: index unreachable" }, 500); catalogue(); await openSetup();
    await userEvent.click(await screen.findByRole("button", { name: "환경 준비" })); expect(await screen.findByText("환경을 준비하지 못했습니다. 다시 준비하세요.")).toBeInTheDocument();
    expect(screen.getByText(/uv: index unreachable/)).not.toBeVisible(); expect(screen.getByText("기술 정보")).toBeInTheDocument(); expect(screen.queryByText(/준비를 마쳤습니다/)).not.toBeInTheDocument();
  });
  it("says why the start draft cannot be created yet", async () => {
    rows = [workflow("needs-environment")];
    catalogue(); const dialog = await openSetup(); await step(dialog, 4);
    expect(within(dialog).getByText("먼저 환경을 준비하세요.")).toBeInTheDocument(); expect(within(dialog).getByText("준비되지 않은 실행 환경: Geo core")).toBeInTheDocument();
  });
  it("shows indeterminate progress while preparation is running", async () => {
    rows = [workflow("needs-environment")];
    const implementation = apiFetch.getMockImplementation()!;
    let finish!: (response: Response) => void;
    apiFetch.mockImplementation((path, ...args) => path.endsWith("/prepare") ? new Promise<Response>((resolve) => { finish = resolve; }) : implementation(path, ...args));
    catalogue(); const dialog = await openSetup(); await userEvent.click(within(dialog).getByRole("button", { name: "환경 준비" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent("프로젝트 환경의 패키지를 준비하고 import를 확인하는 중입니다.");
    expect(screen.getByRole("button", { name: "환경 준비 중" })).toBeDisabled();
    rows = [workflow()]; finish(json({ ready: true }));
    expect(await within(dialog).findByText("준비를 마쳤습니다. 시작 초안을 만들 수 있습니다.")).toBeInTheDocument();
  });
  it("checks a local recipe without starting, showing a localized issue", async () => {
    catalogue(); await userEvent.click(await screen.findByRole("button", { name: "레시피 가져오기" })); const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Geo 작업 레시피 파일"), { target: { files: [recipeFile({})] } });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("다른 카탈로그 판의 레시피입니다: 0.1.0");
    expect(within(dialog).getByRole("button", { name: "레시피 저장" })).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "저장하지 않고 열기" })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledWith("/geo/recipes/check", expect.objectContaining({ body: JSON.stringify({ recipe: {} }) }), "p1");
  });
  it("saves a checked recipe under a new category, lists it there, opens it prefilled and deletes it", async () => {
    recipeResult = { ok: true, issues: [], setup: okSetup };
    catalogue(); await userEvent.click(await screen.findByRole("button", { name: "레시피 가져오기" })); let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Geo 작업 레시피 파일"), { target: { files: [recipeFile(okRecipe)] } });
    expect(await within(dialog).findByLabelText("레시피 제목")).toHaveValue("Well log QC well-qc");
    const options = within(within(dialog).getByLabelText("카테고리")).getAllByRole("option").map((option) => option.textContent);
    expect(options[0]).toBe("지구과학"); expect(options).toContain("논문·원고"); expect(options.at(-1)).toBe("새 카테고리 추가");
    fireEvent.change(within(dialog).getByLabelText("레시피 제목"), { target: { value: "MD 기준 QC" } });
    fireEvent.change(within(dialog).getByLabelText("카테고리"), { target: { value: "__new__" } });
    expect(within(dialog).getByRole("button", { name: "레시피 저장" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("새 카테고리 이름"), { target: { value: "현장 조사" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "레시피 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith("/geo/recipes", expect.objectContaining({ method: "POST", body: JSON.stringify({ recipe: okRecipe, title: "MD 기준 QC", newCategory: "현장 조사" }) }), "p1");
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)[1]).toMatch(/^현장 조사/); expect(screen.getByRole("button", { name: "현장 조사" })).toBeInTheDocument();
    dialog = await openSetup(/^MD 기준 QC/);
    expect(within(dialog).getByText("기반 작업: Well log QC well-qc")).toBeInTheDocument();
    // A recipe opens at the summary (UI guide Q4); its values are labelled as recipe values on their step.
    expect(within(dialog).getByRole("heading", { name: "선택 내용 확인" })).toBeInTheDocument(); expect(within(dialog).getByText("측정 심도(MD)")).toBeInTheDocument(); expect(within(dialog).getByText("작업 중 결정")).toBeInTheDocument();
    await step(dialog, 2); expect(radio(dialog, /측정 심도\(MD\)/)).toHaveAttribute("aria-checked", "true"); expect(within(dialog).getByText("레시피 값")).toBeInTheDocument(); await step(dialog, 4);
    await userEvent.click(within(dialog).getByRole("button", { name: "레시피 삭제" }));
    expect(apiFetch.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "레시피 삭제 확인" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^MD 기준 QC/ })).not.toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith("/geo/recipes/00000000-0000-4000-8000-000000000001", { method: "DELETE" }, "p1");
  });
  it("opens a checked recipe once without saving", async () => {
    recipeResult = { ok: true, issues: [], setup: okSetup };
    catalogue(); await userEvent.click(await screen.findByRole("button", { name: "레시피 가져오기" })); const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Geo 작업 레시피 파일"), { target: { files: [recipeFile(okRecipe)] } });
    await userEvent.click(await within(dialog).findByRole("button", { name: "저장하지 않고 열기" }));
    const setup = await screen.findByRole("dialog"); expect(within(setup).getByText("측정 심도(MD)")).toBeInTheDocument();
    expect(apiFetch.mock.calls.some(([path, init]) => path === "/geo/recipes" && init?.method === "POST")).toBe(false);
  });
  it("keeps a saved recipe the catalogue rejects and explains why", async () => {
    saved = { categories: [], recipes: [{ id: "00000000-0000-4000-8000-000000000002", title: "옛 레시피", category: "paper", recipe: { ...okRecipe, catalogueVersion: "0.1.0" }, savedAt: "2026-10-12T00:00:00Z", check: { ok: false, issues: [{ code: "catalogue-version", subject: "0.1.0", message: "x" }] } }] };
    catalogue(); const row = await screen.findByRole("button", { name: /^옛 레시피/ });
    expect(within(row).getByText("사용 불가")).toBeInTheDocument(); expect(screen.getByRole("heading", { name: /^논문·원고/ })).toBeInTheDocument();
    await userEvent.click(row); const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("다른 카탈로그 판의 레시피입니다: 0.1.0");
  });
});

function recipeFile(value: unknown) {
  const file = new File([JSON.stringify(value)], "test.geo-start.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => JSON.stringify(value) });
  return file;
}

describe("file actions and recipes", () => {
  it("caps suggestions at three, names the match and preselects the matching file", async () => {
    rows = ["one", "two", "three", "four"].map((id) => workflow("ready", id)); suggestions = rows.map(suggestion); render(<GeoFileActions path="logs/A.LAS" projectId="p1" />);
    const buttons = await screen.findAllByRole("button", { name: "시작 설정 열기" }); expect(buttons).toHaveLength(3); expect(screen.getAllByText("일치한 입력: Well log · 형식: las-welllog")).toHaveLength(3);
    await userEvent.click(buttons[0]); const dialog = await screen.findByRole("dialog"); expect(radio(dialog, /A\.LAS/)).toHaveAttribute("aria-checked", "true"); expect(await within(dialog).findByRole("radio", { name: /other\.las/ })).toBeInTheDocument();
  });
  it.each(["off", "empty"])("renders no strip for %s", async (condition) => {
    if (condition === "off") catalogueState = "off"; else suggestions = []; const { container } = render(<GeoFileActions path="logs/A.LAS" projectId="p1" />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/suggestions", expect.anything(), "p1")); expect(container).toBeEmptyDOMElement();
  });
  it("reads the open recipe, shows issues, then prefills editable choices without starting", async () => {
    suggestions = []; render(<GeoFileActions path="recipe.geo-start.json" projectId="p1" />);
    await userEvent.click(await screen.findByRole("button", { name: "레시피 가져오기" })); expect(await screen.findByRole("alert")).toHaveTextContent("다른 카탈로그 판의 레시피입니다");
    recipeResult = { ok: true, issues: [], setup: { workflowId: "well-qc", choices: { depth: "MD", units: "m" }, unresolvedChoices: ["units"], skillIds: ["geo/well"], exampleId: null } };
    await userEvent.click(screen.getByRole("button", { name: "레시피 가져오기" })); const dialog = await screen.findByRole("dialog");
    // An unresolved choice stays open even with a value in the recipe.
    expect(within(dialog).getByText("측정 심도(MD)")).toBeInTheDocument(); expect(within(dialog).getByText("작업 중 결정")).toBeInTheDocument();
    // The project's only fitting file is bound to the required input; nothing starts until the researcher does.
    expect(apiFetch).toHaveBeenCalledWith("/sandbox/file?path=recipe.geo-start.json", {}, "p1"); expect(apiFetch.mock.calls.some(([path]) => path === "/skills")).toBe(false);
  });
});

describe("geo-result", () => {
  it.each(["map-layer", "depth-track", "validation-curve"] as const)("opens %s manifest and uses a project-scoped thumbnail URL", async (kind) => {
    setApiToken("fixture token");
    const onOpenFile = vi.fn(); render(<GeoResultBody projectId="p1" card={{ schemaVersion: 1, kind: "geo-result", title: "QC", manifestPath: "results/qc.depth.json", resultKind: kind, thumbnailPath: "results/QC preview.png" }} onOpenFile={onOpenFile} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", expect.stringContaining("/sandbox/raw?path=results%2FQC%20preview.png&project=p1&kady_token=fixture%20token")); await userEvent.click(screen.getByRole("button")); expect(onOpenFile).toHaveBeenCalledWith("results/qc.depth.json"); expect(screen.getByText("results/qc.depth.json")).toBeInTheDocument();
  });
});

describe("integration additions", () => {
  it("turns on an installed but disabled workflow skill and re-reads readiness", async () => {
    const off = workflow("missing-skills"); off.readiness.skills[0].installed = true; rows = [off]; catalogue(); const dialog = await openSetup();
    await userEvent.click(within(dialog).getByRole("button", { name: "스킬 켜기" }));
    expect(apiFetch).toHaveBeenCalledWith("/skills/well-skill/enable", { method: "POST" }, "p1");
    expect(await within(dialog).findByText("준비를 마쳤습니다. 시작 초안을 만들 수 있습니다.")).toBeInTheDocument();
  });

  it("names a skill that is not installed instead of offering to turn it on", async () => {
    rows = [workflow("missing-skills")]; catalogue(); await openSetup();
    expect(await screen.findByText(/프로젝트에 설치되지 않은 스킬: well-skill/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "스킬 켜기" })).not.toBeInTheDocument();
  });

  it("shows the content evidence behind a suggestion", async () => {
    suggestions = [{ ...suggestion(rows[0]), match: { ...suggestion(rows[0]).match, signal: { kind: "element-columns", columns: ["Au_ppb", "Cu_ppm", "Ni"] } } }];
    render(<GeoFileActions path="logs/A.LAS" projectId="p1" />);
    expect(await screen.findByText("원소·산화물 열: Au_ppb, Cu_ppm, Ni")).toBeInTheDocument();
  });
});

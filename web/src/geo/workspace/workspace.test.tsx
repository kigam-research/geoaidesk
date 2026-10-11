import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoSuggestion, GeoWorkflowSummary, WorkflowReadinessState } from "@/geo/contracts/workspace";
import { GeoTaskCatalogue } from "./task-catalogue";
import { GeoFileActions } from "./file-actions";
import { GeoChatActions } from "./chat-actions";
import { GeoResultBody } from "./result-card";
import { onStartGeoTask } from "./events";
import { onChatPrefill } from "@/lib/chat-prefill";
import { setApiToken } from "@/lib/api-auth";

const apiFetch = vi.fn();
vi.mock("@/lib/projects", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/projects")>(), apiFetch: (...args: unknown[]) => apiFetch(...args) }));
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
beforeEach(() => {
  window.localStorage.clear(); Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] });
  rows = [workflow()]; suggestions = rows.map(suggestion); catalogueState = "ready";
  recipeResult = { ok: false, issues: [{ code: "catalogue-version", subject: "0.1.0", message: "Version does not match" }] }; prepareResult = null;
  apiFetch.mockReset().mockImplementation(async (path: string) => {
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
function catalogue() { return render(<GeoTaskCatalogue projectId="p1" availableFiles={["logs/A.LAS", "table.csv"]}><p>Upstream list</p></GeoTaskCatalogue>); }
async function openSetup() {
  await userEvent.click((await screen.findAllByRole("button", { name: "작업 설정 열기" }))[0]); return screen.findByRole("dialog");
}
function bindFile(dialog: HTMLElement) { fireEvent.change(within(dialog).getByLabelText("Well log (필수)"), { target: { value: "logs/A.LAS" } }); }

describe("task catalogue and setup", () => {
  it.each(["ready", "missing-skills", "needs-environment", "unavailable"] as const)("separates run record from readiness: %s", async (state) => {
    rows = [workflow(state)]; catalogue(); await screen.findByRole("heading", { name: "Geoscience 작업" });
    expect(screen.getByText("미시험 · GAID 실행 기록 없음")).toBeInTheDocument();
    if (state === "ready") expect(screen.getByText("준비됨")).toBeInTheDocument(); else expect(screen.queryByText("준비됨")).not.toBeInTheDocument();
    if (state === "missing-skills") expect(screen.getByText("필요한 스킬: well-skill")).toBeInTheDocument();
    if (state === "unavailable") expect(screen.getByText("사용 불가: uv unavailable")).toBeInTheDocument();
    const dialog = await openSetup(); bindFile(dialog);
    const start = within(dialog).getByRole("button", { name: "작업 초안 만들기" });
    if (state === "ready") expect(start).toBeEnabled(); else expect(start).toBeDisabled();
  });
  it("keeps form after close/reopen, hands off answers, unresolved choices, files, skill and exposure, then clears", async () => {
    catalogue(); let dialog = await openSetup();
    expect(within(within(dialog).getByLabelText("Well log (필수)")).queryByRole("option", { name: "table.csv" })).not.toBeInTheDocument();
    bindFile(dialog); fireEvent.change(within(dialog).getByLabelText("심도 기준", { exact: false }), { target: { value: "MD" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "설정 닫기" })); dialog = await openSetup();
    expect(within(dialog).getByLabelText("Well log (필수)")).toHaveValue("logs/A.LAS");
    expect(within(dialog).getByLabelText("심도 기준", { exact: false })).toHaveValue("MD");
    const handoff = vi.fn(); const off = onStartGeoTask((detail) => { handoff(detail); detail.result = "opened"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "작업 초안 만들기" })); await waitFor(() => expect(handoff).toHaveBeenCalledOnce());
      expect(handoff.mock.calls[0][0]).toMatchObject({ title: "Well log QC well-qc", attachedFiles: ["logs/A.LAS"], skills: [{ id: "skill-1", name: "well-skill", description: "QC" }], geoExposure: "workflow:well-qc" });
      expect(handoff.mock.calls[0][0].text).toContain("심도 기준: MD"); expect(handoff.mock.calls[0][0].text).toContain("작업 중 결정할 조건: 단위"); expect(handoff.mock.calls[0][0].text).toContain("해석 결과가 아닙니다.");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); dialog = await openSetup();
      expect(within(dialog).getByLabelText("Well log (필수)")).toHaveValue(""); expect(within(dialog).getByLabelText("심도 기준", { exact: false })).toHaveValue("");
      expect(apiFetch).toHaveBeenCalledWith("/skills", {}, "p1");
    } finally { off(); }
  });
  it("keeps inputs on tab limit and does not pin a skill absent from /skills", async () => {
    apiFetch.mockImplementation(async (path) => path === "/geo/workflows" ? json({ catalogue: { state: "ready" }, workflows: rows }) : json([]));
    catalogue(); const dialog = await openSetup(); bindFile(dialog);
    const off = onStartGeoTask((detail) => { expect(detail.skills).toEqual([]); detail.result = "tab-limit"; });
    try {
      await userEvent.click(within(dialog).getByRole("button", { name: "작업 초안 만들기" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("채팅 탭이 가득 찼습니다"); expect(within(dialog).getByLabelText("Well log (필수)")).toHaveValue("logs/A.LAS");
    } finally { off(); }
  });
  it("keeps upstream reachable and displays it directly when geo is off", async () => {
    const view = catalogue(); await screen.findByText("Geoscience 작업"); expect(screen.queryByText("Upstream list")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "K-Dense workflow 목록 보기" })); expect(screen.getByText("Upstream list")).toBeInTheDocument();
    view.unmount(); catalogueState = "off"; catalogue(); expect(await screen.findByText(/Geo 카탈로그 상태: off/)).toBeInTheDocument(); expect(screen.getByText("Upstream list")).toBeInTheDocument();
  });
  it("explicitly prepares the project environment and refreshes readiness", async () => {
    rows = [workflow("needs-environment")]; catalogue(); await screen.findByText("환경 준비 필요: Geo core"); expect(apiFetch.mock.calls.some(([path]) => path.endsWith("/prepare"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "환경 준비" })); expect(await screen.findByText("준비됨")).toBeInTheDocument();
    expect(await screen.findByText(/환경 패키지의 import를 확인했습니다/)).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/geo/environments/geo-core/prepare", expect.objectContaining({ method: "POST", body: JSON.stringify({ target: "project" }) }), "p1");
  });
  it("shows preparation failure output without claiming ready", async () => {
    rows = [workflow("needs-environment")]; prepareResult = json({ detail: "Install failed", output: "uv: index unreachable" }, 500); catalogue();
    await userEvent.click(await screen.findByRole("button", { name: "환경 준비" })); expect(await screen.findByText(/uv: index unreachable/)).toBeInTheDocument(); expect(screen.queryByText("준비됨")).not.toBeInTheDocument();
  });
  it("shows indeterminate progress while preparation is running", async () => {
    rows = [workflow("needs-environment")];
    const implementation = apiFetch.getMockImplementation()!;
    let finish!: (response: Response) => void;
    apiFetch.mockImplementation((path, ...args) => path.endsWith("/prepare") ? new Promise<Response>((resolve) => { finish = resolve; }) : implementation(path, ...args));
    catalogue(); await userEvent.click(await screen.findByRole("button", { name: "환경 준비" }));
    expect(screen.getByRole("status")).toHaveTextContent("프로젝트 환경의 패키지를 준비하고 import를 확인하는 중입니다.");
    expect(screen.getByRole("button", { name: "환경 준비 중" })).toBeDisabled();
    rows = [workflow()]; finish(json({ ready: true }));
    expect(await screen.findByText("준비됨")).toBeInTheDocument();
  });
  it("checks a local recipe without starting, showing a localized issue", async () => {
    catalogue(); await screen.findByText("Geoscience 작업"); const file = new File(["{}"], "test.geo-start.json", { type: "application/json" }); Object.defineProperty(file, "text", { value: async () => "{}" });
    fireEvent.change(screen.getAllByLabelText("Geo 작업 레시피 파일")[0], { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("다른 카탈로그 판의 레시피입니다: 0.1.0"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/geo/recipes/check", expect.objectContaining({ body: JSON.stringify({ recipe: {} }) }), "p1");
  });
});

describe("file actions and recipes", () => {
  it("caps suggestions at three, names the match and preselects the matching file", async () => {
    rows = ["one", "two", "three", "four"].map((id) => workflow("ready", id)); suggestions = rows.map(suggestion); render(<GeoFileActions path="logs/A.LAS" projectId="p1" />);
    const buttons = await screen.findAllByRole("button", { name: "작업 설정 열기" }); expect(buttons).toHaveLength(3); expect(screen.getAllByText("일치한 입력: Well log · 형식: las-welllog")).toHaveLength(3);
    await userEvent.click(buttons[0]); const dialog = await screen.findByRole("dialog"); expect(within(dialog).getByLabelText("Well log (필수)")).toHaveValue("logs/A.LAS"); expect(await within(dialog).findByRole("option", { name: "other.las" })).toBeInTheDocument();
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
    expect(within(dialog).getByLabelText("심도 기준", { exact: false })).toHaveValue("MD"); expect(within(dialog).getByLabelText("단위")).toHaveValue(""); expect(within(dialog).getByRole("button", { name: "작업 초안 만들기" })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledWith("/sandbox/file?path=recipe.geo-start.json", {}, "p1"); expect(apiFetch.mock.calls.some(([path]) => path === "/skills")).toBe(false);
  });
});

describe("reusable skill", () => {
  it("disables creation without a session or during streaming", () => {
    const { rerender } = render(<GeoChatActions projectId="p1" sessionId={null} isStreaming={false} />); expect(screen.getByRole("button", { name: "재사용 스킬 만들기" })).toBeDisabled();
    rerender(<GeoChatActions projectId="p1" sessionId="s1" isStreaming />); expect(screen.getByRole("button", { name: "재사용 스킬 만들기" })).toBeDisabled();
  });
  it("validates the Pi name rule, creates a project template and prefills without sending", async () => {
    render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); await userEvent.click(screen.getByRole("button", { name: "재사용 스킬 만들기" }));
    fireEvent.change(screen.getByLabelText(/스킬 이름/), { target: { value: "bad--name" } }); fireEvent.change(screen.getByLabelText("재사용할 작업 설명 (한 문장)"), { target: { value: "Well log QC" } }); expect(screen.getByRole("button", { name: "스킬 템플릿 만들기" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/스킬 이름/), { target: { value: "my-qc" } }); const prefill = vi.fn(); const off = onChatPrefill(prefill);
    try {
      await userEvent.click(screen.getByRole("button", { name: "스킬 템플릿 만들기" })); await waitFor(() => expect(prefill).toHaveBeenCalledOnce());
      expect(apiFetch).toHaveBeenCalledWith("/skills/create", expect.objectContaining({ body: JSON.stringify({ name: "my-qc", description: "Well log QC", scope: "project" }) })); expect(prefill.mock.calls[0][0]).toContain(".pi/skills/my-qc/SKILL.md"); expect(prefill.mock.calls[0][0]).toContain("검증을 주장하지 마세요"); expect(apiFetch.mock.calls.every(([path]) => path === "/skills/create")).toBe(true);
    } finally { off(); }
  });
  it("shows creation errors without losing the fields", async () => {
    apiFetch.mockResolvedValue(json({ detail: "Name exists" }, 409)); render(<GeoChatActions projectId="p1" sessionId="s1" isStreaming={false} />); await userEvent.click(screen.getByRole("button", { name: "재사용 스킬 만들기" }));
    fireEvent.change(screen.getByLabelText(/스킬 이름/), { target: { value: "my-qc" } }); fireEvent.change(screen.getByLabelText("재사용할 작업 설명 (한 문장)"), { target: { value: "QC" } }); await userEvent.click(screen.getByRole("button", { name: "스킬 템플릿 만들기" })); expect(await screen.findByRole("alert")).toHaveTextContent("Name exists"); expect(screen.getByLabelText(/스킬 이름/)).toHaveValue("my-qc");
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
    const off = workflow("missing-skills"); off.readiness.skills[0].installed = true; rows = [off]; catalogue();
    await userEvent.click(await screen.findByRole("button", { name: "스킬 켜기" }));
    expect(apiFetch).toHaveBeenCalledWith("/skills/well-skill/enable", { method: "POST" }, "p1");
    expect(await screen.findByText("준비됨")).toBeInTheDocument();
  });

  it("names a skill that is not installed instead of offering to turn it on", async () => {
    rows = [workflow("missing-skills")]; catalogue();
    expect(await screen.findByText(/프로젝트에 설치되지 않은 스킬: well-skill/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "스킬 켜기" })).not.toBeInTheDocument();
  });

  it("shows the content evidence behind a suggestion", async () => {
    suggestions = [{ ...suggestion(rows[0]), match: { ...suggestion(rows[0]).match, signal: { kind: "element-columns", columns: ["Au_ppb", "Cu_ppm", "Ni"] } } }];
    render(<GeoFileActions path="logs/A.LAS" projectId="p1" />);
    expect(await screen.findByText("원소·산화물 열: Au_ppb, Cu_ppm, Ni")).toBeInTheDocument();
  });
});

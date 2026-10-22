import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import type { FigureRecord, FigureCheck, JournalSummary } from "@/geo/contracts/figures";
import { NoteFigures } from "./note-figures";
import { checkPreviewUrl } from "./preview-url";

vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn(), API_BASE: "http://localhost:8000" }));
vi.mock("@/lib/chat-prefill", () => ({ prefillChat: vi.fn() }));
vi.mock("@/lib/use-sandbox", () => ({ rawFileUrl: (path: string) => `/sandbox/raw?path=${encodeURIComponent(path)}` }));
const sha = "a".repeat(64);
const plot: FigureRecord = {
  path: "연구노트/test/figures/plot.png", caption: "그림 1. 분석 결과", noteId: "test", exists: true, sha256: sha,
  kind: "data-figure", kindSource: "derived", staleness: "current", inputsChanged: true,
  origin: { sessionId: "chat-a", producedAt: "2026-10-22T00:00:00Z", copiedFrom: "out.png", copyMatch: "edge", script: "draw.py", inputs: [
    { path: "draw.py", role: "script", confidence: "observed", exists: true, changedSinceUse: false },
    { path: "data.csv", role: "data", confidence: "inferred", exists: true, changedSinceUse: true },
  ], incomplete: false, record: { toolName: "bash", model: "private-model-name", environmentId: "env-id" } }, check: null, policy: null, disclosure: null,
};
const ai: FigureRecord = { ...plot, path: "ai.png", caption: "그림 2. 개념 그림", kind: "ai-picture", inputsChanged: false, origin: { ...plot.origin!, script: null, inputs: [], record: { toolName: "generate_image", model: "image-model", environmentId: null } }, disclosure: "AI image tool: generate_image; model: image-model; date: 2026-10-22; purpose: concept.", policy: { journalId: "test", policy: "disclose", sourceUrl: "https://example.org" } };
const journal: JournalSummary = { id: "test", name: "Test Journal", widths: [{ id: "single", label: "1단", mm: 90 }], sourceUrl: "https://example.org", rulesCheckedAt: "2026-10-22" };
const target = { journalId: "test", width: "single", updatedAt: "2026-10-22" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const check: FigureCheck = { schema: "gaid-figure-check/v1", sha256: sha, path: plot.path, kind: "data-figure", checkedAt: "2026-10-22", rulesCheckedAt: "2026-10-22", target: { journalId: "test", width: "single", widthMm: 90 }, items: [{ id: "dpi", status: "fail", measured: "30 dpi", required: "300 dpi" }], cvdPreviews: [`.kady/geo/figure-checks/${sha}-cvd-deuteranopia.png`] };

beforeEach(() => {
  vi.clearAllMocks(); localStorage.setItem("gaid:locale", "ko");
  vi.mocked(apiFetch).mockImplementation(async url => {
    if (url === "/geo/figures/journals") return json({ journals: [journal] });
    if (url === "/geo/figures/check") return json({ figure: { ...plot, check } });
    if (url === "/geo/figures/kind") return json({ figure: { ...plot, kind: "code-diagram", kindSource: "researcher" } });
    return json({ figures: [plot, ai], target, truncated: false });
  });
});
function panel(over: Partial<Parameters<typeof NoteFigures>[0]> = {}) {
  return render(<NoteFigures projectId="project-a" noteId="test" onOpenFile={vi.fn()} {...over} />);
}

it("shows provenance without agent internals and redraws only into a composer", async () => {
  const onPrefill = vi.fn(), onOpenChat = vi.fn(), onOpenFile = vi.fn(); panel({ onPrefill, onOpenChat, onOpenFile });
  await screen.findByText("스크립트");
  expect(screen.queryByText("private-model-name")).not.toBeVisible();
  expect(screen.getAllByText("입력이 바뀜")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "만든 채팅 열기" })); expect(onOpenChat).toHaveBeenCalledWith("chat-a", plot.caption);
  fireEvent.click(screen.getByText("draw.py")); expect(onOpenFile).toHaveBeenCalledWith("draw.py");
  fireEvent.click(screen.getByRole("button", { name: "다시 그리기" }));
  expect(onPrefill).toHaveBeenCalledWith(expect.stringContaining("gaid-figures"), { send: false });
  expect(onPrefill.mock.calls[0][0]).toContain("data.csv");
  expect(onPrefill.mock.calls[0][0]).toContain("draw.py");
  fireEvent.click(screen.getByRole("tab", { name: "점검" }));
  fireEvent.click(screen.getByRole("button", { name: "저널 크기로 다시 그리기" }));
  expect(onPrefill.mock.calls[1][0]).toContain("90 mm");
  expect(apiFetch).toHaveBeenCalledWith("/geo/figures?note=test", {}, "project-a");
});

it("runs a check, shows measured versus required values and serves hidden CVD previews safely", async () => {
  panel(); fireEvent.click(await screen.findByRole("tab", { name: "점검" }));
  fireEvent.click(screen.getByRole("button", { name: "그림 점검하기" }));
  expect(await screen.findByText("30 dpi")).toBeInTheDocument(); expect(screen.getByText("300 dpi")).toBeInTheDocument();
  expect(screen.getByText("기준 미달")).toBeInTheDocument();
  fireEvent.click(screen.getByText("색각 시뮬레이션 보기"));
  expect(screen.getByRole("img", { name: "색각 시뮬레이션 1" }).getAttribute("src")).toContain(`/geo/figures/check-preview?project=project-a&sha256=${sha}&variant=deuteranopia`);
  expect(screen.getByText(/투고 전 최신 지침/)).toBeInTheDocument();
});

it("keeps AI disclosure behind the record, permits kind override, and hides the AI tab for data figures", async () => {
  panel(); const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }; Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  fireEvent.click((await screen.findByText("그림 2. 개념 그림")).closest("button")!);
  fireEvent.click(screen.getByRole("tab", { name: "AI 그림" }));
  expect(screen.getByText("목표 저널은 AI 사용 공개를 요구합니다.")).toBeInTheDocument();
  const disclosure = screen.getByText(ai.disclosure!); expect(disclosure).not.toBeVisible();
  fireEvent.click(screen.getByText("기록 보기")); expect(disclosure).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "공개 문구 복사" })); expect(clipboard.writeText).toHaveBeenCalledWith(ai.disclosure);
  fireEvent.click(screen.getAllByText("그림 1. 분석 결과")[0].closest("button")!);
  expect(screen.queryByRole("tab", { name: "AI 그림" })).toBeNull();
  expect(screen.getByRole("button", { name: "다시 그리기" })).toBeInTheDocument();
  fireEvent.click(screen.getByText("그림 종류 바꾸기"));
  fireEvent.change(screen.getByRole("combobox", { name: "그림 종류" }), { target: { value: "code-diagram" } });
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/geo/figures/kind", expect.objectContaining({ method: "PUT", body: JSON.stringify({ path: plot.path, sha256: sha, kind: "code-diagram" }) }), "project-a"));
});

it("shows empty/error states and does not reuse a note after project switch", async () => {
  const view = panel(); await screen.findByText("스크립트");
  vi.mocked(apiFetch).mockImplementation(async () => json({ figures: [], target: null, truncated: false, journals: [] }));
  view.rerender(<NoteFigures projectId="project-b" noteId="new" onOpenFile={vi.fn()} />);
  await waitFor(() => expect(screen.queryByRole("region", { name: "그림 기록" })).not.toBeInTheDocument());
  expect(screen.queryByText("스크립트")).not.toBeInTheDocument();
  vi.mocked(apiFetch).mockImplementation(async () => json({ detail: "technical failure" }, 503));
  view.rerender(<NoteFigures projectId="project-c" noteId="new" onOpenFile={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("그림 기록을 읽거나 저장하지 못했습니다.");
  expect(screen.getByText(/technical failure/)).not.toBeVisible();
});

it("builds authenticated CVD preview URLs without arbitrary file paths", () => {
  localStorage.setItem("kady:apiToken", "test-token");
  const url = checkPreviewUrl("project/a", sha, "deuteranopia");
  expect(url).toContain("project=project%2Fa"); expect(url).not.toContain(".kady"); expect(url).toContain("kady_token=test-token");
});

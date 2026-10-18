import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/projects";
import { prefillChat } from "@/lib/chat-prefill";
import type { ResearchNoteSummary } from "@/geo/contracts/research-notes";
import { ResearchNotesPanel } from "./research-notes-panel";

vi.mock("@/lib/projects", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/chat-prefill", () => ({ prefillChat: vi.fn() }));
vi.mock("@/components/ai-elements/message", () => ({ MessageResponse: ({ children }: { children: string }) => <div data-testid="md">{children}</div> }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const note = (over: Partial<ResearchNoteSummary> = {}): ResearchNoteSummary => ({
  id: "2026-10-15-assay", path: "연구노트/2026-10-15-assay/index.md", title: "다원소 분석값 점검", date: "2026-10-15", status: "pending",
  headline: "지정 입력은 시료 자료가 아닙니다.", cover: null, supersedes: [], supersededBy: null,
  decisions: [{ number: 1, question: "시료 자료로 다시 분석할지", options: [
    { label: "가", text: "시료 표를 올려 다시 실행", recommended: true, reason: "지금 결과는 시연" },
    { label: "나", text: "시연으로 마무리", recommended: false, reason: null },
  ] }],
  sessions: ["s1"], method: { name: "조성 탐색", methodId: "m", workflowId: "w", assessment: "useful" }, updatedAt: "2026-10-15T10:00:00Z", problems: [], ...over,
});
const CONTENT = "---\ntitle: 다원소 분석값 점검\n---\n# 다원소 분석값 점검\n\n## 결과\n\n![m](figures/m.png)\n\n## 결정할 일\n\n1. 시료 자료로 다시 분석할지\n\n## 근거\n\n- [t](../../results/t.csv)\n";

beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.mocked(prefillChat).mockReset();
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path, init) => {
    if (path === "/geo/notes") return json({ dir: "연구노트", notes: [note(), note({ id: "2026-10-12-map", path: "연구노트/2026-10-12-map/index.md", title: "지질도 면적", headline: "14개 암상 면적표", status: "confirmed", decisions: [], method: null })] });
    if (path === `/geo/notes/${encodeURIComponent("2026-10-15-assay")}`) return json({ note: note(), content: CONTENT });
    if (path.endsWith("/status") && init?.method === "POST") return json({ note: note({ status: "confirmed" }) });
    throw new Error(`Unexpected: ${path}`);
  });
});

function panel(over: Partial<Parameters<typeof ResearchNotesPanel>[0]> = {}) {
  return render(<ResearchNotesPanel projectId="p1" streaming={false} onOpenFile={vi.fn()} onOpenChat={vi.fn()} workRecord={<div>timeline</div>} {...over} />);
}

it("groups notes by decisions, not reviewed and reviewed", async () => {
  panel();
  expect(await screen.findByText("결정할 일 1")).toBeInTheDocument();
  expect(screen.getByText("검토 전 1")).toBeInTheDocument();
  expect(screen.getByText("확인함 1")).toBeInTheDocument();
  expect(screen.getByText("정리 노트 2개 · 결정할 일 1건")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /노트 정리/ }));
  expect(prefillChat).toHaveBeenCalledWith(expect.stringContaining("정리 노트"));
});

it("opens a note, renders its body around answerable decision cards and confirms it", async () => {
  const onOpenChat = vi.fn();
  panel({ onOpenChat });
  fireEvent.click(await screen.findByText("지정 입력은 시료 자료가 아닙니다."));
  expect(await screen.findByText("사용한 방법: 조성 탐색 · 시험 평가: 유용함", { exact: false })).toBeInTheDocument();
  const bodies = await screen.findAllByTestId("md");
  expect(bodies[0].textContent).toContain("## 결과");
  expect(bodies[0].textContent).not.toContain("title:");
  expect(bodies.at(-1)!.textContent).toContain("](results/t.csv)");
  // Recommended option first, with its reason; clicking prefills the chat.
  const option = screen.getByRole("button", { name: /시료 표를 올려 다시 실행/ });
  expect(option).toHaveTextContent("권장");
  fireEvent.click(option);
  expect(prefillChat).toHaveBeenCalledWith(expect.stringContaining("결정 1에 답합니다: 가) 시료 표를 올려 다시 실행"));
  fireEvent.click(screen.getByRole("button", { name: /채팅 열기/ }));
  expect(onOpenChat).toHaveBeenCalledWith("s1", "다원소 분석값 점검");
  fireEvent.click(screen.getByRole("button", { name: "확인함으로 표시" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "검토 전으로 되돌리기" })).toBeInTheDocument());
});

it("shows the work record on request and when the chat deep-links an entry", async () => {
  const view = panel();
  fireEvent.click(await screen.findByRole("button", { name: "작업 기록 보기" }));
  expect(screen.getByText("timeline")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /정리 노트로 돌아가기/ }));
  expect(screen.queryByText("timeline")).not.toBeInTheDocument();
  view.rerender(<ResearchNotesPanel projectId="p1" streaming={false} recordFocusToken={7} onOpenFile={vi.fn()} workRecord={<div>timeline</div>} />);
  expect(screen.getByText("timeline")).toBeInTheDocument();
});

it("shows the empty state and a research-language error with technical details", async () => {
  vi.mocked(apiFetch).mockImplementationOnce(async () => json({ dir: "연구노트", notes: [] }));
  const view = panel();
  expect(await screen.findByText("아직 정리 노트가 없습니다")).toBeInTheDocument();
  view.unmount();
  vi.mocked(apiFetch).mockImplementationOnce(async () => new Response("boom", { status: 500 }));
  panel();
  expect(await screen.findByText("정리 노트를 읽지 못했습니다. 잠시 뒤 다시 여세요.")).toBeInTheDocument();
  expect(screen.getByText("기술 정보")).toBeInTheDocument();
});

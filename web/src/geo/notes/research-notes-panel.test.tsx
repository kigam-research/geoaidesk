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
  ] }, { number: 2, question: "면적 단위", options: [
    { label: "가", text: "km²", recommended: false, reason: null },
    { label: "나", text: "ha", recommended: false, reason: null },
  ] }],
  sessions: ["s1"], method: { name: "조성 탐색", methodId: "m", workflowId: "w", assessment: "useful" }, updatedAt: "2026-10-15T10:00:00Z", problems: [], ...over,
});
const CONTENT = "---\ntitle: 다원소 분석값 점검\n---\n# 다원소 분석값 점검\n\n## 결과\n\n![m](figures/m.png)\n\n## 결정할 일\n\n1. 시료 자료로 다시 분석할지\n\n## 근거\n\n- [t](../../results/t.csv)\n";

beforeEach(() => {
  localStorage.setItem("gaid:locale", "ko");
  vi.mocked(prefillChat).mockReset().mockReturnValue("sent");
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path, init) => {
    if (path === "/geo/notes") return json({ dir: "연구노트", notes: [note(), note({ id: "2026-10-12-map", path: "연구노트/2026-10-12-map/index.md", title: "지질도 면적", headline: "14개 암상 면적표", status: "confirmed", decisions: [], method: null })] });
    if (path === `/geo/notes/${encodeURIComponent("2026-10-15-assay")}`) return json({ note: note(), content: CONTENT });
    if (path.endsWith("/status") && init?.method === "POST") return json(note({ status: "confirmed" }));
    throw new Error(`Unexpected: ${path}`);
  });
});

function panel(over: Partial<Parameters<typeof ResearchNotesPanel>[0]> = {}) {
  return render(<ResearchNotesPanel projectId="p1" streaming={false} onOpenFile={vi.fn()} onOpenChat={vi.fn()} workRecord={<div>timeline</div>} {...over} />);
}

it("groups notes by decisions, not reviewed and reviewed", async () => {
  panel();
  expect(await screen.findByText("결정할 일 2")).toBeInTheDocument();
  expect(screen.getByText("검토 전 1")).toBeInTheDocument();
  expect(screen.getByText("확인함 1")).toBeInTheDocument();
  expect(screen.getByText("정리 노트 2개 · 결정할 일 2건")).toBeInTheDocument();
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
  // Recommended option first, with its reason; choosing answers sends nothing until 답변 보내기.
  const option = screen.getByRole("radio", { name: /시료 표를 올려 다시 실행/ });
  expect(option).toHaveTextContent("권장");
  const send = screen.getByRole("button", { name: /답변 보내기/ });
  expect(send).toBeDisabled();
  expect(screen.getByText("결정마다 답을 고른 뒤 함께 보내세요.")).toBeInTheDocument();
  fireEvent.click(option);
  expect(option).toHaveAttribute("aria-checked", "true");
  expect(screen.getByText("결정 2건 중 1건에 답했습니다.")).toBeInTheDocument();
  // One decision at a time: the second decision is one step on, and gets a separate instruction instead of an option.
  fireEvent.click(screen.getByRole("button", { name: "다음 결정" }));
  expect(screen.queryByRole("radio", { name: /시료 표를 올려 다시 실행/ })).toBeNull();
  const instruction = screen.getByRole("radio", { name: "별도 지시 (직접 입력)" });
  fireEvent.click(instruction);
  // An empty instruction is not an answer yet.
  expect(screen.getByText("결정 2건 중 1건에 답했습니다.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "결정 2의 별도 지시" }), { target: { value: "면적은 km²와 ha를 함께 표시" } });
  expect(prefillChat).not.toHaveBeenCalled();
  expect(onOpenChat).not.toHaveBeenCalled();
  fireEvent.click(send);
  // All answers go in one message to the chat that wrote the note.
  expect(onOpenChat).toHaveBeenCalledWith("s1", "다원소 분석값 점검");
  await waitFor(() => expect(prefillChat).toHaveBeenCalledTimes(1));
  const [text, options] = vi.mocked(prefillChat).mock.calls[0];
  expect(options).toEqual({ send: true, sessionId: "s1" });
  expect(text).toContain("“다원소 분석값 점검” 노트의 결정할 일에 답합니다.");
  expect(text).toContain("- 결정 1: 가) 시료 표를 올려 다시 실행");
  expect(text).toContain("- 결정 2(별도 지시): 면적은 km²와 ha를 함께 표시");
  expect(await screen.findByText("답변을 채팅으로 보냈습니다.")).toBeInTheDocument();
  // Sent answers are cleared and the stepper returns to the first decision.
  expect(screen.getByRole("radio", { name: /시료 표를 올려 다시 실행/ })).toHaveAttribute("aria-checked", "false");
  onOpenChat.mockClear();
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

it("keeps the answers and says so when no chat takes them", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    vi.mocked(prefillChat).mockReturnValue(null);
    panel();
    fireEvent.click(await screen.findByText("지정 입력은 시료 자료가 아닙니다."));
    fireEvent.click(await screen.findByRole("radio", { name: /시연으로 마무리/ }));
    fireEvent.click(screen.getByRole("button", { name: /답변 보내기/ }));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await screen.findByRole("alert")).toHaveTextContent("답변을 보내지 못했습니다");
    expect(screen.getByRole("radio", { name: /시연으로 마무리/ })).toHaveAttribute("aria-checked", "true");
    // Only the answered decision is sent; the open one is named.
    expect(vi.mocked(prefillChat).mock.calls[0][0]).toContain("결정 2에는 아직 답하지 않았습니다.");
  } finally {
    vi.useRealTimers();
  }
});

it("says when the chat put the answers in its chat box instead of sending", async () => {
  vi.mocked(prefillChat).mockReturnValue("filled");
  panel();
  fireEvent.click(await screen.findByText("지정 입력은 시료 자료가 아닙니다."));
  fireEvent.click(await screen.findByRole("radio", { name: /시연으로 마무리/ }));
  fireEvent.click(screen.getByRole("button", { name: /답변 보내기/ }));
  expect(await screen.findByText("채팅에서 지금 보낼 수 없어 답변을 채팅 입력창에 넣었습니다. 채팅에서 확인한 뒤 보내세요.")).toBeInTheDocument();
});

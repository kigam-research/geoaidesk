import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_QUESTIONS, fixtureDraft } from "./fixtures";
import { FlowDiagram, orderedNodes } from "./flow-diagram";
import { parseHubHash } from "./location";
import { QuestionStep, isAnswered, sameAnswer, type DraftAnswer } from "./question-step";
import { hasMethodSetup, openMethodSetup, takeMethodSetup } from "./handoff";
import { RegisterDialog } from "./hub-dialogs";

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => localStorage.removeItem("gaid:locale"));

function Questions({ onApply }: { onApply: () => void }) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  return (
    <QuestionStep
      questions={FIXTURE_QUESTIONS}
      answers={answers}
      onAnswer={(id, a) => setAnswers((cur) => ({ ...cur, [id]: a }))}
      onApply={onApply}
    />
  );
}

describe("GAID hub question step", () => {
  it("shows one question at a time with the recommendation marked and a 기타 field", () => {
    render(<Questions onApply={() => undefined} />);
    expect(screen.getByRole("heading", { name: FIXTURE_QUESTIONS[0].text })).toBeTruthy();
    expect(screen.queryByText(FIXTURE_QUESTIONS[1].text)).toBeNull();
    const recommended = screen.getByRole("radio", { name: /다른 지역 자료에 적용/ });
    expect(within(recommended).getByText("권장")).toBeTruthy();
    expect(screen.getByLabelText("기타")).toBeTruthy();
    expect(screen.getByText("0/5 답함")).toBeTruthy();
  });

  it("moves with tabs and previous/next, and applies only when every question has an answer", () => {
    const onApply = vi.fn();
    render(<Questions onApply={onApply} />);
    fireEvent.click(screen.getByRole("radio", { name: /다른 지역 자료에 적용/ }));
    fireEvent.click(screen.getByRole("button", { name: /다음 질문/ }));
    expect(screen.getByRole("heading", { name: FIXTURE_QUESTIONS[1].text })).toBeTruthy();
    // 기타 replaces the chosen option
    fireEvent.change(screen.getByLabelText("기타"), { target: { value: "필요한 스크립트만" } });
    fireEvent.click(screen.getByRole("tab", { name: "질문 4" }));
    expect(screen.getByRole("heading", { name: FIXTURE_QUESTIONS[3].text })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /나중에 정하기/ }));
    fireEvent.click(screen.getByRole("tab", { name: "답 확인" }));
    const apply = screen.getByRole("button", { name: "답 반영해 초안 만들기" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/답하지 않은 질문이 2개/)).toBeTruthy();
    for (const n of [3, 5]) {
      fireEvent.click(screen.getByRole("tab", { name: `질문 ${n}` }));
      fireEvent.click(screen.getAllByRole("radio")[0]);
    }
    fireEvent.click(screen.getByRole("tab", { name: "답 확인" }));
    expect(screen.getByText("필요한 스크립트만")).toBeTruthy();
    expect(screen.getByText("나중에 정함")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "답 반영해 초안 만들기" }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("keeps recorded answers editable and applies only the changed ones after a draft exists", () => {
    const recorded: Record<string, DraftAnswer> = Object.fromEntries(
      FIXTURE_QUESTIONS.map((q) => [q.id, q.options.length ? { optionId: q.options[0].id } : { response: "답" }]),
    );
    const onApply = vi.fn();
    function Recorded() {
      const [answers, setAnswers] = useState<Record<string, DraftAnswer>>(recorded);
      return (
        <QuestionStep
          questions={FIXTURE_QUESTIONS}
          answers={answers}
          recorded={recorded}
          onAnswer={(id, a) => setAnswers((cur) => ({ ...cur, [id]: a }))}
          onApply={onApply}
        />
      );
    }
    render(<Recorded />);
    // Opens on the review tab: everything is recorded, nothing to apply yet.
    expect(screen.getByText(/답을 바꾸려면 질문 번호를 눌러/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "질문 1" }));
    expect(screen.getByText(/초안에 반영된 답입니다/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("기타"), { target: { value: "다른 지역 격자도 받기" } });
    expect(screen.getByText(/반영된 답과 다릅니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "답 확인" }));
    expect(screen.getByText("바꾼 답 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "바꾼 답 반영" }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("compares answers by option, words or deferral", () => {
    expect(sameAnswer({ optionId: "a" }, { optionId: "a" })).toBe(true);
    expect(sameAnswer({ optionId: "a" }, { optionId: "b" })).toBe(false);
    expect(sameAnswer({ response: " x " }, { response: "x" })).toBe(true);
    expect(sameAnswer({ defer: true }, { optionId: "a" })).toBe(false);
    expect(sameAnswer(undefined, { optionId: "a" })).toBe(false);
  });

  it("treats an option, free text or deferral as an answer", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered({ response: "  " })).toBe(false);
    expect(isAnswered({ optionId: "a" })).toBe(true);
    expect(isAnswered({ response: "x" })).toBe(true);
    expect(isAnswered({ defer: true })).toBe(true);
  });
});

describe("GAID hub draft flow", () => {
  it("orders steps along next edges and marks researcher decisions", () => {
    const draft = fixtureDraft().drafts[0];
    const shuffled = [...draft.profile.procedure.nodes].reverse();
    expect(orderedNodes(shuffled, draft.profile.procedure.edges).map((n) => n.id)).toEqual([
      "n1",
      "n2",
      "n3",
      "n4",
      "n5",
      "n6",
      "n7",
    ]);
    const onSelect = vi.fn();
    render(
      <FlowDiagram nodes={draft.profile.procedure.nodes} edges={draft.profile.procedure.edges} onSelect={onSelect} />,
    );
    expect(screen.getAllByText("직접 정함")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /블록 크기 확정/ }));
    expect(onSelect).toHaveBeenCalledWith("n3");
  });
});

describe("GAID hub location and hand-off", () => {
  it("parses the hub hash", () => {
    expect(parseHubHash("#hub")).toEqual({ open: true, projectId: null });
    expect(parseHubHash("#hub/ap-a135f290-1c4")).toEqual({ open: true, projectId: "ap-a135f290-1c4" });
    expect(parseHubHash("#hub/../x")).toEqual({ open: false, projectId: null });
    expect(parseHubHash("")).toEqual({ open: false, projectId: null });
    expect(parseHubHash("#hub/c/map-check%2Fv2")).toEqual({ open: true, projectId: null, catalogueId: "map-check/v2" });
    expect(parseHubHash("#hub/c/%E0%A4%A")).toEqual({ open: true, projectId: null });
  });

  it("keeps a setup request until the target project's workspace takes it once", () => {
    openMethodSetup({ projectId: "p1", methodKey: "project:m", workflowId: "w", recipeId: null });
    expect(hasMethodSetup("p2")).toBe(false);
    expect(takeMethodSetup("p2")).toBeNull();
    expect(hasMethodSetup("p1")).toBe(true);
    expect(takeMethodSetup("p1")).toMatchObject({ methodKey: "project:m", workflowId: "w" });
    expect(takeMethodSetup("p1")).toBeNull();
  });
});

describe("GAID hub registration", () => {
  it("selects the first folder when the folder list arrives after the dialog opened", async () => {
    const onRegister = vi.fn(async () => undefined);
    const props = { open: true, onOpenChange: () => undefined, onRegister };
    const { rerender } = render(<RegisterDialog {...props} folders={[]} />);
    rerender(<RegisterDialog {...props} folders={[{ id: "general", name: "일반" }]} />);
    const submit = screen.getByRole("button", { name: "허브에 등록" });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await vi.waitFor(() => expect(onRegister).toHaveBeenCalledWith("general", "", "patch"));
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractionRecord, Question, SourceDocument } from "@/geo/contracts/authoring";

import { QuestionStep, type DraftAnswer, type QuestionEvidence } from "../question-step";

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => localStorage.removeItem("gaid:locale"));

const source = (id: string, kind: SourceDocument["kind"], name: string): SourceDocument => ({
  id,
  kind,
  name,
  mediaType: "",
  sha256: "",
  size: 1,
  addedAt: "",
  status: "extracted",
});
const record = (sourceId: string, more: Partial<ExtractionRecord>): ExtractionRecord => ({
  sourceId,
  sourceSha256: "",
  tool: "",
  coveredPages: [],
  emptyPages: [],
  figures: [],
  characters: 1,
  at: "",
  ...more,
});
const base = {
  revision: 1,
  reason: "평가 방식이 달라집니다.",
  affects: "평가 단계",
  answerType: "choice-or-text" as const,
  materiality: "required" as const,
  status: "open" as const,
  attemptId: "a",
  draftRevision: 0,
  createdAt: "",
};
const QUESTIONS: Question[] = [
  {
    ...base,
    id: "q1",
    key: "block-size",
    text: "공간 block 크기를 어떻게 정할까요?",
    evidence: [
      { sourceId: "web", page: 1, quote: "spatial blocks of 50 km", verified: true },
      { sourceId: "web", page: 1, quote: "a sentence the source never had", verified: false },
    ],
    options: [
      { id: "paper", label: "논문 값 50 km" },
      {
        id: "code",
        label: "코드 설정 따르기",
        evidence: [{ sourceId: "code", path: "cv.py", quote: "block_size = 50_000", verified: true }],
      },
    ],
    recommendedOptionId: "paper",
  },
  { ...base, id: "q2", key: "trial-scale", text: "빠른 첫 시험용 줄인 설정을 함께 만들까요?", evidence: [], options: [{ id: "a", label: "포함" }, { id: "b", label: "제외" }] },
];

function Step({ evidence }: { evidence: QuestionEvidence }) {
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>({});
  return (
    <QuestionStep
      questions={QUESTIONS}
      answers={answers}
      onAnswer={(id, a) => setAnswers((cur) => ({ ...cur, [id]: a }))}
      onApply={() => undefined}
      evidence={evidence}
    />
  );
}

describe("authoring question evidence viewer", () => {
  it("shows the cited passage beside the question, moves to an option's passage and says what was not found", async () => {
    const pageText = vi.fn(async () => "Methods. We use spatial blocks of 50 km for evaluation.");
    const fileText = vi.fn(async () => "import numpy\n\nblock_size = 50_000\nfolds = 5\n");
    render(
      <Step
        evidence={{
          sources: [source("web", "web", "논문 웹 페이지"), source("code", "code", "cv-code.zip")],
          extractions: { web: record("web", { pages: 1 }), code: record("code", { files: [{ path: "cv.py", size: 1, sha256: "", text: true }] }) },
          standardKeys: ["trial-scale"],
          access: { pdfUrl: () => "", pageText, fileText },
        }}
      />,
    );
    const panel = screen.getByRole("complementary", { name: "근거 자료" });
    expect(within(panel).getByText("근거 3개")).toBeTruthy();
    // The first passage: the page text with the quote marked.
    const mark = await within(panel).findByText("spatial blocks of 50 km", { selector: "mark" });
    expect(mark).toBeTruthy();
    expect(pageText).toHaveBeenCalledWith("web", 1);

    // Choosing an option with its own passage moves the viewer to the code line.
    fireEvent.click(screen.getByRole("radio", { name: /코드 설정 따르기/ }));
    await waitFor(() => expect(fileText).toHaveBeenCalledWith("code", "cv.py"));
    const rows = within(panel).getAllByRole("button", { pressed: true });
    expect(rows[0].textContent).toContain("선택지: 코드 설정 따르기");
    // The quote above, and its line in the file marked.
    const line = (await within(panel).findAllByText("block_size = 50_000")).find((el) => el.tagName === "SPAN");
    expect(line?.parentElement?.className).toContain("bg-gaid-signal-tint");
    expect(line?.previousElementSibling?.textContent).toBe("3");

    // An unconfirmed quote is shown as such, and its page is not marked.
    fireEvent.click(within(panel).getByRole("button", { name: /확인 안 됨/ }));
    expect(await within(panel).findByText(/인용한 내용을 자료에서 찾지 못했습니다/)).toBeTruthy();
    await waitFor(() => expect(within(panel).queryByText("spatial blocks of 50 km", { selector: "mark" })).toBeNull());

    // GAID's own question cites no passage and says so.
    fireEvent.click(screen.getByRole("tab", { name: "질문 2" }));
    expect(
      within(screen.getByRole("complementary", { name: "근거 자료" })).getByText(/모든 Workflow에 묻는 질문/),
    ).toBeTruthy();
  });

  it("says when a cited source was removed from the draft", () => {
    render(
      <Step
        evidence={{ sources: [], extractions: {}, access: { pdfUrl: () => "", pageText: vi.fn(), fileText: vi.fn() } }}
      />,
    );
    const panel = screen.getByRole("complementary", { name: "근거 자료" });
    expect(within(panel).getAllByText("삭제한 자료").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/초안에서 삭제한 자료라/)).toBeTruthy();
  });
});

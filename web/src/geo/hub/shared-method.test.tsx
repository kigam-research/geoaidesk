import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureDraft } from "./fixtures";
import { SharedMethod, type SharedMethodView } from "./shared-method";

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => localStorage.removeItem("gaid:locale"));

const base: SharedMethodView = {
  id: "entry-test", title: "공유 방법", tagline: "자료를 확인합니다.", summary: "분석 지침입니다.",
  author: "연구자", folder: "탐사", revision: 1, registeredAt: "2026. 10. 18.", kind: "workflow",
  tags: [], stars: 0, starred: false, trials: 1, image: null, comments: [],
};
function show(implementation: SharedMethodView["implementation"]) {
  return render(<SharedMethod method={{ ...base, implementation }} profile={fixtureDraft().drafts[0].profile}
    flow={<div />} onStar={vi.fn()} onComment={vi.fn()} onTry={vi.fn()} />);
}

describe("shared method evidence labels", () => {
  it("explains instructions-only and identifies trial starts, not completed analyses", () => {
    show("descriptive");
    expect(screen.getByText("분석 지침만 · 실행 코드 없음")).toBeTruthy();
    expect(screen.getByText("시험하면 AI agent가 스킬 지침에 따라 분석 코드를 새로 씁니다.")).toBeTruthy();
    expect(screen.getByText("등록한 판으로 시작한 시험 1회 (검토 결과 아님)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내 프로젝트에서 시험" })).toBeTruthy();
  });

  it("shows supplied code availability without the code-writing hint", () => {
    show("implemented");
    expect(screen.getByText("실행 코드 포함")).toBeTruthy();
    expect(screen.queryByText("시험하면 AI agent가 스킬 지침에 따라 분석 코드를 새로 씁니다.")).toBeNull();
  });
});

describe("editing a registered method", () => {
  it("offers the author an edit and anyone else a copy, with the original and revision history", () => {
    const run = vi.fn();
    const onOpen = vi.fn();
    const profile = fixtureDraft().drafts[0].profile;
    const view = {
      ...base,
      basedOn: { title: "원본 방법", author: "김 연구원", revision: 2, onOpen },
      revisions: [
        { revision: 1, at: "2026. 10. 18.", by: "연구자", note: "" },
        { revision: 2, at: "2026. 10. 20.", by: "연구자", note: "구역 기준을 고쳤습니다." },
      ],
    };
    const { rerender } = render(<SharedMethod method={view} profile={profile} flow={<div />} onStar={vi.fn()}
      onComment={vi.fn()} onTry={vi.fn()} onEdit={{ mode: "edit", run }} />);
    fireEvent.click(screen.getByRole("button", { name: "Workflow 고치기" }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.getByText(/새 판으로 등록합니다/)).toBeTruthy();
    expect(screen.getByText(/김 연구원의 「원본 방법」 2판을 복사해 고친 Workflow입니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "원본 보기" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByText("판 기록 2개")).toBeTruthy();
    expect(screen.getByText("구역 기준을 고쳤습니다.")).toBeTruthy();
    rerender(<SharedMethod method={view} profile={profile} flow={<div />} onStar={vi.fn()}
      onComment={vi.fn()} onTry={vi.fn()} onEdit={{ mode: "copy", run }} />);
    expect(screen.getByRole("button", { name: "복사해서 고치기" })).toBeTruthy();
    expect(screen.getByText(/원본을 밝힌 별도 Workflow가 됩니다/)).toBeTruthy();
  });
});

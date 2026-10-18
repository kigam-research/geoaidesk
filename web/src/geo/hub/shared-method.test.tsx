import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("GAID 시험 시작 1회 (검토 결과 아님)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내 프로젝트에서 시험" })).toBeTruthy();
  });

  it("shows supplied code availability without the code-writing hint", () => {
    show("implemented");
    expect(screen.getByText("실행 코드 포함")).toBeTruthy();
    expect(screen.queryByText("시험하면 AI agent가 스킬 지침에 따라 분석 코드를 새로 씁니다.")).toBeNull();
  });
});

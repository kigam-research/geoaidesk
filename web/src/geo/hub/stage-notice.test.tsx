import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckResult } from "@/geo/contracts/authoring";
import { StageNotice } from "./stage-notice";

const check = (codes: string[]): CheckResult => ({
  ok: true,
  findings: codes.map((code, i) => ({
    check: "workflow",
    level: "warning",
    code,
    path: "workflow/steps",
    message: code === "workflow-stages" ? `Workflow 단계가 ${8 + i}개입니다.` : "다른 참고 사항",
  })),
} as unknown as CheckResult);

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => localStorage.removeItem("gaid:locale"));

describe("analysis-flow stage notice (gaid-workflow-stages)", () => {
  it("stays hidden without stage findings", () => {
    const { container } = render(<StageNotice check={check(["workflow-headings"])} onRevise={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the stage findings and sends one fixed regroup request through the revise path", async () => {
    const onRevise = vi.fn().mockResolvedValue(undefined);
    render(<StageNotice check={check(["workflow-stages", "workflow-headings"])} onRevise={onRevise} />);
    expect(screen.getByRole("heading", { name: "Workflow 단계 구성 확인" })).toBeInTheDocument();
    expect(screen.getByText("확인할 점 1개")).toBeInTheDocument();
    expect(screen.queryByText("다른 참고 사항")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "분석 흐름으로 단계 나누기" }));
    await waitFor(() => expect(onRevise).toHaveBeenCalledOnce());
    const feedback = onRevise.mock.calls[0][0] as string;
    expect(feedback).toMatch(/3~5단계/);
    expect(feedback).toMatch(/하나도 빼지 말고/);
    expect(feedback).toContain("- Workflow 단계가 8개입니다.");
  });

  it("keeps the raw failure behind technical detail", async () => {
    render(<StageNotice check={check(["workflow-stages"])} onRevise={vi.fn().mockRejectedValue(new Error("HTTP 409"))} />);
    fireEvent.click(screen.getByRole("button", { name: "분석 흐름으로 단계 나누기" }));
    expect(await screen.findByText("단계 나누기를 시작하지 못했습니다.")).toBeInTheDocument();
  });
});

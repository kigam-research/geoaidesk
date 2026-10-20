import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { parseWorkflowBlock, type WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { WorkflowBlockCard } from "./workflow-card";
import { workflowStartMessage } from "./render";

const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "legacy", id: "well-qc", title: { ko: "검층 점검", en: "Well-log QC" }, revision: 2, purpose: null,
  inputRoles: [{ id: "log", label: { ko: "검층 파일" }, formats: ["las-welllog"], required: true }],
  choices: [{ id: "depth", label: { ko: "심도 기준" }, options: ["MD", "TVD"] }],
  skills: [{ name: "well-log-qc-quicklook", source: "catalogue", role: "primary" }],
  steps: [{ id: "intake", title: { ko: "파일 확인" }, does: { ko: "LAS 판과 단위를 확인합니다." }, skill: "well-log-qc-quicklook", checks: [], choiceIds: [], outputs: [] }],
  artifacts: [], boundary: null, instructions: null,
};

beforeEach(() => { window.localStorage.clear(); Object.defineProperty(navigator, "languages", { configurable: true, value: ["ko-KR"] }); });

describe("Workflow start message", () => {
  it("puts the 지침 with the researcher's settings in a <workflow> block", () => {
    const message = workflowStartMessage(doc, { log: "logs/A.LAS" }, { depth: "MD" });
    const block = parseWorkflowBlock(message);
    expect(block).toMatchObject({ id: "well-qc", revision: 2, title: "검층 점검", tail: "" });
    expect(block!.body).toContain("- 검층 파일: logs/A.LAS");
    expect(block!.body).toContain("- 심도 기준: MD");
    expect(block!.body).toContain("1. 파일 확인: LAS 판과 단위를 확인합니다.");
  });

  it("shows the Workflow as a card that opens the 지침", async () => {
    const block = parseWorkflowBlock(`${workflowStartMessage(doc, {}, {})}\n\n북쪽 구간만 보세요.`)!;
    render(<WorkflowBlockCard block={block} />);
    const toggle = screen.getByRole("button", { name: /Workflow · 검층 점검 · 2판/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("북쪽 구간만 보세요.")).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/LAS 판과 단위를 확인합니다/)).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { parseWorkflowBlock, type WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { WorkflowBlockCard } from "./workflow-card";
import { workflowStartMessage } from "./render";

const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "legacy", id: "well-qc", title: { ko: "검층 점검", en: "Well-log QC" }, version: "0.1.1", purpose: null,
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
    expect(block).toMatchObject({ id: "well-qc", version: "0.1.1", title: "검층 점검", tail: "" });
    expect(block!.body).toContain("- 검층 파일: logs/A.LAS");
    expect(block!.body).toContain("- 심도 기준: MD");
    expect(block!.body).toContain("1. 파일 확인: LAS 판과 단위를 확인합니다.");
  });

  it("shows the Workflow as a card that opens the 지침", async () => {
    const block = parseWorkflowBlock(`${workflowStartMessage(doc, {}, {})}\n\n북쪽 구간만 보세요.`)!;
    render(<WorkflowBlockCard block={block} />);
    const toggle = screen.getByRole("button", { name: /Workflow · 검층 점검 · version 0.1.1/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("북쪽 구간만 보세요.")).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/LAS 판과 단위를 확인합니다/)).toBeInTheDocument();
  });
});

describe("pending Workflow in the composer", () => {
  it("shows the card with a remove action and keeps the sent message parseable with attached paths after it", async () => {
    const { PendingWorkflowChip } = await import("./workflow-card");
    const block = workflowStartMessage(doc, { log: "logs/A.LAS" }, {});
    let removed = false;
    render(<PendingWorkflowChip block={block} onRemove={() => { removed = true; }} />);
    expect(screen.getByRole("button", { name: /Workflow · 검층 점검 · version 0.1.1/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Workflow 빼기" }));
    expect(removed).toBe(true);
    // chat-tab sends `${block}\n\n${typed text + attached paths + context}`.
    const sent = `${block}\n\n북쪽만\nlogs/A.LAS`;
    expect(parseWorkflowBlock(sent)).toMatchObject({ id: "well-qc", tail: "북쪽만\nlogs/A.LAS" });
  });
});

describe("chat labels", () => {
  it("names a Workflow start in tab and history labels", async () => {
    const { commandPreview } = await import("@/lib/command-blocks");
    const block = workflowStartMessage(doc, {}, {});
    expect(commandPreview(block)).toBe("Workflow · 검층 점검");
    expect(commandPreview(`${block}\n\n북쪽만 보세요.\nlogs/A.LAS`)).toBe("Workflow · 검층 점검 — 북쪽만 보세요.");
  });
});

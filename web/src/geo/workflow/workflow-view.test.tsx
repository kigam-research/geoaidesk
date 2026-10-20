import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { WorkflowView, WorkflowInstructions } from "./workflow-view";
import { workflowDocText } from "./render";
import { fixtureDraft } from "@/geo/hub/fixtures";

export const doc: WorkflowDoc = {
  schemaVersion: "gaid-workflow/v1", kind: "structured", id: "test", title: { ko: "격자 분석" }, revision: 2, purpose: { ko: "입력 격자를 확인합니다." },
  inputRoles: [{ id: "grid", label: { ko: "격자 표" }, formats: ["csv"], required: true }],
  choices: [{ id: "split", label: { ko: "블록 크기" }, options: ["small", "large"], optionLabels: { small: { ko: "작은 블록" }, large: { ko: "큰 블록" } } }, { id: "seed", label: { ko: "시드" } }],
  skills: [{ name: "grid", source: "bundled", role: "primary", purpose: { ko: "격자 검사" } }, { name: "extra", source: "imported", ref: "owner/repo#v1", role: "supporting" }],
  steps: [{ id: "input", title: { ko: "입력 검사" }, does: { ko: "열과 결측값을 확인합니다." }, skill: "grid", read: { ko: "자료 계약" }, checks: [{ ko: "열 이름 확인" }], choiceIds: ["split", "seed"], outputs: ["report"] }],
  artifacts: [{ id: "report", label: { ko: "검사 보고서" }, required: true, files: ["report.csv"] }], boundary: { ko: "자원량을 추정하지 않습니다." }, instructions: { ko: "원본을 보존하세요." },
};
beforeEach(() => { localStorage.setItem("gaid:locale", "ko"); });
it("shows all steps, skills with sources, choice options and output files; reads the bundled instructions on request", async () => {
  const load = vi.fn().mockResolvedValue({ content: "# 격자 지침\n원본을 보존합니다." });
  render(<WorkflowView doc={doc} loadSkillSource={load} />);
  expect(screen.getByText("1. 입력 검사")).toBeInTheDocument();
  expect(screen.getByText("열 이름 확인")).toBeInTheDocument();
  fireEvent.click(screen.getByText("사용하는 스킬 (2)"));
  expect(screen.getByText("Workflow에 딸린 스킬")).toBeInTheDocument();
  expect(screen.getByText(/가져온 스킬 · owner\/repo#v1/)).toBeInTheDocument();
  expect(load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "지침 보기" }));
  expect(await screen.findByLabelText("SKILL.md")).toHaveTextContent("원본을 보존합니다.");
  fireEvent.click(screen.getByText("입력과 연구자가 정할 조건"));
  expect(screen.getByText("작은 블록")).toBeVisible();
  expect(screen.getByText("큰 블록")).toBeVisible();
  fireEvent.click(screen.getByText("결과 파일과 해석 한계"));
  expect(screen.getByText("report.csv")).toBeVisible();
});
it("copies exactly the chat renderer with current settings, including unresolved choices", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const settings = { inputs: { grid: "user_data/my.csv" }, choices: { split: "small" } };
  render(<WorkflowInstructions doc={doc} target="chat" settings={settings} />);
  fireEvent.click(screen.getByText("AI agent가 받는 지침 보기"));
  fireEvent.click(screen.getByRole("button", { name: "지침 복사" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(workflowDocText(doc, "chat", settings)));
  expect(writeText.mock.calls[0][0]).toContain("user_data/my.csv");
  expect(writeText.mock.calls[0][0]).toContain("정하지 않은 조건: 시드");
});
it("derives flow decision marks from choiceIds and keeps the existing concept picture renderer", () => {
  const { container } = render(<WorkflowView doc={doc} profile={fixtureDraft().drafts[0].profile} visuals={{ input: { src: "/concept.png", kind: "generated", caption: "검사 그림" } }} />);
  expect(screen.getByRole("button", { name: /입력 검사.*직접 정함/ })).toBeInTheDocument();
  expect(screen.getByText(/검사 그림/)).toBeInTheDocument();
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/concept.png");
});
it("labels legacy documents without rewriting them", () => {
  render(<WorkflowView doc={{ ...doc, kind: "legacy" }} />);
  expect(screen.getByText(/이전 형식입니다/)).toBeInTheDocument();
});

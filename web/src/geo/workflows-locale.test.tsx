import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import upstream from "@/data/workflows.json";
import ko from "./locales/workflows/ko.json";
import en from "./locales/workflows/en.json";
import { formatMessage } from "./icu";
import { GEO_CATALOGUES } from "./locales";
import { WorkflowLaunchDialog, WorkflowsPanel, WORKFLOW_CATEGORIES, workflowDisplayText, workflowMatchesSearch, type Workflow } from "@/components/workflows-panel";

vi.mock("@/components/model-selector", () => ({
  DEFAULT_MODEL: { id: "test/model", name: "Test model" },
  ModelSelector: () => <div />,
  modelUsesBillableBudget: () => true,
}));
vi.mock("@/lib/use-models", () => ({ useModels: () => ({ modelAvailability: () => "available", models: [] }) }));
vi.mock("@/lib/app-settings", () => ({ useAppDefaults: () => null }));

beforeEach(() => localStorage.setItem("gaid:locale", "ko"));
afterEach(() => localStorage.removeItem("gaid:locale"));

describe("upstream workflow locale contract", () => {
  it("covers every upstream row and input with exact English and nonempty Korean", () => {
    expect(Object.keys(ko.rows).sort()).toEqual(upstream.map((row) => row.id).sort());
    expect(Object.keys(en.rows).sort()).toEqual(upstream.map((row) => row.id).sort());
    for (const row of upstream) {
      expect(row.id).not.toContain(".");
      const key = row.id as keyof typeof en.rows;
      expect(en.rows[key].name, row.id).toBe(row.name);
      expect(en.rows[key].description, row.id).toBe(row.description);
      expect(ko.rows[key].name, row.id).toMatch(/[가-힣]/);
      expect(ko.rows[key].description, row.id).toMatch(/[가-힣]/);
      expect(Object.keys(ko.rows[key].inputs).sort()).toEqual(row.placeholders.map((input) => input.key).sort());
      expect(en.rows[key].inputs).toEqual(Object.fromEntries(row.placeholders.map((input) => [input.key, input.label])));
      for (const input of row.placeholders) {
        expect(input.key).not.toContain(".");
        expect((ko.rows[key].inputs as Record<string, string>)[input.key], `${row.id}.${input.key}`).toMatch(/[가-힣]/);
      }
    }
  });

  it("formats every row message without interpreting source punctuation as ICU", () => {
    for (const locale of ["ko", "en"] as const) {
      for (const [id, message] of Object.entries(GEO_CATALOGUES.workflows[locale])) {
        if (!id.startsWith("rows.")) continue;
        expect(formatMessage(message, locale, {}), id).toBe(message);
      }
    }
  });

  it("looks up translated categories at use time and retains future rows' source text", () => {
    expect(WORKFLOW_CATEGORIES[0].label).toBe("논문·원고");
    localStorage.setItem("gaid:locale", "en");
    expect(WORKFLOW_CATEGORIES[0].label).toBe("Paper & Manuscript");
    localStorage.setItem("gaid:locale", "ko");
    const future = { ...upstream[0], id: "future-upstream-row", name: "Future workflow", description: "New source description" };
    expect(workflowDisplayText(future, "name", future.name)).toBe(future.name);
    expect(workflowDisplayText(future, "description", future.description)).toBe(future.description);
    expect(workflowDisplayText(future, "inputs.future", "New source input")).toBe("New source input");
  });

  it("matches Korean and English row names and descriptions", () => {
    const row = upstream[0];
    for (const query of ["논문 검토", "방법론", "review a paper", "statistical rigor"]) {
      expect(workflowMatchesSearch(row, query), query).toBe(true);
    }
    expect(workflowMatchesSearch(row, "단일세포")).toBe(false);
  });

  it("searches translated rows, opens a Korean launch dialog, and leaves the model prompt unchanged", () => {
    const onLaunch = vi.fn();
    render(<WorkflowsPanel onLaunch={onLaunch} />);
    fireEvent.change(screen.getByPlaceholderText("워크플로 검색..."), { target: { value: "논문 작성" } });
    fireEvent.click(screen.getByRole("button", { name: /^논문 작성/ }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("제공한 자료나 결과로 논문 전체 초안을 작성합니다.")).toBeVisible();
    expect(dialog.getByText("프로젝트 sandbox")).toBeVisible();
    fireEvent.change(dialog.getByPlaceholderText("논문 주제·제목"), { target: { value: "Sedimentary basins" } });
    fireEvent.click(dialog.getByRole("button", { name: "워크플로 실행" }));
    const row = upstream.find((row) => row.id === "write-paper")!;
    expect(onLaunch.mock.calls[0][0]).toContain(row.prompt.replaceAll("{topic}", "Sedimentary basins"));
  });

  it("retains original optional placeholder labels inside the English model prompt", () => {
    const workflow = upstream.find((row) => row.id === "write-results")! as Workflow;
    const onLaunch = vi.fn();
    render(<WorkflowLaunchDialog workflow={workflow} open onOpenChange={vi.fn()} onLaunch={onLaunch} />);
    expect(screen.getByPlaceholderText("강조할 결과(선택)")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "워크플로 실행" }));
    expect(onLaunch.mock.calls[0][0]).toContain("[Specific results to emphasize (optional)]");
  });
});

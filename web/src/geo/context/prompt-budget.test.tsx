import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GeoPromptBudget } from "./prompt-budget";

const apiFetch = vi.fn();
vi.mock("@/lib/projects", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

function budget(estimatedTokens: number, contextWindow: number, maxOutputTokens = 8192) {
  const remainingTokens = contextWindow - estimatedTokens - maxOutputTokens;
  return {
    schemaVersion: "gaid-prompt-budget/v1",
    model: { ref: "gaid-local/qwen3", contextWindow, maxOutputTokens },
    initialPrompt: { systemPromptChars: 0, toolSchemaChars: 0, tools: 31, estimatedTokens, method: "chars/4" },
    skills: { mode: "catalogue", exposed: 15, installed: 15 },
    remainingTokens,
    remainingFraction: remainingTokens / contextWindow,
    observed: null,
  };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  apiFetch.mockReset();
  Object.defineProperty(navigator, "languages", { value: ["ko-KR"], configurable: true });
});
afterEach(() => vi.restoreAllMocks());

describe("GeoPromptBudget", () => {
  it("previews a new chat before the first message and warns when little context is left", async () => {
    apiFetch.mockImplementation((path: string) => {
      if (path.startsWith("/geo/context/preview")) {
        return json({ exposure: { mode: "catalogue" }, budget: budget(20_000, 32_768) });
      }
      if (path === "/geo/catalogue") {
        return json({ status: { state: "ready" }, workflows: [{ id: "well-log-qc", title: { ko: "검층 QC" } }] });
      }
      if (path === "/geo/context/settings") return json({ newChatExposure: "catalogue" });
      throw new Error(`unexpected ${path}`);
    });
    render(<GeoPromptBudget projectId="p1" sessionId={null} modelRef="gaid-local/qwen3" />);
    const chip = await screen.findByRole("button", { name: "시작 프롬프트 예산" });
    expect(chip).toHaveTextContent("시작 프롬프트 ≈20.0k");
    expect(apiFetch).toHaveBeenCalledWith("/geo/context/preview?model=gaid-local%2Fqwen3", {}, "p1");

    fireEvent.click(chip);
    expect(await screen.findByText(/남는 양이 context의 절반보다 적습니다/)).toBeInTheDocument();
    const select = await screen.findByRole("combobox");
    expect(screen.getByRole("option", { name: "워크플로: 검층 QC" })).toBeInTheDocument();

    apiFetch.mockImplementationOnce(() => json({ newChatExposure: "workflow:well-log-qc" }));
    fireEvent.change(select, { target: { value: "workflow:well-log-qc" } });
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/geo/context/settings",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ newChatExposure: "workflow:well-log-qc" }) }),
        "p1",
      ),
    );
  });

  it("reads an existing chat's own budget", async () => {
    apiFetch.mockImplementation(() =>
      json({ exposure: { mode: "all" }, budget: { ...budget(12_000, 200_000), skills: { mode: "all", exposed: 3, installed: 3 } } }),
    );
    render(<GeoPromptBudget projectId="p1" sessionId="s-1" />);
    const chip = await screen.findByRole("button");
    expect(chip).toHaveTextContent("≈12.0k");
    expect(apiFetch).toHaveBeenCalledWith("/geo/context?sessionId=s-1", {}, "p1");
  });
});

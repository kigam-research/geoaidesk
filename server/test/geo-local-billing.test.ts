import { describe, expect, it } from "vitest";
import { billingCountsTowardBudget, billingForProvider } from "../src/cost/billing.ts";
import { emptySnapshot, recordRun, sessionCostSummary } from "../src/cost/ledger.ts";
import { createProject } from "../src/projects.ts";
import { customModelForClient, type CustomProviderListing } from "../src/agent/custom-models.ts";
import { makeSubagentLedgerExtension } from "../src/agent/subagent-bridge.ts";

describe("GAID local billing consumers", () => {
  it("keeps zero-priced generic custom servers cap-counted and the picker consistent", () => {
    for (const id of ["gaid-local", "other-local"]) {
      const provider = { id, baseUrl: "http://localhost/v1" } as CustomProviderListing;
      const model = { id: "qwen/trial", name: "Trial", input: ["text"], contextWindow: 65536,
        cost: { input: 0, output: 0 }, reasoning: false } as any;
      const billing = billingForProvider(id);
      expect(billingCountsTowardBudget(billing)).toBe(id !== "gaid-local");
      expect(customModelForClient(model, provider).billingMode).toBe(billing.billingMode);
    }
  });

  it("infers local billing for legacy ledger callers without an explicit context", () => {
    const { id } = createProject({ name: "GAID inferred billing" });
    const entry = recordRun({ projectId: id, sessionId: "legacy", model: "gaid-local/qwen/trial",
      before: emptySnapshot(), after: { ...emptySnapshot(), costUsd: 1, input: 10, total: 10 } });
    expect(entry).toMatchObject({ provider: "gaid-local", authType: "local", billingMode: "local",
      costUsd: 0, listPriceUsd: 1, totalTokens: 10 });
  });

  it("classifies unmetered child completion as local without borrowing parent billing", async () => {
    const { id } = createProject({ name: "GAID legacy child" });
    const handlers: Record<string, (event: any) => any> = {};
    makeSubagentLedgerExtension(id, () => "parent", () => ({ provider: "openrouter", id: "paid" } as any), () => false)({
      on: (name: string, handler: any) => { handlers[name] = handler; }, events: { on: () => {} },
    } as any);
    await handlers.tool_result({ toolName: "subagent", details: { results: [{ modelAttempts: [
      { model: "gaid-local/qwen/trial", usage: { input: 30, output: 10, cost: 1 } },
    ] }] } });
    const summary = sessionCostSummary("parent", id);
    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0]).toMatchObject({ billingMode: "local", authType: "local", costUsd: 0, listPriceUsd: 1 });
  });
});

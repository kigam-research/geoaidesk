import { describe, expect, it } from "vitest";
import type { Model } from "@/components/model-selector";
import type { ModelAvailability } from "@/lib/use-models";
import { isSupersededLegacyModel, pickStartModel } from "./start-model";

const model = (id: string, extra: Partial<Model> = {}): Model => ({
  id, label: id, provider: "p", tier: "high", context_length: 1, pricing: { prompt: 0, completion: 0 }, modality: null,
  description: "", ...extra,
});
const astraRouter = model("openrouter/openai/gpt-6-astra", { label: "GPT-6 Astra", tier: "flagship", billingMode: "payg", available: false });
// The review app's picker in the acceptance trial (ChatGPT sign-in, the legacy Codex login and a MiniMax key).
const reviewApp = [
  astraRouter,
  model("openai/gpt-4", { tier: "flagship", billingMode: "subscription" }),
  model("openai/gpt-6-astra", { label: "GPT-6 Astra", tier: "flagship", billingMode: "subscription" }),
  model("openai/gpt-6.1-sol", { label: "GPT-6.1 Sol", billingMode: "subscription" }),
  model("openai-codex/gpt-6-astra", { label: "GPT-6 Astra", tier: "flagship", billingMode: "subscription" }),
  model("openai-codex/gpt-6.1-sol", { label: "GPT-6.1 Sol", billingMode: "subscription" }),
  model("minimax/MiniMax-M3", { billingMode: "payg" }),
];
const availabilityOf = (models: Model[], checking = false) => (m: Pick<Model, "id">): ModelAvailability => {
  if (checking) return "checking";
  const found = models.find((x) => x.id === m.id);
  return found ? (found.available === false ? "unavailable" : "available") : "unavailable";
};

describe("start model for a chat that has not run (gaid-first-use-fixes)", () => {
  it("keeps a connected choice and waits while providers are still being discovered", () => {
    const sol = reviewApp[3];
    expect(pickStartModel(sol, reviewApp, availabilityOf(reviewApp))).toBe(sol);
    expect(pickStartModel(astraRouter, reviewApp, availabilityOf(reviewApp, true))).toBe("wait");
  });

  it("moves the unconnected OpenRouter default to the same model on the ChatGPT sign-in", () => {
    expect(pickStartModel(astraRouter, reviewApp, availabilityOf(reviewApp))?.valueOf()).toMatchObject({ id: "openai/gpt-6-astra" });
  });

  it("otherwise takes the strongest connected chat model, subscriptions before keys before local servers", () => {
    const keyAndLocal = [astraRouter, model("ollama/qwen3", { tier: "budget", billingMode: "local" }), model("minimax/MiniMax-M2.7", { tier: "mid", billingMode: "payg" }),
      model("minimax/MiniMax-M3", { tier: "high", billingMode: "payg" })];
    expect(pickStartModel(astraRouter, keyAndLocal, availabilityOf(keyAndLocal))).toMatchObject({ id: "minimax/MiniMax-M3" });
    const localOnly = [astraRouter, model("openai/gpt-realtime-2.1", { tier: "flagship", billingMode: "subscription", available: false }),
      model("gaid-local/qwen3-96k", { tier: "mid", billingMode: "local" })];
    expect(pickStartModel(astraRouter, localOnly, availabilityOf(localOnly))).toMatchObject({ id: "gaid-local/qwen3-96k" });
    expect(pickStartModel(astraRouter, [astraRouter], availabilityOf([astraRouter]))).toBeNull();
  });

  it("hides a legacy Codex row only when the ChatGPT sign-in offers the same model", () => {
    expect(isSupersededLegacyModel(reviewApp[5], reviewApp)).toBe(true);
    expect(isSupersededLegacyModel(reviewApp[3], reviewApp)).toBe(false);
    const legacyOnly = [model("openai-codex/gpt-6.1-sol"), model("openai/gpt-6.1-sol", { available: false })];
    expect(isSupersededLegacyModel(legacyOnly[0], legacyOnly)).toBe(false);
  });
});

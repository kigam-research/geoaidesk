import type { Model } from "@/components/model-selector";
import type { ModelAvailability } from "@/lib/use-models";

/**
 * Model choices for a chat that has not run yet (gaid-first-use-fixes). In the acceptance trial every new chat started
 * on the built-in default "GPT-6 Astra" through OpenRouter, shown as not connected, although the researcher was signed
 * in with ChatGPT, which offers the same model.
 */

type Availability = (model: Pick<Model, "id">) => ModelAvailability;

const BILLING_RANK: Record<string, number> = { subscription: 0, metered_oauth: 1, payg: 1, local: 2 };
const TIER_RANK: Record<Model["tier"], number> = { flagship: 0, high: 1, mid: 2, budget: 3 };
/** Catalogue entries that are not chat models. */
const NOT_CHAT = /realtime|audio|tts|transcri|whisper|embed|image|moderation|search-preview/i;

const modelKey = (id: string) => id.slice(id.lastIndexOf("/") + 1).toLowerCase();
const billingRank = (m: Model) => BILLING_RANK[m.billingMode ?? "payg"] ?? 1;

/** True while the provider lists that decide availability have not all arrived. */
function discoveryPending(availability: Availability): boolean {
  return ["openrouter/~", "~/~", "ollama/~", "openai-compatible/~"].some((id) => availability({ id }) === "checking");
}

/**
 * The legacy "OpenAI Codex" login lists the same models as "Sign in with ChatGPT"; with both connected the picker
 * showed every GPT model twice under the same name. A legacy row is hidden when the newer login offers that model.
 */
export function isSupersededLegacyModel(model: Model, models: Model[]): boolean {
  if (!model.id.startsWith("openai-codex/") || model.available === false) return false;
  const twin = `openai/${model.id.slice("openai-codex/".length)}`;
  return models.some((m) => m.id === twin && m.available !== false);
}

/**
 * The model a not-yet-run chat should start on: `target` when it can run, else the same model through a connected
 * source (subscription first), else the strongest connected chat model, subscriptions before pay-as-you-go before
 * local servers. "wait" while availability is still being discovered; null when nothing is connected (the chat then
 * shows its connect-a-model card).
 */
export function pickStartModel(target: Model, models: Model[], availability: Availability): Model | null | "wait" {
  const own = availability(target);
  if (own === "available") return target;
  if (own === "checking" || discoveryPending(availability)) return "wait";
  const usable = models
    .map((model, index) => ({ model, index }))
    .filter(({ model }) => !model.isFusion && model.id !== target.id && availability(model) === "available");
  const byBilling = (a: { model: Model; index: number }, b: { model: Model; index: number }) =>
    billingRank(a.model) - billingRank(b.model) || a.index - b.index;
  const same = usable.filter(({ model }) => modelKey(model.id) === modelKey(target.id)).sort(byBilling);
  if (same.length) return same[0].model;
  const chat = usable
    .filter(({ model }) => !NOT_CHAT.test(model.id))
    .sort((a, b) => billingRank(a.model) - billingRank(b.model) || TIER_RANK[a.model.tier] - TIER_RANK[b.model.tier] || a.index - b.index);
  return chat[0]?.model ?? null;
}

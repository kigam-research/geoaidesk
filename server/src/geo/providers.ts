/**
 * GAID additions to Pi's built-in providers, registered once at startup (session-registry, after setupModelRuntime).
 *
 * MiniMax M3.1 Flash Preview (user direction 2026-10-16): Pi 1.0–1.3 list only MiniMax-M2.7, -M2.7-highspeed and -M3.
 * MiniMax documents `MiniMax-M3.1-Flash-Preview` for M Plan subscription keys (and MiniMax Code) on the
 * Anthropic-compatible endpoint with a 1M context (platform.minimax.io/docs/api-reference/api-overview,
 * docs/m-plan/claude-code). It is added to the `minimax` provider with the same shape as MiniMax-M3 and cost 0: the
 * model is plan-only, so usage draws on the subscription quota rather than per-token USD.
 */
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";

export const MINIMAX_M31_FLASH_PREVIEW = "MiniMax-M3.1-Flash-Preview";

export function registerGeoProviderModels(runtime: Pick<ModelRuntime, "registerProvider" | "getModels">): void {
  // registerProvider replaces the provider's model list, so the current (built-in) models are carried over.
  const current = runtime.getModels("minimax").filter((m) => m.id !== MINIMAX_M31_FLASH_PREVIEW);
  runtime.registerProvider("minimax", {
    models: [
      ...current.map((m) => ({ ...m, type: "chat" as const })),
      {
        id: MINIMAX_M31_FLASH_PREVIEW,
        name: "MiniMax M3.1 Flash Preview (M Plan)",
        api: "anthropic-messages",
        baseUrl: "https://api.minimax.io/anthropic",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1_000_000,
        maxTokens: 512_000,
        inputLimits: { images: { resize: { maxWidth: 2000, maxHeight: 2000, maxBytes: 4_718_592, jpegQuality: 80 } } },
      },
    ],
  });
}

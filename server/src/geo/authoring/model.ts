/**
 * Coauthor model calls through GAID's own model runtime (the connections in Settings → Providers, custom
 * servers such as kigam-qwen, the local model). Every response is ledgered before it is validated; the
 * project spend cap of the `default` project applies. Replies are validated by the caller, never trusted.
 */
import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, ThinkingLevel } from "@earendil-works/pi-ai";
import { DEFAULT_PROJECT_ID } from "../../config.ts";
import { billingCountsTowardBudget, billingForModel } from "../../cost/billing.ts";
import { emptySnapshot, isBudgetExceeded, recordRun } from "../../cost/ledger.ts";
import { assertModelAuthentication, configuredDefaultRef, modelReference, resolveModel } from "../../agent/models.ts";
import { getModelRegistry, getModelRuntime } from "../../agent/session-registry.ts";
import { AuthoringError } from "./store.ts";

/** Ledger session id of GAID hub authoring calls (in the `default` project). */
export const AUTHORING_LEDGER_SESSION = "gaid-hub-authoring";
export const THINKING_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export type AuthoringThinking = (typeof THINKING_LEVELS)[number];

export interface ModelConfig {
  /** Canonical model ref (`provider/model`). */
  ref: string;
  thinkingLevel: AuthoringThinking;
  timeoutMs: number;
  maxTokens: number;
}

export function modelConfig(ref?: string, thinkingLevel?: string): ModelConfig {
  const level = THINKING_LEVELS.find((l) => l === thinkingLevel);
  return {
    ref: ref?.trim() || configuredDefaultRef(),
    thinkingLevel: level ?? "medium",
    timeoutMs: Number(process.env.GAID_AUTHORING_TIMEOUT_MS || 15 * 60_000),
    maxTokens: Number(process.env.GAID_AUTHORING_MAX_TOKENS || 32_000),
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  finishReason?: string;
  usage?: { input?: number; output?: number; costUsd?: number };
}

export type ChatFn = (messages: ChatMessage[], config: ModelConfig) => Promise<ChatResult>;

type Complete = (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => Promise<AssistantMessage>;

/**
 * The provider-neutral context: the system message, then one user message. A repair turn (an earlier reply
 * plus the validation errors) is folded into that user message as a transcript, so no provider-specific
 * assistant message has to be reconstructed.
 */
export function toContext(messages: ChatMessage[]): Context {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const content =
    turns.length === 1
      ? turns[0].content
      : turns
          .map((m, i) =>
            m.role === "assistant"
              ? `## Your previous reply\n${m.content}`
              : i === 0
                ? m.content
                : `## Correction request\n${m.content}`,
          )
          .join("\n\n");
  return { systemPrompt: system, messages: [{ role: "user", content, timestamp: Date.now() }] };
}

/** Resolve the model and refuse before any call when it is not connected or the cap is reached. */
export async function preflight(config: ModelConfig): Promise<{ model: Model<Api> }> {
  if (config.ref.startsWith("fusion/"))
    throw new AuthoringError("Fusion 모델은 저작에 쓸 수 없습니다. 다른 모델을 고르세요.", 400);
  let model: Model<Api>;
  try {
    model = resolveModel(config.ref, getModelRegistry());
  } catch (e) {
    throw new AuthoringError(`모델을 찾지 못했습니다: ${(e as Error).message}`, 400);
  }
  try {
    await assertModelAuthentication(model, getModelRuntime());
  } catch (e) {
    throw new AuthoringError(`모델이 연결되지 않았습니다: ${(e as Error).message}`, 401);
  }
  const billing = await billingForModel(model, getModelRuntime());
  if (billingCountsTowardBudget(billing) && isBudgetExceeded(DEFAULT_PROJECT_ID).exceeded)
    throw new AuthoringError("기본 프로젝트의 지출 한도에 도달해 모델을 호출하지 않았습니다.", 402);
  return { model };
}

/** Default transport: GAID's runtime `completeSimple` with the attempt's thinking level and a timeout. */
export function runtimeChat(complete?: Complete): ChatFn {
  return async (messages, config) => {
    const model = resolveModel(config.ref, getModelRegistry());
    const runtime = getModelRuntime();
    const billing = await billingForModel(model, runtime);
    if (billingCountsTowardBudget(billing) && isBudgetExceeded(DEFAULT_PROJECT_ID).exceeded)
      throw new AuthoringError("기본 프로젝트의 지출 한도에 도달해 모델을 호출하지 않았습니다.", 402);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let message: AssistantMessage;
    try {
      const call: Complete = complete ?? ((m, c, o) => runtime.completeSimple(m, c, o));
      message = await call(model, toContext(messages), {
        maxTokens: config.maxTokens,
        reasoning: config.thinkingLevel as ThinkingLevel,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const usage = message.usage;
    const entry = recordRun({
      projectId: DEFAULT_PROJECT_ID,
      sessionId: AUTHORING_LEDGER_SESSION,
      role: "agent",
      model: modelReference(model),
      billing,
      before: emptySnapshot(),
      after: {
        costUsd: usage.cost.total,
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        total: usage.totalTokens,
      },
    });
    if (message.stopReason === "error" || message.stopReason === "aborted")
      throw new Error(
        message.stopReason === "aborted" && controller.signal.aborted
          ? `응답이 ${Math.round(config.timeoutMs / 60_000)}분 안에 끝나지 않았습니다`
          : message.errorMessage || `model stopped (${message.stopReason})`,
      );
    const content = message.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");
    return {
      content,
      finishReason: message.stopReason === "length" ? "length" : message.stopReason,
      usage: { input: usage.input, output: usage.output, costUsd: entry?.costUsd ?? usage.cost.total },
    };
  };
}

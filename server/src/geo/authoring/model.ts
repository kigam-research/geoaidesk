/**
 * Coauthor model calls through GAID's own model runtime (the connections in Settings → Providers, custom
 * servers such as kigam-qwen, the local model). Every response is ledgered before it is validated; the
 * project spend cap of the `default` project applies. Replies are validated by the caller, never trusted.
 */
import type { Api, AssistantMessage, Context, Message, Model, SimpleStreamOptions, TextContent, ThinkingLevel } from "@earendil-works/pi-ai";
import { getOpenAICodexWebSocketDebugStats } from "@earendil-works/pi-ai/api/openai-codex-responses";
import { DEFAULT_PROJECT_ID } from "../../config.ts";
import { billingCountsTowardBudget, billingForModel } from "../../cost/billing.ts";
import { emptySnapshot, isBudgetExceeded, recordRun } from "../../cost/ledger.ts";
import { assertModelAuthentication, configuredDefaultRef, modelReference, resolveModel } from "../../agent/models.ts";
import { getModelRegistry, getModelRuntime } from "../../agent/session-registry.ts";
import { cachePlan, markSourcesBoundary, rawUsageOf, summarisePayload, type CachePlan, type PayloadSummary } from "./cache.ts";
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
  /**
   * Stable prompt-cache key (the authoring project id): providers that cache by session (ChatGPT Codex backend, OpenAI,
   * OpenRouter affinity) reuse the shared prefix of one project's calls (instructions and sources).
   */
  cacheKey?: string;
  /**
   * How a repair sends the earlier reply: `fold` puts it and the correction after the task in the same user message;
   * `native` keeps the provider's own assistant message (reasoning items, signatures) and adds a user turn. Unset: the
   * path's default (`historyFor`).
   */
  history?: HistoryMode;
  /** Gap between the project's two latest model-call starts (ms): the retention predictor (see cache.ts). */
  recentGapMs?: number;
}

export type HistoryMode = "fold" | "native";

/** Override from `GAID_AUTHORING_HISTORY` (measurements); unset keeps the per-path default. */
export function historyMode(value = process.env.GAID_AUTHORING_HISTORY): HistoryMode | undefined {
  return value === "native" || value === "fold" ? value : undefined;
}

/**
 * Per-path repair history. The legacy Codex backend continues an exact extension of the previous request on the same
 * WebSocket (`previous_response_id` + input delta), so the native reply is not sent again: a repair after a 9.5K-token
 * reply sent 233 uncached input tokens against 8,714 folded (probe 2026-10-24). Elsewhere the reply is sent again either
 * way and native history adds the reasoning items, so the fold stays.
 */
export function historyFor(path: CachePlan["path"]): HistoryMode {
  return path === "openai-codex" ? "native" : "fold";
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
  /** This user message is the sources block: the end of the prefix every call of the project shares. */
  cacheBoundary?: boolean;
  /** The provider's own reply, for native history (never written to records). */
  native?: AssistantMessage;
}

/** Pi-normalised usage: `input` excludes cache reads and writes, so the request's whole input is their sum. */
export interface ChatUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  costUsd?: number;
}

/** What one model call did, for the attempt record: path, payload shape, raw and normalised usage, timing. */
export interface CallRecord {
  provider: string;
  model: string;
  api: string;
  /** Pi credential type (`oauth`, `api_key`, `local` …) and the cache path it implies. */
  auth: string;
  cache: CachePlan;
  history: HistoryMode;
  startedAt: string;
  /** ms from the start to the HTTP response, to the first provider stream event, and to the end. */
  responseMs?: number;
  firstEventMs?: number;
  ms: number;
  responseId?: string;
  requestId?: string;
  stopReason: string;
  usage: { input: number; cacheRead: number; cacheWrite: number; cacheWrite1h?: number; output: number; reasoning?: number; total: number };
  rawUsage?: Record<string, unknown>;
  payload?: PayloadSummary;
  /** Codex WebSocket: whether the call reused the open connection and sent only an input delta. */
  transport?: { connectionReused: boolean; delta: boolean; sseFallback: boolean };
}

export interface ChatResult {
  content: string;
  finishReason?: string;
  usage?: ChatUsage;
  native?: AssistantMessage;
  call?: CallRecord;
}

export type ChatFn = (messages: ChatMessage[], config: ModelConfig) => Promise<ChatResult>;

type Complete = (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => Promise<AssistantMessage>;

/**
 * The provider context: the system message, then the user turns as separate text blocks of one user message (the sources
 * block first, so a provider can cache up to its end). A repair turn is folded into that message as a transcript (the earlier
 * reply and the correction as two more blocks), or, in `native` mode with the provider's own reply at hand, sent as that
 * assistant message followed by a user turn.
 */
export function toContext(messages: ChatMessage[], mode: HistoryMode = "fold", model?: Pick<Model<Api>, "provider" | "api" | "id">): Context {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const out: Message[] = [];
  let blocks: TextContent[] = [];
  let seenAssistant = false;
  const flush = () => {
    if (blocks.length) out.push({ role: "user", content: blocks, timestamp: Date.now() });
    blocks = [];
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    const native =
      m.role === "assistant" &&
      mode === "native" &&
      m.native &&
      (!model || (m.native.provider === model.provider && m.native.api === model.api && m.native.model === model.id))
        ? m.native
        : undefined;
    if (native) {
      flush();
      out.push(native);
      seenAssistant = false;
      continue;
    }
    if (m.role === "assistant") {
      blocks.push({ type: "text", text: `## Your previous reply\n${m.content}` });
      seenAssistant = true;
    } else blocks.push({ type: "text", text: seenAssistant ? `## Correction request\n${m.content}` : m.content });
  }
  flush();
  return { systemPrompt: system, messages: out };
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

/** Default transport: GAID's runtime `completeSimple` with the attempt's thinking level, a timeout and the cache plan. */
export function runtimeChat(complete?: Complete): ChatFn {
  return async (messages, config) => {
    const model = resolveModel(config.ref, getModelRegistry());
    const runtime = getModelRuntime();
    const billing = await billingForModel(model, runtime);
    if (billingCountsTowardBudget(billing) && isBudgetExceeded(DEFAULT_PROJECT_ID).exceeded)
      throw new AuthoringError("기본 프로젝트의 지출 한도에 도달해 모델을 호출하지 않았습니다.", 402);
    const plan = cachePlan(model, billing.authType, config.recentGapMs);
    const history = config.history ?? historyFor(plan.path);
    const sources = messages.find((m) => m.cacheBoundary)?.content ?? "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const started = Date.now();
    const wsBefore = config.cacheKey && model.api === "openai-codex-responses" ? getOpenAICodexWebSocketDebugStats(config.cacheKey) : undefined;
    let payload: PayloadSummary | undefined;
    let rawUsage: Record<string, unknown> | undefined;
    let responseMs: number | undefined;
    let firstEventMs: number | undefined;
    let requestId: string | undefined;
    let message: AssistantMessage;
    try {
      const call: Complete = complete ?? ((m, c, o) => runtime.completeSimple(m, c, o));
      message = await call(model, toContext(messages, history, model), {
        maxTokens: config.maxTokens,
        reasoning: config.thinkingLevel as ThinkingLevel,
        signal: controller.signal,
        cacheRetention: plan.retention,
        ...(config.cacheKey ? { sessionId: config.cacheKey } : {}),
        onPayload: (body) => {
          if (sources) markSourcesBoundary(body, plan, sources);
          payload = summarisePayload(body, sources, config.cacheKey);
          return undefined;
        },
        onResponse: (response) => {
          responseMs = Date.now() - started;
          const h = response.headers ?? {};
          requestId = h["x-request-id"] ?? h["request-id"] ?? h["x-oai-request-id"];
        },
        onProviderStreamEvent: (event) => {
          firstEventMs ??= Date.now() - started;
          rawUsage = rawUsageOf(event, rawUsage);
        },
      } as SimpleStreamOptions);
    } finally {
      clearTimeout(timer);
    }
    const usage = message.usage;
    const wsAfter = config.cacheKey && model.api === "openai-codex-responses" ? getOpenAICodexWebSocketDebugStats(config.cacheKey) : undefined;
    const record: CallRecord = {
      provider: model.provider,
      model: model.id,
      api: model.api,
      auth: billing.authType,
      cache: plan,
      history,
      startedAt: new Date(started).toISOString(),
      ...(responseMs !== undefined ? { responseMs } : {}),
      ...(firstEventMs !== undefined ? { firstEventMs } : {}),
      ms: Date.now() - started,
      ...(message.responseId ? { responseId: message.responseId } : {}),
      ...(requestId ? { requestId } : {}),
      stopReason: message.stopReason,
      usage: {
        input: usage.input,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        ...(usage.cacheWrite1h ? { cacheWrite1h: usage.cacheWrite1h } : {}),
        output: usage.output,
        ...(usage.reasoning !== undefined ? { reasoning: usage.reasoning } : {}),
        total: usage.totalTokens,
      },
      ...(rawUsage ? { rawUsage } : {}),
      ...(payload ? { payload } : {}),
      ...(wsAfter
        ? {
            transport: {
              connectionReused: wsAfter.connectionsReused > (wsBefore?.connectionsReused ?? 0),
              delta: wsAfter.deltaRequests > (wsBefore?.deltaRequests ?? 0),
              sseFallback: wsAfter.sseFallbacks > (wsBefore?.sseFallbacks ?? 0),
            },
          }
        : {}),
    };
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
        cacheWrite: usage.cacheWrite,
        total: usage.totalTokens,
      },
    });
    if (message.stopReason === "error" || message.stopReason === "aborted")
      throw Object.assign(
        new Error(
          message.stopReason === "aborted" && controller.signal.aborted
            ? `응답이 ${Math.round(config.timeoutMs / 60_000)}분 안에 끝나지 않았습니다`
            : message.errorMessage || `model stopped (${message.stopReason})`,
        ),
        { call: record },
      );
    const content = message.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n");
    return {
      content,
      finishReason: message.stopReason === "length" ? "length" : message.stopReason,
      usage: {
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        costUsd: entry?.costUsd ?? usage.cost.total,
      },
      native: message,
      call: record,
    };
  };
}

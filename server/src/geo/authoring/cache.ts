/**
 * Prompt-cache handling of authoring calls, per provider path (gaid-authoring-cache, docs/design/hub-authoring-service.md
 * "Prompt cache"). Every call of one authoring project starts with the same instructions and the sources block; this
 * module decides where the cache boundary goes and with which retention, marks it in Pi's final provider payload, and
 * summarises that payload and the provider's raw usage for the call record.
 *
 * Paths (Pi 1.0.0):
 * - `openai-api`: OpenAI Responses with an API key. GPT-5.6+ models (`supportsExplicitPromptCacheMode`) take an explicit
 *   `prompt_cache_breakpoint` on the sources block; their default 30-minute TTL is kept (Pi's "long" only re-sends 30m and
 *   12h writes cost 2× input). Older models get Pi's "long" = `prompt_cache_retention: "24h"`, which has no write premium.
 * - `openai-chatgpt` (Sign in with ChatGPT) and `openai-codex` (legacy Codex login): Pi omits every cache option as
 *   unsupported and the Codex backend refuses `prompt_cache_breakpoint` ("not supported on this model", probe 2026-10-24).
 *   Their implicit cache reuses a shared leading prefix under the cache key, so nothing is added.
 * - `anthropic`: Pi marks the system block(s) and the last user block; a third marker goes on the sources block (at most
 *   four per request). Retention follows the project's measured call gaps (`anthropicRetention`).
 * - `other`: nothing is changed; providers with automatic prefix caching (vLLM, MiniMax, Ollama) need a stable prefix only.
 */
import crypto from "node:crypto";
import type { Api, CacheRetention, Model } from "@earendil-works/pi-ai";

export type CachePath = "openai-api" | "openai-chatgpt" | "openai-codex" | "anthropic" | "other";

export interface CachePlan {
  path: CachePath;
  /** Mark the end of the sources block explicitly in the payload. */
  boundary: "explicit" | "implicit";
  /** Pi `cacheRetention` for the call. */
  retention: CacheRetention;
  /** Why this retention (for the call record). */
  reason: string;
  /**
   * Warm the sources before an operation's first call: the path's implicit cache keeps an entry only at the end of a
   * request's input and a later request reuses it only when it diverges within a few tokens of that end (probe
   * 2026-10-24: a 30-token tail after the sources was reused, 400 tokens and more never). The warm-up's entry ends right
   * after the sources, so every later operation of the project reads them while it lives (`ttlMs`, measured).
   */
  prewarm?: { ttlMs: number };
}

/** A legacy Codex entry was still read 20 minutes after it was written (probe 2026-10-24; longer gaps not measured). */
export const CODEX_WARM_TTL_MS = 20 * 60_000;

/** Anthropic's short TTL: a later call that reuses the sources after this gap pays the write again. */
export const ANTHROPIC_SHORT_TTL_MS = 5 * 60_000;

export function cachePath(model: Pick<Model<Api>, "provider" | "api" | "baseUrl">, authType: string): CachePath {
  if (model.api === "openai-codex-responses") return "openai-codex";
  if (model.api === "openai-responses" && model.provider === "openai")
    return authType === "oauth" ? "openai-chatgpt" : "openai-api";
  if (model.api === "anthropic-messages" && model.provider === "anthropic") return "anthropic";
  return "other";
}

/**
 * Anthropic retention from the project's own call history: the sources entry is reused by the next call, so 1h (write
 * 2× input instead of 1.25×, reads refresh it) pays when the gap between consecutive calls has been longer than the 5-minute
 * TTL. With n later reuses and a share f of gaps over 5 minutes, 1h saves f·n·1.15 − 0.75 input-equivalents of the sources;
 * a recent gap over 5 minutes is the predictor. Without history (the first call) the short TTL is used.
 */
export function anthropicRetention(recentGapMs: number | undefined): { retention: CacheRetention; reason: string } {
  if (recentGapMs === undefined) return { retention: "short", reason: "first call of the project: 5m" };
  if (recentGapMs > ANTHROPIC_SHORT_TTL_MS)
    return { retention: "long", reason: `previous gap ${Math.round(recentGapMs / 1000)} s > 5 min: 1h` };
  return { retention: "short", reason: `previous gap ${Math.round(recentGapMs / 1000)} s <= 5 min: 5m` };
}

export function cachePlan(
  model: Pick<Model<Api>, "provider" | "api" | "baseUrl" | "compat">,
  authType: string,
  recentGapMs?: number,
): CachePlan {
  const path = cachePath(model, authType);
  const compat = (model.compat ?? {}) as { supportsExplicitPromptCacheMode?: boolean; supportsLongCacheRetention?: boolean };
  switch (path) {
    case "openai-api":
      return compat.supportsExplicitPromptCacheMode
        ? { path, boundary: "explicit", retention: "short", reason: "explicit breakpoint, default 30m TTL" }
        : compat.supportsLongCacheRetention === false
          ? { path, boundary: "implicit", retention: "short", reason: "model has no long retention" }
          : { path, boundary: "implicit", retention: "long", reason: "24h retention (no write premium)" };
    case "anthropic": {
      const r = anthropicRetention(recentGapMs);
      return { path, boundary: "explicit", ...r };
    }
    case "openai-codex":
      return {
        path,
        boundary: "implicit",
        retention: "short",
        reason: "subscription path: cache options and breakpoints unsupported; sources warmed",
        prewarm: { ttlMs: CODEX_WARM_TTL_MS },
      };
    case "openai-chatgpt":
      return { path, boundary: "implicit", retention: "short", reason: "subscription path: cache options unsupported" };
    default:
      return { path, boundary: "implicit", retention: "short", reason: "provider default" };
  }
}

/** One content block of the final payload as recorded: size and the cache marker on it. */
export interface PayloadBlock {
  chars: number;
  marker?: string;
}

export interface PayloadSummary {
  api: string;
  /** Leading instructions (system / developer / `instructions`) size. */
  instructionsChars: number;
  items: { role: string; blocks: PayloadBlock[] }[];
  /** Cache markers in the request (Anthropic: at most 4; OpenAI: at most 4 explicit breakpoints). */
  markers: number;
  /** Where the sources block ended up and whether it carries the boundary. */
  sources?: { item: number; block: number; marker?: string };
  /** sha256 (12 hex) of instructions + sources: equal values mean an identical cacheable prefix. */
  prefixSha?: string;
  cacheKeySha?: string;
  promptCache?: Record<string, unknown>;
  previousResponseId?: boolean;
}

type Json = Record<string, any>;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

function blockText(b: unknown): string | undefined {
  if (typeof b === "string") return b;
  if (b && typeof b === "object" && typeof (b as Json).text === "string") return (b as Json).text;
  return undefined;
}

function blockMarker(b: unknown): string | undefined {
  if (!b || typeof b !== "object") return undefined;
  const o = b as Json;
  if (o.prompt_cache_breakpoint) return `breakpoint:${o.prompt_cache_breakpoint.mode ?? "explicit"}`;
  if (o.cache_control) return `cache_control:${o.cache_control.ttl ?? "5m"}`;
  return undefined;
}

/** The message list of a payload (OpenAI `input`, Anthropic `messages`) and its leading instructions text. */
function messagesOf(payload: Json): { list: Json[]; instructions: string } {
  if (Array.isArray(payload.input)) {
    const list = payload.input as Json[];
    const lead = list[0] && (list[0].role === "developer" || list[0].role === "system") ? list[0] : undefined;
    const text = typeof payload.instructions === "string" ? payload.instructions : lead ? (blockText(lead.content) ?? (Array.isArray(lead.content) ? lead.content.map(blockText).join("") : "")) : "";
    return { list: lead ? list.slice(1) : list, instructions: text };
  }
  const system = Array.isArray(payload.system) ? payload.system.map(blockText).join("\n") : typeof payload.system === "string" ? payload.system : "";
  return { list: Array.isArray(payload.messages) ? payload.messages : [], instructions: system };
}

function contentBlocks(m: Json): unknown[] {
  return Array.isArray(m.content) ? m.content : m.content === undefined ? [] : [m.content];
}

/** The sources block as Pi sent it (Pi replaces lone surrogates, which keeps the length). */
function isSources(b: unknown, sources: string): boolean {
  const text = blockText(b);
  return text === sources || (text !== undefined && text.length === sources.length && text.slice(0, 256) === sources.slice(0, 256));
}

/** Find the sources block: the first block of the first user item whose text is the sources text. */
function findSources(list: Json[], sources: string): { item: number; block: number } | undefined {
  const first = list.findIndex((m) => m.role === "user");
  if (first < 0) return undefined;
  const blocks = contentBlocks(list[first]);
  const block = blocks.findIndex((b) => isSources(b, sources));
  return block < 0 ? undefined : { item: first, block };
}

function countMarkers(payload: Json): number {
  const { list } = messagesOf(payload);
  let n = 0;
  for (const s of Array.isArray(payload.system) ? payload.system : []) if (blockMarker(s)) n++;
  for (const t of Array.isArray(payload.tools) ? payload.tools : []) if (t?.cache_control) n++;
  for (const m of list) for (const b of contentBlocks(m)) if (blockMarker(b)) n++;
  return n;
}

/**
 * Put the cache boundary at the end of the sources block of Pi's final payload, when the plan asks for an explicit one.
 * The payload is changed in place. A missing sources block (text changed by Pi) leaves the payload as it is; the summary
 * then shows no marker on the sources.
 */
export function markSourcesBoundary(payload: unknown, plan: CachePlan, sources: string): void {
  if (plan.boundary !== "explicit" || !payload || typeof payload !== "object") return;
  const p = payload as Json;
  const { list } = messagesOf(p);
  const at = findSources(list, sources);
  if (!at) return;
  const m = list[at.item];
  if (!Array.isArray(m.content)) return;
  const block = m.content[at.block];
  if (!block || typeof block !== "object" || blockMarker(block)) return;
  if (plan.path === "openai-api") {
    if (countMarkers(p) >= 4) return;
    block.prompt_cache_breakpoint = { mode: "explicit" };
  } else if (plan.path === "anthropic") {
    if (countMarkers(p) >= 4) return;
    // Entries with a longer TTL must come first: with "long" Pi marked the system 1h; the sources take the same TTL and the
    // volatile last block keeps the 5-minute one.
    block.cache_control = plan.retention === "long" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" };
    // Pi's own message marker (the last user block; an effort message may follow it) keeps the short TTL.
    if (plan.retention === "long")
      for (const m of list)
        for (const b of contentBlocks(m))
          if (b !== block && b && typeof b === "object" && (b as Json).cache_control?.ttl === "1h")
            (b as Json).cache_control = { type: "ephemeral" };
  }
}

export function summarisePayload(payload: unknown, sources: string, cacheKey?: string): PayloadSummary | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Json;
  const { list, instructions } = messagesOf(p);
  const at = findSources(list, sources);
  const items = list.map((m) => ({
    role: String(m.role ?? m.type ?? "item"),
    blocks: contentBlocks(m).map((b) => ({ chars: blockText(b)?.length ?? 0, ...(blockMarker(b) ? { marker: blockMarker(b) } : {}) })),
  }));
  const promptCache = Object.fromEntries(
    Object.entries({ retention: p.prompt_cache_retention, options: p.prompt_cache_options }).filter(([, v]) => v !== undefined),
  );
  return {
    api: Array.isArray(p.input) ? "responses" : "messages",
    instructionsChars: instructions.length,
    items,
    markers: countMarkers(p),
    ...(at ? { sources: { ...at, ...(blockMarker(contentBlocks(list[at.item])[at.block]) ? { marker: blockMarker(contentBlocks(list[at.item])[at.block]) } : {}) } } : {}),
    ...(at ? { prefixSha: sha(`${instructions}\u0000${sources}`) } : {}),
    ...(cacheKey ? { cacheKeySha: sha(cacheKey) } : {}),
    ...(Object.keys(promptCache).length ? { promptCache } : {}),
    ...(p.previous_response_id ? { previousResponseId: true } : {}),
  };
}

/** The provider's own usage object from a raw stream event (OpenAI Responses / Codex / Anthropic / chat completions). */
export function rawUsageOf(event: unknown, previous?: Json): Json | undefined {
  if (!event || typeof event !== "object") return previous;
  const e = event as Json;
  const usage = e.response?.usage ?? e.message?.usage ?? e.usage;
  if (!usage || typeof usage !== "object") return previous;
  // Anthropic splits usage over message_start and message_delta; later values win.
  return { ...(previous ?? {}), ...usage };
}

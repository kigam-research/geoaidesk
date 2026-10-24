/**
 * Prompt-cache boundary of hub authoring calls (gaid-authoring-cache): the sources block is its own content block, the
 * explicit boundary lands on it in Pi's final provider payload where the path supports one, retention follows the
 * per-path policy, and the call record keeps cache reads and writes.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeContext, type Api, type AssistantMessage, type Model } from "@earendil-works/pi-ai";
import { streamSimple as anthropicStream } from "@earendil-works/pi-ai/api/anthropic-messages";
import { streamSimple as codexStream } from "@earendil-works/pi-ai/api/openai-codex-responses";
import { streamSimple as openaiStream } from "@earendil-works/pi-ai/api/openai-responses";
import { resolveModel } from "../src/agent/models.ts";
import { getModelRegistry } from "../src/agent/session-registry.ts";
import { anthropicRetention, cachePlan, markSourcesBoundary, rawUsageOf, summarisePayload } from "../src/geo/authoring/cache.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { toContext, type CallRecord, type ChatFn, type ChatMessage } from "../src/geo/authoring/model.ts";
import { analysis, cleanup, config, draftReply, fixture, testVocabulary } from "./helpers/geo-authoring.ts";

afterEach(cleanup);

const SOURCES = `## Sources\n${"Page 1: the paper text. ".repeat(40)}`;
const messages: ChatMessage[] = [
  { role: "system", content: "Shared authoring instructions." },
  { role: "user", content: SOURCES, cacheBoundary: true },
  { role: "user", content: "# Task\nWrite the draft." },
];
const repair: ChatMessage[] = [
  ...messages,
  { role: "assistant", content: '{"slug": "x"}' },
  { role: "user", content: "Fix the slug." },
];

const fakeJwt = (claims: object) =>
  ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");

/** Run Pi's adapter (on the transcript ModelRuntime builds) up to the request: mark the boundary in onPayload, capture the payload, stop before any network. */
async function payloadOf(
  stream: (m: Model<Api>, c: ReturnType<typeof toContext>, o: object) => { result(): Promise<AssistantMessage> },
  model: Model<Api>,
  apiKey: string,
  authType: string,
  recentGapMs?: number,
  chat: ChatMessage[] = messages,
) {
  const plan = cachePlan(model, authType, recentGapMs);
  let captured: any;
  const reply = await stream(model, normalizeContext(toContext(chat, "fold", model)) as never, {
    apiKey,
    cacheRetention: plan.retention,
    sessionId: "ap-test",
    onPayload: (p: unknown) => {
      markSourcesBoundary(p, plan, SOURCES);
      captured = structuredClone(p);
      throw new Error("stop before the request");
    },
  }).result();
  expect(reply.errorMessage).toContain("stop before the request");
  return { plan, payload: captured, summary: summarisePayload(captured, SOURCES, "ap-test")! };
}

describe("GAID hub authoring prompt cache", () => {
  const registry = getModelRegistry();

  it("sends the sources as their own first block and folds a repair after the task", () => {
    const context = toContext(repair);
    expect(context.systemPrompt).toBe("Shared authoring instructions.");
    expect(context.messages).toHaveLength(1);
    const blocks = context.messages[0].content as { text: string }[];
    expect(blocks.map((b) => b.text)).toEqual([
      SOURCES,
      "# Task\nWrite the draft.",
      '## Your previous reply\n{"slug": "x"}',
      "## Correction request\nFix the slug.",
    ]);
  });

  it("keeps the provider's own reply as native history only for the same model", () => {
    const model = resolveModel("openai-codex/gpt-6.1-sol", registry);
    const native = { role: "assistant", api: model.api, provider: model.provider, model: model.id, content: [{ type: "text", text: "{}" }] } as unknown as AssistantMessage;
    const chat: ChatMessage[] = [...messages, { role: "assistant", content: "{}", native }, { role: "user", content: "Fix the slug." }];
    const context = toContext(chat, "native", model);
    expect(context.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(context.messages[1]).toBe(native);
    expect((context.messages[2].content as { text: string }[])[0].text).toBe("Fix the slug.");
    // Another model's reply cannot be sent back natively: it is folded.
    const other = toContext(chat, "native", resolveModel("openai/gpt-6.1-sol", registry));
    expect(other.messages).toHaveLength(1);
  });

  it("puts an explicit breakpoint on the sources block for OpenAI API-key GPT-5.6+ models", async () => {
    const model = resolveModel("openai/gpt-6.1-sol", registry);
    const { plan, payload, summary } = await payloadOf(openaiStream as never, model, "sk-test", "api_key");
    expect(plan).toMatchObject({ path: "openai-api", boundary: "explicit", retention: "short" });
    const user = payload.input.find((i: any) => i.role === "user");
    expect(user.content[0]).toMatchObject({ type: "input_text", text: SOURCES, prompt_cache_breakpoint: { mode: "explicit" } });
    expect(user.content[1].prompt_cache_breakpoint).toBeUndefined();
    expect(payload.prompt_cache_key).toBe("ap-test");
    expect(summary.sources?.marker).toBe("breakpoint:explicit");
    expect(summary.markers).toBe(1);
  });

  it("adds nothing on the subscription paths, where Pi omits the cache options and Codex refuses breakpoints", async () => {
    const signIn = await payloadOf(openaiStream as never, resolveModel("openai/gpt-6.1-sol", registry), "chatgpt-access-token", "oauth");
    expect(signIn.plan).toMatchObject({ path: "openai-chatgpt", boundary: "implicit" });
    expect(signIn.summary.markers).toBe(0);
    expect(signIn.payload.prompt_cache_options).toBeUndefined();
    expect(signIn.payload.prompt_cache_key).toBe("ap-test");
    const jwt = fakeJwt({ "https://api.openai.com/auth": { chatgpt_account_id: "acct" } });
    const codex = await payloadOf(codexStream as never, resolveModel("openai-codex/gpt-6.1-sol", registry), jwt, "oauth");
    expect(codex.plan).toMatchObject({ path: "openai-codex", boundary: "implicit" });
    expect(codex.summary.markers).toBe(0);
    expect(codex.summary.sources).toMatchObject({ item: 0, block: 0 });
    expect(codex.payload.prompt_cache_key).toBe("ap-test");
  });

  it("marks the Anthropic sources block within the four-marker limit, 1h only after a long gap", async () => {
    const model = resolveModel("anthropic/claude-opus-5-5", registry);
    const short = await payloadOf(anthropicStream as never, model, "sk-ant-api-test", "api_key");
    const user = short.payload.messages[0];
    expect(user.content[0]).toMatchObject({ text: SOURCES, cache_control: { type: "ephemeral" } });
    expect(user.content[0].cache_control.ttl).toBeUndefined();
    expect(short.summary.markers).toBeLessThanOrEqual(4);
    expect(short.summary.markers).toBe(3); // system, sources, Pi's last block
    // OAuth adds Pi's identity block: still at most four.
    const oauth = await payloadOf(anthropicStream as never, model, "sk-ant-oat-test", "oauth", undefined, repair);
    expect(oauth.summary.markers).toBe(4);
    expect(oauth.payload.messages[0].content[0].cache_control).toBeDefined();
    // After a gap longer than the 5-minute TTL: system and sources 1h (longer TTLs first), the volatile tail 5m.
    const long = await payloadOf(anthropicStream as never, model, "sk-ant-api-test", "api_key", 6 * 60_000);
    expect(long.plan.retention).toBe("long");
    expect(long.payload.system[0].cache_control.ttl).toBe("1h");
    const blocks = long.payload.messages[0].content;
    expect(blocks[0].cache_control.ttl).toBe("1h");
    expect(blocks.at(-1).cache_control).toEqual({ type: "ephemeral" });
  });

  it("chooses Anthropic retention from the measured gap and reads raw usage from stream events", () => {
    expect(anthropicRetention(undefined).retention).toBe("short");
    expect(anthropicRetention(4 * 60_000).retention).toBe("short");
    expect(anthropicRetention(6 * 60_000).retention).toBe("long");
    const start = rawUsageOf({ type: "message_start", message: { usage: { input_tokens: 10, cache_creation_input_tokens: 900, cache_read_input_tokens: 0 } } });
    expect(rawUsageOf({ type: "message_delta", usage: { output_tokens: 5 } }, start)).toEqual({
      input_tokens: 10,
      cache_creation_input_tokens: 900,
      cache_read_input_tokens: 0,
      output_tokens: 5,
    });
    expect(rawUsageOf({ type: "response.completed", response: { usage: { input_tokens: 30, input_tokens_details: { cached_tokens: 20 } } } })).toMatchObject({ input_tokens: 30 });
  });

  it("keeps cache reads and writes on the attempt and passes the gap since the project's previous call", async () => {
    const { dir, store, projectId } = await fixture();
    const seen: { messages: ChatMessage[]; gap?: number }[] = [];
    const replies = [analysis, { ...draftReply, slug: "" }, draftReply];
    const chat: ChatFn = async (messages, c) => {
      seen.push({ messages: messages.map((m) => ({ ...m })), gap: c.recentGapMs });
      const call = { startedAt: new Date().toISOString(), ms: 5, cache: { path: "other" }, usage: { input: 7, cacheRead: 90, cacheWrite: 3, output: 5, total: 105 } } as unknown as CallRecord;
      return { content: JSON.stringify(replies.shift()), finishReason: "stop", usage: { input: 7, cacheRead: 90, cacheWrite: 3, output: 5 }, call };
    };
    const deps = { chat, config, vocabulary: testVocabulary() };
    const analyzed = await runOperation(store, projectId, "analyze", "op-cache-a", deps);
    expect(analyzed.usage).toMatchObject({ input: 7, cacheRead: 90, cacheWrite: 3, output: 5 });
    expect(analyzed.calls).toHaveLength(1);
    // The sources are their own message, marked as the cache boundary, and the task follows.
    expect(seen[0].messages.map((m) => [m.role, !!m.cacheBoundary])).toEqual([["system", false], ["user", true], ["user", false]]);
    expect(seen[0].messages[1].content.startsWith("## Sources\n")).toBe(true);
    expect(seen[0].messages[2].content.startsWith("# Task\n")).toBe(true);
    expect(seen[0].gap).toBeUndefined();
    const drafted = await runOperation(store, projectId, "draft", "op-cache-d", deps);
    expect(drafted.outcome, JSON.stringify(drafted.validationErrors)).toBe("repaired");
    // The repair adds its call: usage sums both, the record file keeps both call records.
    expect(drafted.usage).toMatchObject({ input: 14, cacheRead: 180, cacheWrite: 6, output: 10 });
    expect(drafted.calls).toHaveLength(2);
    expect(seen[1].gap).toBeGreaterThanOrEqual(0);
    expect(seen[2].gap).toBeGreaterThanOrEqual(0);
    expect(seen[1].messages[1].content).toBe(seen[0].messages[1].content);
    const record = JSON.parse(await readFile(join(dir, "projects", projectId, drafted.record!), "utf8"));
    expect(record.calls).toHaveLength(2);
    expect(record.messages.some((m: { native?: unknown }) => m.native)).toBe(false);
  });
});


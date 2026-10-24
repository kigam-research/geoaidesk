/**
 * Prompt-cache probe on one model: which request shapes let a second call reuse the sources prefix of the first.
 * Each sequence starts its system prompt with a fresh nonce, so no sequence can hit an entry another one wrote.
 *
 * Usage (from server/): KADY_PI_AGENT_DIR=~/.geoaidesk/pi-agent KADY_PROJECTS_ROOT=<run>/projects \
 *   npx tsx ../reports/2026-10-24-gaid-authoring-cache/measure/probe.mts --record <attempt.json> --out <result.jsonl> \
 *   [--model openai-codex/gpt-6.1-sol] [--thinking high] [--only string,blocks,...]
 * <attempt.json> is an authoring attempt record; its user message up to "\n\n# Task\n" is the sources text.
 */
import "../../../server/src/env.ts";
import crypto from "node:crypto";
import fs from "node:fs";
import { parseArgs } from "node:util";

const { getModelRegistry, getModelRuntime } = await import("../../../server/src/agent/session-registry.ts");
const { resolveModel } = await import("../../../server/src/agent/models.ts");
const { getOpenAICodexWebSocketDebugStats } = await import(
  // The copy the model runtime uses (pi-coding-agent's own pi-ai): the counters are module state.
  new URL("../../../server/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/api/openai-codex-responses.js", import.meta.url).href
);

const { values } = parseArgs({
  options: {
    record: { type: "string" },
    out: { type: "string" },
    model: { type: "string", default: "openai-codex/gpt-6.1-sol" },
    thinking: { type: "string", default: "high" },
    only: { type: "string" },
    draft: { type: "string" },
  },
});
const record = JSON.parse(fs.readFileSync(values.record!, "utf8"));
const system: string = record.messages[0].content;
const user: string = record.messages[1].content;
// Records of this unit carry the sources as their own message; older ones as the start of one user message.
const S = record.messages[2]?.role === "user" ? user : user.slice(0, user.indexOf("\n\n# Task\n"));
const T1 = "# Task\nReply with exactly this JSON and nothing else: {\"probe\": 1}";
const T2 = "# Task\nReply with exactly this JSON and nothing else: {\"probe\": \"second\", \"ok\": true}";
const T3 = "# Task\nReply with exactly this JSON and nothing else: {\"probe\": 3}";

const runtime = getModelRuntime();
const model = resolveModel(values.model!, getModelRegistry());
const out = fs.createWriteStream(values.out!, { flags: "a" });

type Block = { text: string; breakpoint?: boolean };
type Turn = { role: "user"; blocks: Block[] } | { role: "assistant"; message: unknown };

async function send(seq: string, step: string, nonce: string, turns: Turn[], opts: { breakpoint?: boolean; string?: boolean } = {}) {
  const sessionId = `probe-${nonce}`;
  const messages = turns.map((t) =>
    t.role === "assistant"
      ? t.message
      : {
          role: "user",
          content: opts.string ? t.blocks.map((b) => b.text).join("\n\n") : t.blocks.map((b) => ({ type: "text", text: b.text })),
          timestamp: Date.now(),
        },
  );
  const marks = new Set(turns.flatMap((t) => (t.role === "user" ? t.blocks.filter((b) => b.breakpoint).map((b) => b.text) : [])));
  let payloadSummary: unknown;
  let rawUsage: unknown;
  let firstEvent: number | undefined;
  let responseAt: number | undefined;
  let requestId: string | undefined;
  const t0 = Date.now();
  const message = (await runtime.completeSimple(
    model,
    { systemPrompt: `[probe ${nonce}]\n${system}`, messages } as never,
    {
      reasoning: values.thinking as never,
      sessionId,
      maxTokens: 2000,
      onPayload: (payload: any) => {
        if (opts.breakpoint)
          for (const item of payload.input ?? [])
            for (const c of Array.isArray(item.content) ? item.content : [])
              if (c.type === "input_text" && marks.has(c.text)) c.prompt_cache_breakpoint = { mode: "explicit" };
        payloadSummary = {
          keys: Object.keys(payload).sort(),
          previous_response_id: payload.previous_response_id,
          input: (payload.input ?? []).map((i: any) => ({
            type: i.type ?? "message",
            role: i.role,
            blocks: Array.isArray(i.content) ? i.content.map((c: any) => ({ type: c.type, chars: c.text?.length, bp: c.prompt_cache_breakpoint })) : undefined,
          })),
          prefixSha: crypto.createHash("sha256").update(JSON.stringify(payload.instructions ?? "") + S).digest("hex").slice(0, 12),
        };
        return payload;
      },
      onResponse: (r: any) => {
        responseAt = Date.now();
        requestId = r.headers?.["x-request-id"] ?? r.headers?.["x-oai-request-id"];
      },
      onProviderStreamEvent: (e: any) => {
        firstEvent ??= Date.now();
        const resp = e?.response;
        if (resp?.usage) rawUsage = resp.usage;
      },
    } as never,
  )) as any;
  const row = {
    seq,
    step,
    nonce,
    model: values.model,
    api: model.api,
    at: new Date(t0).toISOString(),
    ms: Date.now() - t0,
    firstEventMs: firstEvent ? firstEvent - t0 : undefined,
    responseMs: responseAt ? responseAt - t0 : undefined,
    responseId: message.responseId,
    requestId,
    stop: message.stopReason,
    error: message.errorMessage,
    usage: { input: message.usage.input, cacheRead: message.usage.cacheRead, cacheWrite: message.usage.cacheWrite, output: message.usage.output },
    rawUsage,
    payload: payloadSummary,
    ws: getOpenAICodexWebSocketDebugStats(sessionId),
    text: message.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("").slice(0, 80),
  };
  out.write(`${JSON.stringify(row)}\n`);
  console.log(seq, step, JSON.stringify(row.usage), row.stop, row.error ?? "", `${row.ms} ms`);
  return message;
}

// Real task blocks of a draft and an analysis call (attempt records of this unit's run), when given.
const draftRecord = values.draft ? JSON.parse(fs.readFileSync(values.draft, "utf8")) : undefined;
const TDRAFT = draftRecord ? `${draftRecord.messages[2].content}\n\nIgnore the task above for this probe and reply with exactly {"probe": "big"}.` : "";
const TANALYZE = record.messages[2]?.role === "user" ? record.messages[2].content : "";
const TLONG =
  "# Task\nWrite a plain-text summary of the sources in about 1500 English words (no JSON), section by section.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nonce = () => crypto.randomBytes(4).toString("hex");
const sequences: Record<string, () => Promise<void>> = {
  // The gaid-authoring-tokens shape: one user string, sources then a different task.
  string: async () => {
    const n = nonce();
    await send("string", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }], { string: true });
    await send("string", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }], { string: true });
  },
  // Sources and task as separate content blocks, no explicit breakpoint.
  blocks: async () => {
    const n = nonce();
    await send("blocks", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await send("blocks", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // Separate blocks plus prompt_cache_breakpoint at the end of the sources block.
  breakpoint: async () => {
    const n = nonce();
    await send("breakpoint", "A", n, [{ role: "user", blocks: [{ text: S, breakpoint: true }, { text: T1 }] }], { breakpoint: true });
    await send("breakpoint", "B", n, [{ role: "user", blocks: [{ text: S, breakpoint: true }, { text: T2 }] }], { breakpoint: true });
    await send("breakpoint", "C", n, [{ role: "user", blocks: [{ text: S, breakpoint: true }, { text: T3 }] }], { breakpoint: true });
  },
  // A long first reply (like the analysis call) before the second task.
  long: async () => {
    const n = nonce();
    await send("long", "A", n, [{ role: "user", blocks: [{ text: S }, { text: TLONG }] }]);
    await send("long", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // How far from the end of the first request's input the second may diverge: first tails of about 200-2,500 tokens.
  ...Object.fromEntries(
    [200, 600, 1100, 2500].map((tokens) => [
      `tail${tokens}`,
      async () => {
        const n = nonce();
        const filler = Array.from({ length: Math.round(tokens / 6) }, (_, i) => `Note ${i}: this line is padding for the probe.`).join("\n");
        await send(`tail${tokens}`, "A", n, [{ role: "user", blocks: [{ text: S }, { text: `${T1}\n\n${filler}` }] }]);
        await send(`tail${tokens}`, "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
      },
    ]),
  ),
  // A 10K-token task after the sources (the draft call's shape), the reply kept short.
  bigtail: async () => {
    const n = nonce();
    await send("bigtail", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await send("bigtail", "B", n, [{ role: "user", blocks: [{ text: S }, { text: TDRAFT }] }]);
    await send("bigtail", "C", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // The real analysis call (a ~5-minute reply), then a short task.
  analysis: async () => {
    const n = nonce();
    await send("analysis", "A", n, [{ role: "user", blocks: [{ text: S }, { text: TANALYZE }] }]);
    await send("analysis", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // Gaps within (270 s) and beyond (330 s) Pi's 5-minute WebSocket idle limit.
  delay270: async () => {
    const n = nonce();
    await send("delay270", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await sleep(270_000);
    await send("delay270", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  ...Object.fromEntries(
    [600, 1200].map((s) => [
      `delay${s}`,
      async () => {
        const n = nonce();
        await send(`delay${s}`, "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
        await sleep(s * 1000);
        await send(`delay${s}`, "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
      },
    ]),
  ),
  delay330: async () => {
    const n = nonce();
    await send("delay330", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await sleep(330_000);
    await send("delay330", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // Repair after a long reply: native history first, then the folded transcript, both after the same first call.
  repairAB: async () => {
    const n = nonce();
    const a = await send("repairAB", "A", n, [{ role: "user", blocks: [{ text: S }, { text: TLONG }] }]);
    const reply = a.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const fix = "## Correction request\nShorten the summary of the second section to three sentences; return the whole summary.";
    await send("repairAB", "native", n, [
      { role: "user", blocks: [{ text: S }, { text: TLONG }] },
      { role: "assistant", message: a },
      { role: "user", blocks: [{ text: fix }] },
    ]);
    await send("repairAB", "fold", n, [
      { role: "user", blocks: [{ text: S }, { text: TLONG }, { text: `## Your previous reply\n${reply}` }, { text: fix }] },
    ]);
  },
  // A sources-only request first, then two different tasks.
  prewarm: async () => {
    const n = nonce();
    await send("prewarm", "P", n, [{ role: "user", blocks: [{ text: S }] }]);
    await send("prewarm", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await send("prewarm", "B", n, [{ role: "user", blocks: [{ text: S }, { text: T2 }] }]);
  },
  // Repair as native history: the first reply kept as an assistant message, then a correction turn.
  native: async () => {
    const n = nonce();
    const a = await send("native", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    await send("native", "B", n, [
      { role: "user", blocks: [{ text: S }, { text: T1 }] },
      { role: "assistant", message: a },
      { role: "user", blocks: [{ text: T2 }] },
    ]);
  },
  // Repair as a folded transcript in the same user message (blocks): previous reply and correction after the task.
  fold: async () => {
    const n = nonce();
    const a = await send("fold", "A", n, [{ role: "user", blocks: [{ text: S }, { text: T1 }] }]);
    const reply = a.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    await send("fold", "B", n, [
      { role: "user", blocks: [{ text: S }, { text: T1 }, { text: `## Your previous reply\n${reply}` }, { text: `## Correction request\n${T2}` }] },
    ]);
  },
};
const only = values.only ? values.only.split(",") : ["string", "blocks", "breakpoint", "prewarm", "native", "fold"];
await Promise.all(only.map(async (name) => {
  try {
    await sequences[name]();
  } catch (e) {
    console.log(name, "failed", (e as Error).message);
    out.write(`${JSON.stringify({ seq: name, failed: (e as Error).message })}\n`);
  }
}));
out.end();
process.exit(0);

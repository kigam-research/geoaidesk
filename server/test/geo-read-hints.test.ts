import fs from "node:fs";
import path from "node:path";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as sdk from "@earendil-works/pi-coding-agent";
import { makeGeoReadHintExtension, LARGE_TEXT_DATA_BYTES } from "../src/geo/read-hints.ts";
import { sandboxFixture, las2, tiff } from "./fixtures/geo/factories.ts";
let f: ReturnType<typeof sandboxFixture>;
beforeEach(() => { f = sandboxFixture(); }); afterEach(() => f.cleanup());
type Handler = (event: { type: string; toolCallId: string; toolName: string; input: Record<string, unknown> }) => Promise<{ block: boolean; reason: string } | undefined>;
function install() {
  let hook: Handler;
  makeGeoReadHintExtension("p", f.paths)!({ on(_name: string, callback: Handler) { hook = callback; } } as never);
  return (path: string, input: Record<string, unknown> = {}, toolName = "read") => hook({ type: "tool_call", toolCallId: "tc", toolName, input: { path, ...input } });
}
it("blocks unbounded/oversized reads with <=2KB of shared metadata and executable next actions", async () => {
  f.write("big.las", las2 + "100 1\n".repeat(LARGE_TEXT_DATA_BYTES / 3)); const hook = install();
  for (const input of [{}, { limit: 201 }, { limit: 100000 }, { limit: -1 }]) {
    const result = await hook("big.las", input); expect(result!.block).toBe(true);
    expect(Buffer.byteLength(result!.reason)).toBeLessThanOrEqual(2000);
    for (const text of ["geo_inspect", "geo_read_window", '"limit":50', "uv run python", "lasio.read", "CRS: unknown", "Depth:"]) expect(result!.reason).toContain(text);
  }
});
it("lets small/bounded text reads pass and always diverts recognized binary geo reads", async () => {
  f.write("small.las", las2); f.write("big.csv", "x,y\n".repeat(100000)); f.write("r.tif", tiff());
  const hook = install();
  expect(await hook("small.las")).toBeUndefined();
  expect(await hook("big.csv", { limit: 200 })).toBeUndefined();
  expect(await hook("big.csv", { limit: 1 }, "bash")).toBeUndefined();
  expect(await hook("missing.las")).toBeUndefined();
  expect((await hook("r.tif", { limit: 1 }))!.block).toBe(true);
});
it("never drops next actions when names are long or include shell syntax", async () => {
  const name = 'log$(not-a-command)".las'; f.write(name, las2.repeat(2000));
  const result = await install()(name); expect(result!.reason).toContain("<<'PY'"); expect(result!.reason).toContain("geo_read_window");
});
it("the real Pi tool pipeline sends the blocked read reason back as a model-facing tool result", async () => {
  f.write("large.las", las2 + "100 1\n".repeat(50000));
  const agentDir = path.join(f.root, "agent"); fs.mkdirSync(agentDir);
  const credentials = { read: async () => undefined, list: async () => [], modify: async (_id: string, fn: (value: undefined) => Promise<undefined>) => fn(undefined), delete: async () => {} };
  const runtime = await sdk.ModelRuntime.create({ credentials: credentials as never, modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
  await runtime.setRuntimeApiKey("openai", "test-only-not-a-real-key");
  const model = runtime.getModels("openai")[0]!;
  const settings = sdk.SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
  const loader = new sdk.DefaultResourceLoader({ cwd: f.root, agentDir, settingsManager: settings, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [makeGeoReadHintExtension("p", f.paths)!] });
  await loader.reload();
  const { session } = await sdk.createAgentSession({ cwd: f.root, agentDir, modelRuntime: runtime, model, thinkingLevel: "off", tools: ["read"], resourceLoader: loader, settingsManager: settings, sessionManager: sdk.SessionManager.inMemory(f.root) });
  const contexts: unknown[] = [];
  const provider = vi.fn((_model, context) => {
    contexts.push(structuredClone(context));
    const first = contexts.length === 1;
    const message = { role: "assistant", api: model.api, provider: model.provider, model: model.id, content: first ? [{ type: "toolCall", id: "read-1", name: "read", arguments: { path: "large.las" } }] : [{ type: "text", text: "Use bounded inspection." }], usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: first ? "toolUse" : "stop", timestamp: Date.now() };
    return { async *[Symbol.asyncIterator]() { yield { type: "done", message, reason: message.stopReason }; }, async result() { return message; } };
  });
  session.agent.streamFunction = provider as never;
  try {
    await session.prompt("Read large.las");
    const messages = (contexts.at(-1) as { messages: { role: string; content: { text?: string }[] }[] }).messages;
    const result = messages.find(m => m.role === "toolResult");
    expect(result).toBeDefined(); const text = result!.content.map(c => c.text ?? "").join("\n");
    expect(text).toContain("Direct read blocked"); expect(text).toContain("geo_inspect"); expect(text).toContain("uv run python"); expect(text).not.toContain("100 1\n100 1");
  } finally { session.dispose(); }
}, 20000);

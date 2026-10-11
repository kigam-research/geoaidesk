import { createServer, type Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerGeoLocalModelRoutes } from "../src/geo/routes/local-model.ts";
import { listCustomProviders, writeCustomProviders } from "../src/agent/custom-models.ts";
import { billingForProvider, normalizeUsageCost } from "../src/cost/billing.ts";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

let server: Server;
let app: FastifyInstance;
let dir: string;
let baseUrl: string;
let parameters: string;
let loaded: number | undefined;
let failShow: boolean;
let failCreate: boolean;
let failPs: boolean;
let names: string[];
let creates: Record<string, unknown>[];
let shows: string[];
let variantContext: number;
const refresh = vi.fn(async () => {});
const input = { model: "qwen3:trial", contextWindow: 65_536, maxTokens: 4096 };

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-local-model-"));
  parameters = "temperature 0.7\nnum_ctx 32768\n";
  loaded = 16_384; failShow = false; failCreate = false; failPs = false;
  names = [input.model]; creates = []; shows = []; variantContext = 0; refresh.mockClear();
  server = createServer(async (req, res) => {
    let text = "";
    for await (const part of req) text += part;
    const body = text ? JSON.parse(text) : {};
    let output: unknown;
    if (req.url === "/api/tags") output = { models: names.map(name => ({ name })) };
    else if (req.url === "/api/ps") {
      res.statusCode = failPs ? 404 : 200;
      output = { models: [{ name: input.model, context_length: loaded }] };
    } else if (req.url === "/api/show") {
      shows.push(body.model);
      res.statusCode = failShow ? 500 : 200;
      output = { parameters: body.model === input.model ? parameters : `num_ctx ${variantContext}`,
        model_info: { "general.architecture": "qwen3", "qwen3.context_length": 131_072 } };
    } else if (req.url === "/api/create") {
      creates.push(body);
      if (failCreate) output = { error: "creation failed" };
      else { names.push(body.model); variantContext = body.parameters.num_ctx; output = { status: "success" }; }
    } else { res.statusCode = 404; output = {}; }
    res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(output));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  app = Fastify();
  await registerGeoLocalModelRoutes(app, { agentDir: dir, baseUrl: () => baseUrl, refreshModels: refresh });
});
afterEach(async () => {
  await app.close();
  await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });
  fs.rmSync(dir, { recursive: true, force: true });
});
const configure = (payload: unknown = input) => app.inject({ method: "POST", url: "/geo/local-model/configure", payload });
const status = async () => (await app.inject("/geo/local-model/status")).json();

describe("Ollama status and declared versus runtime context", () => {
  it("parses tags, configured, trained and loaded context without mutations", async () => {
    const data = await status();
    expect(data.reachable).toBe(true);
    expect(data.models).toEqual([{ model: input.model, configuredContext: 32768, trainedContext: 131072, loadedContext: 16384, detailAvailable: true }]);
    expect(data.verification.state).toBe("unverified");
    expect(data.profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ evidence: "recorded-trial", machines: 1, cpuOffloadPercent: 18 }),
      expect.objectContaining({ contextWindow: 65536, evidence: "proposed-not-tested" }),
    ]));
    expect(creates).toEqual([]);
  });
  it("reports a mismatch using loaded context before configured context", async () => {
    const data = (await configure()).json();
    expect(data.verification).toMatchObject({ state: "mismatch", reason: "exceeds-runtime", knownRuntime: 16384, source: "loaded" });
    loaded = 65536;
    expect((await status()).verification.state).toBe("verified");
    loaded = undefined;
    expect((await status()).verification).toMatchObject({ state: "mismatch", knownRuntime: 32768, source: "configured" });
  });
  it("does not confuse trained capacity with known runtime allocation", async () => {
    await configure(); parameters = "temperature 0.7"; loaded = undefined;
    expect((await status()).verification.state).toBe("unverified");
    failShow = true; failPs = true;
    const data = await status();
    expect(data.reachable).toBe(true);
    expect(data.models[0].detailAvailable).toBe(false);
    expect(data.loadedStatusAvailable).toBe(false);
    expect(data.verification.state).toBe("unverified");
  });
  it("reports trained-limit and endpoint mismatches, plus unreachable status", async () => {
    expect((await configure({ ...input, contextWindow: 262144 })).json().verification.reason).toBe("exceeds-trained");
    baseUrl = "http://127.0.0.1:1";
    const data = await status();
    expect(data.reachable).toBe(false); expect(data.error).toMatch(/Ollama/);
    expect(data.verification.reason).toBe("server-changed");
    expect(data.provider.models[0].contextWindow).toBe(262144);
  });
});

describe("configuration, ownership and persistence", () => {
  it("persists explicit limits and default through fresh modules, and remains one entry on reconfigure", async () => {
    const first = await configure({ ...input, setDefault: true });
    expect(first.statusCode).toBe(200); expect(refresh).toHaveBeenCalledTimes(1);
    expect(creates).toHaveLength(0);
    vi.resetModules();
    const freshCustom = await import("../src/agent/custom-models.ts");
    const freshDefaults = await import("../src/app-settings.ts");
    const persisted = freshCustom.listCustomProviders(dir);
    expect(persisted).toMatchObject([{ id: "gaid-local", managed: true, baseUrl: `${baseUrl}/v1`, api: "openai-completions",
      models: [{ id: input.model, contextWindow: 65536, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] }]);
    expect(freshDefaults.readAppDefaults(dir)).toEqual({ model: `gaid-local/${input.model}` });
    expect(fs.existsSync(path.join(dir, "models.json"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "kady-settings.json"))).toBe(true);
    expect((await configure({ ...input, contextWindow: 98304, maxTokens: 8192 })).statusCode).toBe(200);
    expect(freshCustom.listCustomProviders(dir)).toHaveLength(1);
    expect(freshCustom.listCustomProviders(dir)[0].models[0]).toMatchObject({ contextWindow: 98304, maxTokens: 8192 });
    const billing = billingForProvider("gaid-local");
    expect(billing.billingMode).toBe("payg");
    expect(normalizeUsageCost(0, billing)).toEqual({ costUsd: 0 });
  });
  it("creates only an explicitly requested variant with num_ctx and selects it", async () => {
    const response = await configure({ ...input, createVariant: true, setDefault: true });
    expect(response.statusCode).toBe(200);
    expect(creates).toEqual([{ model: "qwen3:trial-gaid-64k", from: input.model, parameters: { num_ctx: 65536 }, stream: false }]);
    expect(response.json()).toMatchObject({ defaults: { model: "gaid-local/qwen3:trial-gaid-64k" }, verification: { state: "verified", source: "configured" } });
    expect(names).toContain(input.model); expect(shows).toContain("qwen3:trial-gaid-64k");
  });
  it("reloads the saved custom model in real Pi runtime without model-provider requests", async () => {
    const options = { authPath: path.join(dir, "test-auth.json"), modelsPath: path.join(dir, "models.json"),
      modelsStorePath: path.join(dir, "test-models-store.json"), allowModelNetwork: false };
    const runtime = await ModelRuntime.create(options);
    expect(runtime.getModel("gaid-local", input.model)).toBeUndefined();
    await configure({ ...input, setDefault: true });
    await runtime.refresh({ allowNetwork: false });
    expect(runtime.getModel("gaid-local", input.model)).toMatchObject({ provider: "gaid-local", contextWindow: 65536, maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } });
    const restarted = await ModelRuntime.create(options);
    expect(restarted.getModel("gaid-local", input.model)?.contextWindow).toBe(65536);
    expect(restarted.hasConfiguredAuth("gaid-local")).toBe(true);
  });
  it("preserves other managed providers, exact keys, foreign entries and unrelated defaults", async () => {
    writeCustomProviders([{ id: "other-local", apiKey: "$!literal$$key", baseUrl: "http://other/v1", api: "openai-completions", models: [{ id: "other" }] }], dir);
    const file = path.join(dir, "models.json");
    const initial = JSON.parse(fs.readFileSync(file, "utf8"));
    initial.providers.foreign = { baseUrl: "http://foreign", apiKey: "unmodified", models: [{ id: "x" }], unusual: true };
    fs.writeFileSync(file, JSON.stringify(initial));
    fs.writeFileSync(path.join(dir, "kady-settings.json"), JSON.stringify({ future: true, defaults: { thinkingLevel: "high", futureDefault: 5 } }));
    expect((await configure({ ...input, setDefault: true })).statusCode).toBe(200);
    const written = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(written.providers["other-local"]).toEqual(initial.providers["other-local"]);
    expect(written.providers.foreign).toEqual(initial.providers.foreign);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "kady-settings.json"), "utf8"))).toMatchObject({ future: true, defaults: { thinkingLevel: "high", futureDefault: 5 } });
  });
  it("does not overwrite foreign gaid-local or malformed files", async () => {
    const file = path.join(dir, "models.json");
    const text = JSON.stringify({ providers: { "gaid-local": { models: [{ id: "mine" }] } } });
    fs.writeFileSync(file, text);
    expect((await configure({ ...input, createVariant: true })).statusCode).toBe(409);
    expect(fs.readFileSync(file, "utf8")).toBe(text); expect(creates).toEqual([]);
    fs.writeFileSync(file, "not json");
    expect((await configure()).statusCode).toBe(409);
    expect(fs.readFileSync(file, "utf8")).toBe("not json");
  });
  it("leaves default unchanged on creation or refresh failure and reports partial persistence", async () => {
    failCreate = true;
    expect((await configure({ ...input, createVariant: true, setDefault: true })).statusCode).toBe(502);
    expect(listCustomProviders(dir)).toEqual([]); expect(refresh).not.toHaveBeenCalled();
    failCreate = false;
    refresh.mockRejectedValueOnce(new Error("reload"));
    const partial = await configure({ ...input, setDefault: true });
    expect(partial.statusCode).toBe(502); expect(partial.json().detail).toMatch(/saved.*default was not changed/);
    expect(listCustomProviders(dir)).toHaveLength(1);
    expect(fs.existsSync(path.join(dir, "kady-settings.json"))).toBe(false);
    fs.writeFileSync(path.join(dir, "kady-settings.json"), "broken");
    expect((await configure({ ...input, setDefault: true })).statusCode).toBe(409);
    expect(fs.readFileSync(path.join(dir, "kady-settings.json"), "utf8")).toBe("broken");
  });
  it.each([
    {}, { ...input, model: "" }, { ...input, model: "missing" }, { ...input, model: "../oops" },
    { ...input, contextWindow: 999 }, { ...input, contextWindow: "65536" }, { ...input, contextWindow: 1234.5 },
    { ...input, maxTokens: 65536 }, { ...input, maxTokens: 0 }, { ...input, createVariant: "true" },
    { ...input, setDefault: 1 }, { ...input, surprise: true },
  ])("rejects invalid settings without creating or writing: %j", async payload => {
    expect((await configure(payload)).statusCode).toBe(400);
    expect(creates).toEqual([]); expect(listCustomProviders(dir)).toEqual([]); expect(refresh).not.toHaveBeenCalled();
  });
});

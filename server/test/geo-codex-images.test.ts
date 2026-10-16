import { describe, expect, it, vi } from "vitest";

import { chatGptAccountId, codexImagesUrl, generateCodexImage } from "../src/geo/authoring/codex-images.ts";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("../src/cost/ledger.ts", async (original) => ({
  ...(await original<typeof import("../src/cost/ledger.ts")>()),
  recordRun: mocks.record,
}));

const { chatGptImageGenerator } = await import("../src/geo/authoring/visuals.ts");

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const token = (claims: object) => ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
const TOKEN = token({ "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } });

describe("concept pictures through the ChatGPT subscription", () => {
  it("reads the account id and builds the Codex images endpoint", () => {
    expect(chatGptAccountId(TOKEN)).toBe("acct-1");
    expect(() => chatGptAccountId(token({}))).toThrow("계정을 확인하지");
    expect(codexImagesUrl()).toBe("https://chatgpt.com/backend-api/codex/images/generations");
    expect(codexImagesUrl("https://chatgpt.com/backend-api/codex/responses")).toBe(
      "https://chatgpt.com/backend-api/codex/images/generations",
    );
    expect(codexImagesUrl("https://example.org/v1")).toBe("https://chatgpt.com/backend-api/codex/images/generations");
  });

  it("posts an Images API body with the account headers and returns the PNG bytes", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: "gpt-image-2", n: 1, prompt: "concept" });
      expect((init?.headers as Record<string, string>)["chatgpt-account-id"]).toBe("acct-1");
      return new Response(JSON.stringify({ created: 1, data: [{ b64_json: PNG.toString("base64") }] }));
    });
    const image = await generateCodexImage({ provider: "openai", token: TOKEN }, "concept", {
      fetch: fetchImpl as typeof fetch,
    });
    expect(image.mimeType).toBe("image/png");
    expect(Buffer.from(image.bytes)).toEqual(PNG);
    const denied = vi.fn(async () => new Response("no", { status: 403 }));
    await expect(
      generateCodexImage({ provider: "openai", token: TOKEN }, "x", { fetch: denied as typeof fetch }),
    ).rejects.toMatchObject({ status: 401 });
    const text = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] })));
    await expect(
      generateCodexImage({ provider: "openai", token: TOKEN }, "x", { fetch: text as typeof fetch }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("is used only with a ChatGPT OAuth sign-in and ledgers subscription use at $0", async () => {
    const none = { checkAuth: async () => ({ type: "api_key" as const }), getAuth: async () => undefined };
    expect(await chatGptImageGenerator(none)).toBeNull();
    // "Sign in with ChatGPT" (openai) cannot generate images: subscription sharing refuses the tool.
    const chatgptOnly = {
      checkAuth: async (p: string) => (p === "openai" ? { type: "oauth" as const } : undefined),
      getAuth: async () => undefined,
    };
    expect(await chatGptImageGenerator(chatgptOnly)).toBeNull();
    const runtime = {
      checkAuth: async (p: string) => (p === "openai-codex" ? { type: "oauth" as const } : undefined),
      getAuth: async () => ({ auth: { apiKey: TOKEN } }),
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] })));
    const generator = await chatGptImageGenerator(runtime, fetchImpl as typeof fetch);
    expect(generator?.model).toBe("openai-codex/gpt-image-2");
    await generator!.generate("concept");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "gaid-hub-visuals",
        model: "openai-codex/gpt-image-2",
        billing: expect.objectContaining({ billingMode: "subscription" }),
        after: expect.objectContaining({ costUsd: 0 }),
      }),
    );
  });
});

describe("concept pictures through the MiniMax key", () => {
  it("posts image-01 with base64 output, maps base_resp codes and accepts PNG", async () => {
    const { generateMiniMaxImage } = await import("../src/geo/authoring/minimax-images.ts");
    const ok = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ model: "image-01", response_format: "base64", n: 1 });
      return new Response(
        JSON.stringify({ data: { image_base64: [PNG.toString("base64")] }, base_resp: { status_code: 0 } }),
      );
    });
    const image = await generateMiniMaxImage("key", "concept", { fetch: ok as typeof fetch });
    expect(image.mimeType).toBe("image/png");
    const limited = vi.fn(async () => new Response(JSON.stringify({ base_resp: { status_code: 1008 } })));
    await expect(generateMiniMaxImage("key", "x", { fetch: limited as typeof fetch })).rejects.toMatchObject({
      status: 402,
    });
  });

  it("needs a MiniMax key and ledgers the plan use at $0", async () => {
    const { miniMaxImageGenerator } = await import("../src/geo/authoring/visuals.ts");
    expect(
      await miniMaxImageGenerator({ checkAuth: async () => undefined, getAuth: async () => undefined }),
    ).toBeNull();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { image_base64: [PNG.toString("base64")] }, base_resp: { status_code: 0 } }),
        ),
    );
    const generator = await miniMaxImageGenerator(
      { checkAuth: async () => ({ type: "api_key" as const }), getAuth: async () => ({ auth: { apiKey: "k" } }) },
      fetchImpl as typeof fetch,
    );
    expect(generator?.model).toBe("minimax/image-01");
    await generator!.generate("concept");
    expect(mocks.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: "minimax/image-01",
        billing: expect.objectContaining({ billingMode: "subscription" }),
      }),
    );
  });

  it("adds MiniMax M3.1 Flash Preview to the minimax provider", async () => {
    const { registerGeoProviderModels, MINIMAX_M31_FLASH_PREVIEW } = await import("../src/geo/providers.ts");
    const registerProvider = vi.fn();
    const m3 = { id: "MiniMax-M3", name: "MiniMax-M3", contextWindow: 1_000_000 };
    registerGeoProviderModels({ registerProvider, getModels: () => [m3] as never });
    expect(registerProvider).toHaveBeenCalledWith(
      "minimax",
      expect.objectContaining({
        models: [
          expect.objectContaining({ id: "MiniMax-M3" }),
          expect.objectContaining({ id: MINIMAX_M31_FLASH_PREVIEW, contextWindow: 1_000_000 }),
        ],
      }),
    );
  });
});

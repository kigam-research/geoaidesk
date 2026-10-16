import { describe, expect, it, vi } from "vitest";

import { chatGptAccountId, codexImagesUrl, generateCodexImage } from "../src/geo/authoring/codex-images.ts";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("../src/cost/ledger.ts", async (original) => ({
  ...(await original<typeof import("../src/cost/ledger.ts")>()),
  recordRun: mocks.record,
}));

const { chatGptImageGenerator } = await import("../src/geo/authoring/visuals.ts");
const { usageLimit } = await import("../src/geo/authoring/codex-images.ts");

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

  it("turns a Codex usage-limit body into a notice with the reset time", () => {
    const at = usageLimit({ error: { type: "usage_limit_reached", resets_at: 1_792_000_000 } });
    expect(at.status).toBe(429);
    expect(at.resetsAt).toBe(new Date(1_792_000_000_000).toISOString());
    expect(usageLimit({ error: { resets_in_seconds: 60 } }, 0).resetsAt).toBe(new Date(60_000).toISOString());
    expect(usageLimit(null).resetsAt).toBeUndefined();
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

describe("MiniMax M3.1 Flash Preview", () => {
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

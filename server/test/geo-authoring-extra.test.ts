/** Local HTTP + fake image runtime only. Never makes a paid model call. */
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plainLabel } from "../src/geo/authoring/agent.ts";
import { AuthoringError, AuthoringStore } from "../src/geo/authoring/store.ts";
import { UsageLimitError } from "../src/geo/authoring/codex-images.ts";
import { addUrlSource, readableHtml, validateSourceUrl } from "../src/geo/authoring/url-sources.ts";
import { pageText, SOURCE_LIMIT_BYTES } from "../src/geo/authoring/sources.ts";
import { readFileSync } from "node:fs";
import {
  ADAPT_PROMPT,
  DARK_VARIANT_PROMPT,
  PICTURE_WELL,
  prepareRuntimeImageGenerator,
  startVisuals,
  VISUALS_LEDGER_SESSION,
  type ImageGenerator,
} from "../src/geo/authoring/visuals.ts";
import { registerGeoAuthoringExtraRoutes } from "../src/geo/routes/authoring-extra.ts";
import { getAuthoringStore, registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import {
  analysis,
  cleanup,
  config,
  draftReply,
  fixture,
  pdf,
  reply,
  testVocabulary,
  work,
} from "./helpers/geo-authoring.ts";

const mocks = vi.hoisted(() => ({
  defaults: {} as { imageModel?: string },
  connected: true,
  codex: true,
  generate: vi.fn(),
  record: vi.fn(),
  budget: vi.fn(() => ({ exceeded: false })),
  model: {
    provider: "openrouter",
    id: "fake-image",
    cost: { input: 1, output: 2 },
    input: ["text"],
  },
}));
vi.mock("../src/app-settings.ts", () => ({
  readAppDefaults: () => mocks.defaults,
}));
vi.mock("../src/agent/session-registry.ts", () => ({
  getModelRegistry: () => ({
    getModelOfType: () => mocks.model,
    getAvailableOfType: async () => (mocks.connected ? [mocks.model] : []),
    generateImages: mocks.generate,
  }),
  getModelRuntime: () => ({
    checkAuth: async (provider: string) =>
      provider === "openrouter"
        ? { type: "api_key" }
        : provider === "openai-codex" && mocks.codex
          ? { type: "oauth" }
          : undefined,
    getAuth: async () => ({ auth: { apiKey: "token" } }),
  }),
}));
vi.mock("../src/cost/ledger.ts", async (original) => ({
  ...(await original<typeof import("../src/cost/ledger.ts")>()),
  recordRun: mocks.record,
  isBudgetExceeded: mocks.budget,
}));
const servers: Server[] = [];
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  vi.unstubAllEnvs();
  mocks.defaults = {};
  mocks.connected = true;
  mocks.codex = true;
  mocks.generate.mockReset();
  mocks.record.mockReset();
  mocks.budget.mockReset().mockReturnValue({ exceeded: false });
  await cleanup();
});

async function localServer() {
  const server = createServer((req, res) => {
    const path = req.url!;
    if (path.startsWith("/redirect/")) {
      const count = Number(path.split("/").at(-1));
      res.writeHead(302, {
        Location: count ? `/redirect/${count - 1}` : "/html",
      });
      res.end();
    } else if (path === "/html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<html><head><title>논문 &amp; 방법</title><style>BAD STYLE</style></head><body><nav>BAD NAV</nav><h1>자료 준비</h1><p>Spatial blocks separate outer testing.</p><p>유효한 한글 본문입니다.</p><script>BAD SCRIPT</script><p hidden>BAD HIDDEN</p></body></html>",
      );
    } else if (path === "/pdf") {
      res.writeHead(200, { "Content-Type": "application/pdf" });
      res.end(pdf(["Spatial blocks separate outer testing.", "Figure 1. A conceptual spatial evaluation method."]));
    } else if (path === "/large-header") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Length": String(SOURCE_LIMIT_BYTES + 1),
      });
      res.flushHeaders();
    } else if (path === "/large-chunks") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("a".repeat(300));
    } else if (path === "/slow") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.flushHeaders();
    } else if (path === "/refused-redirect") {
      res.writeHead(302, {
        Location: "http://169.254.169.254/latest/meta-data",
      });
      res.end();
    } else {
      res.writeHead(403);
      res.end("Forbidden");
    }
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  vi.stubEnv("GAID_URL_SOURCE_ALLOW", "127.0.0.1");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function newStore() {
  const store = new AuthoringStore(await work("extra-test-"));
  await store.initialize();
  const p = await store.create({});
  return { store, id: p.id };
}
async function drafted() {
  const f = await fixture();
  const deps = { config, vocabulary: testVocabulary(), chat: reply(analysis) };
  await runOperation(f.store, f.projectId, "analyze", "analyze-extra", deps);
  await runOperation(f.store, f.projectId, "draft", "draft-extra", {
    ...deps,
    chat: reply(draftReply),
  });
  return f;
}
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGJkAAAAASUVORK5CYII=",
  "base64",
);
const fakeGenerator = (
  generate = vi.fn(async () => ({
    bytes: PNG,
    mimeType: "image/png" as const,
  })),
): ImageGenerator => ({ model: "test/image", generate });

describe("URL sources", () => {
  it("extracts headings and paragraphs, title, Unicode and entities, not navigation/scripts", async () => {
    const base = await localServer();
    const { store, id } = await newStore();
    const result = await addUrlSource(store, id, {
      url: `${base}/html`,
      kind: "paper",
    });
    expect(result.source).toMatchObject({
      kind: "web",
      title: "논문 & 방법",
      status: "extracted",
      documentKind: "paper",
      url: `${base}/html`,
      fetch: { finalUrl: `${base}/html`, status: 200 },
    });
    expect(result.source.fetch!.contentHash).toBe(result.source.sha256);
    const page = await pageText(store, id, result.source.id, 1);
    expect(page).toContain("자료 준비\n\nSpatial blocks");
    expect(page).toContain("유효한 한글");
    expect(page).not.toContain("BAD");
    expect((await store.read(id)).sourceRevision).toBe(1);
    // New web pages participate in exactly the same grounded sourceContext and anchor checks as PDFs.
    const analyzed = await runOperation(store, id, "analyze", "analyze-web", {
      config,
      vocabulary: testVocabulary(),
      chat: reply({
        ...analysis,
        findings: [
          {
            kind: "method",
            statement: "공간 평가",
            anchors: [
              {
                source: "S1",
                page: 1,
                quote: "Spatial blocks separate outer testing",
              },
            ],
          },
        ],
      }),
    });
    expect(analyzed.outcome).toBe("accepted");
    expect((await store.read(id)).findings[0].anchors[0].verified).toBe(true);
  });
  it("reuses PDF page and figure-caption extraction", async () => {
    const base = await localServer();
    const { store, id } = await newStore();
    const { source, extraction } = await addUrlSource(store, id, {
      url: `${base}/pdf`,
      kind: "paper",
    });
    expect(source.kind).toBe("pdf");
    expect(source.status).toBe("extracted");
    expect(extraction.pages).toBe(1);
    expect(extraction.figures[0].label).toBe("Figure 1");
    expect(await pageText(store, id, source.id, 1)).toContain("Spatial blocks");
  });
  it("allows exactly five redirects, records the final URL and fails on the sixth", async () => {
    const base = await localServer();
    const { store, id } = await newStore();
    expect(
      (
        await addUrlSource(store, id, {
          url: `${base}/redirect/4`,
          kind: "blog",
        })
      ).source.url,
    ).toBe(`${base}/html`);
    const result = await addUrlSource(store, id, {
      url: `${base}/redirect/5`,
      kind: "search",
    });
    expect(result.source.status).toBe("failed");
    expect(result.extraction.error).toContain("5회");
  });
  it.each([
    "file:///etc/passwd",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/",
    "http://[fe80::1]/",
    "http://user:pass@example.com/",
  ])("records a refused URL as a failed source: %s", async (url) => {
    vi.stubEnv("GAID_URL_SOURCE_ALLOW", "");
    const { store, id } = await newStore();
    const result = await addUrlSource(store, id, { url, kind: "paper" });
    expect(result.source.status).toBe("failed");
    expect(result.extraction.error).toBeTruthy();
    expect((await store.read(id)).sources).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("user:pass");
  });
  it("rechecks each redirect target", async () => {
    const base = await localServer();
    const { store, id } = await newStore();
    const result = await addUrlSource(store, id, {
      url: `${base}/refused-redirect`,
      kind: "search",
    });
    expect(result.source.status).toBe("failed");
    expect(result.extraction.error).toContain("링크 로컬");
  });
  it("enforces declared and streamed byte limits, and records HTTP failures and timeouts", async () => {
    const base = await localServer();
    const { store, id } = await newStore();
    for (const path of ["large-header", "large-chunks"]) {
      const result = await addUrlSource(store, id, { url: `${base}/${path}`, kind: "blog" }, { limitBytes: 100 });
      expect(result.source.status).toBe("failed");
      expect(result.extraction.error).toContain("30 MiB");
    }
    const failure = await addUrlSource(store, id, {
      url: `${base}/forbidden`,
      kind: "paper",
    });
    expect(failure.source.fetch!.status).toBe(403);
    expect(failure.extraction.error).toContain("HTTP 403");
    const timeout = await addUrlSource(store, id, { url: `${base}/slow`, kind: "paper" }, { timeoutMs: 30 });
    expect(timeout.source.status).toBe("failed");
    expect(timeout.extraction.error).toContain("30초");
  });
  it("does not turn quoted markup entities into HTML or leak title into text", () => {
    expect(readableHtml("<title>Title</title><p>&lt;script&gt; text &amp; more</p>")).toEqual({
      title: "Title",
      text: "<script> text & more",
    });
  });
});

describe("Concept illustrations", () => {
  it("redoes only the selected key and edits with the prior bytes, preserving history and the verbatim request", async () => {
    const { store, projectId } = await drafted();
    const generator = fakeGenerator();
    await (await startVisuals(store, projectId, 1, { opId: "pictures-first" }, async () => generator)).completion;
    const before = await store.read(projectId);
    const request = "  블록을 더 크게, 색은 단색으로  ";
    const run = await startVisuals(store, projectId, 1, { opId: "picture-edit", keys: ["prepare"], instruction: request }, async () => generator);
    await run.completion;
    const after = await store.read(projectId);
    expect(after.visuals!.cover).toEqual(before.visuals!.cover);
    expect(after.visuals!.evaluate).toEqual(before.visuals!.evaluate);
    expect(after.visuals!.prepare.file).not.toBe(before.visuals!.prepare.file);
    expect(await store.readFile(projectId, before.visuals!.prepare.file)).toEqual(PNG);
    expect(after.visualOperations!["picture-edit"]).toMatchObject({ keys: ["prepare"], completed: ["prepare"], instruction: request, status: "complete" });
    // The light picture is edited from the previous one with the request; the dark picture is edited from the new light one.
    const [lightCall, darkCall] = vi.mocked(generator.generate).mock.calls.slice(-2);
    expect(lightCall[0]).toContain(request);
    expect(lightCall[0]).toContain("not data");
    expect(lightCall[1]).toEqual({ bytes: PNG, mimeType: "image/png" });
    expect(darkCall[0]).toBe(DARK_VARIANT_PROMPT);
    expect(after.visuals!.prepare.dark).toMatch(/^visuals\/picture-edit\/0-dark\.png$/);
    await startVisuals(store, projectId, 1, { opId: "picture-edit", keys: ["cover"] }, async () => { throw Error("retry must not prepare"); });
    await (await startVisuals(store, projectId, 1, { opId: "picture-redo", keys: ["prepare"] }, async () => generator)).completion;
    expect(vi.mocked(generator.generate).mock.calls.at(-2)![1]).toBeUndefined();
  });

  it("keeps the web well token equal to the colours pictures are generated on", () => {
    const css = readFileSync(new URL("../../web/src/app/globals.css", import.meta.url), "utf8");
    const block = (start: string) => css.slice(css.indexOf(start), css.indexOf("\n}", css.indexOf(start)));
    expect(block(":root {")).toContain(`--gaid-pic-well: ${PICTURE_WELL.light};`);
    expect(block(".dark {")).toContain(`--gaid-pic-well: ${PICTURE_WELL.dark};`);
  });

  it("fits an older white picture to the screen themes by editing it, keeping its caption", async () => {
    const { store, projectId } = await drafted();
    await store.writeFile(projectId, "visuals/old/0.png", PNG);
    await store.mutate(projectId, (p) => {
      p.visuals = { cover: { file: "visuals/old/0.png", caption: "예전 표지", model: "gaid-hub", draftRevision: 1 } };
    });
    const generator = fakeGenerator();
    const run = await startVisuals(store, projectId, 1, { opId: "picture-adapt", keys: ["cover"], adapt: true }, async () => generator);
    await run.completion;
    const p = await store.read(projectId);
    expect(p.visualOperations!["picture-adapt"]).toMatchObject({ adapt: true, completed: ["cover"], status: "complete" });
    expect(p.visuals!.cover).toMatchObject({ caption: "예전 표지", file: "visuals/picture-adapt/0.png", dark: "visuals/picture-adapt/0-dark.png" });
    expect(vi.mocked(generator.generate).mock.calls.map((c) => c[0])).toEqual([ADAPT_PROMPT, DARK_VARIANT_PROMPT]);
    expect(vi.mocked(generator.generate).mock.calls[0][1]).toEqual({ bytes: PNG, mimeType: "image/png" });
    expect(await store.readFile(projectId, "visuals/old/0.png")).toEqual(PNG);
    await expect(
      startVisuals(store, projectId, 1, { opId: "picture-adapt-again", keys: ["cover"], adapt: true }, async () => generator),
    ).rejects.toThrow("이미 화면 테마에 맞춘 그림");
    await expect(
      startVisuals(store, projectId, 1, { opId: "picture-adapt-edit", keys: ["cover"], adapt: true, instruction: "x" }, async () => generator),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("validates targeted keys and instructions before preparing a generator", async () => {
    const { store, projectId } = await drafted();
    const prepare = vi.fn(async () => fakeGenerator());
    for (const selection of [
      { keys: [] }, { keys: ["absent"] }, { keys: ["cover", "cover"] }, { keys: Array(7).fill("cover") },
      { keys: ["cover"], steps: [] }, { keys: ["cover"], instruction: "a".repeat(501) },
      { keys: ["cover"], instruction: "   " }, { instruction: "edit" }, { keys: ["cover"], instruction: "edit" },
      { keys: "cover" }, { instruction: 3 }, { keys: [null] },
      { keys: ["cover"], adapt: true }, { adapt: true }, { keys: ["cover"], adapt: "yes" },
    ]) {
      await expect(startVisuals(store, projectId, 1, { opId: "invalid-selection", ...selection } as never, prepare)).rejects.toMatchObject({ status: 400 });
    }
    expect(prepare).not.toHaveBeenCalled();
    const generator = fakeGenerator();
    await (await startVisuals(store, projectId, 1, { opId: "valid-cover", keys: ["cover"] }, async () => generator)).completion;
    await (await startVisuals(store, projectId, 1, { opId: "valid-length", keys: ["cover"], instruction: "a".repeat(500) }, async () => generator)).completion;
    expect((await store.read(projectId)).visualOperations!["valid-length"].status).toBe("complete");
  });
  it("generates cover and steps, records revision/model/captions, and concurrent retries stay idempotent", async () => {
    const { store, projectId } = await drafted();
    const generator = fakeGenerator();
    const [a, b] = await Promise.all([
      startVisuals(store, projectId, 1, { opId: "visual-op-1" }, async () => generator),
      startVisuals(store, projectId, 1, { opId: "visual-op-1" }, async () => generator),
    ]);
    await Promise.all([a.completion, b.completion]);
    const p = await store.read(projectId);
    expect(p.visualOperations!["visual-op-1"]).toMatchObject({
      status: "complete",
      completed: ["cover", "prepare", "evaluate", "report"],
    });
    expect(generator.generate).toHaveBeenCalledTimes(8);
    expect(p.visuals!.evaluate).toMatchObject({
      model: "test/image",
      draftRevision: 1,
      file: "visuals/visual-op-1/2.png",
      dark: "visuals/visual-op-1/2-dark.png",
    });
    expect(p.visuals!.evaluate.caption).toContain("분석 자료가 아닙니다");
    expect(await store.readFile(projectId, p.visuals!.cover.file)).toEqual(PNG);
    const prompt = vi.mocked(generator.generate).mock.calls[0][0];
    expect(prompt).toContain("#1F5EFF");
    expect(prompt).toContain(`exactly ${PICTURE_WELL.light.toUpperCase()}`);
    expect(prompt).not.toContain("white background");
    expect(DARK_VARIANT_PROMPT).toContain(`exactly ${PICTURE_WELL.dark.toUpperCase()}`);
    expect(vi.mocked(generator.generate).mock.calls[1]).toEqual([DARK_VARIANT_PROMPT, { bytes: PNG, mimeType: "image/png" }]);
    expect(prompt).toContain("not data");
    expect(prompt).toContain("PU nested CV 방법");
    await startVisuals(store, projectId, 1, { opId: "visual-op-1" }, async () => {
      throw Error("must not prepare");
    });
  });
  it("caps default selection at 6 steps and refuses unknown requested nodes", async () => {
    const { store, projectId } = await drafted();
    await store.mutate(projectId, (p) => {
      const d = p.drafts[0];
      d.profile.procedure.nodes = Array.from({ length: 10 }, (_, i) => ({
        ...d.profile.procedure.nodes[0],
        id: `node-${i}`,
      }));
    });
    const generator = fakeGenerator();
    const run = await startVisuals(store, projectId, 1, { opId: "visual-cap" }, async () => generator);
    await run.completion;
    expect(generator.generate).toHaveBeenCalledTimes(14);
    await expect(
      startVisuals(store, projectId, 1, { opId: "visual-bad", steps: ["absent"] }, async () => generator),
    ).rejects.toThrow("단계 식별자");
  });
  it("reserves shared-cap slots for map/figure outputs but not tables/reports", async () => {
    const { store, projectId } = await drafted();
    await store.mutate(projectId, (p) => {
      const draft = p.drafts[0];
      draft.profile.procedure.nodes = Array.from({ length: 8 }, (_, i) => ({
        ...draft.profile.procedure.nodes[0],
        id: `node-${i}`,
      }));
      draft.profile.outputs.push(
        { id: "zone", label: "후보 구역", kind: "map-vector" },
        { id: "curve", label: "평가 그림", kind: "figure" },
        { id: "report", label: "보고서", kind: "report" },
      );
    });
    const generator = fakeGenerator();
    const run = await startVisuals(store, projectId, 1, { opId: "visual-outputs" }, async () => generator);
    await run.completion;
    const p = await store.read(projectId);
    expect(run.operation.keys).toEqual([
      "cover",
      "node-0",
      "node-1",
      "node-2",
      "node-3",
      "output:zone",
      "output:curve",
    ]);
    expect(generator.generate).toHaveBeenCalledTimes(14);
    expect(p.visuals!["output:zone"].caption).toContain("후보 구역");
    expect(p.visuals!["output:scores"]).toBeUndefined();
    expect(p.visuals!["output:report"]).toBeUndefined();
    expect(vi.mocked(generator.generate).mock.calls[10][0]).toContain("never an actual result");
    await expect(
      startVisuals(
        store,
        projectId,
        1,
        { opId: "visual-too-many", steps: ["node-0", "node-1", "node-2", "node-3", "node-4"] },
        async () => generator,
      ),
    ).rejects.toThrow("합쳐서 최대 6개");
  });
  it("keeps completed images on failure and never retries a failed opId", async () => {
    const { store, projectId } = await drafted();
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ bytes: PNG, mimeType: "image/png" })
      .mockResolvedValueOnce({ bytes: PNG, mimeType: "image/png" })
      .mockResolvedValueOnce({ bytes: PNG, mimeType: "image/png" })
      .mockRejectedValueOnce(Error("provider failure"));
    const run = await startVisuals(store, projectId, 1, { opId: "visual-fail" }, async () => fakeGenerator(generate));
    await run.completion;
    const p = await store.read(projectId);
    expect(p.visualOperations!["visual-fail"]).toMatchObject({
      status: "failed",
      completed: ["cover"],
    });
    expect(p.visuals!.cover.dark).toBeTruthy();
    // The second picture's light file is kept without a dark-mode picture; it shows on the paper mat.
    expect(p.visuals!.prepare).toMatchObject({ file: "visuals/visual-fail/1.png" });
    expect(p.visuals!.prepare.dark).toBeUndefined();
    await startVisuals(store, projectId, 1, { opId: "visual-fail" }, async () => {
      throw Error("must not run");
    });
  });
  it("marks operations interrupted on restart without regenerating paid images", async () => {
    const { store, projectId } = await drafted();
    await store.mutate(projectId, (p) => {
      p.visualOperations = {
        "visual-restart": {
          opId: "visual-restart",
          draftRevision: 1,
          model: "test/image",
          keys: ["cover"],
          completed: [],
          status: "running",
          startedAt: new Date().toISOString(),
        },
      };
    });
    const restarted = new AuthoringStore(store.root);
    await restarted.initialize();
    expect((await restarted.read(projectId)).visualOperations!["visual-restart"].status).toBe("interrupted");
    await startVisuals(restarted, projectId, 1, { opId: "visual-restart" }, async () => {
      throw Error("must not run");
    });
  });
  it("uses only the OpenAI Codex login, never another image model, and refuses without it", async () => {
    expect((await prepareRuntimeImageGenerator()).model).toBe("openai-codex/gpt-image-2");
    mocks.codex = false;
    await expect(prepareRuntimeImageGenerator()).rejects.toThrow("OpenAI Codex 로그인이 없습니다");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("stops the batch at the usage limit and records it for a notice", async () => {
    const { store, projectId } = await drafted();
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ bytes: PNG, mimeType: "image/png" })
      .mockResolvedValueOnce({ bytes: PNG, mimeType: "image/png" })
      .mockRejectedValueOnce(new UsageLimitError("2026-10-16T12:00:00.000Z"));
    const run = await startVisuals(store, projectId, 1, { opId: "visual-limit" }, async () => fakeGenerator(generate));
    await run.completion;
    const op = (await store.read(projectId)).visualOperations!["visual-limit"];
    expect(op).toMatchObject({
      status: "failed",
      completed: ["cover"],
      usageLimit: { resetsAt: "2026-10-16T12:00:00.000Z" },
    });
    expect(op.error).toContain("사용량 한도");
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it("shares the registered store; routes serve bytes, return 202 and report a missing Codex login as Korean 400", async () => {
    const { store, projectId } = await drafted();
    const app = Fastify();
    apps.push(app);
    await registerAuthoringRoutes(app, { store, vocabulary: testVocabulary() });
    expect(getAuthoringStore(app)).toBe(store);
    await registerGeoAuthoringExtraRoutes(app, {
      prepareImageGenerator: async () => fakeGenerator(),
    });
    const response = await app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/drafts/1/visuals`,
      payload: { opId: "visual-route", keys: ["cover"] },
    });
    expect(response.statusCode).toBe(202);
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const app2 = Fastify();
    apps.push(app2);
    await registerGeoAuthoringExtraRoutes(app2, { store });
    const image = await app2.inject({
      url: `/geo/authoring/projects/${projectId}/visuals/cover`,
    });
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.rawPayload).toEqual(PNG);
    const darkBytes = Buffer.from("dark-picture");
    await store.writeFile(projectId, (await store.read(projectId)).visuals!.cover.dark!, darkBytes);
    const dark = await app2.inject({ url: `/geo/authoring/projects/${projectId}/visuals/cover?theme=dark` });
    expect(dark.rawPayload).toEqual(darkBytes);
    await store.mutate(projectId, (p) => { delete p.visuals!.cover.dark; });
    const older = await app2.inject({ url: `/geo/authoring/projects/${projectId}/visuals/cover?theme=dark` });
    expect(older.rawPayload).toEqual(PNG);
    mocks.codex = false;
    const noModel = await app2.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/drafts/1/visuals`,
      payload: { opId: "visual-no-model" },
    });
    expect(noModel.statusCode).toBe(400);
    expect(noModel.json().error).toContain("OpenAI Codex 로그인이 없습니다");
    mocks.codex = true;
    const base = await localServer();
    const urlResponse = await app2.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/sources/url`,
      payload: { url: `${base}/html`, kind: "blog" },
    });
    expect(urlResponse.statusCode).toBe(200);
    expect(urlResponse.json().source.status).toBe("extracted");
  });
});

describe("plain labels", () => {
  it("drops required/optional markers the screens add themselves", () => {
    expect(plainLabel("경계 도형 (선택)")).toBe("경계 도형");
    expect(plainLabel("격자 표(필수) 파일")).toBe("격자 표 파일");
    expect(plainLabel("Boundary (optional)")).toBe("Boundary");
    expect(plainLabel("선택 기준 표")).toBe("선택 기준 표");
  });
});

describe("authoring project author", () => {
  it("records the hub display name for the 'my methods' list and drops invalid names", async () => {
    const store = new AuthoringStore(await work("author-test-"));
    await store.initialize();
    const named = await store.create({ author: "  새연구자2 " });
    const unnamed = await store.create({ author: "x".repeat(41) });
    expect(named.author).toBe("새연구자2");
    expect(unnamed.author).toBeUndefined();
    const list = await store.list();
    expect(list.find((p) => p.id === named.id)?.author).toBe("새연구자2");
    expect(list.find((p) => p.id === unnamed.id)).not.toHaveProperty("author");
  });
});

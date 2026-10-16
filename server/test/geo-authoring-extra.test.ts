/** Local HTTP + fake image runtime only. Never makes a paid model call. */
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthoringError, AuthoringStore } from "../src/geo/authoring/store.ts";
import { addUrlSource, readableHtml, validateSourceUrl } from "../src/geo/authoring/url-sources.ts";
import { pageText, SOURCE_LIMIT_BYTES } from "../src/geo/authoring/sources.ts";
import {
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
    checkAuth: async (provider: string) => (provider === "openrouter" ? { type: "api_key" } : undefined),
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
    expect(generator.generate).toHaveBeenCalledTimes(4);
    expect(p.visuals!.evaluate).toMatchObject({
      model: "test/image",
      draftRevision: 1,
    });
    expect(p.visuals!.evaluate.caption).toContain("분석 자료가 아닙니다");
    expect(await store.readFile(projectId, p.visuals!.cover.file)).toEqual(PNG);
    const prompt = vi.mocked(generator.generate).mock.calls[0][0];
    expect(prompt).toContain("#1f5eff");
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
    expect(generator.generate).toHaveBeenCalledTimes(7);
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
    expect(generator.generate).toHaveBeenCalledTimes(7);
    expect(p.visuals!["output:zone"].caption).toContain("후보 구역");
    expect(p.visuals!["output:scores"]).toBeUndefined();
    expect(p.visuals!["output:report"]).toBeUndefined();
    expect(vi.mocked(generator.generate).mock.calls[5][0]).toContain("never an actual result");
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
      .mockRejectedValueOnce(Error("provider failure"));
    const run = await startVisuals(store, projectId, 1, { opId: "visual-fail" }, async () => fakeGenerator(generate));
    await run.completion;
    const p = await store.read(projectId);
    expect(p.visualOperations!["visual-fail"]).toMatchObject({
      status: "failed",
      completed: ["cover"],
    });
    expect(p.visuals!.cover).toBeTruthy();
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
  it("falls back to a connected image model, refuses none and cap reached before calls; ledgers a paid empty response", async () => {
    expect((await prepareRuntimeImageGenerator()).model).toBe("openrouter/fake-image");
    mocks.connected = false;
    await expect(prepareRuntimeImageGenerator()).rejects.toThrow("이미지 생성 모델이 연결되지 않았습니다");
    mocks.defaults.imageModel = "openrouter/fake-image";
    await expect(prepareRuntimeImageGenerator()).rejects.toMatchObject({ status: 401 });
    mocks.connected = true;
    mocks.budget.mockReturnValue({ exceeded: true });
    await expect(prepareRuntimeImageGenerator()).rejects.toMatchObject({
      status: 402,
    });
    expect(mocks.generate).not.toHaveBeenCalled();
    mocks.budget.mockReturnValue({ exceeded: false });
    mocks.generate.mockResolvedValue({
      stopReason: "stop",
      output: [],
      usage: {
        cost: { total: 0.03 },
        input: 10,
        output: 20,
        cacheRead: 0,
        totalTokens: 30,
      },
    });
    const generator = await prepareRuntimeImageGenerator();
    await expect(generator.generate("concept")).rejects.toThrow("그림을 반환하지");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: VISUALS_LEDGER_SESSION,
        model: "openrouter/fake-image",
        after: expect.objectContaining({ costUsd: 0.03 }),
      }),
    );
    mocks.budget.mockReturnValue({ exceeded: true });
    await expect(generator.generate("next")).rejects.toMatchObject({
      status: 402,
    });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it("shares the registered store; routes serve bytes, return 202 and report no connected model as Korean 400", async () => {
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
      payload: { opId: "visual-route", steps: [] },
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
    mocks.connected = false;
    const noModel = await app2.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/drafts/1/visuals`,
      payload: { opId: "visual-no-model" },
    });
    expect(noModel.statusCode).toBe(400);
    expect(noModel.json().error).toContain("이미지 생성 모델이 연결되지");
    mocks.connected = true;
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

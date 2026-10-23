/**
 * Example data of Workflow inputs in hub authoring (gaid-workflow-example): attach from an upload, a data-source file
 * or a public URL (loopback HTTP server), edit and remove as researcher revisions, carry-over onto model drafts, the
 * package's `examples/<roleId>/<name>` entries, and restoring the bytes when a registered Workflow is opened for editing.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { HubEntry } from "../../web/src/geo/contracts/hub-shared.ts";
import type { AttachExampleBody, MethodDraft } from "../../web/src/geo/contracts/authoring.ts";
import { EXAMPLE_LIMITS, exampleProblems } from "../../web/src/geo/contracts/workflow-examples.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { carryExamples, remoteDigest } from "../src/geo/authoring/examples.ts";
import { buildPackage, checkMethod, type PackageContext } from "../src/geo/authoring/package.ts";
import { registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import { registerSharedHubRoutes } from "../src/geo/hub-shared/routes.ts";
import { DEFAULT_FOLDER, SharedHubStore } from "../src/geo/hub-shared/store.ts";
import { readTarGz } from "../src/geo/tar.ts";
import { parseMethodFile } from "../src/geo/methods/method-file.ts";
import { analysis, cleanup, config, draftReply, fixture, reply, testVocabulary, work } from "./helpers/geo-authoring.ts";

const apps: FastifyInstance[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const s of servers.splice(0)) s.close();
  await cleanup();
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const deps = (content: unknown) => ({ chat: reply(content), config, vocabulary: testVocabulary() });
const CSV = Buffer.from("x,y,label\n1,2,1\n3,4,0\n");

async function setup() {
  const f = await fixture();
  await runOperation(f.store, f.projectId, "analyze", "ex-analyze", deps(analysis));
  const attempt = await runOperation(f.store, f.projectId, "draft", "ex-draft", deps(draftReply));
  expect(attempt.outcome).toMatch(/accepted|repaired/);
  const app = Fastify();
  apps.push(app);
  await registerAuthoringRoutes(app, { store: f.store, vocabulary: testVocabulary(), remote: { timeoutMs: 5000 } });
  const ctx: PackageContext = { store: f.store, vocabulary: testVocabulary(), checker: "gaid-hub@test" };
  const latest = async () => (await f.store.read(f.projectId)).drafts.at(-1)!;
  const attach = async (body: Omit<AttachExampleBody, "baseRevision">) =>
    app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${f.projectId}/examples`,
      payload: { baseRevision: (await latest()).revision, ...body },
    });
  return { ...f, app, ctx, latest, attach };
}

/** Loopback file server; `/redirect` sends to `/grid.csv`. */
async function fileServer(files: Record<string, Buffer>) {
  const server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/grid.csv" });
      return res.end();
    }
    const body = files[req.url ?? ""];
    if (!body) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { "content-length": body.length });
    res.end(body);
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  return `http://127.0.0.1:${port}`;
}

describe("hub authoring example data", () => {
  it("attaches an upload as a new researcher revision and bundles it at examples/<roleId>/<name>", async () => {
    const f = await setup();
    const before = await f.latest();
    const response = await f.attach({
      roleId: "grid",
      title: "합성 격자 표",
      source: "논문 그림 3을 따라 만든 합성 자료",
      license: "CC BY 4.0",
      synthetic: true,
      from: { kind: "upload", files: [{ name: "C:\\data\\grid table.csv", contentBase64: CSV.toString("base64") }] },
    });
    expect(response.statusCode, response.body).toBe(201);
    const draft = response.json<MethodDraft>();
    expect(draft).toMatchObject({ revision: before.revision + 1, baseRevision: before.revision, origin: "researcher" });
    const example = draft.workflow!.inputRoles[0].example!;
    expect(example).toEqual({
      title: { ko: "합성 격자 표" },
      source: { ko: "논문 그림 3을 따라 만든 합성 자료" },
      license: "CC BY 4.0",
      synthetic: true,
      files: [{ name: "grid table.csv", sha256: sha(CSV), size: CSV.length, path: "examples/grid/grid table.csv", from: { upload: true } }],
    });
    expect(await f.store.readFile(f.projectId, `examples/${sha(CSV)}`)).toEqual(CSV);
    // A stale base revision is refused.
    const stale = await f.app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${f.projectId}/examples`,
      payload: { baseRevision: before.revision, roleId: "grid", title: "t", source: "s", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: "YQ==" }] } },
    });
    expect(stale.statusCode).toBe(409);

    const p = await f.store.read(f.projectId);
    expect((await checkMethod(p, draft, f.ctx)).filter((x) => x.level === "error")).toEqual([]);
    const built = await buildPackage(p, draft, f.ctx);
    if (!("record" in built)) throw Error(JSON.stringify(built.findings));
    const entries = readTarGz(await f.store.readFile(f.projectId, built.record.archive));
    const bundled = entries.find((e) => e.path === `${draft.slug}/examples/grid/grid table.csv`)!;
    expect(bundled.data).toEqual(CSV);
    const manifest = JSON.parse(entries.find((e) => e.path === `${draft.slug}/gaid-method.json`)!.data.toString());
    const declared = manifest.workflows[0].inputRoles[0].example;
    expect(declared.files[0]).toEqual({ name: "grid table.csv", sha256: sha(CSV), size: CSV.length, path: "examples/grid/grid table.csv" });
    expect(exampleProblems(declared, "grid")).toEqual([]);
    expect(manifest.files).toContainEqual({ path: "examples/grid/grid table.csv", sha256: sha(CSV), size: CSV.length });
    // The installed side accepts what the authoring side packages.
    expect(parseMethodFile(manifest, draft.slug).issues).toEqual([]);
  });

  it("keeps packages of Workflows without examples byte-identical", async () => {
    const f = await setup();
    const p = await f.store.read(f.projectId);
    const draft = p.drafts.at(-1)!;
    const a = await buildPackage(p, draft, f.ctx);
    // Attach then remove: the Workflow is the same as before, so is the archive.
    expect((await f.attach({ roleId: "grid", title: "t", source: "s", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: CSV.toString("base64") }] } })).statusCode).toBe(201);
    const removed = await f.app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${f.projectId}/examples/grid/remove`,
      payload: { baseRevision: (await f.latest()).revision },
    });
    expect(removed.statusCode, removed.body).toBe(201);
    const after = removed.json<MethodDraft>();
    expect(after.workflow!.inputRoles[0].example).toBeUndefined();
    const b = await buildPackage(await f.store.read(f.projectId), { ...after, createdAt: draft.createdAt, revision: draft.revision }, f.ctx);
    if (!("record" in a) || !("record" in b)) throw Error("package failed");
    expect(b.record.sha256).toBe(a.record.sha256);
    expect(JSON.stringify(b.record.manifest)).not.toContain('"example"');
  });

  it("attaches files of a data source, checks their hashes and suggests nothing on its own", async () => {
    const f = await setup();
    const dir = await work("example-source-");
    await writeFile(join(dir, "grid.csv"), CSV);
    await writeFile(join(dir, "README.txt"), "provider: test\n");
    execFileSync("tar", ["-czf", join(dir, "data.tar.gz"), "-C", dir, "grid.csv", "README.txt"]);
    const { source } = await addSource(f.store, f.projectId, {
      name: "data.tar.gz",
      mediaType: "application/gzip",
      kind: "code",
      contentBase64: (await readFile(join(dir, "data.tar.gz"))).toString("base64"),
    });
    const missingTitle = await f.attach({ roleId: "grid", title: " ", source: "s", from: { kind: "source", sourceId: source.id, paths: ["grid.csv"] } });
    expect(missingTitle.statusCode).toBe(400);
    expect(missingTitle.json().error).toContain("제목");
    const response = await f.attach({
      roleId: "grid",
      title: "공개 격자",
      source: "data.tar.gz",
      from: { kind: "source", sourceId: source.id, paths: ["grid.csv", "README.txt"] },
    });
    expect(response.statusCode, response.body).toBe(201);
    const draft = response.json<MethodDraft>();
    const files = draft.workflow!.inputRoles[0].example!.files;
    expect(files.map((x) => [x.name, x.path, x.from])).toEqual([
      ["grid.csv", "examples/grid/grid.csv", { sourceId: source.id, sourcePath: "grid.csv" }],
      ["README.txt", "examples/grid/README.txt", { sourceId: source.id, sourcePath: "README.txt" }],
    ]);
    // Example files are data: a README with a personal path is not an instruction finding.
    const p = await f.store.read(f.projectId);
    expect((await checkMethod(p, draft, f.ctx)).filter((x) => x.level === "error")).toEqual([]);
    // A file that changed after it was attached blocks the package with a plain message.
    await f.store.writeFile(f.projectId, `sources/${source.id}/files/grid.csv`, Buffer.from("changed"));
    const findings = await checkMethod(p, draft, f.ctx);
    expect(findings).toContainEqual(expect.objectContaining({ code: "example-file", level: "error", plain: expect.stringContaining("예제 자료") }));
    expect("findings" in (await buildPackage(p, draft, f.ctx))).toBe(true);
  });

  it("records a public URL's sha256 and size without keeping its bytes, following one redirect", async () => {
    const f = await setup();
    const base = await fileServer({ "/grid.csv": CSV });
    const response = await f.attach({
      roleId: "grid",
      title: "공개 격자",
      source: "예제 서버",
      from: { kind: "url", files: [{ url: `${base}/redirect`, name: "grid.csv" }] },
    });
    expect(response.statusCode, response.body).toBe(201);
    const example = response.json<MethodDraft>().workflow!.inputRoles[0].example!;
    expect(example.files).toEqual([{ name: "grid.csv", sha256: sha(CSV), size: CSV.length, url: `${base}/redirect` }]);
    expect(f.store.exists(f.projectId, `examples/${sha(CSV)}`)).toBe(false);
    const p = await f.store.read(f.projectId);
    const built = await buildPackage(p, p.drafts.at(-1)!, f.ctx);
    if (!("record" in built)) throw Error(JSON.stringify(built.findings));
    expect(readTarGz(await f.store.readFile(f.projectId, built.record.archive)).some((e) => e.path.includes("/examples/"))).toBe(false);

    const missing = await f.attach({ roleId: "grid", title: "t", source: "s", from: { kind: "url", files: [{ url: `${base}/none.csv` }] } });
    expect(missing.statusCode).toBe(400);
    expect((await f.attach({ roleId: "grid", title: "t", source: "s", from: { kind: "url", files: [{ url: "http://example.org/a.csv" }] } })).statusCode).toBe(400);
    await expect(remoteDigest(`${base}/grid.csv`, { limitBytes: 4 })).rejects.toMatchObject({ status: 413 });
  });

  it("edits the text, refuses oversize bundles and unknown roles", async () => {
    const f = await setup();
    expect((await f.attach({ roleId: "grid", title: "격자", source: "출처", license: "CC0", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: CSV.toString("base64") }] } })).statusCode).toBe(201);
    const edited = await f.app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${f.projectId}/examples/grid`,
      payload: { baseRevision: (await f.latest()).revision, title: "새 제목", license: "", synthetic: true },
    });
    expect(edited.statusCode, edited.body).toBe(201);
    expect(edited.json<MethodDraft>().workflow!.inputRoles[0].example).toMatchObject({ title: { ko: "새 제목" }, source: { ko: "출처" }, synthetic: true });
    expect(edited.json<MethodDraft>().workflow!.inputRoles[0].example!.license).toBeUndefined();
    expect((await f.attach({ roleId: "nope", title: "t", source: "s", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: "YQ==" }] } })).statusCode).toBe(404);
    const big = Buffer.alloc(EXAMPLE_LIMITS.bundledFile + 1).toString("base64");
    expect((await f.attach({ roleId: "grid", title: "t", source: "s", from: { kind: "upload", files: [{ name: "big.bin", contentBase64: big }] } })).statusCode).toBe(413);
    expect((await f.attach({ roleId: "grid", title: "t", source: "s", from: { kind: "upload", files: [{ name: "id_rsa", contentBase64: "YQ==" }] } })).statusCode).toBe(400);
  });

  it("carries examples onto model drafts by input role id and notes a role that disappeared", async () => {
    const f = await setup();
    expect((await f.attach({ roleId: "grid", title: "격자", source: "출처", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: CSV.toString("base64") }] } })).statusCode).toBe(201);
    const withExample = await f.latest();
    // The model proposes its own example: dropped, the researcher's stays.
    const modelExample = { title: "모델", source: "모델", files: [{ name: "x.csv", sha256: "0".repeat(64), size: 1, url: "https://example.org/x.csv" }] };
    const revised = await runOperation(f.store, f.projectId, "revise", "ex-revise", {
      ...deps({ ...draftReply, workflow: { ...draftReply.workflow, inputRoles: [{ ...draftReply.workflow.inputRoles[0], example: modelExample }] } }),
      feedback: "요약을 다듬어 주세요.",
    });
    expect(revised.outcome).toMatch(/accepted|repaired/);
    const next = await f.latest();
    expect(next.origin).toBe("model");
    expect(next.workflow!.inputRoles[0].example).toEqual(withExample.workflow!.inputRoles[0].example);
    // The revise request does not show the example to the model.
    const record = await f.store.readFile(f.projectId, `attempts/${revised.record!.split("/").at(-1)}`).catch(() => null);
    if (record) expect(record.toString()).not.toContain(sha(CSV));

    const gone = structuredClone(next);
    gone.workflow!.inputRoles = [{ id: "other", label: { ko: "다른 입력" }, formats: ["csv"], required: true }];
    gone.notes = [];
    carryExamples(withExample, gone);
    expect(gone.workflow!.inputRoles[0].example).toBeUndefined();
    expect(gone.notes).toEqual([expect.stringContaining("격자 표")]);
  });

  it("restores bundled example bytes when a registered Workflow is opened for editing on another server", async () => {
    const f = await setup();
    const hub = new SharedHubStore(await work("example-hub-"));
    await registerSharedHubRoutes(f.app, { store: hub, agentDir: await work("example-agent-"), vocabulary: testVocabulary() });
    expect((await f.attach({ roleId: "grid", title: "격자", source: "출처", from: { kind: "upload", files: [{ name: "a.csv", contentBase64: CSV.toString("base64") }] } })).statusCode).toBe(201);
    const headers = { "X-GAID-User": encodeURIComponent("김 연구원") };
    const registered = await f.app.inject({
      method: "POST",
      url: "/geo/hub/entries",
      headers,
      payload: { authoringProjectId: f.projectId, folderId: DEFAULT_FOLDER, note: "예제 포함" },
    });
    expect(registered.statusCode, registered.body).toBe(201);
    const entry = registered.json<HubEntry>();
    await f.store.archive(f.projectId);
    const opened = await f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/edit`, headers, payload: {} });
    expect(opened.statusCode, opened.body).toBe(201);
    const { authoringProjectId } = opened.json();
    const seeded = await f.store.read(authoringProjectId);
    expect(seeded.drafts[0].workflow!.inputRoles[0].example!.files[0].from).toEqual({ upload: true });
    expect(await f.store.readFile(authoringProjectId, `examples/${sha(CSV)}`)).toEqual(CSV);
    const check = (await f.app.inject(`/geo/authoring/projects/${authoringProjectId}/drafts/1/check`)).json();
    expect(check.findings.filter((x: { code: string }) => x.code.startsWith("example"))).toEqual([]);
  });
});

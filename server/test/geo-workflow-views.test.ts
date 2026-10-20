import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, expect, it } from "vitest";
import { registerGeoWorkflowViewRoutes } from "../src/geo/routes/workflow-view.ts";
import { registerSharedHubRoutes } from "../src/geo/hub-shared/routes.ts";
import { SharedHubStore, DEFAULT_FOLDER } from "../src/geo/hub-shared/store.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { analysis, cleanup, config, draftReply, fixture, reply, testVocabulary, work } from "./helpers/geo-authoring.ts";
const apps: FastifyInstance[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); await cleanup(); });
async function setup() {
  const f = await fixture();
  const deps = (content: unknown) => ({ chat: reply(content), config, vocabulary: testVocabulary() });
  await runOperation(f.store, f.projectId, "analyze", "views-analyze", deps(analysis));
  await runOperation(f.store, f.projectId, "draft", "views-draft", deps(draftReply));
  const app = Fastify(); apps.push(app);
  await registerAuthoringRoutes(app, { store: f.store, vocabulary: testVocabulary() });
  await registerGeoWorkflowViewRoutes(app, { store: f.store });
  await registerSharedHubRoutes(app, { store: new SharedHubStore(await work("views-shared-")), authoringStore: f.store, vocabulary: testVocabulary(), catalogueWorkflows: () => [{ id: "catalogue-test", title: { ko: "기본 Workflow" }, skillIds: [], environmentProfile: "geo-core" }] });
  return { ...f, app };
}
it("serves the exact draft revision document read-only and rejects unknown revisions", async () => {
  const f = await setup();
  const before = await f.store.read(f.projectId);
  const revision = before.drafts.at(-1)!.revision;
  const r = await f.app.inject(`/geo/authoring/projects/${f.projectId}/drafts/${revision}/workflow`);
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().doc).toMatchObject({ schemaVersion: "gaid-workflow/v1", kind: "legacy", skills: [{ name: draftReply.slug, source: "bundled" }] });
  expect((await f.app.inject(`/geo/authoring/projects/${f.projectId}/drafts/999/workflow`)).statusCode).toBe(404);
  expect(await f.store.read(f.projectId)).toEqual(before);
});
it("serves a built-in recommendation document without project provisioning", async () => {
  const f = await setup();
  const r = await f.app.inject("/geo/hub/catalogue/catalogue-test");
  expect(r.statusCode, r.body).toBe(200);
  expect(r.json().doc.title.ko).toBe("기본 Workflow");
  expect((await f.app.inject("/geo/hub/catalogue/missing")).statusCode).toBe(404);
});
it("reads SKILL.md from the registered package, pinned to the shown revision", async () => {
  const f = await setup();
  const r = await f.app.inject({ method: "POST", url: "/geo/hub/entries", headers: { "X-GAID-User": encodeURIComponent("연구자") }, payload: { authoringProjectId: f.projectId, folderId: DEFAULT_FOLDER } });
  expect(r.statusCode, r.body).toBe(201);
  const entry = r.json();
  const source = await f.app.inject(`/geo/hub/entries/${entry.id}/skill-source?revision=1&name=${draftReply.slug}`);
  expect(source.statusCode, source.body).toBe(200);
  expect(source.json().content).toContain(`name: "${draftReply.slug}"`);
  expect(source.json().content).toContain(draftReply.instructions);
  expect((await f.app.inject(`/geo/hub/entries/${entry.id}/skill-source?revision=2&name=${draftReply.slug}`)).statusCode).toBe(404);
  expect((await f.app.inject(`/geo/hub/entries/${entry.id}/skill-source?revision=1&name=another`)).statusCode).toBe(404);
});

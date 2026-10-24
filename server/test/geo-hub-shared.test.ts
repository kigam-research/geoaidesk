/** Shared hub integration: real package builder/gate, isolated stores/projects, scripted authoring responses. */
import Fastify, { type FastifyInstance } from "fastify";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { HubEntry, HubEntryDetail } from "../../web/src/geo/contracts/hub-shared.ts";
import { runOperation } from "../src/geo/authoring/agent.ts";
import { editDraft, getAuthoringStore, registerAuthoringRoutes } from "../src/geo/authoring/routes.ts";
import { AuthoringStore } from "../src/geo/authoring/store.ts";
import { addSource } from "../src/geo/authoring/sources.ts";
import { registerSharedHubRoutes } from "../src/geo/hub-shared/routes.ts";
import { DEFAULT_FOLDER, SharedHubStore } from "../src/geo/hub-shared/store.ts";
import { geoStateDir } from "../src/geo/context.ts";
import type { GeoWorkflow } from "../src/geo/catalogue-types.ts";
import { recordMethodTrial } from "../src/geo/methods/trials.ts";
import { getSkillProvenance } from "../src/agent/skills-sync.ts";
import { originOfSource, packageStore } from "../src/geo/methods/package-origin.ts";
import { projectSkillRoot } from "../src/agent/skills.ts";
import { createProject, deleteProject, resolvePaths } from "../src/projects.ts";
import {
  analysis,
  cleanup,
  config,
  draftReply,
  fixture,
  reply,
  testVocabulary,
  work,
} from "./helpers/geo-authoring.ts";

const apps: FastifyInstance[] = [];
const projects: string[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const id of projects.splice(0)) deleteProject(id);
  await cleanup();
});
const headers = (name = "김 연구원") => ({ "X-GAID-User": encodeURIComponent(name) });
const deps = (content: unknown) => ({ chat: reply(content), config, vocabulary: testVocabulary() });
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  "base64",
);
const DARK = Buffer.from("dark-mode picture");
async function drafted(slug = draftReply.slug) {
  const f = await fixture();
  await runOperation(f.store, f.projectId, "analyze", "hub-analyze", deps(analysis));
  const attempt = await runOperation(f.store, f.projectId, "draft", "hub-draft", deps({ ...draftReply, slug, workflow: { ...draftReply.workflow, skills: draftReply.workflow.skills.map((s) => ({ ...s, name: slug })), steps: draftReply.workflow.steps.map((s) => ({ ...s, skill: slug })) } }));
  expect(attempt.outcome).toMatch(/accepted|repaired/);
  return f;
}
async function setup(withCatalogue = false) {
  const f = await drafted();
  const dir = await work("hub-shared-");
  const store = new SharedHubStore(dir);
  const agentDir = await work("hub-shared-agent-");
  const app = Fastify();
  apps.push(app);
  await registerAuthoringRoutes(app, { store: f.store, vocabulary: testVocabulary() });
  expect(getAuthoringStore(app)).toBe(f.store);
  await registerSharedHubRoutes(app, {
    store,
    agentDir,
    vocabulary: testVocabulary(),
    ...(withCatalogue
      ? {
          catalogueWorkflows: () =>
            Array.from(
              { length: 5 },
              (_, i) =>
                ({
                  id: `workflow-${i}`,
                  title: { ko: `Workflow ${i}` },
                  description: { ko: "카탈로그 방법" },
                  skillIds: [],
                  environmentProfile: "geo-core",
                  ...(i === 0 ? { image: "/catalogue-cover.png" } : {}),
                }) satisfies GeoWorkflow,
            ),
        }
      : {}),
  });
  await app.ready();
  const register = (author = "김 연구원", overrides = {}) =>
    app.inject({
      method: "POST",
      url: "/geo/hub/entries",
      headers: headers(author),
      payload: { authoringProjectId: f.projectId, folderId: DEFAULT_FOLDER, note: "공유 초안", ...overrides },
    });
  return { ...f, app, shared: store, agentDir, register };
}
function target() {
  const p = createProject({ name: "Shared hub test" });
  projects.push(p.id);
  return p;
}

describe("shared GAID hub", () => {
  it("refuses skill-only registration and explains the missing Workflow", async () => {
    const f = await setup();
    await f.store.mutate(f.projectId, (p) => { p.drafts.at(-1)!.workflow = null; p.drafts.at(-1)!.recipe = null; });
    const response = await f.register();
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatch(/Workflow가 없는 초안.*입력 자료, 분석 조건과 AI agent 지시문/);
    expect(await f.shared.list()).toHaveLength(0);
  });

  it("previews exact built draft files before installation without installing them", async () => {
    const f = await setup();
    expect((await f.register()).statusCode).toBe(201);
    const p = await f.store.read(f.projectId);
    const pkg = p.packages.at(-1)!;
    const project = target();
    const response = await f.app.inject({ method: "POST", url: `/geo/authoring/projects/${f.projectId}/packages/${pkg.revision}/preview`, payload: { projectId: project.id } });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ skills: [{ name: draftReply.slug }], contents: [{ name: draftReply.slug, files: expect.arrayContaining(["SKILL.md", "gaid-method.json"]), hasCode: false, prompts: expect.any(Array) }] });
    expect(getSkillProvenance(projectSkillRoot(resolvePaths(project.id)), draftReply.slug)).toBeNull();
    expect((await f.store.read(f.projectId)).installs).toHaveLength(0);
  });

  it("registers once per project, freezes draft/visual/package snapshots and keeps old revisions downloadable", async () => {
    const f = await setup();
    await f.store.writeFile(f.projectId, "visuals/prepare.png", PNG);
    await f.store.writeFile(f.projectId, "visuals/cover-dark.png", DARK);
    await f.store.mutate(f.projectId, (p) => {
      p.visuals = {
        prepare: { file: "visuals/prepare.png", caption: "입력 개념", model: "test", draftRevision: 1 },
        cover: { file: "visuals/prepare.png", dark: "visuals/cover-dark.png", caption: "대표 그림", model: "test", draftRevision: 1 },
        "output:scores": { file: "visuals/prepare.png", caption: "점수 결과", model: "test", draftRevision: 1 },
      };
    });
    const registered = await f.register();
    expect(registered.statusCode, registered.body).toBe(201);
    const entry = registered.json<HubEntry>();
    expect(entry).toMatchObject({
      author: "김 연구원",
      folderId: DEFAULT_FOLDER,
      latestRevision: 1,
      stars: 0,
      comments: 0,
      trials: 0,
      kind: "workflow",
      implementation: "descriptive",
      tags: ["modeling"],
    });
    expect(entry.cover).toContain("revision=1");
    expect(entry.coverThemed).toBe(true);
    expect((await f.app.inject(`${entry.cover!}&theme=dark`)).rawPayload).toEqual(DARK);
    const detail = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(detail.profile.title).toEqual({ ko: draftReply.title });
    expect(detail.workflowTitle).toEqual({ ko: draftReply.workflow.title });
    expect(detail.visuals.prepare.caption).toBe("입력 개념");
    expect(detail.visuals.prepare.themed).toBeUndefined();
    expect((await f.app.inject(`${detail.visuals.prepare.src}&theme=dark`)).rawPayload).toEqual(PNG);
    expect(Object.keys(detail.visuals)).toEqual(["prepare"]);
    expect(detail.outputImages.scores.caption).toBe("점수 결과");
    expect((await f.app.inject(detail.outputImages.scores.src)).rawPayload).toEqual(PNG);
    const image = await f.app.inject(detail.visuals.prepare.src);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.rawPayload).toEqual(PNG);
    expect((await f.app.inject(entry.cover!)).rawPayload).toEqual(PNG);
    const archive = await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz`);
    expect(archive.statusCode).toBe(200);
    const p = await f.store.read(f.projectId);
    expect(p.packages).toHaveLength(1);
    expect(archive.rawPayload).toEqual(await f.store.readFile(f.projectId, p.packages[0].archive));

    // Code availability follows the registered snapshot, never a private later draft.
    const codeDir = await work("hub-shared-code-");
    await writeFile(join(codeDir, "run.py"), "print('trial')\n");
    execFileSync("tar", ["-czf", join(codeDir, "code.tar.gz"), "-C", codeDir, "run.py"]);
    const code = await addSource(f.store, f.projectId, {
      name: "code.tar.gz", mediaType: "application/gzip",
      contentBase64: (await readFile(join(codeDir, "code.tar.gz"))).toString("base64"),
    });
    await f.store.mutate(f.projectId, (p) => {
      p.drafts.push(editDraft(p, { baseRevision: 1, title: "새 판 제목" }));
      p.drafts.at(-1)!.codeFiles.push({ path: "scripts/run.py", sourceId: code.source.id, sourcePath: "run.py" });
    });
    await f.store.writeFile(f.projectId, "visuals/prepare.png", Buffer.from("changed private image"));
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}`)).json().profile).toEqual(detail.profile);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}`)).json().entry.implementation).toBe("descriptive");
    expect((await f.app.inject(entry.cover!)).rawPayload).toEqual(PNG);
    expect((await new SharedHubStore(f.shared.root).read(entry.id)).snapshots[1].draft.profile).toEqual(detail.profile);
    const r2 = await f.register();
    expect(r2.statusCode, r2.body).toBe(201);
    // Pictures whose step/output/cover still exists carry into the next revision (as the draft shows them), frozen anew.
    expect(r2.json()).toMatchObject({ id: entry.id, latestRevision: 2, title: "새 판 제목", implementation: "implemented" });
    expect(r2.json().cover).toContain("revision=2");
    expect((await f.app.inject("/geo/hub/entries")).json().entries[0].implementation).toBe("implemented");
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz?revision=1`)).rawPayload).toEqual(
      archive.rawPayload,
    );
    expect((await f.app.inject(entry.cover!)).rawPayload).toEqual(PNG);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/cover`)).rawPayload).toEqual(
      Buffer.from("changed private image"),
    );
    await f.register();
    expect((await f.store.read(f.projectId)).packages).toHaveLength(2);
    expect(await f.shared.list()).toHaveLength(1);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz?revision=0`)).statusCode).toBe(404);
  });

  it("decodes name identity, refuses missing/invalid users and non-author revisions, and validates mutation bodies", async () => {
    const f = await setup();
    expect((await f.app.inject("/geo/hub/me")).json()).toEqual({ name: null });
    expect((await f.app.inject({ url: "/geo/hub/me", headers: headers("  연구자 🌏  ") })).json()).toEqual({
      name: "연구자 🌏",
    });
    const entry = (await f.register()).json<HubEntry>();
    expect((await f.register("다른 연구원")).statusCode).toBe(403);
    expect((await f.store.read(f.projectId)).packages).toHaveLength(1);
    const mutations = [
      { url: "/geo/hub/folders", payload: { name: "폴더" } },
      { url: "/geo/hub/entries", payload: { authoringProjectId: f.projectId, folderId: DEFAULT_FOLDER, note: "" } },
      { url: `/geo/hub/entries/${entry.id}/star`, payload: { on: true } },
      { url: `/geo/hub/entries/${entry.id}/comments`, payload: { body: "댓글" } },
      { url: `/geo/hub/entries/${entry.id}/install`, payload: { projectId: "default", acknowledged: true } },
    ];
    for (const mutation of mutations) {
      const response = await f.app.inject({ method: "POST", ...mutation });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toContain("이름");
    }
    for (const name of ["", " ", "a".repeat(41), "%broken", "%00bad"]) {
      const response = await f.app.inject({
        method: "POST",
        url: `/geo/hub/entries/${entry.id}/star`,
        headers: { "X-GAID-User": name },
        payload: { on: true },
      });
      expect(response.statusCode).toBe(401);
    }
    expect((await f.register("김 연구원", { folderId: "missing" })).statusCode).toBe(404);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: `/geo/hub/entries/${entry.id}/star`,
          headers: headers(),
          payload: { on: "true" },
        })
      ).statusCode,
    ).toBe(400);
    for (const body of [" ", "a".repeat(4001)])
      expect(
        (
          await f.app.inject({
            method: "POST",
            url: `/geo/hub/entries/${entry.id}/comments`,
            headers: headers(),
            payload: { body },
          })
        ).statusCode,
      ).toBe(400);
  });

  it("serializes two-user stars, appends revision-bound comments, counts folders and fills recommended cards", async () => {
    const f = await setup(true);
    const initial = (await f.app.inject("/geo/hub/recommended")).json().cards;
    expect(initial).toHaveLength(4);
    expect(initial[0]).toMatchObject({ source: "catalogue", image: "/catalogue-cover.png" });
    const folder = (
      await f.app.inject({
        method: "POST",
        url: "/geo/hub/folders",
        headers: headers(),
        payload: { name: "광물 탐사" },
      })
    ).json();
    const entry = (await f.register("김 연구원", { folderId: folder.id })).json<HubEntry>();
    const star = (name: string, on: boolean) =>
      f.app.inject({
        method: "POST",
        url: `/geo/hub/entries/${entry.id}/star`,
        headers: headers(name),
        payload: { on },
      });
    await Promise.all([star("김 연구원", true), star("이 연구원", true), star("__proto__", true)]);
    expect((await star("__proto__", false)).json()).toEqual({ stars: 2, starredByMe: false });
    expect((await star("이 연구원", true)).json()).toEqual({ stars: 2, starredByMe: true });
    const comment = await f.app.inject({
      method: "POST",
      url: `/geo/hub/entries/${entry.id}/comments`,
      headers: headers("이 연구원"),
      payload: { body: "  새 자료에도 적용했습니다.  " },
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({ author: "이 연구원", revision: 1, body: "새 자료에도 적용했습니다." });
    await f.register("김 연구원", { folderId: folder.id });
    await Promise.all(
      ["김 연구원", "이 연구원"].map((name) =>
        f.app.inject({
          method: "POST",
          url: `/geo/hub/entries/${entry.id}/comments`,
          headers: headers(name),
          payload: { body: "후속 의견" },
        }),
      ),
    );
    const comments = (await f.app.inject(`/geo/hub/entries/${entry.id}/comments`)).json().comments;
    expect(comments.map((c: { revision: number }) => c.revision)).toEqual([1, 2, 2]);
    expect(await new SharedHubStore(f.shared.root).comments(entry.id)).toEqual(comments);
    expect(
      (await f.app.inject({ url: `/geo/hub/entries/${entry.id}`, headers: headers("이 연구원") })).json().entry,
    ).toMatchObject({ stars: 2, starredByMe: true, comments: 3 });
    expect((await f.app.inject("/geo/hub/folders")).json().folders).toContainEqual({ ...folder, entries: 1 });
    expect((await f.app.inject(`/geo/hub/entries?folder=${folder.id}&q=modeling`)).json().entries).toHaveLength(1);
    expect((await f.app.inject("/geo/hub/entries?q=absent")).json().entries).toHaveLength(0);
    const cards = (await f.app.inject("/geo/hub/recommended")).json().cards;
    expect(cards).toHaveLength(4);
    expect(cards[0]).toMatchObject({ source: "shared", ref: entry.id, stars: 2 });
    expect(cards[1].source).toBe("catalogue");
    await star("김 연구원", false);
    await star("이 연구원", false);
    expect(
      (await f.app.inject("/geo/hub/recommended"))
        .json()
        .cards.every((c: { source: string }) => c.source === "catalogue"),
    ).toBe(true);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: "/geo/hub/folders",
          headers: headers(),
          payload: { name: "광물 탐사" },
        })
      ).statusCode,
    ).toBe(409);
  });

  it("carries the Workflow's own stages on entries and recommended cards, inventing none", async () => {
    const f = await setup(true);
    const entry = (await f.register()).json<HubEntry>();
    const stages = { titles: [{ ko: "자료 준비" }, { ko: "nested CV" }, { ko: "보고" }], inputs: ["CSV"], outputs: [{ ko: "점수 표" }] };
    expect(entry.stages).toEqual(stages);
    expect((await f.app.inject("/geo/hub/entries")).json().entries[0].stages).toEqual(stages);
    await f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/star`, headers: headers(), payload: { on: true } });
    const cards = (await f.app.inject("/geo/hub/recommended")).json().cards;
    expect(cards[0]).toMatchObject({ source: "shared", stages });
    // Catalogue Workflows without steps or a skill procedure get no stages (the card keeps its neutral plate).
    expect(cards.slice(1).every((c: { stages?: unknown }) => c.stages === undefined)).toBe(true);
  });

  it("orders starred entries first and skips catalogue fallback when the catalogue is off", async () => {
    const f = await setup();
    const first = (await f.register()).json<HubEntry>();
    const second = await f.store.create({ title: "다른 방법" });
    const p = await f.store.read(f.projectId);
    await f.store.mutate(second.id, (s) => {
      s.drafts = structuredClone(p.drafts);
      s.drafts[0].slug = "other-method";
      for (const skill of s.drafts[0].workflow?.skills ?? []) if (skill.source === "bundled") skill.name = "other-method";
      for (const step of s.drafts[0].workflow?.steps ?? []) if (step.skill === draftReply.slug) step.skill = "other-method";
      s.drafts[0].workflow!.skillIds = ["local:other-method"];
      s.drafts[0].workflow!.expectedArtifacts.forEach((a) => {
        a.skill = "local:other-method";
      });
    });
    const r = await f.register("김 연구원", { authoringProjectId: second.id });
    expect(r.statusCode, r.body).toBe(201);
    const other = r.json<HubEntry>();
    await f.app.inject({
      method: "POST",
      url: `/geo/hub/entries/${first.id}/star`,
      headers: headers(),
      payload: { on: true },
    });
    await Promise.all(
      ["김 연구원", "이 연구원"].map((name) =>
        f.app.inject({
          method: "POST",
          url: `/geo/hub/entries/${other.id}/star`,
          headers: headers(name),
          payload: { on: true },
        }),
      ),
    );
    expect((await f.app.inject("/geo/hub/recommended")).json().cards.map((c: { ref: string }) => c.ref)).toEqual([
      other.id,
      first.id,
    ]);
  });

  it("browses all researchers by title, tagline, author and taxonomy labels, combining folder filters and ranking", async () => {
    const f = await setup();
    const first = (await f.register()).json<HubEntry>();
    const folder = (await f.app.inject({ method: "POST", url: "/geo/hub/folders", headers: headers(), payload: { name: "지도" } })).json();
    const second = await f.store.create({ title: "다른 작업" });
    const project = await f.store.read(f.projectId);
    await f.store.mutate(second.id, (s) => {
      s.drafts = structuredClone(project.drafts);
      s.drafts[0].slug = "map-method";
      for (const skill of s.drafts[0].workflow?.skills ?? []) if (skill.source === "bundled") skill.name = "map-method";
      for (const step of s.drafts[0].workflow?.steps ?? []) if (step.skill === draftReply.slug) step.skill = "map-method";
      s.drafts[0].profile.title = "좌표 비교";
      s.drafts[0].profile.tagline = { ko: "독립적인 한 줄 설명", en: "Unique bilingual tagline" };
      s.drafts[0].description += " Ni exploration instructions.";
      s.drafts[0].profile.inputs![0].label = { ko: "시료 좌표", en: "sample coordinates" };
      s.drafts[0].profile.outputs[0].label = { ko: "우선순위 결과", en: "priority results" };
      s.drafts[0].profile.limitations[0].text = { ko: "현장 확인 전", en: "Field confirmation pending" };
      s.drafts[0].workflow!.skillIds = ["local:map-method"];
      s.drafts[0].workflow!.expectedArtifacts.forEach((a) => { a.skill = "local:map-method"; });
    });
    const registered = await f.register("박 연구원", { authoringProjectId: second.id, folderId: folder.id });
    expect(registered.statusCode, registered.body).toBe(201);
    const other = registered.json<HubEntry>();
    for (const [id, at] of [[first.id, "2026-10-16T00:00:00Z"], [other.id, "2026-10-17T00:00:00Z"]]) {
      const record = await f.shared.read(id);
      record.entry.updatedAt = at;
      await f.shared.write(record);
    }
    const list = async (q = "", folderId = "") => (await f.app.inject({ url: "/geo/hub/entries?" + new URLSearchParams({ q, ...(folderId ? { folder: folderId } : {}) }) })).json().entries as HubEntry[];
    expect((await list()).map((e) => e.id)).toEqual([other.id, first.id]);
    for (const q of ["좌표 비교", "독립적인 한 줄", "  UNIQUE BILINGUAL  ", "박 연구원"]) {
      expect((await list(q)).map((e) => e.id), q).toEqual([other.id]);
    }
    expect((await list("모델링")).map((e) => e.id)).toEqual([other.id, first.id]);
    expect((await list("Modelling")).length).toBe(2);
    expect((await list("모델링", folder.id)).map((e) => e.id)).toEqual([other.id]);
    expect(await list("박 연구원", DEFAULT_FOLDER)).toEqual([]);
    expect(await list("missing")).toEqual([]);
    expect(await list("", "missing")).toEqual([]);
    expect((await list("좌표 비교"))[0].tagline).toBe("독립적인 한 줄 설명");
    for (const q of ["니켈", "nickel", "니켈 비교", "시료 우선순위", "sample results", "현장 확인", "field pending"]) {
      expect((await list(q)).map((e) => e.id), q).toEqual([other.id]);
    }
    expect(await list("니켈 없는말")).toEqual([]);
    expect(await list("니켈", DEFAULT_FOLDER)).toEqual([]);
    await f.app.inject({ method: "POST", url: `/geo/hub/entries/${first.id}/star`, headers: headers(), payload: { on: true } });
    expect((await list()).map((e) => e.id)).toEqual([first.id, other.id]);
  });

  it("installs registered bytes through the normal gate, preserves local/foreign skills and counts actual trial records", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    const project = target();
    const install = (acknowledged = true) =>
      f.app.inject({
        method: "POST",
        url: `/geo/hub/entries/${entry.id}/install`,
        headers: headers("이 연구원"),
        payload: { projectId: project.id, acknowledged },
      });
    expect((await install(false)).statusCode).toBe(400);
    const installed = await install();
    expect(installed.statusCode, installed.body).toBe(201);
    expect(installed.json()).toMatchObject({
      workflowId: draftReply.slug,
      recipeId: `${draftReply.slug}-default`,
      install: { projectId: project.id, methodKey: `project:${draftReply.slug}` },
    });
    const recorded = getSkillProvenance(projectSkillRoot(resolvePaths(project.id)), draftReply.slug);
    expect(originOfSource(recorded?.source, packageStore(f.agentDir)).origin).toMatchObject({ kind: "gaid-hub", hubEntry: { id: entry.id, revision: 1, version: "0.1.0" } });
    expect((await install()).statusCode).toBe(201);
    expect((await f.shared.read(entry.id)).installs).toHaveLength(2);
    // The revision the researcher looked at is installed; an unknown or malformed revision is refused.
    const pinned = (revision: unknown) =>
      f.app.inject({
        method: "POST",
        url: `/geo/hub/entries/${entry.id}/install`,
        headers: headers("이 연구원"),
        payload: { projectId: project.id, acknowledged: true, revision },
      });
    const atOne = await pinned(1);
    expect(atOne.statusCode, atOne.body).toBe(201);
    expect(atOne.json().install.packageRevision).toBeGreaterThanOrEqual(1);
    expect((await pinned(9)).statusCode).toBe(404);
    expect((await pinned(0)).statusCode).toBe(400);
    expect((await f.shared.read(entry.id)).installs).toHaveLength(3);
    const paths = resolvePaths(project.id);
    const trial = recordMethodTrial(
      paths,
      "shared-trial",
      `method:${draftReply.slug}:${draftReply.slug}`,
      undefined,
      packageStore(f.agentDir),
    );
    expect(trial).not.toBeNull();
    const trialDir = join(geoStateDir(paths), "method-trials");
    await writeFile(
      join(trialDir, "other.json"),
      JSON.stringify({ ...trial, sessionId: "other", packageSha256: "other-package" }),
    );
    await writeFile(join(trialDir, "broken.json"), "{");
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}`)).json().entry.trials).toBe(1);
    const root = projectSkillRoot(paths);
    const file = join(root.skillsDir, draftReply.slug, "SKILL.md");
    const edited = (await readFile(file, "utf8")) + "\nLocal edits\n";
    await writeFile(file, edited);
    expect((await install()).statusCode).toBe(409);
    expect(await readFile(file, "utf8")).toBe(edited);
    // Disabled skills are equally protected; the installer must not silently replace that copy either.
    await mkdir(root.disabledDir, { recursive: true });
    await rename(join(root.skillsDir, draftReply.slug), join(root.disabledDir, draftReply.slug));
    expect((await install()).statusCode).toBe(409);
    const foreign = target();
    const foreignRoot = projectSkillRoot(resolvePaths(foreign.id));
    await mkdir(join(foreignRoot.disabledDir, draftReply.slug), { recursive: true });
    await writeFile(join(foreignRoot.disabledDir, draftReply.slug, "SKILL.md"), "foreign skill");
    const conflict = await f.app.inject({
      method: "POST",
      url: `/geo/hub/entries/${entry.id}/install`,
      headers: headers(),
      payload: { projectId: foreign.id, acknowledged: true },
    });
    expect(conflict.statusCode, conflict.body).toBe(409);
    expect(await readFile(join(foreignRoot.disabledDir, draftReply.slug, "SKILL.md"), "utf8")).toBe("foreign skill");
  });

  it("refuses a failing draft with a CheckResult and serializes concurrent registration into one entry/package", async () => {
    const f = await setup();
    await f.store.mutate(f.projectId, (p) => {
      p.drafts[0].workflow!.environmentProfile = "missing-env";
    });
    const failed = await f.register();
    expect(failed.statusCode, failed.body).toBe(409);
    expect(failed.json()).toMatchObject({ passed: false, draftRevision: 1 });
    expect(failed.json().findings.length).toBeGreaterThan(0);
    expect(await f.shared.list()).toHaveLength(0);
    expect((await f.store.read(f.projectId)).packages).toHaveLength(0);
    await f.store.mutate(f.projectId, (p) => {
      p.drafts[0].workflow!.environmentProfile = "geo-mpm";
    });
    const results = await Promise.all([f.register(), f.register()]);
    expect(results.map((r) => r.statusCode)).toEqual([201, 201]);
    expect(results[0].json().id).toBe(results[1].json().id);
    expect((await f.store.read(f.projectId)).packages).toHaveLength(1);
    expect((await f.shared.list())[0].entry.revisions).toHaveLength(2);
    const folder = (await f.app.inject("/geo/hub/folders")).json().folders[0];
    expect(folder).toMatchObject({ id: DEFAULT_FOLDER, name: "일반", entries: 1 });
    // A malformed log is reported instead of erased or silently counted as empty.
    await writeFile(f.shared.within(results[0].json().id, "comments.jsonl"), "{");
    expect((await f.app.inject(`/geo/hub/entries/${results[0].json().id}`)).statusCode).toBe(409);
    const comment = await f.app.inject({
      method: "POST",
      url: `/geo/hub/entries/${results[0].json().id}/comments`,
      headers: headers(),
      payload: { body: "hello" },
    });
    expect(comment.statusCode).toBe(409);
    expect(await readFile(f.shared.within(results[0].json().id, "comments.jsonl"), "utf8")).toBe("{");
  });
});

describe("editing a registered method (gaid-hub-editing)", () => {
  const edit = (f: Awaited<ReturnType<typeof setup>>, id: string, user: string) =>
    f.app.inject({ method: "POST", url: `/geo/hub/entries/${id}/edit`, headers: headers(user), payload: {} });
  const registerFrom = (f: Awaited<ReturnType<typeof setup>>, projectId: string, user: string) =>
    f.app.inject({
      method: "POST",
      url: "/geo/hub/entries",
      headers: headers(user),
      payload: { authoringProjectId: projectId, folderId: DEFAULT_FOLDER, note: "고친 판" },
    });
  const reviseSummary = async (f: Awaited<ReturnType<typeof setup>>, projectId: string, summary: string) => {
    const p = await f.store.read(projectId);
    const response = await f.app.inject({
      method: "POST",
      url: `/geo/authoring/projects/${projectId}/drafts`,
      payload: { baseRevision: p.drafts.at(-1)!.revision, summary },
    });
    expect(response.statusCode, response.body).toBe(201);
  };

  it("lets the author reopen the linked draft and register the next revision of the same entry", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    expect((await f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/edit` })).statusCode).toBe(401);
    const opened = await edit(f, entry.id, "김 연구원");
    expect(opened.statusCode).toBe(200);
    expect(opened.json()).toEqual({ authoringProjectId: f.projectId, mode: "edit", created: false });
    await reviseSummary(f, f.projectId, "고친 요약");
    const second = await f.register();
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json<HubEntry>()).toMatchObject({ id: entry.id, latestRevision: 2, author: "김 연구원" });
    const detail = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(detail.profile.summary).toEqual({ ko: "고친 요약" });
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz?revision=1`)).statusCode).toBe(200);
  });

  it("registers 0.1.0 first, then the version step the registrant picks, and reads older records as 0.1.x", async () => {
    const f = await setup();
    const first = (await f.register()).json<HubEntry>();
    expect(first.revisions.map((r) => r.version)).toEqual(["0.1.0"]);
    await reviseSummary(f, f.projectId, "고친 요약");
    expect((await f.register("김 연구원", { bump: "huge" })).statusCode).toBe(400);
    const minor = await f.register("김 연구원", { bump: "minor" });
    expect(minor.statusCode, minor.body).toBe(201);
    expect(minor.json<HubEntry>().revisions.map((r) => r.version)).toEqual(["0.1.0", "0.2.0"]);
    await reviseSummary(f, f.projectId, "정식 배포 요약");
    const major = await f.register("김 연구원", { bump: "major" });
    expect(major.json<HubEntry>().revisions.map((r) => r.version)).toEqual(["0.1.0", "0.2.0", "1.0.0"]);
    const detail = (await f.app.inject(`/geo/hub/entries/${first.id}`)).json<HubEntryDetail>();
    expect(detail.workflowDoc?.version).toBe("1.0.0");
    // A record registered before versions (no stored version) reads 0.1.0, 0.1.1, 0.1.2; the stored record is not rewritten.
    const raw = await f.shared.read(first.id);
    for (const r of raw.entry.revisions) delete r.version;
    await f.shared.write(raw);
    const listed = (await f.app.inject({ url: "/geo/hub/entries", headers: headers() })).json<{ entries: HubEntry[] }>().entries;
    expect(listed[0].revisions.map((r) => r.version)).toEqual(["0.1.0", "0.1.1", "0.1.2"]);
    expect((await f.shared.read(first.id)).entry.revisions.every((r) => r.version === undefined)).toBe(true);
    await reviseSummary(f, f.projectId, "그다음 요약");
    const patch = await f.register();
    expect(patch.json<HubEntry>().revisions.map((r) => r.version)).toEqual(["0.1.0", "0.1.1", "0.1.2", "0.1.3"]);
  });

  it("removes a registered Workflow for its registrant only, hides it everywhere, keeps installed copies and restores it", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    const project = target();
    const install = () => f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/install`, headers: headers("이 연구원"),
      payload: { projectId: project.id, acknowledged: true } });
    expect((await install()).statusCode).toBe(201);
    const installedDir = join(resolvePaths(project.id).sandbox, ".pi", "skills", draftReply.slug);
    const remove = (user: string, reason?: string) => f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/remove`,
      headers: headers(user), payload: reason === undefined ? {} : { reason } });
    expect((await f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/remove`, payload: {} })).statusCode).toBe(401);
    expect((await remove("이 연구원")).statusCode).toBe(403);
    expect((await remove("김 연구원", "x".repeat(501))).statusCode).toBe(400);
    expect((await remove("김 연구원", "중복 등록")).statusCode).toBe(204);
    expect((await remove("김 연구원")).statusCode).toBe(409);
    expect((await f.app.inject({ url: "/geo/hub/entries", headers: headers() })).json().entries).toEqual([]);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}`)).statusCode).toBe(404);
    expect((await f.app.inject("/geo/hub/folders")).json().folders.find((x: { id: string }) => x.id === DEFAULT_FOLDER).entries).toBe(0);
    expect((await install()).statusCode).toBe(404);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz`)).statusCode).toBe(404);
    // The copy installed before the removal stays in the project.
    expect((await readFile(join(installedDir, "SKILL.md"), "utf8")).length).toBeGreaterThan(0);
    // Registering again from the same draft is refused while removed.
    await reviseSummary(f, f.projectId, "제거 뒤 고친 요약");
    const again = await f.register();
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toContain("제거한 Workflow");
    expect((await f.app.inject({ url: "/geo/hub/removed", headers: headers("이 연구원") })).json().entries).toEqual([]);
    const removed = (await f.app.inject({ url: "/geo/hub/removed", headers: headers() })).json<{ entries: HubEntry[] }>().entries;
    expect(removed.map((e) => [e.id, e.removed?.by, e.removed?.reason, e.revisions[0].version])).toEqual([[entry.id, "김 연구원", "중복 등록", "0.1.0"]]);
    const restore = (user: string) => f.app.inject({ method: "POST", url: `/geo/hub/entries/${entry.id}/restore`, headers: headers(user), payload: {} });
    expect((await restore("이 연구원")).statusCode).toBe(403);
    const restored = await restore("김 연구원");
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json<HubEntry>()).toMatchObject({ id: entry.id, latestRevision: 1 });
    expect(restored.json<HubEntry>().removed).toBeUndefined();
    expect((await restore("김 연구원")).statusCode).toBe(404);
    expect((await f.app.inject({ url: "/geo/hub/entries", headers: headers() })).json().entries).toHaveLength(1);
    const history = (await readFile(join(f.shared.entryDir(entry.id), "removals.jsonl"), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
    expect(history.map((h) => [h.action, h.by])).toEqual([["remove", "김 연구원"], ["restore", "김 연구원"]]);
    expect((await f.register()).statusCode).toBe(201);
  });

  it("seeds a draft from the registered revision when the author's draft is not on this server", async () => {
    const f = await setup();
    await f.store.writeFile(f.projectId, "visuals/prepare.png", PNG);
    const codeDir = await work("hub-edit-code-");
    await writeFile(join(codeDir, "run.py"), "print('trial')\n");
    execFileSync("tar", ["-czf", join(codeDir, "code.tar.gz"), "-C", codeDir, "run.py"]);
    const code = await addSource(f.store, f.projectId, {
      name: "code.tar.gz", mediaType: "application/gzip",
      contentBase64: (await readFile(join(codeDir, "code.tar.gz"))).toString("base64"),
    });
    await f.store.mutate(f.projectId, (p) => {
      p.visuals = { prepare: { file: "visuals/prepare.png", dark: "visuals/prepare.png", caption: "입력 개념", model: "test", draftRevision: 2 } };
      p.drafts.push(editDraft(p, { baseRevision: 1, title: "코드 포함 판" }));
      p.drafts.at(-1)!.codeFiles.push({ path: "scripts/run.py", sourceId: code.source.id, sourcePath: "run.py" });
    });
    const entry = (await f.register()).json<HubEntry>();
    expect(entry.implementation).toBe("implemented");
    await f.store.archive(f.projectId);
    const opened = await edit(f, entry.id, "김 연구원");
    expect(opened.statusCode).toBe(201);
    const { authoringProjectId, mode } = opened.json();
    expect(mode).toBe("edit");
    expect(authoringProjectId).not.toBe(f.projectId);
    const seeded = await f.store.read(authoringProjectId);
    expect(seeded).toMatchObject({
      author: "김 연구원",
      hubEntry: { entryId: entry.id, revision: 1, mode: "edit", author: "김 연구원" },
    });
    expect(seeded.drafts).toHaveLength(1);
    expect(seeded.drafts[0]).toMatchObject({ revision: 1, origin: "researcher", slug: draftReply.slug });
    expect(await f.store.readFile(authoringProjectId, seeded.visuals!.prepare.file)).toEqual(PNG);
    expect(await f.store.readFile(authoringProjectId, seeded.visuals!.prepare.dark!)).toEqual(PNG);
    // The registered package is the code source; the seeded draft's code files resolve inside it.
    const check = (await f.app.inject(`/geo/authoring/projects/${authoringProjectId}/drafts/1/check`)).json();
    expect(check.findings.filter((x: { code: string }) => x.code === "draft-files")).toEqual([]);
    // A second click reopens the seeded draft.
    expect((await edit(f, entry.id, "김 연구원")).json()).toMatchObject({ authoringProjectId, created: false });
    await reviseSummary(f, authoringProjectId, "새 서버에서 고친 요약");
    const second = await registerFrom(f, authoringProjectId, "김 연구원");
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json<HubEntry>()).toMatchObject({ id: entry.id, latestRevision: 2 });
    const detail = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(detail.visuals.prepare.caption).toBe("입력 개념");
    // Another name cannot add revisions through the author's seeded draft.
    expect((await registerFrom(f, authoringProjectId, "다른 연구원")).statusCode).toBe(403);
  });

  it("re-registers a linked legacy draft with a structured snapshot and document without rewriting the old draft", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    await f.store.mutate(f.projectId, (p) => {
      const w = p.drafts[0].workflow!;
      w.schemaVersion = "geo-workflow/v1";
      delete w.skills;
      delete w.steps;
      for (const pkg of p.packages) pkg.manifest.workflows[0].schemaVersion = "geo-workflow/v1";
    });
    const before = JSON.stringify((await f.store.read(f.projectId)).drafts);
    expect((await edit(f, entry.id, "김 연구원")).json()).toMatchObject({ authoringProjectId: f.projectId, created: false });
    const next = await f.register();
    expect(next.statusCode, next.body).toBe(201);
    const record = await f.shared.read(entry.id);
    expect(record.snapshots[2].package.manifest.workflows[0].schemaVersion).toBe("gaid-workflow/v1");
    expect(record.snapshots[2].draft.workflow!.schemaVersion).toBe("gaid-workflow/v1");
    const detail = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(detail.workflowDoc?.kind).toBe("structured");
    expect(JSON.stringify((await f.store.read(f.projectId)).drafts)).toBe(before);
  });

  it("seeds legacy registered snapshots with derived structured steps and leaves the snapshot unchanged", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    const record = await f.shared.read(entry.id);
    const old = record.snapshots[1].draft.workflow!;
    old.schemaVersion = "geo-workflow/v1";
    delete old.skills;
    delete old.steps;
    for (const node of record.snapshots[1].draft.profile.procedure.nodes) delete node.decisionIds;
    await f.shared.write(record);
    const before = JSON.stringify((await f.shared.read(entry.id)).snapshots[1]);
    await f.store.archive(f.projectId);
    const opened = await edit(f, entry.id, "김 연구원");
    expect(opened.statusCode, opened.body).toBe(201);
    const seeded = await f.store.read(opened.json().authoringProjectId);
    expect(seeded.drafts[0].workflow).toMatchObject({ schemaVersion: "gaid-workflow/v1", skills: [{ name: draftReply.slug, source: "bundled", role: "primary" }] });
    expect(seeded.drafts[0].workflow!.steps).toHaveLength(3);
    expect(seeded.drafts[0].workflow!.steps![0].choiceIds).toEqual(expect.arrayContaining(["label-def", "block-size"]));
    expect(seeded.drafts[0].workflow!.steps![2].outputs).toEqual(["scores"]);
    expect(JSON.stringify((await f.shared.read(entry.id)).snapshots[1])).toBe(before);
    const next = await registerFrom(f, seeded.id, "김 연구원");
    expect(next.statusCode, next.body).toBe(201);
    const current = await f.shared.read(entry.id);
    expect(current.snapshots[2].package.manifest.workflows[0].schemaVersion).toBe("gaid-workflow/v1");
  });

  it("gives another researcher one own copy, registered as a separate entry that names its original", async () => {
    const f = await setup();
    const entry = (await f.register()).json<HubEntry>();
    const opened = await edit(f, entry.id, "박 연구원");
    expect(opened.statusCode).toBe(201);
    const { authoringProjectId, mode } = opened.json();
    expect(mode).toBe("copy");
    const copy = await f.store.read(authoringProjectId);
    const original = await f.store.read(f.projectId);
    expect(copy.author).toBe("박 연구원");
    expect(copy.drafts[0].slug).toBe(`${draftReply.slug}-copy`);
    expect(copy.drafts[0].workflow?.skillIds[0]).toBe(`local:${draftReply.slug}-copy`);
    expect(copy.sources.map((s) => s.id)).toEqual(original.sources.map((s) => s.id));
    expect(copy.questions.map((q) => q.id)).toEqual(
      original.questions.filter((q) => q.status !== "superseded").map((q) => q.id),
    );
    for (const s of copy.sources)
      expect(f.store.exists(authoringProjectId, `sources/${s.id}/original`)).toBe(true);
    expect((await edit(f, entry.id, "박 연구원")).json()).toMatchObject({ authoringProjectId, created: false });
    await reviseSummary(f, authoringProjectId, "박 연구원의 판");
    const registered = await registerFrom(f, authoringProjectId, "박 연구원");
    expect(registered.statusCode, registered.body).toBe(201);
    const own = registered.json<HubEntry>();
    expect(own.id).not.toBe(entry.id);
    expect(own).toMatchObject({
      author: "박 연구원",
      latestRevision: 1,
      basedOn: { entryId: entry.id, revision: 1, version: "0.1.0", author: "김 연구원" },
    });
    const untouched = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(untouched.entry.latestRevision).toBe(1);
  });
});

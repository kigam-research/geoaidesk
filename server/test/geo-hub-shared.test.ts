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
import { packageStore } from "../src/geo/methods/package-origin.ts";
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
async function drafted(slug = draftReply.slug) {
  const f = await fixture();
  await runOperation(f.store, f.projectId, "analyze", "hub-analyze", deps(analysis));
  const attempt = await runOperation(f.store, f.projectId, "draft", "hub-draft", deps({ ...draftReply, slug }));
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
  it("registers once per project, freezes draft/visual/package snapshots and keeps old revisions downloadable", async () => {
    const f = await setup();
    await f.store.writeFile(f.projectId, "visuals/prepare.png", PNG);
    await f.store.mutate(f.projectId, (p) => {
      p.visuals = {
        prepare: { file: "visuals/prepare.png", caption: "입력 개념", model: "test", draftRevision: 1 },
        cover: { file: "visuals/prepare.png", caption: "대표 그림", model: "test", draftRevision: 1 },
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
    const detail = (await f.app.inject(`/geo/hub/entries/${entry.id}`)).json<HubEntryDetail>();
    expect(detail.profile.title).toEqual({ ko: draftReply.title });
    expect(detail.workflowTitle).toEqual({ ko: draftReply.workflow.title });
    expect(detail.visuals.prepare.caption).toBe("입력 개념");
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
    expect(r2.json()).toMatchObject({ id: entry.id, latestRevision: 2, title: "새 판 제목", cover: null, implementation: "implemented" });
    expect((await f.app.inject("/geo/hub/entries")).json().entries[0].implementation).toBe("implemented");
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/package.tar.gz?revision=1`)).rawPayload).toEqual(
      archive.rawPayload,
    );
    expect((await f.app.inject(entry.cover!)).rawPayload).toEqual(PNG);
    expect((await f.app.inject(`/geo/hub/entries/${entry.id}/cover`)).statusCode).toBe(404);
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

  it("orders starred entries first and skips catalogue fallback when the catalogue is off", async () => {
    const f = await setup();
    const first = (await f.register()).json<HubEntry>();
    const second = await f.store.create({ title: "다른 방법" });
    const p = await f.store.read(f.projectId);
    await f.store.mutate(second.id, (s) => {
      s.drafts = structuredClone(p.drafts);
      s.drafts[0].slug = "other-method";
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

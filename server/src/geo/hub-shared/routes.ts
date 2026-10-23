/**
 * Shared hub routes. The record store and the actor come per request from `resolveHub` (ADR
 * docs/adr/2026-10-22-gaid-hub-server.md): a logged-in institute hub server account, or the local store with the display
 * name from X-GAID-User (not account authentication).
 */
import { hubPinProblems } from "../methods/hub-pin-install.ts";
import { procedureSteps, workflowDocFor } from "../workflow-doc.ts";
import { gunzipSync } from "node:zlib";
import { readTar } from "../tar.ts";
import { catalogueWorkflowDoc } from "../workspace/workflows.ts";
import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AtlasTextInput, CheckResult, InstallBody } from "../../../../web/src/geo/contracts/authoring.ts";
import type {
  HubEntry,
  HubEntryDetail,
  HubRecommendation,
  RegisterBody,
  RemoveEntryBody,
  SharedInstallBody,
} from "../../../../web/src/geo/contracts/hub-shared.ts";
import { bumpHubVersion, FIRST_HUB_VERSION, HUB_VERSION_BUMPS, hubRefVersion, hubRevisionVersions, hubVersionOf } from "../../../../web/src/geo/contracts/hub-version.ts";
import { getProject, resolvePaths } from "../../projects.ts";
import { installPackageBytes, type InstallDeps } from "../authoring/install.ts";
import { structuredDraft } from "../authoring/workflow.ts";
import { buildPackage } from "../authoring/package.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { safeRelative } from "../authoring/sources.ts";
import { AuthoringError, now, type AuthoringStore } from "../authoring/store.ts";
import { loadVocabulary, type Vocabulary } from "../authoring/vocabulary.ts";
import { geoCatalogueActive, loadGeoCatalogue } from "../catalogue.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";
import { countRegisteredMethodTrials } from "../methods/trials.ts";
import { openEntryForEdit } from "./edit.ts";
import type { RegisteredSnapshot, StoredEntry } from "./store.ts";
import { hubUser, localHubStore, resolveHub, type ResolvedHub } from "./active.ts";
import { isEntryAuthor, type Actor, type HubRecordStore } from "./records.ts";

export { hubUser };
import { hubSearchFields, matchesHubSearch } from "./search.ts";

export interface SharedHubOptions extends InstallDeps {
  /** A fixed store (tests); default: per request, the hub server account or the local store. */
  store?: HubRecordStore;
  authoringStore?: AuthoringStore;
  vocabulary?: Vocabulary;
  /** Tests can supply catalogue cards without enabling/fetching a catalogue. */
  catalogueWorkflows?: () => GeoWorkflow[];
}

const actorRequired = (hub: ResolvedHub): Actor => {
  if (!hub.actor) throw new AuthoringError("허브에서 사용할 이름을 1–40자로 입력해 주세요.", 401);
  return hub.actor;
};
const text = (v: unknown, label: string, max: number, optional = false) => {
  if (optional && v === undefined) return "";
  if (typeof v !== "string" || (!optional && !v.trim()) || [...v.trim()].length > max)
    throw new AuthoringError(`${label} 길이를 확인해 주세요. 최대 ${max}자입니다.`);
  return v.trim();
};
const korean = (v: AtlasTextInput | undefined) => (typeof v === "string" ? v : (v?.ko ?? ""));
const imageTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const snapshotOf = (record: StoredEntry, revision?: string): RegisteredSnapshot => {
  const n = revision === undefined ? record.entry.latestRevision : Number(revision);
  if (!Number.isSafeInteger(n) || n < 1 || !record.snapshots[n])
    throw new AuthoringError("등록한 version을 찾을 수 없습니다.", 404);
  return record.snapshots[n];
};

export async function registerSharedHubRoutes(
  app: FastifyInstance,
  options: SharedHubOptions = {},
): Promise<HubRecordStore> {
  const authoring = options.authoringStore ?? getAuthoringStore(app);
  await (options.store ?? localHubStore()).initialize();
  const hubOf = (req: FastifyRequest) => resolveHub(req, options.store);

  const entryView = async (store: HubRecordStore, record: StoredEntry, actor: Actor | null): Promise<HubEntry> => {
    // A removed entry (the removed list) has no readable stars/comments on a hub server (404 there): count none.
    const removed = Boolean(record.entry.removed);
    const [stars, comments] = await Promise.all([
      store.stars(record.entry.id).catch((e) => (removed ? {} : Promise.reject(e))),
      store.comments(record.entry.id).catch((e) => (removed ? [] : Promise.reject(e))),
    ]);
    const identities = new Map<string, Set<string>>();
    for (const snapshot of Object.values(record.snapshots)) {
      const hashes = identities.get(snapshot.package.methodId) ?? new Set<string>();
      hashes.add(snapshot.package.sha256);
      identities.set(snapshot.package.methodId, hashes);
    }
    // Trials of the registered package bytes count wherever they were installed: through this entry, or by the author
    // trying the same draft revision before registering (authoring installs).
    const authorInstalls = await authoring
      .read(record.authoringProjectId)
      .then((p) => p.installs.map((i) => i.projectId))
      .catch(() => [] as string[]);
    let trials = 0;
    for (const projectId of new Set([...record.installs.map((i) => i.projectId), ...authorInstalls])) {
      if (getProject(projectId))
        for (const [methodId, hashes] of identities)
          trials += countRegisteredMethodTrials(resolvePaths(projectId), methodId, hashes);
    }
    const versions = hubRevisionVersions(record.entry.revisions);
    return {
      ...record.entry,
      revisions: record.entry.revisions.map((r, i) => ({ ...r, version: versions[i] })),
      ...(record.entry.basedOn ? { basedOn: { ...record.entry.basedOn, version: hubRefVersion(record.entry.basedOn)! } } : {}),
      tagline: korean(snapshotOf(record).draft.profile.tagline),
      implementation: snapshotOf(record).draft.codeFiles.length ? "implemented" : "descriptive",
      recipe: Boolean(snapshotOf(record).draft.workflow && snapshotOf(record).draft.recipe),
      stars: Object.keys(stars).length,
      starredByMe: actor !== null && Object.hasOwn(stars, actor.id),
      mine: isEntryAuthor(record.entry, actor),
      comments: comments.length,
      trials,
    };
  };

  app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof AuthoringError) return reply.code(error.status).send({ error: error.message });
      if ((error as { statusCode?: number }).statusCode === 400)
        return reply.code(400).send({ error: "JSON 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onSend", async (_req, reply, payload) => {
      reply.header("Cache-Control", "no-store");
      return payload;
    });
    // All shared mutations require a named actor (account or valid display name), before body parsing.
    scope.addHook("onRequest", async (req) => {
      if (req.method !== "GET" && req.method !== "HEAD") actorRequired(hubOf(req));
    });

    scope.get("/geo/hub/me", async (req) => {
      const hub = hubOf(req);
      return { name: hub.actor?.name ?? null, ...(hub.account ? { account: true } : {}), ...(hub.actor?.admin ? { admin: true } : {}) };
    });
    scope.get("/geo/hub/folders", async (req) => {
      const { store } = hubOf(req);
      const [folders, entries] = await Promise.all([store.folders(), store.list()]);
      return {
        folders: folders.map((f) => ({ ...f, entries: entries.filter((e) => e.entry.folderId === f.id).length })),
      };
    });
    scope.post<{ Body: { name: string } }>("/geo/hub/folders", async (req, reply) =>
      reply.code(201).send(await hubOf(req).store.addFolder(text(req.body?.name, "폴더 이름", 80), actorRequired(hubOf(req)))),
    );
    scope.get<{ Querystring: { folder?: string; q?: string } }>("/geo/hub/entries", async (req) => {
      const { store, actor } = hubOf(req);
      const query = req.query.q?.trim().toLocaleLowerCase();
      const taxonomy = (options.vocabulary ?? loadVocabulary()).taxonomy;
      const labels = new Map(Object.values(taxonomy).flat().map((term) => [
        term.id, typeof term.label === "string" ? term.label : Object.values(term.label).join(" "),
      ]));
      const records = (await store.list()).filter(
        (record) => {
          const e = record.entry;
          if (req.query.folder && e.folderId !== req.query.folder) return false;
          if (!query) return true;
          return matchesHubSearch(query, hubSearchFields(e, snapshotOf(record).draft, labels));
        },
      );
      const entries = await Promise.all(records.map((r) => entryView(store, r, actor)));
      entries.sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { entries };
    });
    scope.post<{ Body: RegisterBody }>("/geo/hub/entries", async (req, reply) => {
      const body = req.body;
      const hub = hubOf(req);
      const { store } = hub;
      const actor = actorRequired(hub);
      const projectId = text(body?.authoringProjectId, "방법 작업 식별자", 64);
      // Validates the authoring id before it can determine an entry path. A draft opened with "방법 고치기" adds the next
      // revision of the entry it edits; any other draft (also a copy) registers as its own entry.
      authoring.projectDir(projectId);
      const link = (await authoring.read(projectId)).hubEntry;
      const id = link?.mode === "edit" ? link.entryId : `entry-${projectId}`;
      const folderId = text(body?.folderId, "폴더 식별자", 80);
      const note = text(body?.note, "등록 설명", 4000, true);
      if (body?.bump !== undefined && !HUB_VERSION_BUMPS.includes(body.bump))
        throw new AuthoringError("version 단계는 patch, minor, major 가운데 하나여야 합니다.");
      const bump = body?.bump ?? "patch";
      if (!(await store.folders()).some((f) => f.id === folderId))
        throw new AuthoringError("주제 폴더를 찾을 수 없습니다.", 404);
      const result = await store.serial(id, async () => {
        const previous = await store.find(id);
        if (previous && !isEntryAuthor(previous.entry, actor))
          throw new AuthoringError("등록한 연구자만 새 version을 등록할 수 있습니다.", 403);
        if (link?.mode === "edit" && !previous) throw new AuthoringError("고치던 등록 방법을 찾을 수 없습니다.", 404);
        const original = link?.mode === "copy" ? await store.find(link.entryId) : null;
        const prepared = await authoring.mutate(projectId, async (project) => {
          const selectedDraft =
            body.draftRevision === undefined
              ? project.drafts.at(-1)
              : project.drafts.find((d) => d.revision === body.draftRevision);
          if (!selectedDraft) throw new AuthoringError("등록할 초안을 찾을 수 없습니다.", 404);
          const draft = structuredDraft(selectedDraft);
          if (!draft.workflow) throw new AuthoringError("Workflow가 없는 초안은 등록할 수 없습니다. 초안을 고쳐 입력 자료, 분석 조건과 AI agent 지시문을 갖춘 Workflow를 추가하세요.", 422);
          // Pinned hub skills must be installable by every researcher who installs this Workflow.
          const pinProblems = await hubPinProblems(draft.workflow.skills ?? []);
          if (pinProblems.length) throw new AuthoringError(pinProblems.join(" "), 409);
          let pkg = project.packages.find((p) => p.draftRevision === draft.revision &&
            ((p.manifest as { workflows?: GeoWorkflow[] } | null)?.workflows ?? []).some((w) => w.id === draft.workflow!.id && w.schemaVersion === "gaid-workflow/v1"));
          if (!pkg) {
            const built = await buildPackage(project, draft, {
              store: authoring,
              vocabulary: options.vocabulary ?? loadVocabulary(),
              checker: "gaid-hub",
            });
            if (!("record" in built))
              return {
                check: { draftRevision: draft.revision, findings: built.findings, passed: false } satisfies CheckResult,
              };
            pkg = built.record;
            project.packages.push(pkg);
          }
          const revision = (previous?.entry.latestRevision ?? 0) + 1;
          const archive = await authoring.readFile(project.id, pkg.archive);
          if (createHash("sha256").update(archive).digest("hex") !== pkg.sha256)
            throw new AuthoringError("패키지 파일이 저장된 해시와 맞지 않습니다.", 409);
          await store.immutableBytes(id, `packages/${revision}.tar.gz`, archive, actor);
          const visuals: RegisteredSnapshot["visuals"] = {};
          // Pictures shown on the draft: those of this revision or earlier whose step, output or cover still exists.
          const keys = new Set([
            "cover",
            ...draft.profile.procedure.nodes.map((n) => n.id),
            ...draft.profile.outputs.map((o) => `output:${o.id}`),
          ]);
          for (const [key, visual] of Object.entries(project.visuals ?? {})) {
            if (
              visual.draftRevision > draft.revision ||
              !keys.has(key) ||
              !safeRelative(visual.file) ||
              !visual.file.startsWith("visuals/")
            )
              continue;
            const copy = async (source: string) => {
              const mediaType = imageTypes[extname(source).toLowerCase()];
              if (!mediaType) return null;
              const bytes = await authoring.readFile(project.id, source);
              const sha = createHash("sha256").update(bytes).digest("hex");
              const file = `visuals/${revision}/${sha}${extname(source).toLowerCase()}`;
              await store.immutableBytes(id, file, bytes, actor);
              return { file, mediaType };
            };
            const light = await copy(visual.file);
            if (!light) continue;
            const dark =
              visual.dark && safeRelative(visual.dark) && visual.dark.startsWith("visuals/")
                ? await copy(visual.dark)
                : null;
            Object.defineProperty(visuals, key, {
              value: { ...light, caption: visual.caption, ...(dark ? { dark } : {}) },
              enumerable: true,
            });
          }
          return { draft, pkg, revision, visuals };
        });
        if (prepared.check) return { check: prepared.check };
        const { draft, pkg, revision, visuals } = prepared;
        const at = now();
        const current = previous ? hubVersionOf(previous.entry) : null;
        const version = current ? bumpHubVersion(current, bump) : FIRST_HUB_VERSION;
        const entry: StoredEntry = {
          schemaVersion: "gaid-hub-entry/v1",
          authoringProjectId: projectId,
          entry: {
            id,
            methodId: pkg.methodId,
            slug: pkg.slug,
            title: korean(draft.profile.title),
            summary: korean(draft.profile.summary),
            kind: draft.workflow ? "workflow" : "skill",
            tags: [
              ...new Set([...(draft.profile.taxonomy?.tasks ?? []), ...(draft.profile.taxonomy?.methods ?? [])]),
            ].slice(0, 6),
            author: previous?.entry.author ?? actor.name,
            ...(previous ? (previous.entry.authorId ? { authorId: previous.entry.authorId } : {}) : actor.id !== actor.name ? { authorId: actor.id } : {}),
            ...(previous?.entry.basedOn
              ? { basedOn: previous.entry.basedOn }
              : link?.mode === "copy"
                ? {
                    basedOn: {
                      entryId: link.entryId,
                      revision: link.revision,
                      version: (original ? hubVersionOf(original.entry, link.revision) : null) ?? hubRefVersion(link)!,
                      title: original?.entry.title ?? link.title,
                      author: original?.entry.author ?? link.author,
                    },
                  }
                : {}),
            folderId,
            cover: Object.keys(visuals).length ? `/geo/hub/entries/${id}/cover?revision=${revision}` : null,
            ...(Object.keys(visuals).length && (visuals.cover ?? Object.values(visuals)[0]).dark
              ? { coverThemed: true }
              : {}),
            latestRevision: revision,
            revisions: [
              ...(previous?.entry.revisions ?? []),
              {
                revision,
                version,
                authoringProjectId: projectId,
                draftRevision: draft.revision,
                packageRevision: pkg.revision,
                packageSha256: pkg.sha256,
                packageDigest: pkg.packageDigest,
                registeredAt: at,
                registeredBy: actor.name,
                ...(actor.id !== actor.name ? { registeredById: actor.id } : {}),
                note,
              },
            ],
            updatedAt: at,
          },
          snapshots: { ...previous?.snapshots, [revision]: { draft, package: pkg, visuals } },
          installs: previous?.installs ?? [],
        };
        await store.write(entry, actor);
        return { entry: (await store.find(id)) ?? entry };
      });
      if ("check" in result) return reply.code(409).send(result.check);
      return reply.code(201).send(await entryView(store, result.entry, actor));
    });
    scope.post<{ Params: { id: string } }>("/geo/hub/entries/:id/edit", async (req, reply) => {
      const hub = hubOf(req);
      const result = await openEntryForEdit(hub.store, authoring, req.params.id, actorRequired(hub));
      return reply.code(result.created ? 201 : 200).send(result);
    });
    scope.get<{ Params: { id: string } }>("/geo/hub/entries/:id", async (req): Promise<HubEntryDetail> => {
      const { store, actor } = hubOf(req);
      const record = await store.read(req.params.id);
      const snapshot = snapshotOf(record);
      const images = Object.fromEntries(
        Object.entries(snapshot.visuals).map(([key, v]) => [
          key,
          {
            src: `/geo/hub/entries/${record.entry.id}/visuals/${encodeURIComponent(key)}?revision=${record.entry.latestRevision}`,
            caption: v.caption,
            ...(v.dark ? { themed: true } : {}),
          },
        ]),
      );
      const nodeIds = new Set(snapshot.draft.profile.procedure.nodes.map((n) => n.id));
      const visuals = Object.fromEntries(Object.entries(images).filter(([key]) => nodeIds.has(key)));
      const outputImages = Object.fromEntries(
        Object.entries(images)
          .filter(([key]) => key.startsWith("output:"))
          .map(([key, image]) => [key.slice(7), image]),
      );
      return {
        entry: await entryView(store, record, actor),
        profile: snapshot.draft.profile,
        visuals,
        outputImages,
        workflowTitle: snapshot.draft.workflow?.title ?? null,
        workflowDoc: snapshot.draft.workflow
          ? workflowDocFor(snapshot.draft.workflow as unknown as GeoWorkflow, {
            version: hubVersionOf(record.entry),
            skills: [{ name: snapshot.draft.slug, source: "bundled" }],
            procedure: procedureSteps(snapshot.draft.profile),
          })
          : null,
        comments: await store.comments(record.entry.id),
      };
    });
    scope.post<{ Params: { id: string }; Body: RemoveEntryBody }>("/geo/hub/entries/:id/remove", async (req, reply) => {
      const hub = hubOf(req);
      const reason = text(req.body?.reason, "제거 사유", 500, true);
      await hub.store.remove(req.params.id, actorRequired(hub), reason);
      return reply.code(204).send();
    });
    scope.get("/geo/hub/removed", async (req) => {
      const { store, actor } = hubOf(req);
      const records = await store.removed(actor);
      return { entries: await Promise.all(records.map((r) => entryView(store, r, actor))) };
    });
    scope.post<{ Params: { id: string } }>("/geo/hub/entries/:id/restore", async (req) => {
      const hub = hubOf(req);
      const actor = actorRequired(hub);
      return entryView(hub.store, await hub.store.restore(req.params.id, actor), actor);
    });
    scope.post<{ Params: { id: string }; Body: { on: boolean } }>("/geo/hub/entries/:id/star", async (req) => {
      if (typeof req.body?.on !== "boolean") throw new AuthoringError("별표 상태를 선택해 주세요.");
      const hub = hubOf(req);
      return hub.store.star(req.params.id, actorRequired(hub), req.body.on);
    });
    scope.get<{ Params: { id: string } }>("/geo/hub/entries/:id/comments", async (req) => {
      const { store } = hubOf(req);
      await store.read(req.params.id);
      return { comments: await store.comments(req.params.id) };
    });
    scope.post<{ Params: { id: string }; Body: { body: string } }>(
      "/geo/hub/entries/:id/comments",
      async (req, reply) => {
        const hub = hubOf(req);
        return reply
          .code(201)
          .send(await hub.store.addComment(req.params.id, actorRequired(hub), text(req.body?.body, "댓글", 4000)));
      },
    );
    const sendImage = async (store: HubRecordStore, id: string, revision: string | undefined, key?: string, theme?: string) => {
      const snapshot = snapshotOf(await store.read(id), revision);
      const visual =
        key === undefined
          ? (snapshot.visuals.cover ?? Object.values(snapshot.visuals)[0])
          : Object.hasOwn(snapshot.visuals, key)
            ? snapshot.visuals[key]
            : null;
      if (!visual) throw new AuthoringError("등록한 그림을 찾을 수 없습니다.", 404);
      const shown = theme === "dark" && visual.dark ? visual.dark : visual;
      return { bytes: await store.bytes(id, shown.file), mediaType: shown.mediaType };
    };
    scope.get<{ Params: { id: string }; Querystring: { revision?: string; theme?: string } }>(
      "/geo/hub/entries/:id/cover",
      async (req, reply) => {
        const image = await sendImage(hubOf(req).store, req.params.id, req.query.revision, undefined, req.query.theme);
        return reply.type(image.mediaType).send(image.bytes);
      },
    );
    scope.get<{ Params: { id: string; key: string }; Querystring: { revision?: string; theme?: string } }>(
      "/geo/hub/entries/:id/visuals/:key",
      async (req, reply) => {
        const image = await sendImage(hubOf(req).store, req.params.id, req.query.revision, req.params.key, req.query.theme);
        return reply.type(image.mediaType).send(image.bytes);
      },
    );
    scope.get<{ Params: { id: string }; Querystring: { revision?: string } }>(
      "/geo/hub/entries/:id/package.tar.gz",
      async (req, reply) => {
        const { store } = hubOf(req);
        const record = await store.read(req.params.id);
        const snapshot = snapshotOf(record, req.query.revision);
        const revision = req.query.revision === undefined ? record.entry.latestRevision : Number(req.query.revision);
        return reply
          .type("application/gzip")
          .header("Content-Disposition", `attachment; filename="${snapshot.package.slug}-${revision}.tar.gz"`)
          .send(await store.bytes(record.entry.id, `packages/${revision}.tar.gz`));
      },
    );
    scope.post<{ Params: { id: string }; Body: SharedInstallBody }>(
      "/geo/hub/entries/:id/install",
      async (req, reply) => {
        const hub = hubOf(req);
        const { store } = hub;
        const actor = actorRequired(hub);
        const result = await store.serial(`install:${req.params.id}`, async () => {
          const record = await store.read(req.params.id);
          // Install the revision the researcher looked at (immutable snapshot), not whatever is latest now.
          const asked = req.body?.revision;
          if (asked !== undefined && (!Number.isSafeInteger(asked) || asked < 1))
            throw new AuthoringError("등록한 version을 확인해 주세요.");
          const revision = asked ?? record.entry.latestRevision;
          const snapshot = snapshotOf(record, String(revision));
          const result = await installPackageBytes(
            await store.bytes(record.entry.id, `packages/${revision}.tar.gz`),
            snapshot.package,
            req.body ?? ({} as InstallBody),
            { ...options, hubEntry: { id: record.entry.id, revision, version: hubVersionOf(record.entry, revision)! } },
          );
          await store.recordInstall(record.entry.id, result.install, actor);
          return result;
        });
        return reply.code(201).send(result);
      },
    );
    scope.get<{ Params: { id: string }; Querystring: { revision?: string; name?: string } }>("/geo/hub/entries/:id/skill-source", async (req) => {
      const { store } = hubOf(req);
      const record = await store.read(req.params.id);
      const snapshot = snapshotOf(record, req.query.revision);
      if (req.query.name !== snapshot.package.slug) throw new AuthoringError("스킬 지침을 찾을 수 없습니다.", 404);
      const revision = req.query.revision === undefined ? record.entry.latestRevision : Number(req.query.revision);
      const archive = await store.bytes(record.entry.id, `packages/${revision}.tar.gz`);
      if (createHash("sha256").update(archive).digest("hex") !== snapshot.package.sha256)
        throw new AuthoringError("등록 파일을 읽지 못했습니다.", 409);
      const files = readTar(gunzipSync(archive, { maxOutputLength: 64 * 1024 * 1024 }));
      const skill = files.find((f) => f.type === "file" && f.path === `${snapshot.package.slug}/SKILL.md`);
      if (!skill || skill.data.length > 2 * 1024 * 1024) throw new AuthoringError("스킬 지침을 읽지 못했습니다.", 404);
      return { content: skill.data.toString("utf8") };
    });
    scope.get<{ Params: { id: string }; Querystring: { name?: string } }>("/geo/hub/catalogue/:id/skill-source", async (req) => {
      if (!geoCatalogueActive()) throw new AuthoringError("기본 Workflow를 찾을 수 없습니다.", 404);
      const catalogue = loadGeoCatalogue();
      const workflow = catalogue.workflows.find((w) => w.id === req.params.id);
      const skill = catalogue.index.skills.find((s) => workflow?.skillIds.includes(s.id) && s.runtimeName === req.query.name);
      if (!skill || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.runtimeName)) throw new AuthoringError("스킬 지침을 찾을 수 없습니다.", 404);
      const file = join(catalogue.skillsDir, skill.runtimeName, "SKILL.md");
      if ((await stat(file)).size > 2 * 1024 * 1024) throw new AuthoringError("스킬 지침을 읽지 못했습니다.", 413);
      return { content: await readFile(file, "utf8") };
    });
    scope.get<{ Params: { id: string } }>("/geo/hub/catalogue/:id", async (req) => {
      const catalogue = geoCatalogueActive() ? loadGeoCatalogue() : null;
      const workflow = (options.catalogueWorkflows?.() ?? catalogue?.workflows ?? []).find((w) => w.id === req.params.id);
      if (!workflow) throw new AuthoringError("기본 Workflow를 찾을 수 없습니다.", 404);
      const doc = catalogue ? catalogueWorkflowDoc(catalogue, workflow, workflow.skillIds.map((id) => {
        const skill = catalogue.index.skills.find((s) => s.id === id);
        return { id, runtimeName: skill?.runtimeName ?? null, title: skill?.title ?? null, installed: false, enabled: false };
      })) : workflowDocFor(workflow, { skills: workflow.skillIds.map((id) => ({ name: id, source: "catalogue" })) });
      return { doc };
    });
    scope.get("/geo/hub/recommended", async (req) => {
      const { store, actor } = hubOf(req);
      const entries = await Promise.all((await store.list()).map((r) => entryView(store, r, actor)));
      const cards: HubRecommendation[] = entries
        .filter((e) => e.stars >= 1)
        .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
        .slice(0, 4)
        .map((e) => ({
          id: `shared:${e.id}`,
          source: "shared",
          title: e.title,
          line: e.summary,
          image: e.cover,
          ...(e.coverThemed ? { imageThemed: true } : {}),
          stars: e.stars,
          author: e.author,
          ref: e.id,
        }));
      if (cards.length < 4) {
        const workflows = options.catalogueWorkflows
          ? options.catalogueWorkflows()
          : geoCatalogueActive()
            ? loadGeoCatalogue().workflows
            : [];
        for (const w of workflows.slice(0, 4 - cards.length)) {
          const image =
            typeof w.image === "string"
              ? w.image
              : typeof (w.image as { src?: unknown })?.src === "string"
                ? (w.image as { src: string }).src
                : null;
          cards.push({
            id: `catalogue:${w.id}`,
            source: "catalogue",
            title: korean(w.title),
            line: korean(w.description),
            image,
            stars: 0,
            ref: w.id,
          });
        }
      }
      return { cards };
    });
  });
  return options.store ?? localHubStore();
}

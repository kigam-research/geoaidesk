/** Institute-shared method registry. Display-name identity is intentionally not account authentication. */
import { createHash } from "node:crypto";
import { extname } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AtlasTextInput, CheckResult, InstallBody } from "../../../../web/src/geo/contracts/authoring.ts";
import type {
  HubEntry,
  HubEntryDetail,
  HubRecommendation,
  RegisterBody,
  SharedInstallBody,
} from "../../../../web/src/geo/contracts/hub-shared.ts";
import { HUB_USER_HEADER } from "../../../../web/src/geo/contracts/hub-shared.ts";
import { getProject, resolvePaths } from "../../projects.ts";
import { installPackageBytes, type InstallDeps } from "../authoring/install.ts";
import { buildPackage } from "../authoring/package.ts";
import { getAuthoringStore } from "../authoring/routes.ts";
import { safeRelative } from "../authoring/sources.ts";
import { AuthoringError, now, type AuthoringStore } from "../authoring/store.ts";
import { loadVocabulary, type Vocabulary } from "../authoring/vocabulary.ts";
import { geoCatalogueActive, loadGeoCatalogue } from "../catalogue.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";
import { countRegisteredMethodTrials } from "../methods/trials.ts";
import { SharedHubStore, type RegisteredSnapshot, type StoredEntry } from "./store.ts";
import { hubSearchFields, matchesHubSearch } from "./search.ts";

export interface SharedHubOptions extends InstallDeps {
  store?: SharedHubStore;
  authoringStore?: AuthoringStore;
  vocabulary?: Vocabulary;
  /** Tests can supply catalogue cards without enabling/fetching a catalogue. */
  catalogueWorkflows?: () => GeoWorkflow[];
}

export function hubUser(req: FastifyRequest): string | null {
  const header = req.headers[HUB_USER_HEADER.toLowerCase()];
  if (typeof header !== "string") return null;
  try {
    const name = decodeURIComponent(header).trim();
    return name && [...name].length <= 40 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
  } catch {
    return null;
  }
}
const userRequired = (req: FastifyRequest) => {
  const name = hubUser(req);
  if (!name) throw new AuthoringError("허브에서 사용할 이름을 1–40자로 입력해 주세요.", 401);
  return name;
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
    throw new AuthoringError("등록 판을 찾을 수 없습니다.", 404);
  return record.snapshots[n];
};

export async function registerSharedHubRoutes(
  app: FastifyInstance,
  options: SharedHubOptions = {},
): Promise<SharedHubStore> {
  const store = options.store ?? new SharedHubStore();
  const authoring = options.authoringStore ?? getAuthoringStore(app);
  await store.initialize();

  const entryView = async (record: StoredEntry, user: string | null): Promise<HubEntry> => {
    const [stars, comments] = await Promise.all([store.stars(record.entry.id), store.comments(record.entry.id)]);
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
    return {
      ...record.entry,
      tagline: korean(snapshotOf(record).draft.profile.tagline),
      implementation: snapshotOf(record).draft.codeFiles.length ? "implemented" : "descriptive",
      recipe: Boolean(snapshotOf(record).draft.workflow && snapshotOf(record).draft.recipe),
      stars: Object.keys(stars).length,
      starredByMe: user !== null && Object.hasOwn(stars, user),
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
    // All shared mutations require an explicitly supplied valid display name, before body parsing.
    scope.addHook("onRequest", async (req) => {
      if (req.method !== "GET" && req.method !== "HEAD") userRequired(req);
    });

    scope.get("/geo/hub/me", async (req) => ({ name: hubUser(req) }));
    scope.get("/geo/hub/folders", async () => {
      const [folders, entries] = await Promise.all([store.folders(), store.list()]);
      return {
        folders: folders.map((f) => ({ ...f, entries: entries.filter((e) => e.entry.folderId === f.id).length })),
      };
    });
    scope.post<{ Body: { name: string } }>("/geo/hub/folders", async (req, reply) =>
      reply.code(201).send(await store.addFolder(text(req.body?.name, "폴더 이름", 80), userRequired(req))),
    );
    scope.get<{ Querystring: { folder?: string; q?: string } }>("/geo/hub/entries", async (req) => {
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
      const entries = await Promise.all(records.map((r) => entryView(r, hubUser(req))));
      entries.sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return { entries };
    });
    scope.post<{ Body: RegisterBody }>("/geo/hub/entries", async (req, reply) => {
      const body = req.body;
      const user = userRequired(req);
      const projectId = text(body?.authoringProjectId, "방법 작업 식별자", 64);
      // Validates the authoring id before it can determine an entry path.
      authoring.projectDir(projectId);
      const id = `entry-${projectId}`;
      const folderId = text(body?.folderId, "폴더 식별자", 80);
      const note = text(body?.note, "등록 설명", 4000, true);
      if (!(await store.folders()).some((f) => f.id === folderId))
        throw new AuthoringError("주제 폴더를 찾을 수 없습니다.", 404);
      const result = await store.serial(id, async () => {
        const previous = await store.find(id);
        if (previous && previous.entry.author !== user)
          throw new AuthoringError("등록한 연구자만 새 판을 등록할 수 있습니다.", 403);
        const prepared = await authoring.mutate(projectId, async (project) => {
          const draft =
            body.draftRevision === undefined
              ? project.drafts.at(-1)
              : project.drafts.find((d) => d.revision === body.draftRevision);
          if (!draft) throw new AuthoringError("등록할 초안 판을 찾을 수 없습니다.", 404);
          let pkg = project.packages.find((p) => p.draftRevision === draft.revision);
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
          await store.immutableBytes(id, `packages/${revision}.tar.gz`, archive);
          const visuals: RegisteredSnapshot["visuals"] = {};
          for (const [key, visual] of Object.entries(project.visuals ?? {})) {
            if (
              visual.draftRevision !== draft.revision ||
              !safeRelative(visual.file) ||
              !visual.file.startsWith("visuals/")
            )
              continue;
            const mediaType = imageTypes[extname(visual.file).toLowerCase()];
            if (!mediaType) continue;
            const bytes = await authoring.readFile(project.id, visual.file);
            const sha = createHash("sha256").update(bytes).digest("hex");
            const file = `visuals/${revision}/${sha}${extname(visual.file).toLowerCase()}`;
            await store.immutableBytes(id, file, bytes);
            Object.defineProperty(visuals, key, {
              value: { file, caption: visual.caption, mediaType },
              enumerable: true,
            });
          }
          return { draft, pkg, revision, visuals };
        });
        if (prepared.check) return { check: prepared.check };
        const { draft, pkg, revision, visuals } = prepared;
        const at = now();
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
            author: user,
            folderId,
            cover: Object.keys(visuals).length ? `/geo/hub/entries/${id}/cover?revision=${revision}` : null,
            latestRevision: revision,
            revisions: [
              ...(previous?.entry.revisions ?? []),
              {
                revision,
                authoringProjectId: projectId,
                draftRevision: draft.revision,
                packageRevision: pkg.revision,
                packageSha256: pkg.sha256,
                packageDigest: pkg.packageDigest,
                registeredAt: at,
                registeredBy: user,
                note,
              },
            ],
            updatedAt: at,
          },
          snapshots: { ...previous?.snapshots, [revision]: { draft, package: pkg, visuals } },
          installs: previous?.installs ?? [],
        };
        await store.write(entry);
        return { entry };
      });
      if ("check" in result) return reply.code(409).send(result.check);
      return reply.code(201).send(await entryView(result.entry, user));
    });
    scope.get<{ Params: { id: string } }>("/geo/hub/entries/:id", async (req): Promise<HubEntryDetail> => {
      const record = await store.read(req.params.id);
      const snapshot = snapshotOf(record);
      const images = Object.fromEntries(
        Object.entries(snapshot.visuals).map(([key, v]) => [
          key,
          {
            src: `/geo/hub/entries/${record.entry.id}/visuals/${encodeURIComponent(key)}?revision=${record.entry.latestRevision}`,
            caption: v.caption,
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
        entry: await entryView(record, hubUser(req)),
        profile: snapshot.draft.profile,
        visuals,
        outputImages,
        workflowTitle: snapshot.draft.workflow?.title ?? null,
        comments: await store.comments(record.entry.id),
      };
    });
    scope.post<{ Params: { id: string }; Body: { on: boolean } }>("/geo/hub/entries/:id/star", async (req) => {
      if (typeof req.body?.on !== "boolean") throw new AuthoringError("별표 상태를 선택해 주세요.");
      return store.star(req.params.id, userRequired(req), req.body.on);
    });
    scope.get<{ Params: { id: string } }>("/geo/hub/entries/:id/comments", async (req) => {
      await store.read(req.params.id);
      return { comments: await store.comments(req.params.id) };
    });
    scope.post<{ Params: { id: string }; Body: { body: string } }>(
      "/geo/hub/entries/:id/comments",
      async (req, reply) =>
        reply
          .code(201)
          .send(await store.addComment(req.params.id, userRequired(req), text(req.body?.body, "댓글", 4000))),
    );
    const sendImage = async (id: string, revision: string | undefined, key?: string) => {
      const snapshot = snapshotOf(await store.read(id), revision);
      const visual =
        key === undefined
          ? (snapshot.visuals.cover ?? Object.values(snapshot.visuals)[0])
          : Object.hasOwn(snapshot.visuals, key)
            ? snapshot.visuals[key]
            : null;
      if (!visual) throw new AuthoringError("등록한 그림을 찾을 수 없습니다.", 404);
      return { bytes: await store.bytes(id, visual.file), mediaType: visual.mediaType };
    };
    scope.get<{ Params: { id: string }; Querystring: { revision?: string } }>(
      "/geo/hub/entries/:id/cover",
      async (req, reply) => {
        const image = await sendImage(req.params.id, req.query.revision);
        return reply.type(image.mediaType).send(image.bytes);
      },
    );
    scope.get<{ Params: { id: string; key: string }; Querystring: { revision?: string } }>(
      "/geo/hub/entries/:id/visuals/:key",
      async (req, reply) => {
        const image = await sendImage(req.params.id, req.query.revision, req.params.key);
        return reply.type(image.mediaType).send(image.bytes);
      },
    );
    scope.get<{ Params: { id: string }; Querystring: { revision?: string } }>(
      "/geo/hub/entries/:id/package.tar.gz",
      async (req, reply) => {
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
        const result = await store.serial(req.params.id, async () => {
          const record = await store.read(req.params.id);
          // Install the revision the researcher looked at (immutable snapshot), not whatever is latest now.
          const asked = req.body?.revision;
          if (asked !== undefined && (!Number.isSafeInteger(asked) || asked < 1))
            throw new AuthoringError("등록 판 번호를 확인해 주세요.");
          const revision = asked ?? record.entry.latestRevision;
          const snapshot = snapshotOf(record, String(revision));
          const result = await installPackageBytes(
            await store.bytes(record.entry.id, `packages/${revision}.tar.gz`),
            snapshot.package,
            req.body ?? ({} as InstallBody),
            options,
          );
          record.installs.push(result.install);
          await store.write(record);
          return result;
        });
        return reply.code(201).send(result);
      },
    );
    scope.get("/geo/hub/recommended", async (req) => {
      const entries = await Promise.all((await store.list()).map((r) => entryView(r, hubUser(req))));
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
  return store;
}

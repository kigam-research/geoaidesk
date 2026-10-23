/**
 * GAID hub authoring routes (`/geo/authoring/*`, contract web/src/geo/contracts/authoring.ts). User-level: the
 * routes ignore the request's project scope, except install, which targets `body.projectId`.
 */
import type { FastifyInstance } from "fastify";
import type {
  AnswerItem,
  AnswersBody,
  AuthoringProject,
  CreateProjectBody,
  Decision,
  EditDraftBody,
  AddNoteSourcesBody,
  InstallBody,
  MethodDraft,
  OperationBody,
  PackageBody,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { structuredDraft } from "./workflow.ts";
import { startOperation } from "./agent.ts";
import { installPackage, previewPackageBytes } from "./install.ts";
import { modelConfig } from "./model.ts";
import { buildPackage, checkMethod, draftFiles, type PackageContext } from "./package.ts";
import { addLibrarySources, addNoteSource, libraryDeps, linkLibraryAuthoring } from "./library-sources.ts";
import { libraryStore, type LibraryStore } from "../library/store.ts";
import { zoteroService } from "../library/zotero-service.ts";
import { addSource, pageImage, pageText, pdftotextVersion, removeSource, safeRelative, sourceFile } from "./sources.ts";
import { AuthoringError, AuthoringStore, authoringOwner, newId, now } from "./store.ts";
import { loadVocabulary, type Vocabulary } from "./vocabulary.ts";
import { activePaths } from "../../projects.ts";
import { buildHandoff, HandoffError } from "../hub-handoff/builder.ts";

type AnswerBody = Omit<AnswerItem, "questionId">;

export interface AuthoringOptions {
  store?: AuthoringStore;
  /** Tests: fixed vocabulary and model transport. */
  vocabulary?: Vocabulary;
  chat?: import("./model.ts").ChatFn;
  /** Tests: the library the handoff reads papers from. */
  library?: () => LibraryStore;
}

const HANDOFF_EXTRA = 20;
const stringList = (v: unknown, max: number): string[] | undefined =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 255) && new Set(v).size === v.length
    ? (v as string[])
    : undefined;

const stores = new WeakMap<FastifyInstance, AuthoringStore>();
/** The authoring store registered on this app (shared by the hub-shared and authoring-extra routes). */
export function getAuthoringStore(app: FastifyInstance): AuthoringStore {
  const store = stores.get(app);
  if (!store) throw new Error("authoring routes are not registered");
  return store;
}

const OP_ID = /^[\w-]{6,80}$/;

/** Researcher edit: a new draft revision on top of the latest one; a stale base is refused. */
export function editDraft(project: AuthoringProject, body: EditDraftBody): MethodDraft {
  const latest = project.drafts.at(-1);
  if (!latest) throw new AuthoringError("먼저 방법 초안을 만들어 주세요.", 409);
  if (body.baseRevision !== latest.revision)
    throw new AuthoringError("다른 곳에서 초안이 바뀌었습니다. 최신 초안을 다시 불러와 주세요.", 409);
  const next: MethodDraft = structuredDraft(latest);
  next.revision = latest.revision + 1;
  next.baseRevision = latest.revision;
  next.origin = "researcher";
  delete next.attemptId;
  next.createdAt = now();
  // Notes describe server changes still present in the content; keep them with the edited revision.
  const text = (v: unknown, max: number) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      throw new AuthoringError("입력한 내용의 길이를 확인해 주세요.");
    return v;
  };
  const keep = (v: unknown) => (v && typeof v === "object" ? (v as { en?: string }) : {});
  if (body.title !== undefined) next.profile.title = { ...keep(next.profile.title), ko: text(body.title, 120) };
  if (body.summary !== undefined)
    next.profile.summary = { ...keep(next.profile.summary), ko: text(body.summary, 2000) };
  if (body.description !== undefined) next.description = text(body.description, 1024);
  if (body.instructions !== undefined) next.instructions = text(body.instructions, 60_000);
  if (body.codeFiles !== undefined) {
    if (!Array.isArray(body.codeFiles)) throw new AuthoringError("코드 파일 목록을 확인해 주세요.");
    for (const f of body.codeFiles) {
      const extraction = project.extractions[f.sourceId];
      if (
        !safeRelative(f.path) ||
        !f.path.startsWith("scripts/") ||
        !extraction?.files?.some((e) => e.path === f.sourcePath && e.text && !e.data)
      )
        throw new AuthoringError("제공한 코드에 없는 파일이거나 경로가 올바르지 않습니다.");
    }
    next.codeFiles = body.codeFiles;
  }
  return next;
}

export function answerQuestion(project: AuthoringProject, questionId: string, body: AnswerBody, by: string): Decision {
  const q = project.questions.find((x) => x.id === questionId);
  if (!q) throw new AuthoringError("질문을 찾을 수 없습니다.", 404);
  if (q.status === "superseded") throw new AuthoringError("이 질문은 새 질문으로 바뀌었습니다.", 409);
  if (body.questionRevision !== q.revision)
    throw new AuthoringError("질문이 바뀌었습니다. 화면을 새로 고친 뒤 다시 답해 주세요.", 409);
  let response = typeof body.response === "string" ? body.response.trim() : "";
  let optionId: string | undefined;
  if (!body.defer) {
    if (body.optionId !== undefined) {
      const option = q.options.find((o) => o.id === body.optionId);
      if (!option || q.answerType === "text") throw new AuthoringError("선택지에 없는 답입니다.");
      optionId = option.id;
      if (!response) response = option.label;
    }
    // Every question accepts a free-text answer ("기타"), also when the coauthor proposed choices only.
    if (!response || response.length > 4000) throw new AuthoringError("답을 입력해 주세요.");
  }
  const decision = {
    id: newId("dec"),
    questionId: q.id,
    questionRevision: q.revision,
    key: q.key,
    response: body.defer ? "" : response,
    ...(optionId ? { optionId } : {}),
    status: body.defer ? ("deferred" as const) : ("answered" as const),
    by,
    at: now(),
  };
  for (const d of project.decisions) if (d.questionId === q.id && !d.supersededBy) d.supersededBy = decision.id;
  project.decisions.push(decision);
  q.status = body.defer ? "deferred" : "answered";
  return decision;
}

/**
 * The revision request after a round of answers: which answers are new and which replace an earlier answer (the
 * researcher changed their mind on a draft that already used the old one), so the coauthor revises those parts.
 */
export function answersFeedback(project: AuthoringProject, decisions: Decision[]): string {
  const said = (d: Decision) => (d.status === "deferred" ? "나중에 정하기" : `"${d.response}"`);
  const lines = decisions.map((d) => {
    const q = project.questions.find((x) => x.id === d.questionId);
    const before = project.decisions.find((x) => x.supersededBy === d.id);
    return before
      ? `- ${d.key} (${q?.text ?? ""}): 이전 답 ${said(before)} → 바꾼 답 ${said(d)}`
      : `- ${d.key} (${q?.text ?? ""}): 새 답 ${said(d)}`;
  });
  return [
    "연구자가 질문에 답하거나 기록한 답을 바꿨습니다. 아래 답에 맞게 초안을 고치고, 바뀐 답에 기대던 단계·설명·기본값도 함께 고치세요.",
    ...lines,
  ].join("\n");
}

/** Validate every answer of a round first, then apply all of them (or none). */
export function answerAll(project: AuthoringProject, answers: AnswerItem[], by: string): Decision[] {
  if (!Array.isArray(answers) || !answers.length) throw new AuthoringError("답이 없습니다.");
  const ids = new Set<string>();
  for (const a of answers) {
    if (!a || typeof a.questionId !== "string") throw new AuthoringError("질문 식별자가 필요합니다.");
    if (ids.has(a.questionId)) throw new AuthoringError("같은 질문에 답이 두 번 있습니다.");
    ids.add(a.questionId);
  }
  // Dry run on a copy: any refusal leaves the stored project unchanged.
  const trial = structuredClone(project);
  for (const a of answers) answerQuestion(trial, a.questionId, a, by);
  return answers.map((a) => answerQuestion(project, a.questionId, a, by));
}

export async function registerAuthoringRoutes(
  app: FastifyInstance,
  options: AuthoringOptions = {},
): Promise<AuthoringStore> {
  const store = options.store ?? new AuthoringStore();
  await store.initialize();
  stores.set(app, store);
  const vocabulary = () => options.vocabulary ?? loadVocabulary();
  const context = (): PackageContext => ({ store, vocabulary: vocabulary(), checker: "gaid-hub" });
  const deps = (body: OperationBody | AnswersBody | undefined, project?: AuthoringProject) => ({
    config: modelConfig(body?.model ?? project?.model, body?.thinkingLevel ?? project?.thinkingLevel),
    ...(options.vocabulary ? { vocabulary: options.vocabulary } : {}),
    ...(options.chat ? { chat: options.chat } : {}),
  });
  const id = (params: unknown) => String((params as { id: string }).id);

  app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof AuthoringError) return reply.code(error.status).send({ error: error.message });
      if ((error as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE")
        return reply.code(413).send({ error: "요청이 너무 큽니다." });
      if ((error as { statusCode?: number }).statusCode === 400)
        return reply.code(400).send({ error: "JSON 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });
    scope.addHook("onSend", async (_req, reply, payload) => {
      reply.header("Cache-Control", "no-store");
      return payload;
    });

    scope.get("/geo/authoring/health", async () => {
      let defaultModel: string | null = null;
      try {
        defaultModel = modelConfig().ref;
      } catch {
        defaultModel = null;
      }
      return { enabled: true, defaultModel, pdfText: Boolean(await pdftotextVersion()) };
    });
    scope.get("/geo/authoring/projects", async () => ({ projects: await store.list() }));
    scope.post<{ Body: CreateProjectBody }>("/geo/authoring/projects", async (req, reply) =>
      reply.code(201).send(await store.create(req.body ?? {})),
    );
    // Hub-side receive (gaid-hub-followups): the chat's "send to the hub draft" bundles the analysis of the request's
    // project and starts a new method with that bundle as its first source (kind gaid-analysis). The researcher may add
    // the project's research notes (`notes`, note ids) and papers from 서재 (`libraryItemIds`); they enter through the
    // same source functions as in the authoring screen (gaid-authoring-sources).
    scope.post<{
      Body: { sessionId?: unknown; files?: unknown; note?: unknown; notes?: unknown; libraryItemIds?: unknown };
    }>("/geo/authoring/handoffs", async (req, reply) => {
      const body = req.body ?? {};
      const notes = body.notes === undefined ? [] : stringList(body.notes, HANDOFF_EXTRA);
      const itemIds = body.libraryItemIds === undefined ? [] : stringList(body.libraryItemIds, HANDOFF_EXTRA);
      if (!notes || !itemIds)
        return reply.code(400).send({ code: "input", error: `Select at most ${HANDOFF_EXTRA} distinct notes and papers` });
      const paths = activePaths();
      let built: Awaited<ReturnType<typeof buildHandoff>>;
      try {
        built = await buildHandoff(paths, body);
      } catch (e) {
        if (e instanceof HandoffError) return reply.code(e.status).send({ code: e.code, error: e.message });
        throw e;
      }
      const note = typeof body.note === "string" ? body.note.trim() : "";
      const project = await store.create({ title: "분석에서 시작한 방법", ...(note ? { goal: note.slice(0, 2000) } : {}) });
      await addSource(store, project.id, {
        name: built.filename,
        mediaType: "application/gzip",
        kind: "gaid-analysis",
        contentBase64: built.archive.toString("base64"),
      });
      const skipped: { id: string; reason: string }[] = [];
      for (const noteId of notes) {
        try {
          await addNoteSource(store, project.id, { projectId: paths.id, noteId }, undefined, paths);
        } catch (e) {
          if (!(e instanceof AuthoringError)) throw e;
          skipped.push({ id: noteId, reason: e.message });
        }
      }
      if (itemIds.length) {
        const library = (options.library ?? libraryStore)();
        const added = await addLibrarySources(store, project.id, itemIds, libraryDeps(library, zoteroService(library)));
        linkLibraryAuthoring(library, added.added.map((a) => a.itemId), project.id);
        skipped.push(...added.skipped.map((x) => ({ id: x.itemId, reason: x.reason })));
      }
      return reply.code(201).send({ projectId: project.id, ...(skipped.length ? { skipped } : {}) });
    });
    scope.get("/geo/authoring/projects/:id", async (req) => store.read(id(req.params)));
    scope.delete("/geo/authoring/projects/:id", async (req, reply) => {
      await store.archive(id(req.params));
      return reply.code(204).send();
    });
    // Sources are base64 in JSON (30 MiB decoded).
    scope.post("/geo/authoring/projects/:id/sources", { bodyLimit: 42 * 1024 * 1024 }, async (req, reply) =>
      reply.code(201).send(await addSource(store, id(req.params), req.body as never)),
    );
    scope.delete("/geo/authoring/projects/:id/sources/:sid", async (req, reply) => {
      await removeSource(store, id(req.params), (req.params as { sid: string }).sid);
      return reply.code(204).send();
    });
    // Research notes from GAID projects on this machine (index.md and the figures in the note folder), each one source.
    scope.post<{ Body: AddNoteSourcesBody }>("/geo/authoring/projects/:id/sources/notes", async (req, reply) => {
      const notes = req.body?.notes;
      if (!Array.isArray(notes) || !notes.length || notes.length > 20)
        throw new AuthoringError("연구 노트를 1~20개 골라 주세요.");
      const projectId = id(req.params);
      await store.read(projectId);
      const added = [];
      for (const ref of notes) added.push((await addNoteSource(store, projectId, ref)).source);
      return reply.code(201).send({ sources: added });
    });
    scope.get("/geo/authoring/projects/:id/sources/:sid/original", async (req, reply) => {
      const project = await store.read(id(req.params));
      const sid = (req.params as { sid: string }).sid;
      const source = project.sources.find((s) => s.id === sid);
      if (!source) throw new AuthoringError("자료를 찾을 수 없습니다.", 404);
      const bytes = await store.readFile(project.id, `sources/${source.id}/original`);
      reply.header("Content-Type", source.kind === "pdf" ? "application/pdf" : "application/octet-stream");
      reply.header(
        "Content-Disposition",
        `${source.kind === "pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(source.name)}`,
      );
      return reply.send(bytes);
    });
    scope.get("/geo/authoring/projects/:id/sources/:sid/page-image/:page", async (req, reply) => {
      const project = await store.read(id(req.params));
      const params = req.params as { sid: string; page: string };
      const extraction = project.extractions[params.sid];
      const page = Number(params.page);
      if (!extraction?.pages || !Number.isInteger(page) || page < 1 || page > extraction.pages)
        throw new AuthoringError("없는 쪽입니다.", 404);
      const width = Number((req.query as { w?: string }).w ?? 800);
      reply.header("Content-Type", "image/png");
      return reply.send(await pageImage(store, project.id, params.sid, page, width));
    });
    scope.get("/geo/authoring/projects/:id/sources/:sid/pages/:page", async (req) => {
      const project = await store.read(id(req.params));
      const params = req.params as { sid: string; page: string };
      const extraction = project.extractions[params.sid];
      const page = Number(params.page);
      if (!extraction?.pages || !Number.isInteger(page) || page < 1 || page > extraction.pages)
        throw new AuthoringError("없는 쪽입니다.", 404);
      return { page, text: await pageText(store, project.id, extraction.sourceId, page) };
    });
    scope.get("/geo/authoring/projects/:id/sources/:sid/files/*", async (req) => {
      const project = await store.read(id(req.params));
      const params = req.params as { sid: string; "*": string };
      const path = params["*"] ?? "";
      const entry = project.extractions[params.sid]?.files?.find((f) => f.path === path);
      if (!entry) throw new AuthoringError("제공한 자료에 없는 파일입니다.", 404);
      if (!entry.text) throw new AuthoringError("텍스트 파일이 아닙니다.", 415);
      const bytes = await store.readFile(project.id, sourceFile(params.sid, path));
      return { path, text: bytes.toString("utf8") };
    });
    scope.post<{ Body: OperationBody }>("/geo/authoring/projects/:id/analyze", async (req, reply) => {
      const projectId = id(req.params);
      const body = req.body ?? ({} as OperationBody);
      if (body.goal !== undefined || body.target !== undefined)
        await store.mutate(projectId, (p) => {
          if (typeof body.goal === "string") {
            const goal = body.goal.trim().slice(0, 500);
            if (goal) p.goal = goal;
            else delete p.goal;
          }
          if (body.target === "skill" || body.target === "workflow" || body.target === "auto") p.target = body.target;
        });
      const project = await store.read(projectId);
      return reply.code(202).send(await startOperation(store, projectId, "analyze", body.opId, deps(body, project)));
    });
    scope.post<{ Body: OperationBody }>("/geo/authoring/projects/:id/draft", async (req, reply) => {
      const project = await store.read(id(req.params));
      return reply
        .code(202)
        .send(await startOperation(store, project.id, "draft", req.body?.opId, deps(req.body, project)));
    });
    scope.post<{ Body: OperationBody }>("/geo/authoring/projects/:id/revise", async (req, reply) => {
      const project = await store.read(id(req.params));
      return reply.code(202).send(
        await startOperation(store, project.id, "revise", req.body?.opId, {
          ...deps(req.body, project),
          feedback: req.body?.feedback,
        }),
      );
    });
    scope.post<{ Body: AnswersBody }>("/geo/authoring/projects/:id/answers", async (req, reply) => {
      const body = req.body ?? ({} as AnswersBody);
      if (typeof body.opId !== "string" || !OP_ID.test(body.opId))
        throw new AuthoringError("작업 식별자(opId)가 필요합니다.");
      const projectId = id(req.params);
      // A repeated request (same opId) returns the recorded decisions and attempt instead of answering twice.
      const decisions = await store.mutate(projectId, (p) => {
        const done = p.ops[`answers:${body.opId}`];
        if (done) return p.decisions.filter((d) => done.split(",").includes(d.id));
        const out = answerAll(p, body.answers, p.owner);
        p.ops[`answers:${body.opId}`] = out.map((d) => d.id).join(",");
        return out;
      });
      if (!body.draft) return reply.code(201).send({ decisions });
      const project = await store.read(projectId);
      const op = project.drafts.length ? "revise" : "draft";
      const attempt = await startOperation(store, projectId, op, `${body.opId}-draft`, {
        ...deps(body, project),
        ...(op === "revise" ? { feedback: answersFeedback(project, decisions) } : {}),
      });
      return reply.code(202).send({ decisions, attempt });
    });
    scope.post<{ Body: EditDraftBody }>("/geo/authoring/projects/:id/drafts", async (req, reply) => {
      const draft = await store.mutate(id(req.params), (p) => {
        const next = editDraft(p, req.body ?? ({} as EditDraftBody));
        p.drafts.push(next);
        return next;
      });
      return reply.code(201).send(draft);
    });
    const draftOf = (p: AuthoringProject, rev: unknown) => {
      const d = p.drafts.find((x) => x.revision === Number(rev));
      if (!d) throw new AuthoringError("초안 판을 찾을 수 없습니다.", 404);
      return d;
    };
    scope.get("/geo/authoring/projects/:id/drafts/:rev/files", async (req) => {
      const p = await store.read(id(req.params));
      return { files: await draftFiles(p, draftOf(p, (req.params as { rev: string }).rev), context()) };
    });
    scope.get("/geo/authoring/projects/:id/drafts/:rev/check", async (req) => {
      const p = await store.read(id(req.params));
      const draft = draftOf(p, (req.params as { rev: string }).rev);
      const findings = await checkMethod(p, draft, context());
      return { draftRevision: draft.revision, findings, passed: !findings.some((f) => f.level === "error") };
    });
    scope.post<{ Body: PackageBody }>("/geo/authoring/projects/:id/packages", async (req, reply) => {
      const body = req.body ?? ({} as PackageBody);
      if (typeof body.opId !== "string" || !OP_ID.test(body.opId))
        throw new AuthoringError("작업 식별자(opId)가 필요합니다.");
      const ctx = context();
      const result = await store.mutate(id(req.params), async (p) => {
        const existing = p.ops[body.opId];
        if (existing?.startsWith("package:"))
          return { record: p.packages.find((x) => `package:${x.revision}` === existing)! };
        const draft = draftOf(p, body.draftRevision);
        // The same draft revision is packaged once; later requests return that package.
        const same = p.packages.find((x) => x.draftRevision === draft.revision);
        if (same) return { record: same };
        const built = await buildPackage(p, draft, ctx);
        if ("record" in built) {
          p.packages.push(built.record);
          p.ops[body.opId] = `package:${built.record.revision}`;
        }
        return built;
      });
      if ("record" in result) return reply.code(201).send(result.record);
      return reply.code(422).send({ draftRevision: body.draftRevision, findings: result.findings, passed: false });
    });
    scope.get("/geo/authoring/projects/:id/packages/:rev", async (req, reply) => {
      const p = await store.read(id(req.params));
      const rev = Number(String((req.params as { rev: string }).rev).replace(/\.tar\.gz$/, ""));
      const pkg = p.packages.find((x) => x.revision === rev);
      if (!pkg) throw new AuthoringError("패키지를 찾을 수 없습니다.", 404);
      reply.header("Content-Type", "application/gzip");
      reply.header("Content-Disposition", `attachment; filename="${pkg.slug}-${pkg.revision}.tar.gz"`);
      return reply.send(await store.readFile(p.id, pkg.archive));
    });
    scope.post<{ Body: { projectId: string } }>("/geo/authoring/projects/:id/packages/:rev/preview", async (req) => {
      const p = await store.read(id(req.params));
      const pkg = p.packages.find((x) => x.revision === Number((req.params as { rev: string }).rev));
      if (!pkg) throw new AuthoringError("설치할 Workflow를 찾을 수 없습니다.", 404);
      return previewPackageBytes(await store.readFile(p.id, pkg.archive), pkg, req.body?.projectId);
    });
    scope.post<{ Body: InstallBody }>("/geo/authoring/projects/:id/packages/:rev/install", async (req, reply) => {
      const body = req.body ?? ({} as InstallBody);
      const p = await store.read(id(req.params));
      const pkg = p.packages.find((x) => x.revision === Number((req.params as { rev: string }).rev));
      if (!pkg) throw new AuthoringError("패키지를 찾을 수 없습니다.", 404);
      const result = await installPackage(store, p, pkg, body);
      return reply.code(201).send(result);
    });
  });
  return store;
}

export { authoringOwner, newId, now };

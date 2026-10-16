import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { KADY_PI_AGENT_DIR } from "../../config.ts";
import {
  AUTHORING_PROJECT_SCHEMA,
  projectStage,
  runningAttempt,
  type AuthoringProject,
  type CreateProjectBody,
  type ProjectSummary,
} from "../../../../web/src/geo/contracts/authoring.ts";

export class AuthoringError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** User-level store of the GAID hub (not inside a GAID project); `GAID_AUTHORING_DIR` overrides it for tests. */
export const authoringDir = () =>
  resolve(process.env.GAID_AUTHORING_DIR || join(KADY_PI_AGENT_DIR, "skill-hub", "authoring"));
export const authoringOwner = () => process.env.GAID_AUTHORING_OWNER || "local";

const ID = /^[a-z0-9][a-z0-9-]{5,63}$/;
export const newId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;
export const now = () => new Date().toISOString();

/** File-backed project store. One process owns a directory; mutations of one project are serialized. */
export class AuthoringStore {
  root: string;
  private queues = new Map<string, Promise<unknown>>();
  private cache = new Map<string, AuthoringProject>();
  constructor(root = authoringDir()) {
    this.root = root;
  }
  async initialize(): Promise<void> {
    await mkdir(join(this.root, "projects"), { recursive: true });
    // Model calls do not survive a restart; never infer their outcome.
    for (const id of await this.ids()) {
      const p = await this.read(id);
      if (!p.attempts.some((a) => a.outcome === "running")) continue;
      await this.mutate(id, (project) => {
        for (const a of project.attempts)
          if (a.outcome === "running") {
            a.outcome = "interrupted";
            a.endedAt = now();
            a.error = "서버가 다시 시작되어 응답을 받지 못했습니다. 다시 실행해 주세요.";
          }
      });
    }
  }
  projectDir(id: string): string {
    if (!ID.test(id)) throw new AuthoringError("작업 식별자가 올바르지 않습니다.", 404);
    return join(this.root, "projects", id);
  }
  /** Resolve a path inside a project folder; rejects traversal. */
  within(id: string, ...parts: string[]): string {
    const base = this.projectDir(id);
    const path = resolve(base, ...parts);
    if (path !== base && !path.startsWith(base + sep)) throw new AuthoringError("작업 폴더 밖의 경로입니다.", 400);
    return path;
  }
  async ids(): Promise<string[]> {
    const dir = join(this.root, "projects");
    if (!existsSync(dir)) return [];
    return (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && ID.test(d.name) && existsSync(join(dir, d.name, "project.json")))
      .map((d) => d.name)
      .sort();
  }
  async read(id: string): Promise<AuthoringProject> {
    const cached = this.cache.get(id);
    if (cached) return structuredClone(cached);
    const file = join(this.projectDir(id), "project.json");
    if (!existsSync(file)) throw new AuthoringError("작업을 찾을 수 없습니다.", 404);
    const project = JSON.parse(await readFile(file, "utf8")) as AuthoringProject;
    if (project.schemaVersion !== AUTHORING_PROJECT_SCHEMA)
      throw new AuthoringError("지원하지 않는 작업 기록 형식입니다.", 500);
    project.installs ??= [];
    this.cache.set(id, project);
    return structuredClone(project);
  }
  async list(): Promise<ProjectSummary[]> {
    const out: ProjectSummary[] = [];
    for (const id of await this.ids()) {
      const p = await this.read(id);
      out.push({
        id: p.id,
        title: p.title,
        owner: p.owner,
        updatedAt: p.updatedAt,
        stage: projectStage(p),
        busy: runningAttempt(p)?.op ?? null,
        sources: p.sources.length,
        openQuestions: p.questions.filter((q) => q.status === "open").length,
        latestDraft: p.drafts.at(-1)?.revision,
        latestPackage: p.packages.at(-1)?.revision,
        ...(p.drafts.length ? { methodTitle: titleOf(p.drafts.at(-1)!.profile.title) } : {}),
      });
    }
    return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  async create(input: CreateProjectBody): Promise<AuthoringProject> {
    const id = newId("ap");
    const t = now();
    const project: AuthoringProject = {
      schemaVersion: AUTHORING_PROJECT_SCHEMA,
      id,
      owner: authoringOwner(),
      title: input.title?.trim() || "새 방법",
      ...(input.goal?.trim() ? { goal: input.goal.trim() } : {}),
      ...(input.target ? { target: input.target } : {}),
      ...(input.model?.trim() ? { model: input.model.trim() } : {}),
      createdAt: t,
      updatedAt: t,
      sourceRevision: 0,
      sources: [],
      extractions: {},
      findings: [],
      questions: [],
      decisions: [],
      drafts: [],
      attempts: [],
      packages: [],
      installs: [],
      ops: {},
    };
    await mkdir(this.projectDir(id), { recursive: true });
    await this.write(project);
    return structuredClone(project);
  }
  /**
   * Serialized read-modify-write. `change` may mutate the project and return a value; the project is persisted
   * atomically only when `change` resolves. A thrown error leaves the stored project unchanged.
   */
  mutate<T>(id: string, change: (p: AuthoringProject) => T | Promise<T>): Promise<T> {
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.then(async () => {
      const project = await this.read(id);
      const result = await change(project);
      project.updatedAt = now();
      await this.write(project);
      return result;
    });
    this.queues.set(
      id,
      next.catch(() => {}),
    );
    return next;
  }
  private async write(project: AuthoringProject) {
    const file = join(this.projectDir(project.id), "project.json");
    const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`);
    await rename(tmp, file);
    this.cache.set(project.id, structuredClone(project));
  }
  /** Move a project out of the list into `<root>/archive/` (never deleted in place). */
  async archive(id: string): Promise<void> {
    const dir = this.projectDir(id);
    if (!existsSync(join(dir, "project.json"))) throw new AuthoringError("작업을 찾을 수 없습니다.", 404);
    await (this.queues.get(id) ?? Promise.resolve());
    await mkdir(join(this.root, "archive"), { recursive: true });
    await rename(dir, join(this.root, "archive", `${id}-${Date.now()}`));
    this.cache.delete(id);
    this.queues.delete(id);
  }
  /** Write a project-local file atomically (attempt records, extracted pages, packages). */
  async writeFile(id: string, relative: string, data: string | Uint8Array): Promise<string> {
    const path = this.within(id, relative);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, data);
    await rename(tmp, path);
    return path;
  }
  async readFile(id: string, relative: string): Promise<Buffer> {
    const path = this.within(id, relative);
    if (!existsSync(path)) throw new AuthoringError("파일을 찾을 수 없습니다.", 404);
    return readFile(path);
  }
  exists(id: string, relative: string): boolean {
    return existsSync(this.within(id, relative));
  }
}

function titleOf(value: string | { ko: string }): string {
  return typeof value === "string" ? value : value.ko;
}

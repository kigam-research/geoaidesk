/**
 * Default example data of a Workflow's input roles in hub authoring (gaid-workflow-example; contract
 * web/src/geo/contracts/workflow-examples.ts and the example section of contracts/authoring.ts). Only the researcher
 * attaches, edits and removes examples, each change as a new researcher draft revision; the coauthor model never writes
 * them and a model draft inherits the previous draft's examples by input role id.
 *
 * Bytes of a bundled file live either in a project source (`sources/<sourceId>/files/<path>`, listed with sha256 in the
 * source's extraction) or in the store (`examples/<sha256>`, uploads and files restored from a registered package). A
 * URL example is fetched once (bounded) to record sha256 and size; its bytes are not kept.
 */
import { createHash } from "node:crypto";
import type {
  AttachExampleBody,
  AuthoringProject,
  DraftExampleFile,
  DraftInputExample,
  EditExampleBody,
  ExampleText,
  LocalWorkflow,
  MethodDraft,
} from "../../../../web/src/geo/contracts/authoring.ts";
import {
  EXAMPLE_LIMITS,
  exampleProblems,
  exampleUrlAllowed,
  type WorkflowExampleFile,
  type WorkflowInputExample,
} from "../../../../web/src/geo/contracts/workflow-examples.ts";
import { sha256, sourceFile } from "./sources.ts";
import { AuthoringError, now, type AuthoringStore } from "./store.ts";
import { structuredDraft } from "./workflow.ts";

const MiB = (n: number) => `${Math.round(n / 1024 / 1024)} MiB`;
const SHA = /^[a-f0-9]{64}$/;
/** Store path of uploaded (or restored) example bytes. */
export const uploadPath = (sha: string) => {
  if (!SHA.test(sha)) throw new AuthoringError("예제 자료 파일 식별값이 올바르지 않습니다.");
  return `examples/${sha}`;
};

/** A new researcher revision on top of the latest draft; a stale base is refused (shared with `editDraft`). */
export function researcherRevision(project: AuthoringProject, baseRevision: unknown): MethodDraft {
  const latest = project.drafts.at(-1);
  if (!latest) throw new AuthoringError("먼저 방법 초안을 만들어 주세요.", 409);
  if (baseRevision !== latest.revision)
    throw new AuthoringError("다른 곳에서 초안이 바뀌었습니다. 최신 초안을 다시 불러와 주세요.", 409);
  const next: MethodDraft = structuredDraft(latest);
  next.revision = latest.revision + 1;
  next.baseRevision = latest.revision;
  next.origin = "researcher";
  delete next.attemptId;
  next.createdAt = now();
  return next;
}

/** The package form of an example: `from` dropped. */
export function packagedExample(example: DraftInputExample): WorkflowInputExample {
  return { ...example, files: example.files.map(({ from: _from, ...file }) => file as WorkflowExampleFile) };
}

/** The Workflow as the package carries it; the same object when no role has an example (byte-identical packages). */
export function packagedWorkflow(workflow: LocalWorkflow): LocalWorkflow {
  if (!workflow.inputRoles.some((r) => r.example)) return workflow;
  return {
    ...workflow,
    inputRoles: workflow.inputRoles.map((r) => (r.example ? { ...r, example: packagedExample(r.example) } : r)),
  };
}

/** Bytes of all bundled example files of a Workflow. */
export function bundledBytes(workflow: LocalWorkflow | undefined, exceptRole?: string): number {
  let total = 0;
  for (const role of workflow?.inputRoles ?? [])
    if (role.id !== exceptRole) for (const f of role.example?.files ?? []) if (f.path) total += f.size;
  return total;
}

/** Read and verify the stored bytes of one bundled example file. */
export async function exampleFileBytes(
  store: AuthoringStore,
  project: AuthoringProject,
  file: DraftExampleFile,
): Promise<Buffer> {
  const from = file.from;
  let relative: string | undefined;
  if (from && "upload" in from) relative = uploadPath(file.sha256);
  else if (from && "sourceId" in from) {
    const entry = project.extractions[from.sourceId]?.files?.find((f) => f.path === from.sourcePath);
    if (entry && entry.sha256 === file.sha256 && entry.size === file.size) relative = sourceFile(from.sourceId, from.sourcePath);
  }
  const bytes = relative && store.exists(project.id, relative) ? await store.readFile(project.id, relative) : undefined;
  if (!bytes || bytes.length !== file.size || sha256(bytes) !== file.sha256)
    throw new AuthoringError(`예제 자료 파일을 찾을 수 없거나 처음 넣은 파일과 다릅니다: ${file.name}`);
  return bytes;
}

/** A plain file name the contract accepts: folders dropped, other characters replaced by `_`. */
export function exampleFileName(raw: string, fallback: string): string {
  const base = raw.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
  const name = base
    .normalize("NFC")
    .replace(/[^A-Za-z0-9 ._()+-]/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\.+$/, "")
    .slice(0, 128);
  return name || fallback;
}

export interface RemoteOptions {
  timeoutMs?: number;
  limitBytes?: number;
}

/**
 * Fetch a public URL once and return its sha256 and size; the bytes are hashed while streaming and dropped. https only
 * (http on loopback for tests), no credentials, at most five redirects (each target checked), bounded size and time.
 */
export async function remoteDigest(raw: string, options: RemoteOptions = {}): Promise<{ sha256: string; size: number }> {
  const limit = options.limitBytes ?? EXAMPLE_LIMITS.remoteFile;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10 * 60_000);
  const failed = () =>
    new AuthoringError("공개 주소에서 파일을 받지 못했습니다. 주소가 맞는지, 로그인 없이 열리는지 확인해 주세요.");
  let url = raw;
  for (let hop = 0; hop <= 5; hop++) {
    if (!exampleUrlAllowed(url)) throw new AuthoringError("예제 자료 주소는 공개 https 주소여야 합니다.");
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual", signal, credentials: "omit", headers: { accept: "*/*" } });
    } catch {
      throw failed();
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      await res.body?.cancel().catch(() => {});
      const location = res.headers.get("location");
      if (!location) throw failed();
      url = new URL(location, url).href;
      continue;
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => {});
      throw failed();
    }
    const declared = Number(res.headers.get("content-length") ?? "");
    const tooLarge = () =>
      new AuthoringError(`공개 주소의 파일이 ${MiB(limit)}보다 커서 예제 자료로 쓸 수 없습니다.`, 413);
    if (Number.isFinite(declared) && declared > limit) {
      await res.body.cancel().catch(() => {});
      throw tooLarge();
    }
    const hash = createHash("sha256");
    let size = 0;
    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) {
          await reader.cancel().catch(() => {});
          throw tooLarge();
        }
        hash.update(value);
      }
    } catch (e) {
      if (e instanceof AuthoringError) throw e;
      throw failed();
    }
    return { sha256: hash.digest("hex"), size };
  }
  throw failed();
}

function exampleText(body: Partial<ExampleText>, current?: DraftInputExample): Omit<DraftInputExample, "files"> {
  const line = (value: unknown, label: string, max: number) => {
    if (typeof value !== "string" || !value.trim()) throw new AuthoringError(`예제 자료의 ${label}을 입력해 주세요.`);
    if (value.trim().length > max) throw new AuthoringError(`예제 자료의 ${label}이 너무 깁니다.`);
    return value.trim();
  };
  // A changed Korean text drops its English version (it no longer says the same thing).
  const localized = (value: unknown, label: string, previous?: { ko: string; en?: string }) => {
    const ko = line(value, label, 500);
    return previous && previous.ko === ko ? previous : { ko };
  };
  const title = body.title !== undefined || !current ? localized(body.title, "제목", current?.title) : current.title;
  const source = body.source !== undefined || !current ? localized(body.source, "출처", current?.source) : current.source;
  let license = current?.license;
  if (body.license !== undefined) {
    if (typeof body.license !== "string" || body.license.trim().length > 500)
      throw new AuthoringError("예제 자료의 이용 조건을 확인해 주세요.");
    license = body.license.trim() || undefined;
  }
  let synthetic = current?.synthetic;
  if (body.synthetic !== undefined) {
    if (typeof body.synthetic !== "boolean") throw new AuthoringError("합성 자료 여부를 확인해 주세요.");
    synthetic = body.synthetic || undefined;
  }
  return { title, source, ...(license ? { license } : {}), ...(synthetic ? { synthetic: true } : {}) };
}

function roleOf(draft: MethodDraft, roleId: unknown) {
  const role = draft.workflow?.inputRoles.find((r) => r.id === roleId);
  if (!role) throw new AuthoringError("Workflow에 없는 입력입니다.", 404);
  return role;
}

/** Contract problems of the package form; the server's own output should never fail them, so they are a 400. */
function assertValid(example: DraftInputExample, roleId: string) {
  const problems = exampleProblems(packagedExample(example), roleId);
  if (problems.length) throw new AuthoringError(`예제 자료 정보를 확인해 주세요. (${problems[0]})`);
}

/** Files of an attach request, hashed and (for uploads) stored; runs before the project is locked. */
async function collectFiles(
  store: AuthoringStore,
  project: AuthoringProject,
  body: AttachExampleBody,
  remote: RemoteOptions,
): Promise<DraftExampleFile[]> {
  const from = body.from;
  const roleId = body.roleId;
  const bundled = (name: string) => `examples/${roleId}/${name}`;
  const tooBig = () =>
    new AuthoringError(`예제 자료 파일 하나는 ${MiB(EXAMPLE_LIMITS.bundledFile)} 이하여야 합니다. 큰 자료는 공개 주소로 넣어 주세요.`, 413);
  const count = (n: number) => {
    if (!n || n > EXAMPLE_LIMITS.files)
      throw new AuthoringError(`예제 자료 파일은 1~${EXAMPLE_LIMITS.files}개를 넣을 수 있습니다.`);
  };
  if (!from || typeof from !== "object") throw new AuthoringError("예제 자료를 어디에서 가져올지 골라 주세요.");
  if (from.kind === "upload") {
    if (!Array.isArray(from.files)) throw new AuthoringError("올릴 파일을 골라 주세요.");
    count(from.files.length);
    const out: DraftExampleFile[] = [];
    for (const [i, f] of from.files.entries()) {
      if (!f || typeof f.contentBase64 !== "string") throw new AuthoringError("올릴 파일을 골라 주세요.");
      if (f.contentBase64.length > Math.ceil(EXAMPLE_LIMITS.bundledFile / 3) * 4 + 4) throw tooBig();
      const bytes = Buffer.from(f.contentBase64, "base64");
      if (bytes.length > EXAMPLE_LIMITS.bundledFile) throw tooBig();
      const sha = sha256(bytes);
      if (!store.exists(project.id, uploadPath(sha))) await store.writeFile(project.id, uploadPath(sha), bytes);
      const name = exampleFileName(String(f.name ?? ""), `example-${i + 1}`);
      out.push({ name, sha256: sha, size: bytes.length, path: bundled(name), from: { upload: true } });
    }
    return out;
  }
  if (from.kind === "source") {
    const source = project.sources.find((s) => s.id === from.sourceId);
    const entries = project.extractions[from.sourceId]?.files ?? [];
    if (!source || !entries.length) throw new AuthoringError("파일 목록이 있는 자료를 골라 주세요.", 404);
    if (!Array.isArray(from.paths)) throw new AuthoringError("자료에서 쓸 파일을 골라 주세요.");
    count(from.paths.length);
    const out: DraftExampleFile[] = [];
    for (const [i, path] of from.paths.entries()) {
      const entry = entries.find((e) => e.path === path);
      if (!entry) throw new AuthoringError(`자료에 없는 파일입니다: ${String(path)}`, 404);
      if (entry.size > EXAMPLE_LIMITS.bundledFile) throw tooBig();
      const file: DraftExampleFile = {
        name: exampleFileName(entry.path, `example-${i + 1}`),
        sha256: entry.sha256,
        size: entry.size,
        path: "",
        from: { sourceId: source.id, sourcePath: entry.path },
      };
      file.path = bundled(file.name);
      await exampleFileBytes(store, project, file);
      out.push(file);
    }
    return out;
  }
  if (from.kind === "url") {
    if (!Array.isArray(from.files)) throw new AuthoringError("예제 자료 주소를 입력해 주세요.");
    count(from.files.length);
    const out: DraftExampleFile[] = [];
    for (const [i, f] of from.files.entries()) {
      const url = typeof f?.url === "string" ? f.url.trim() : "";
      if (!exampleUrlAllowed(url)) throw new AuthoringError("예제 자료 주소는 공개 https 주소여야 합니다.");
      const fromUrl = (() => {
        try {
          return decodeURIComponent(new URL(url).pathname);
        } catch {
          return "";
        }
      })();
      const name = exampleFileName(typeof f.name === "string" && f.name.trim() ? f.name : fromUrl, `example-${i + 1}`);
      const { sha256: sha, size } = await remoteDigest(url, remote);
      out.push({ name, sha256: sha, size, url });
    }
    return out;
  }
  throw new AuthoringError("예제 자료를 어디에서 가져올지 골라 주세요.");
}

/** Attach (or replace) the example of one input role; returns the new draft revision. */
export async function attachExample(
  store: AuthoringStore,
  projectId: string,
  body: AttachExampleBody,
  remote: RemoteOptions = {},
): Promise<MethodDraft> {
  if (!body || typeof body !== "object") throw new AuthoringError("요청 내용을 확인해 주세요.");
  const before = await store.read(projectId);
  const latest = researcherRevision(before, body.baseRevision);
  roleOf(latest, body.roleId);
  const text = exampleText(body);
  const files = await collectFiles(store, before, body, remote);
  const names = new Set<string>();
  for (const f of files) {
    // Names the package gate refuses (key and secret look-alikes).
    if (/^(?:id_|\.env)|^(?:secrets?|secure)$|\.(?:pem|key)$/i.test(f.name))
      throw new AuthoringError(`이 이름의 파일은 Workflow에 넣을 수 없습니다. 이름을 바꿔 주세요: ${f.name}`);
    if (names.has(f.name.toLowerCase())) throw new AuthoringError(`같은 이름의 파일이 두 번 있습니다: ${f.name}`);
    names.add(f.name.toLowerCase());
  }
  return store.mutate(projectId, (p) => {
    const next = researcherRevision(p, body.baseRevision);
    const role = roleOf(next, body.roleId);
    const example: DraftInputExample = { ...text, files };
    assertValid(example, role.id);
    const adding = files.reduce((sum, f) => sum + (f.path ? f.size : 0), 0);
    if (bundledBytes(next.workflow, role.id) + adding > EXAMPLE_LIMITS.bundledTotal)
      throw new AuthoringError(
        `Workflow에 넣는 예제 자료는 모두 합쳐 ${MiB(EXAMPLE_LIMITS.bundledTotal)} 이하여야 합니다. 큰 자료는 공개 주소로 넣어 주세요.`,
        413,
      );
    role.example = example;
    p.drafts.push(next);
    return next;
  });
}

/** Change the title, source, licence or synthetic mark of an attached example. */
export async function editExample(
  store: AuthoringStore,
  projectId: string,
  roleId: string,
  body: EditExampleBody,
): Promise<MethodDraft> {
  return store.mutate(projectId, (p) => {
    const next = researcherRevision(p, body?.baseRevision);
    const role = roleOf(next, roleId);
    if (!role.example) throw new AuthoringError("이 입력에는 예제 자료가 없습니다.", 404);
    const example: DraftInputExample = { ...exampleText(body, role.example), files: role.example.files };
    assertValid(example, role.id);
    role.example = example;
    p.drafts.push(next);
    return next;
  });
}

export async function removeExample(
  store: AuthoringStore,
  projectId: string,
  roleId: string,
  body: { baseRevision?: unknown },
): Promise<MethodDraft> {
  return store.mutate(projectId, (p) => {
    const next = researcherRevision(p, body?.baseRevision);
    const role = roleOf(next, roleId);
    if (!role.example) throw new AuthoringError("이 입력에는 예제 자료가 없습니다.", 404);
    delete role.example;
    p.drafts.push(next);
    return next;
  });
}

/**
 * A model draft keeps the researcher's examples: anything the model put under `example` is dropped, and each example
 * of the previous draft moves to the input role with the same id. A role that disappeared is recorded as a note.
 */
export function carryExamples(previous: MethodDraft | undefined, next: MethodDraft): void {
  for (const role of next.workflow?.inputRoles ?? []) delete role.example;
  for (const role of previous?.workflow?.inputRoles ?? []) {
    if (!role.example) continue;
    const target = next.workflow?.inputRoles.find((r) => r.id === role.id);
    if (target) target.example = structuredClone(role.example);
    else
      next.notes.push(
        `입력 "${role.label.ko}"이(가) 새 초안에 없어 그 입력의 예제 자료 "${role.example.title.ko}"를 옮기지 못했습니다. 필요하면 맞는 입력에 다시 넣어 주세요.`,
      );
  }
}

/**
 * After a draft is seeded from a registered package (hub editing), make every bundled example file of `draft` readable
 * in `projectId`: files whose recorded bytes are already there stay as they are, the rest are taken from the package
 * (`<slug>/examples/<roleId>/<name>`, hash-checked) into `examples/<sha256>`. Mutates `draft`.
 */
export async function restoreExampleBytes(
  store: AuthoringStore,
  project: AuthoringProject,
  draft: MethodDraft,
  packageEntries: () => Promise<Map<string, Buffer>>,
): Promise<void> {
  let entries: Map<string, Buffer> | undefined;
  for (const role of draft.workflow?.inputRoles ?? [])
    for (const file of role.example?.files ?? []) {
      if (!file.path) continue;
      try {
        await exampleFileBytes(store, project, file);
        continue;
      } catch {
        // not here: restore from the package below
      }
      entries ??= await packageEntries();
      const bytes = entries.get(file.path);
      if (!bytes || bytes.length !== file.size || sha256(bytes) !== file.sha256)
        throw new AuthoringError(`등록된 Workflow의 예제 자료 파일이 패키지에 없습니다: ${file.name}`, 409);
      if (!store.exists(project.id, uploadPath(file.sha256))) await store.writeFile(project.id, uploadPath(file.sha256), bytes);
      file.from = { upload: true };
    }
}

/**
 * Default example data of installed method Workflows (gaid-workflow-example; contract
 * web/src/geo/contracts/workflow-examples.ts). `exampleStates` reports, per input role, whether the example is already in
 * the project, bundled in the installed package or still to download; `prepareExamples` writes it into the project
 * (`user_data/examples/<method>/<roleId>-<key>/`): bundled files are copied after their hash is checked, remote files are
 * downloaded once with size, time and hash bounds. Nothing is overwritten: a folder is content-addressed and a file whose
 * bytes differ is refused. Written files are recorded as a user upload step in provenance.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import { recordUpload } from "../../provenance/user-steps.ts";
import type { GeoWorkflow } from "../catalogue-types.ts";
import {
  EXAMPLE_LIMITS,
  exampleFolder,
  examplePath,
  exampleUrlAllowed,
  type PrepareExamplesResponse,
  type WorkflowExampleFile,
  type WorkflowInputExample,
  type WorkflowInputExampleState,
} from "../../../../web/src/geo/contracts/workflow-examples.ts";
import { findInstalledMethod, type InstalledMethod } from "./local-methods.ts";

export class ExampleError extends Error {
  constructor(message: string, public statusCode = 409) {
    super(message);
  }
}

/** Hashes keyed by path, size and mtime, so listing methods does not re-read unchanged files. */
const hashCache = new Map<string, { size: number; mtimeMs: number; sha256: string }>();

async function fileSha256(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** Whether `file` is a regular file with exactly that size and hash. */
async function matches(file: string, expected: WorkflowExampleFile): Promise<boolean> {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile() || stat.size !== expected.size) return false;
  const cached = hashCache.get(file);
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.sha256 === expected.sha256;
  const sha256 = await fileSha256(file);
  hashCache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, sha256 });
  return sha256 === expected.sha256;
}

const exists = (file: string) => {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
};

function rolesWithExamples(workflow: GeoWorkflow): { id: string; example: WorkflowInputExample }[] {
  return (workflow.inputRoles ?? []).flatMap((role) => (role.example ? [{ id: role.id, example: role.example }] : []));
}

function bundledFile(method: InstalledMethod, file: WorkflowExampleFile): string {
  const resolved = path.resolve(method.dir, file.path!);
  if (!resolved.startsWith(path.resolve(method.dir) + path.sep)) throw new ExampleError("Example path leaves the package");
  return resolved;
}

/** Per input role id: the example's state in this project. Roles without an example are absent. */
export async function exampleStates(paths: ProjectPaths, method: InstalledMethod, workflow: GeoWorkflow): Promise<Map<string, WorkflowInputExampleState>> {
  const out = new Map<string, WorkflowInputExampleState>();
  for (const { id, example } of rolesWithExamples(workflow)) {
    const folder = path.join(paths.sandbox, exampleFolder(method.runtimeName, id, example));
    let download = 0;
    let broken: string | null = null;
    let present = true;
    for (const file of example.files) {
      if (await matches(path.join(folder, file.name), file)) continue;
      present = false;
      if (file.url) download += file.size;
      else if (!(await matches(bundledFile(method, file), file))) broken ??= `Bundled example file is missing or differs: ${file.path}`;
    }
    out.set(id, {
      title: example.title,
      source: example.source,
      ...(example.license ? { license: example.license } : {}),
      synthetic: example.synthetic === true,
      size: example.files.reduce((sum, file) => sum + file.size, 0),
      download: present ? 0 : download,
      path: examplePath(method.runtimeName, id, example),
      state: present ? "present" : broken ? "broken" : download > 0 ? "remote" : "bundled",
      ...(!present && broken ? { detail: broken } : {}),
    });
  }
  return out;
}

/** One write per target at a time; a second request for the same file waits for the first. */
const inflight = new Map<string, Promise<void>>();

async function download(file: WorkflowExampleFile, target: string, fetchImpl: typeof fetch): Promise<void> {
  if (!file.url || !exampleUrlAllowed(file.url)) throw new ExampleError("Example URL is not an allowed public address");
  if (file.size > EXAMPLE_LIMITS.remoteFile) throw new ExampleError("Example file is larger than the download limit");
  // About 256 KiB/s at worst, at least one and at most thirty minutes.
  const timeout = Math.min(30 * 60_000, 60_000 + Math.ceil(file.size / (256 * 1024)) * 1000);
  const response = await fetchImpl(file.url, { redirect: "follow", signal: AbortSignal.timeout(timeout), headers: { accept: "*/*" } });
  if (response.url && !exampleUrlAllowed(response.url)) throw new ExampleError("Example URL redirected to an address that is not allowed");
  if (!response.ok || !response.body) throw new ExampleError(`Example download failed: HTTP ${response.status}`, 502);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 0 && declared !== file.size && !response.headers.get("content-encoding"))
    throw new ExampleError(`Example download has ${declared} bytes, expected ${file.size}`, 502);
  const partial = `${target}.part-${crypto.randomUUID().slice(0, 8)}`;
  const hash = crypto.createHash("sha256");
  const out = fs.createWriteStream(partial, { flags: "wx" });
  let bytes = 0;
  try {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > file.size) {
        await reader.cancel().catch(() => undefined);
        throw new ExampleError(`Example download is larger than the declared ${file.size} bytes`, 502);
      }
      hash.update(value);
      if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", () => resolve()));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
    if (bytes !== file.size || hash.digest("hex") !== file.sha256) throw new ExampleError("Example download does not match its declared size and sha256", 502);
    fs.renameSync(partial, target);
  } catch (error) {
    out.destroy();
    fs.rmSync(partial, { force: true });
    throw error;
  }
}

async function copyBundled(method: InstalledMethod, file: WorkflowExampleFile, target: string): Promise<void> {
  const source = bundledFile(method, file);
  if (!(await matches(source, file))) throw new ExampleError(`Bundled example file is missing or differs: ${file.path}`);
  const partial = `${target}.part-${crypto.randomUUID().slice(0, 8)}`;
  fs.copyFileSync(source, partial, fs.constants.COPYFILE_EXCL);
  if (!(await matches(partial, file))) {
    fs.rmSync(partial, { force: true });
    throw new ExampleError(`Bundled example file changed while copying: ${file.path}`);
  }
  fs.renameSync(partial, target);
}

/** The examples of `roleIds` written into the project; already present files are kept as they are. */
export async function prepareExamples(
  paths: ProjectPaths,
  projectId: string,
  request: { method?: unknown; workflowId?: unknown; roleIds?: unknown },
  options: { fetch?: typeof fetch } = {},
): Promise<PrepareExamplesResponse> {
  const { method: name, workflowId, roleIds } = request;
  if (typeof name !== "string" || typeof workflowId !== "string" || !Array.isArray(roleIds) || roleIds.length === 0 || roleIds.length > 50 || roleIds.some((id) => typeof id !== "string"))
    throw new ExampleError("Body needs method, workflowId and roleIds", 400);
  const method = findInstalledMethod(paths, name);
  const workflow = method?.file.method?.workflows.find((candidate) => candidate.id === workflowId);
  if (!method || !workflow) throw new ExampleError("Workflow was not found", 404);
  const roles = rolesWithExamples(workflow);
  const inputs: Record<string, string> = {};
  const written: string[] = [];
  const sandbox = fs.realpathSync(paths.sandbox);
  for (const roleId of roleIds as string[]) {
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) throw new ExampleError(`Input has no example: ${roleId}`, 404);
    const folder = exampleFolder(method.runtimeName, roleId, role.example);
    const dir = path.join(sandbox, folder);
    fs.mkdirSync(dir, { recursive: true });
    // A link anywhere on the way would let the write land outside the project.
    if (fs.realpathSync(dir) !== dir) throw new ExampleError("Example folder is a link; remove it and try again");
    for (const file of role.example.files) {
      const target = path.join(dir, file.name);
      const key = target;
      const write = async () => {
        if (await matches(target, file)) return;
        if (exists(target)) throw new ExampleError(`A different file already exists at ${folder}/${file.name}; it is not overwritten`);
        if (file.url) await download(file, target, options.fetch ?? fetch);
        else await copyBundled(method, file, target);
        written.push(`${folder}/${file.name}`);
      };
      const previous = inflight.get(key);
      if (previous) await previous.catch(() => undefined);
      const running = write();
      inflight.set(key, running);
      try {
        await running;
      } finally {
        if (inflight.get(key) === running) inflight.delete(key);
      }
    }
    inputs[roleId] = examplePath(method.runtimeName, roleId, role.example);
  }
  if (written.length) await recordUpload(projectId, sandbox, written.map((rel) => path.join(sandbox, rel)));
  return { inputs, written };
}

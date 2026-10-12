/**
 * Bounded map helper boundary; no shell, network fetch or implicit dependency repair.
 *
 * A small pool of long-lived `helper.py --serve` workers answers one JSON line per
 * request, so a viewport/tile request does not pay interpreter and GDAL start-up
 * (~0.5 s each) and datasets stay open between tiles. A worker that times out,
 * overflows its output budget or exits is killed and replaced on next use.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUv } from "../../binaries.ts";
import { KADY_SKILLS_CACHE_DIR } from "../../config.ts";
import { HELPERS_DIR } from "../../helpers-env.ts";
import { SandboxError } from "../../sandbox-fs.ts";

const HELPER = fileURLToPath(new URL("./helper.py", import.meta.url));
export const MAP_HELPER_BYTES = 32 * 1024 * 1024;
export const MAP_HELPER_TIMEOUT_MS = 20_000;
const QUEUE_LIMIT = 512;
const IDLE_MS = 10 * 60_000;
/** Display tiles are cheap and often cancelled by panning; finishing them keeps the worker warm. */
const FINISH_ON_ABORT = new Set(["raster-tile", "raster-point", "raster-style"]);

export function mapWorkerCount(): number {
  const configured = Number(process.env.GAID_MAP_WORKERS);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 16) return configured;
  return Math.max(1, Math.min(3, Math.floor(os.availableParallelism() / 2)));
}

/** Derived display overviews for large rasters without their own; never inside a project. */
export function mapCacheDir(): string {
  if (process.env.GAID_MAP_CACHE_DIR?.trim()) return path.resolve(process.env.GAID_MAP_CACHE_DIR.trim());
  if (process.env.GAID_HOME?.trim()) return path.resolve(process.env.GAID_HOME.trim(), "cache", "maps");
  return path.join(path.dirname(KADY_SKILLS_CACHE_DIR), "map-cache");
}

export interface MapHelperOptions { signal?: AbortSignal; timeoutMs?: number }
interface Job {
  id: number; input: Record<string, unknown>; timeoutMs: number; signal?: AbortSignal;
  resolve(value: unknown): void; reject(error: Error): void; onAbort?: () => void;
}
interface Worker {
  proc: ChildProcessWithoutNullStreams; ready: boolean; job?: Job; timer?: NodeJS.Timeout;
  chunks: Buffer[]; bytes: number; stderr: string; idle?: NodeJS.Timeout; dead: boolean;
}

let nextId = 1;
const queue: Job[] = [];
const workers = new Set<Worker>();

function failure(input: Record<string, unknown>, code: number, message: string): SandboxError {
  const detail = message.trim().split("\n").at(-1)?.replaceAll(String(input.path), "[source]").slice(0, 800);
  return new SandboxError(code === 3 ? 503 : code === 4 ? 404 : 422, detail || "The map helper could not read this dataset.");
}

function retire(worker: Worker): void {
  if (worker.dead) return;
  worker.dead = true; workers.delete(worker);
  clearTimeout(worker.timer); clearTimeout(worker.idle);
  worker.proc.kill("SIGKILL");
}

function finish(worker: Worker, outcome: { value?: unknown; error?: Error }): void {
  const job = worker.job;
  worker.job = undefined; clearTimeout(worker.timer);
  if (job) {
    job.signal?.removeEventListener("abort", job.onAbort!);
    if (outcome.error) job.reject(outcome.error); else job.resolve(outcome.value);
  }
  if (!worker.dead) {
    worker.idle = setTimeout(() => { if (!worker.job) retire(worker); }, IDLE_MS);
    worker.idle.unref();
  }
  pump();
}

function onLine(worker: Worker, line: Buffer): void {
  if (!worker.ready) { worker.ready = true; pump(); return; }
  const job = worker.job;
  if (!job) return;
  let reply: { id?: unknown; result?: unknown; code?: number; error?: string };
  try { reply = JSON.parse(line.toString("utf8")); }
  catch { retire(worker); finish(worker, { error: new SandboxError(502, "The map helper returned invalid data.") }); return; }
  if (reply.id !== job.id) { retire(worker); finish(worker, { error: new SandboxError(502, "The map helper returned invalid data.") }); return; }
  finish(worker, reply.error !== undefined ? { error: failure(job.input, reply.code ?? 1, reply.error) } : { value: reply.result });
}

function spawnWorker(uv: string): Worker {
  const proc = spawn(uv, ["run", "--frozen", "--no-sync", "--project", HELPERS_DIR, "python", "-I", HELPER, "--serve"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PROJ_NETWORK: "OFF", GDAL_CACHEMAX: "128", GDAL_NUM_THREADS: "1", GAID_MAP_CACHE_DIR: mapCacheDir() },
  });
  const worker: Worker = { proc, ready: false, chunks: [], bytes: 0, stderr: "", dead: false };
  // Idle workers must not keep a CLI/test process alive; the server's socket does that.
  proc.unref();
  for (const stream of [proc.stdout, proc.stderr, proc.stdin]) (stream as unknown as { unref?: () => void }).unref?.();
  proc.stdout.on("data", (data: Buffer) => {
    let start = 0;
    for (let at = data.indexOf(10); at !== -1; at = data.indexOf(10, start)) {
      worker.chunks.push(data.subarray(start, at));
      const line = Buffer.concat(worker.chunks); worker.chunks = []; worker.bytes = 0; start = at + 1;
      onLine(worker, line);
      if (worker.dead) return;
    }
    worker.chunks.push(data.subarray(start)); worker.bytes += data.length - start;
    if (worker.bytes > MAP_HELPER_BYTES) { retire(worker); finish(worker, { error: new SandboxError(422, "Map response exceeded the display limit. Use a smaller window.") }); }
  });
  proc.stderr.on("data", (data: Buffer) => { if (worker.stderr.length < 4096) worker.stderr += data.toString("utf8").slice(0, 4096 - worker.stderr.length); });
  proc.stdin.on("error", () => { /* exit is handled below */ });
  proc.on("error", () => { retire(worker); finish(worker, { error: new SandboxError(503, "The geo helper could not start. Prepare the helper environment.") }); });
  proc.on("close", code => {
    const wasDead = worker.dead;
    worker.dead = true; workers.delete(worker); clearTimeout(worker.timer); clearTimeout(worker.idle);
    if (worker.job) finish(worker, { error: wasDead && !worker.stderr ? new SandboxError(422, "The map helper stopped.") : failure(worker.job.input, code === 3 ? 3 : 1, worker.stderr || "The map helper stopped.") });
    else if (!worker.ready) {
      // A worker that never started fails queued work now instead of respawning in a loop.
      for (const job of queue.splice(0)) job.reject(code === 3 ? failure(job.input, 3, worker.stderr) : new SandboxError(503, "The geo helper could not start. Prepare the helper environment."));
    } else pump();
  });
  workers.add(worker);
  return worker;
}

function pump(): void {
  while (queue.length) {
    const idle = [...workers].find(w => w.ready && !w.job && !w.dead);
    if (!idle) {
      if (workers.size < mapWorkerCount()) {
        const uv = findUv();
        if (!uv) { for (const job of queue.splice(0)) job.reject(new SandboxError(503, "The geo helper environment requires uv. Prepare the helper environment.")); return; }
        spawnWorker(uv);
      }
      return;
    }
    const job = queue.shift()!;
    clearTimeout(idle.idle);
    idle.job = job;
    idle.timer = setTimeout(() => { retire(idle); finish(idle, { error: new SandboxError(422, `Map read exceeded ${Math.round(job.timeoutMs / 1000)} seconds. Use a smaller window or an analysis script.`) }); }, job.timeoutMs);
    idle.proc.stdin.write(JSON.stringify({ ...job.input, id: job.id, budget: Math.max(1, job.timeoutMs / 1000 - 3) }) + "\n");
  }
}

export async function runMapHelper<T>(input: Record<string, unknown>, options: AbortSignal | MapHelperOptions = {}): Promise<T> {
  const { signal, timeoutMs = MAP_HELPER_TIMEOUT_MS } = options instanceof AbortSignal ? { signal: options } : options;
  if (signal?.aborted) throw new SandboxError(499, "Map request cancelled");
  if (queue.length >= QUEUE_LIMIT) throw new SandboxError(429, "Map readers are busy. Retry shortly.");
  return new Promise<T>((resolve, reject) => {
    const job: Job = { id: nextId++, input, timeoutMs, signal, resolve: resolve as (value: unknown) => void, reject };
    job.onAbort = () => {
      const at = queue.indexOf(job);
      if (at !== -1) { queue.splice(at, 1); reject(new SandboxError(499, "Map request cancelled")); return; }
      const worker = [...workers].find(w => w.job === job);
      if (!worker) return;
      if (FINISH_ON_ABORT.has(String(input.operation))) {
        // Let the worker finish (its reply resolves a promise nobody awaits).
        job.reject = () => {}; job.resolve = () => {};
        reject(new SandboxError(499, "Map request cancelled"));
      } else { retire(worker); finish(worker, { error: new SandboxError(499, "Map request cancelled") }); }
    };
    signal?.addEventListener("abort", job.onAbort, { once: true });
    queue.push(job);
    pump();
  });
}

/** Stops every worker (tests, shutdown). Pending work is rejected. */
export function stopMapWorkers(): void {
  for (const job of queue.splice(0)) job.reject(new SandboxError(503, "Map helper stopped"));
  for (const worker of [...workers]) { retire(worker); finish(worker, { error: new SandboxError(503, "Map helper stopped") }); }
}

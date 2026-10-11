/** Bounded subprocess boundary; no shell, network fetch or implicit dependency repair. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findUv } from "../../binaries.ts";
import { HELPERS_DIR } from "../../helpers-env.ts";
import { SandboxError } from "../../sandbox-fs.ts";

const HELPER = fileURLToPath(new URL("./helper.py", import.meta.url));
export const MAP_HELPER_BYTES = 8 * 1024 * 1024;
export const MAP_HELPER_TIMEOUT_MS = 20_000;
let running = 0;
export async function runMapHelper<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new SandboxError(499, "Map request cancelled");
  if (running >= 4) throw new SandboxError(429, "Map readers are busy. Retry shortly.");
  const uv = findUv();
  if (!uv) throw new SandboxError(503, "The geo helper environment requires uv. Prepare the helper environment.");
  running++;
  try {
    return await new Promise<T>((resolve, reject) => {
      const proc = spawn(uv, ["run", "--frozen", "--no-sync", "--project", HELPERS_DIR, "python", "-I", HELPER], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PROJ_NETWORK: "OFF", GDAL_CACHEMAX: "64", GDAL_NUM_THREADS: "1" },
      });
      const chunks: Buffer[] = []; let bytes = 0, stderr = "", failure: SandboxError | undefined;
      const stop = (error: SandboxError) => { failure ??= error; proc.kill("SIGKILL"); };
      const timer = setTimeout(() => stop(new SandboxError(422, "Map read exceeded 20 seconds. Use a smaller window or an analysis script.")), MAP_HELPER_TIMEOUT_MS);
      const abort = () => stop(new SandboxError(499, "Map request cancelled"));
      signal?.addEventListener("abort", abort, { once: true });
      proc.stdout.on("data", (data: Buffer) => {
        bytes += data.length;
        if (bytes > MAP_HELPER_BYTES) stop(new SandboxError(422, "Map response exceeded the display limit. Use a smaller window."));
        else chunks.push(data);
      });
      proc.stderr.on("data", (data: Buffer) => { if (stderr.length < 4096) stderr += data.toString("utf8").slice(0, 4096 - stderr.length); });
      proc.stdin.on("error", () => { /* early process exit is handled below */ });
      proc.on("error", () => { failure = new SandboxError(503, "The geo helper could not start. Prepare the helper environment."); });
      proc.on("close", code => {
        clearTimeout(timer); signal?.removeEventListener("abort", abort);
        if (failure) return reject(failure);
        if (code !== 0) {
          const detail = stderr.trim().split("\n").at(-1)?.replaceAll(String(input.path), "[source]").slice(0, 800);
          return reject(new SandboxError(code === 3 ? 503 : code === 4 ? 404 : 422, detail || "The map helper could not read this dataset."));
        }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T); }
        catch { reject(new SandboxError(502, "The map helper returned invalid data.")); }
      });
      proc.stdin.end(JSON.stringify(input));
    });
  } finally { running--; }
}

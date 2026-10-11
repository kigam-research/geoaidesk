/**
 * Shared harness for GeoAIDesk release evidence (WP10 gaid-release-proof):
 * start a GAID checkout in production mode with its own data home and free
 * ports, call its API, and stop it. Used by the install/update proofs and the
 * model-route trials; zero dependencies, Node >= 22.19, Linux/WSL/Windows.
 *
 *   const gaid = await startInstance({ checkout, dataHome, runDir, label: "start-1" });
 *   const projects = await gaid.json("GET", "/projects");
 *   await gaid.stop();
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Variables a GAID start reads that must come from the harness, not the caller's shell. */
export const CONTROLLED_ENV = [
  "GAID_HOME",
  "GAID_CATALOGUE",
  "GAID_CATALOGUE_ARCHIVE",
  "GAID_CATALOGUE_URL",
  "GAID_CATALOGUE_DOWNLOAD",
  "KADY_PROJECTS_ROOT",
  "KADY_PI_AGENT_DIR",
  "PI_CODING_AGENT_DIR",
  "KADY_ENV_FILE",
  "KADY_SKILLS_CACHE_DIR",
  "KADY_OFFICE_ASSETS_DIR",
  "KADY_SKILLS_AUTO_SYNC",
  "KADY_SKILLS_REPO",
  "NEXT_PUBLIC_ADK_API_URL",
  "KADY_HOST",
  "KADY_PORT",
  "KADY_FRONTEND_PORT",
  "KADY_REQUIRE_AUTH",
  "KADY_AUTH_TOKEN",
];

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

export function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** Two distinct free ports. */
export async function freePorts() {
  const backend = await freePort();
  let frontend = await freePort();
  while (frontend === backend) frontend = await freePort();
  return { backend, frontend };
}

function killTree(child, signal = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill(signal);
  }
}

/**
 * Start `<checkout>/geo/start.mjs --no-browser` and wait for "All services
 * running!". `env` adds variables on top of the cleaned caller environment;
 * `ports` reuses ports (a restart keeps the UI build valid, since the build
 * inlines the backend URL). The launcher log is `<runDir>/<label>.log`.
 */
export async function startInstance({
  checkout,
  dataHome,
  runDir,
  label = "start",
  env: extraEnv = {},
  ports,
  timeoutMs = 20 * 60_000,
  args = [],
}) {
  fs.mkdirSync(runDir, { recursive: true });
  const { backend, frontend } = ports ?? (await freePorts());
  const env = { ...process.env };
  for (const name of CONTROLLED_ENV) delete env[name];
  Object.assign(env, { GAID_HOME: dataHome, KADY_PORT: String(backend), KADY_FRONTEND_PORT: String(frontend) }, extraEnv);
  const logFile = path.join(runDir, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const startedAt = Date.now();
  const child = spawn(process.execPath, [path.join(checkout, "geo", "start.mjs"), "--no-browser", ...args], {
    cwd: checkout,
    env,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let done = false;
  exited.then(() => (done = true));
  const api = `http://127.0.0.1:${backend}`;
  const ui = `http://127.0.0.1:${frontend}`;
  const instance = {
    checkout,
    dataHome,
    api,
    ui,
    ports: { backend, frontend },
    logFile,
    child,
    exited,
    readyMs: null,
    log: () => fs.readFileSync(logFile, "utf-8"),
    request: (method, route, options) => request(api, method, route, options),
    json: (method, route, options) => requestJson(api, method, route, options),
    stop: () => stopInstance(instance),
  };
  const deadline = startedAt + timeoutMs;
  while (Date.now() < deadline) {
    if (done) throw new Error(`launcher exited before the services came up; see ${logFile}`);
    if (instance.log().includes("All services running!")) {
      instance.readyMs = Date.now() - startedAt;
      return instance;
    }
    await sleep(1000);
  }
  await stopInstance(instance);
  throw new Error(`services not up after ${timeoutMs / 1000}s; see ${logFile}`);
}

/** Stop the launcher and its services; resolves once both ports are free. */
export async function stopInstance(instance) {
  killTree(instance.child);
  let result = await Promise.race([instance.exited, sleep(30_000).then(() => null)]);
  if (!result) {
    killTree(instance.child, "SIGKILL");
    result = await Promise.race([instance.exited, sleep(10_000).then(() => null)]);
  }
  if (!result) throw new Error(`launcher did not exit; see ${instance.logFile}`);
  for (const port of Object.values(instance.ports)) {
    let open = true;
    for (let i = 0; i < 20 && open; i++) {
      open = await portOpen(port);
      if (open) await sleep(500);
    }
    if (open) throw new Error(`port ${port} still in use after stop`);
  }
  return result;
}

/**
 * One API call. `project` sets `X-Project-Id`; a non-string `body` is sent as
 * JSON. Resolves `{ status, text, headers }`; never throws on HTTP status.
 */
export async function request(api, method, route, { project, body, headers = {}, timeoutMs = 60_000 } = {}) {
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(timeoutMs) };
  if (project) init.headers["X-Project-Id"] = project;
  if (body !== undefined) {
    if (typeof body === "string" || body instanceof Uint8Array || body instanceof FormData) {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      init.headers["Content-Type"] ??= "application/json";
    }
  }
  const res = await fetch(`${api}${route}`, init);
  return { status: res.status, text: await res.text(), headers: res.headers };
}

/** `request` that expects a 2xx JSON answer and returns the parsed body. */
export async function requestJson(api, method, route, options) {
  const res = await request(api, method, route, options);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${method} ${route} -> ${res.status}: ${res.text.slice(0, 400)}`);
  }
  return res.text ? JSON.parse(res.text) : null;
}

/** Facts about the host for an evidence record (no secrets, no user paths beyond the run). */
export function hostFacts() {
  const run = (cmd, args) => {
    const res = spawnSync(cmd, args, { encoding: "utf-8", shell: process.platform === "win32" });
    return res.status === 0 ? res.stdout.trim() : null;
  };
  let wsl = false;
  try {
    wsl = /microsoft/i.test(fs.readFileSync("/proc/version", "utf-8"));
  } catch {
    wsl = false;
  }
  return {
    platform: process.platform,
    arch: process.arch,
    wsl,
    osRelease: run(process.platform === "win32" ? "ver" : "uname", process.platform === "win32" ? [] : ["-sr"]),
    node: process.version,
    uv: run("uv", ["--version"]),
    git: run("git", ["--version"]),
  };
}

#!/usr/bin/env node
/**
 * GeoAIDesk production smoke: a clean data home, `start-gaid` in production
 * mode, create a project and a file, stop, restart, and check that
 *   - the UI is served by the production build and the backend answers,
 *   - the project and its file survive stop/restart and the build is reused,
 *   - user data is written under the data home, not into the checkout,
 *   - the excluded anthropics/skills document skills were not fetched,
 *   - unattended catalogue refresh is off.
 *
 * Needs installed server/ and web/ packages (npm ci), uv, and network access for
 * the first-start skill catalogue and sandbox environment. Uses free ports.
 * GAID_SMOKE_DIR keeps the run directory (default: a temp dir, removed on
 * success, kept on failure).
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const keepDir = Boolean(process.env.GAID_SMOKE_DIR);
const runDir = keepDir
  ? path.resolve(process.env.GAID_SMOKE_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), "gaid-smoke-"));
fs.mkdirSync(runDir, { recursive: true });
const dataHome = path.join(runDir, "home");
if (fs.existsSync(dataHome)) throw new Error(`${dataHome} exists; use an empty GAID_SMOKE_DIR`);
const EXCLUDED = ["docx", "pdf", "pptx", "xlsx"];
const PROJECT = "gaid-smoke";
const NOTE = "notes/smoke.txt";
const NOTE_TEXT = "GeoAIDesk smoke: kept across restart\n";

const log = (msg) => console.log(`[smoke] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
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

async function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

const backendPort = await freePort();
let frontendPort = await freePort();
while (frontendPort === backendPort) frontendPort = await freePort();
const api = `http://127.0.0.1:${backendPort}`;
const ui = `http://127.0.0.1:${frontendPort}`;

// Only the variables the smoke controls; everything else is the user's shell.
const env = { ...process.env, GAID_HOME: dataHome, KADY_PORT: String(backendPort), KADY_FRONTEND_PORT: String(frontendPort) };
for (const name of [
  "KADY_PROJECTS_ROOT",
  "KADY_PI_AGENT_DIR",
  "PI_CODING_AGENT_DIR",
  "KADY_ENV_FILE",
  "KADY_SKILLS_CACHE_DIR",
  "KADY_OFFICE_ASSETS_DIR",
  "KADY_SKILLS_AUTO_SYNC",
  "NEXT_PUBLIC_ADK_API_URL",
  "KADY_HOST",
  "KADY_REQUIRE_AUTH",
  "KADY_AUTH_TOKEN",
]) {
  delete env[name];
}

/** Snapshot of checkout paths a start must not create or change. */
function checkoutState() {
  const stat = (rel) => {
    try {
      const s = fs.statSync(path.join(repoRoot, rel));
      return `${s.isDirectory() ? "dir" : "file"}:${s.mtimeMs}`;
    } catch {
      return "absent";
    }
  };
  // Tracked files (lockfiles included) must stay as committed.
  const git = spawnSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: repoRoot, encoding: "utf-8" });
  const tracked = git.status === 0 ? git.stdout : "no git";
  return { projects: stat("projects"), env: stat(".env"), serverEnv: stat("server/.env"), tracked };
}

let current = null;

function startLauncher(round) {
  const logFile = path.join(runDir, `launcher-${round}.log`);
  const out = fs.openSync(logFile, "w");
  const child = spawn(process.execPath, [path.join(repoRoot, "geo", "start.mjs"), "--no-browser"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", out, out],
  });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  current = { child, exited, logFile };
  return current;
}

async function waitReady({ child, exited, logFile }, timeoutMs) {
  let done = false;
  exited.then(() => (done = true));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (done) throw new Error(`launcher exited before the services came up; see ${logFile}`);
    if (fs.readFileSync(logFile, "utf-8").includes("All services running!")) return;
    await sleep(1000);
  }
  child.kill("SIGTERM");
  throw new Error(`services not up after ${timeoutMs / 1000}s; see ${logFile}`);
}

async function stopLauncher({ child, exited, logFile }) {
  child.kill("SIGTERM");
  const result = await Promise.race([exited, sleep(30_000).then(() => null)]);
  assert.ok(result, `launcher did not exit within 30s after SIGTERM; see ${logFile}`);
  for (const port of [backendPort, frontendPort]) {
    let open = true;
    for (let i = 0; i < 10 && open; i++) {
      open = await portOpen(port);
      if (open) await sleep(500);
    }
    assert.ok(!open, `port ${port} still in use after stop`);
  }
  current = null;
}

async function request(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

const projectHeaders = { "X-Project-Id": PROJECT };

async function checkWorkspace() {
  const page = await request(`${ui}/`);
  assert.equal(page.status, 200, "UI answers 200");
  assert.match(page.text, /<html/i, "UI serves the app page");
  assert.ok(!/__nextjs_original-stack-frame|next-dev|webpack-hmr|turbopack-hmr/i.test(page.text), "UI is not the dev server");
  const health = await request(`${api}/health`);
  assert.equal(health.status, 200, "backend /health answers 200");
  // What the browser does: the UI origin calling the backend it was built against.
  const fromUi = await request(`${api}/projects`, { headers: { Origin: `http://localhost:${frontendPort}` } });
  assert.equal(fromUi.status, 200, `backend accepts the UI origin: ${fromUi.text.slice(0, 200)}`);
  assert.ok(builtAgainstBackend(), `UI build calls http://localhost:${backendPort}`);
}

/** The production bundle inlines the backend URL (NEXT_PUBLIC_ADK_API_URL). */
function builtAgainstBackend() {
  const needle = `http://localhost:${backendPort}`;
  const chunks = path.join(repoRoot, "web", ".next", "static", "chunks");
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).some((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".js") && fs.readFileSync(full, "utf-8").includes(needle);
    });
  return fs.existsSync(chunks) && walk(chunks);
}

const before = checkoutState();
let ok = false;
try {
  log(`run dir ${runDir}; ports backend ${backendPort}, UI ${frontendPort}`);

  // Round 1: clean install start.
  log("start 1 (clean data home; installs, prepares and builds as needed)");
  await waitReady(startLauncher(1), 15 * 60_000);
  await checkWorkspace();
  const created = await request(`${api}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "GAID smoke", id: PROJECT }),
  });
  assert.equal(created.status, 201, `project created: ${created.text}`);
  const saved = await request(`${api}/sandbox/file?path=${encodeURIComponent(NOTE)}`, {
    method: "PUT",
    headers: { ...projectHeaders, "Content-Type": "text/plain" },
    body: NOTE_TEXT,
  });
  assert.equal(saved.status, 200, `file saved: ${saved.text}`);
  await stopLauncher(current);
  log("stop 1 ok (ports released)");

  // Round 2: restart keeps the project and reuses the build.
  log("start 2 (restart)");
  await waitReady(startLauncher(2), 10 * 60_000);
  await checkWorkspace();
  const restartLog = fs.readFileSync(path.join(runDir, "launcher-2.log"), "utf-8");
  assert.match(restartLog, /Production UI build is up to date/, "restart reuses the production build");
  assert.match(restartLog, /backend packages match package-lock\.json/, "restart reuses the installed packages");
  const projects = JSON.parse((await request(`${api}/projects`)).text);
  assert.ok(projects.some((p) => p.id === PROJECT), "project listed after restart");
  const note = await request(`${api}/sandbox/file?path=${encodeURIComponent(NOTE)}`, { headers: projectHeaders });
  assert.equal(note.status, 200);
  assert.equal(note.text, NOTE_TEXT, "file content kept after restart");
  await stopLauncher(current);
  log("stop 2 ok");

  // Data locations.
  assert.ok(fs.existsSync(path.join(dataHome, "projects", PROJECT, "sandbox", NOTE)), "project under the data home");
  assert.ok(fs.existsSync(path.join(dataHome, "projects", "default")), "default project under the data home");
  assert.ok(fs.existsSync(path.join(dataHome, "config.env")), "managed env file under the data home");
  assert.ok(fs.existsSync(path.join(dataHome, "pi-agent")), "agent dir under the data home");
  assert.deepEqual(checkoutState(), before, "checkout projects/, .env and tracked files untouched");
  if (fs.existsSync(path.join(repoRoot, "projects"))) {
    assert.ok(!fs.existsSync(path.join(repoRoot, "projects", PROJECT)), "no project in the checkout");
  }

  // Catalogue: provisioned, without the excluded document skills.
  const sandbox = path.join(dataHome, "projects", "default", "sandbox", ".pi");
  const installed = ["skills", "skills-disabled"].flatMap((dir) => {
    try {
      return fs.readdirSync(path.join(sandbox, dir));
    } catch {
      return [];
    }
  });
  assert.ok(installed.length > 0, "the skill catalogue was provisioned on first start");
  for (const name of EXCLUDED) assert.ok(!installed.includes(name), `${name} not installed`);
  const cache = path.join(dataHome, "skills-cache");
  const cached = fs.existsSync(cache) ? fs.readdirSync(cache) : [];
  assert.ok(!cached.some((entry) => /anthropic/i.test(entry)), `no anthropics staging in ${cache}: ${cached.join(", ")}`);
  const firstLog = fs.readFileSync(path.join(runDir, "launcher-1.log"), "utf-8");
  assert.match(firstLog, /automatic skill catalogue sync disabled/, "unattended catalogue refresh is off");
  assert.match(firstLog, /GeoAIDesk — Starting up/, "launcher runs as GeoAIDesk");

  log(`skills provisioned: ${installed.length}; excluded absent: ${EXCLUDED.join(", ")}`);
  ok = true;
  console.log("[smoke] PASS");
} finally {
  if (current) {
    current.child.kill("SIGTERM");
    await Promise.race([current.exited, sleep(10_000)]);
  }
  if (ok && !keepDir) fs.rmSync(runDir, { recursive: true, force: true });
  else if (!ok) console.error(`[smoke] FAIL; logs kept in ${runDir}`);
}

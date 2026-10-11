#!/usr/bin/env node
/**
 * GeoAIDesk (GAID) launcher: applies geo/distribution.json, then runs the
 * upstream launcher (start.mjs) in production mode. Zero dependencies, like
 * start.mjs. The upstream launchers (start.sh / start.cmd) stay the
 * development entry points.
 *
 * User data (projects, model sign-ins, keys, caches) lives under the data home
 * (GAID_HOME, default ~/.geoaidesk), never inside the checkout. A variable the
 * user already set wins over the distribution default.
 *
 * The pinned geo catalogue archive is downloaded into <GAID_HOME>/catalogue/
 * when no place the backend searches has it (gaid-runtime#2: the archive is a
 * geoaidesk GitHub Release asset, pinned by sha256). A file whose sha256 does
 * not match is never kept.
 *
 * Flags (others pass through to start.mjs: --check, --no-browser):
 *   --print-env  print the resolved distribution environment as JSON and exit
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function expandHome(value, home = os.homedir()) {
  if (value === "~") return home;
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(home, value.slice(2));
  return value;
}

/** True when `target` is `root` or below it. */
export function isInside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function readDistribution(root = repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(root, "geo", "distribution.json"), "utf-8"));
}

/**
 * The environment the distribution adds to `env` (only unset variables), and
 * the problems that must stop a start. Pure apart from reading `env`.
 */
export function resolveDistributionEnv(distribution, env, { root = repoRoot, home = os.homedir() } = {}) {
  const set = {};
  const problems = [];
  const resolvePath = (value) => path.resolve(root, expandHome(value, home));
  const dataHomeVar = distribution.dataHome.env;
  const dataHome = resolvePath(env[dataHomeVar]?.trim() || distribution.dataHome.default);
  set[dataHomeVar] = dataHome;
  for (const [name, rel] of Object.entries(distribution.dataHome.paths)) {
    if (!env[name]?.trim()) set[name] = path.join(dataHome, rel);
  }
  for (const [name, value] of Object.entries(distribution.environment ?? {})) {
    if (env[name] === undefined || env[name] === "") set[name] = value;
  }
  if (!env.KADY_PRODUCT_NAME?.trim()) set.KADY_PRODUCT_NAME = distribution.productName;
  if (!env.KADY_ISSUES_URL?.trim()) set.KADY_ISSUES_URL = distribution.issuesUrl;
  // The UI is built against the backend URL; follow a non-default port.
  const port = env.KADY_PORT?.trim();
  if (port && !env.NEXT_PUBLIC_ADK_API_URL?.trim()) set.NEXT_PUBLIC_ADK_API_URL = `http://localhost:${port}`;
  // User data must not land in the source checkout (updates replace it).
  for (const name of [dataHomeVar, ...Object.keys(distribution.dataHome.paths)]) {
    const value = set[name] ?? env[name];
    if (value && isInside(root, resolvePath(value))) {
      problems.push(`${name}=${resolvePath(value)} is inside the source checkout ${root}`);
    }
  }
  return { set, problems, dataHome };
}

const sha256File = (file) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

/**
 * Where the backend looks for the pinned archive, most explicit first. Keep in
 * step with `archiveCandidates` in server/src/geo/catalogue.ts.
 */
export function catalogueCandidates(catalogue, env, { root = repoRoot, home = os.homedir() } = {}) {
  const resolvePath = (value) => path.resolve(root, expandHome(value, home));
  const candidates = [];
  if (env.GAID_CATALOGUE_ARCHIVE?.trim()) candidates.push(resolvePath(env.GAID_CATALOGUE_ARCHIVE.trim()));
  if (env.GAID_HOME?.trim()) candidates.push(path.join(resolvePath(env.GAID_HOME.trim()), "catalogue", catalogue.archive));
  candidates.push(path.join(root, "geo", "catalogue", catalogue.archive));
  const assets = env.TASK_ASSETS_DIR?.trim() || path.join(home, "assets");
  candidates.push(path.join(resolvePath(assets), "geo-catalogue", catalogue.version, catalogue.archive));
  return [...new Set(candidates)];
}

/**
 * What the launcher should do about the catalogue archive, given `env` after
 * the distribution defaults are applied. Pure apart from `exists`.
 *   { action: "none", reason }            geo catalogue off, or no download source
 *   { action: "present", path }           a searched place already has a file
 *   { action: "download", url, target }   fetch into <GAID_HOME>/catalogue/
 */
export function planCatalogue(distribution, env, { root = repoRoot, home = os.homedir(), exists = fs.existsSync } = {}) {
  const catalogue = distribution.catalogue;
  if (!catalogue || catalogue.status !== "pinned") return { action: "none", reason: "no pinned catalogue" };
  const flag = env.GAID_CATALOGUE?.trim().toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false" || env.KADY_SKILLS_REPO?.trim()) {
    return { action: "none", reason: "geo catalogue off" };
  }
  const candidates = catalogueCandidates(catalogue, env, { root, home });
  const found = candidates.find((candidate) => exists(candidate));
  if (found) return { action: "present", path: found };
  const off = env.GAID_CATALOGUE_DOWNLOAD?.trim().toLowerCase();
  if (off === "0" || off === "off" || off === "false") return { action: "none", reason: "download turned off" };
  const url = env.GAID_CATALOGUE_URL?.trim() || catalogue.download?.url;
  if (!url) return { action: "none", reason: "no download url" };
  if (!env.GAID_HOME?.trim()) return { action: "none", reason: "no data home" };
  const target = path.join(path.resolve(root, expandHome(env.GAID_HOME.trim(), home)), "catalogue", catalogue.archive);
  return { action: "download", url, target, sha256: catalogue.sha256 };
}

/**
 * Download `url` (http(s) or file:) to `target` through a temporary file and
 * keep it only when its sha256 is `expected`. Throws with a readable reason.
 */
export async function downloadCatalogue({ url, target, sha256: expected }, { fetchImpl = fetch, timeoutMs = 300_000 } = {}) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const part = `${target}.part-${process.pid}`;
  try {
    if (url.startsWith("file:")) {
      fs.copyFileSync(fileURLToPath(url), part);
    } else {
      const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} from ${url}`);
      const out = fs.createWriteStream(part);
      for await (const chunk of res.body) {
        if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
      }
      await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    }
    const actual = await sha256File(part);
    if (actual !== expected) throw new Error(`sha256 ${actual} does not match the pinned ${expected}`);
    fs.renameSync(part, target);
  } finally {
    fs.rmSync(part, { force: true });
  }
}

async function ensureCatalogue(distribution, check) {
  let plan = planCatalogue(distribution, process.env);
  if (plan.action === "present") {
    // A copy the launcher saved under the data home that no longer matches the
    // pin (an interrupted or tampered file) is replaced; other places are the
    // user's and are only reported (the backend refuses a mismatch).
    const own = planCatalogue(distribution, process.env, { exists: () => false });
    if (own.action === "download" && own.target === plan.path && (await sha256File(plan.path)) !== own.sha256) {
      console.warn(`  Catalogue: ${plan.path} does not match the pinned sha256; downloading it again`);
      plan = own;
    } else {
      console.log(`  Catalogue: ${plan.path}`);
    }
  }
  if (plan.action === "download") {
    if (check) {
      console.log(`  Catalogue: would download ${plan.url}`);
      return;
    }
    console.log(`  Catalogue: downloading ${plan.url}`);
    try {
      await downloadCatalogue(plan);
      console.log(`  Catalogue: saved ${plan.target} (sha256 verified)`);
    } catch (err) {
      console.warn(`  Catalogue: download failed (${err.message}).`);
      console.warn(`    Without it no catalogue skills are installed. Download the file yourself and place it at`);
      console.warn(`    ${plan.target} (or set GAID_CATALOGUE_ARCHIVE), then restart.`);
    }
  }
}

async function main() {
  const distribution = readDistribution();
  const args = process.argv.slice(2);
  const { set, problems, dataHome } = resolveDistributionEnv(distribution, process.env);
  if (args.includes("--print-env")) {
    console.log(JSON.stringify({ set, problems }, null, 2));
    process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) {
    console.error(`${distribution.productName}: user data must live outside the source checkout.`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(`  Set ${distribution.dataHome.env} (or the variable named above) to a directory outside it.`);
    process.exit(1);
  }
  Object.assign(process.env, set);
  const check = args.includes("--check");
  if (!check) fs.mkdirSync(dataHome, { recursive: true, mode: 0o700 });
  console.log(`${distribution.productName} ${distribution.version} (${distribution.channel})`);
  console.log(`  User data: ${dataHome}`);
  console.log(`  Projects:  ${process.env.KADY_PROJECTS_ROOT}`);
  await ensureCatalogue(distribution, check);
  console.log("");
  process.argv = [process.argv[0], path.join(repoRoot, "start.mjs"), ...args.filter((a) => a !== "--production"), "--production"];
  await import(pathToFileURL(path.join(repoRoot, "start.mjs")).href);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

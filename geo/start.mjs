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
 * Flags (others pass through to start.mjs: --check, --no-browser):
 *   --print-env  print the resolved distribution environment as JSON and exit
 */
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
  console.log("");
  process.argv = [process.argv[0], path.join(repoRoot, "start.mjs"), ...args.filter((a) => a !== "--production"), "--production"];
  await import(pathToFileURL(path.join(repoRoot, "start.mjs")).href);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

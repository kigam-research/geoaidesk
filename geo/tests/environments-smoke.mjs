#!/usr/bin/env node
/** Real catalogue import smoke, using Node built-ins only (Node >=22.19).
 * Both targets are tested even when one fails. The temporary analysis sandbox
 * is outside the checkout; no user project is read or modified.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

// Load the actual generator/loader, not a duplicate implementation, without tsx.
registerHooks({ load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".ts")) return {
    format: "module", shortCircuit: true,
    source: stripTypeScriptTypes(fs.readFileSync(fileURLToPath(url), "utf8"), { mode: "transform" }),
  };
  return nextLoad(url, context);
} });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Loading the catalogue stages only into the disposable cache, outside the checkout.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-environments-smoke-"));
process.env.KADY_SKILLS_CACHE_DIR = path.join(sandbox, "catalogue-cache");
const { loadGeoEnvironments, requiredEnvironments, environmentPackages, projectPyproject, importProbeScript } = await import("../../server/src/geo/environments.ts");
const { findUv } = await import("../../server/src/binaries.ts");
const uv = findUv();
if (!uv) throw new Error("uv is required for the environment smoke");
let failed = false;
function command(args, cwd) {
  const result = spawnSync(uv, args, { cwd, encoding: "utf8", timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) { console.error((result.stderr || result.error?.message || "Command failed").slice(-8000)); failed = true; }
  return result;
}
function imports(target, args, cwd, packages) {
  const result = command([...args, "python", "-I", "-c", importProbeScript(packages)], cwd);
  let parsed;
  try { parsed = JSON.parse(result.stdout.trim().split("\n").at(-1)); } catch { /* report every untested module as missing */ }
  console.log(`\n${target}\tmodule\tresult\terror`);
  for (const module of [...new Set(packages.flatMap((p) => p.imports))]) {
    const row = parsed?.imports.find((entry) => entry.module === module);
    console.log(`${target}\t${module}\t${row?.status ?? "missing"}\t${row?.error ?? (row ? "" : "Interpreter/uv command failed")}`);
    if (row?.status !== "ok") failed = true;
  }
  for (const dist of parsed?.distributions ?? []) if (dist.status !== "ok") {
    console.error(`${target}: ${dist.name}: ${dist.error ?? "required distribution missing"}`); failed = true;
  }
}
try {
  const data = loadGeoEnvironments();
  const helper = path.join(root, "server/src/helpers");
  const helperPackages = environmentPackages(requiredEnvironments(data, "helper"));
  imports("helper", ["run", "--frozen", "--python", "3.12", "--project", helper], helper, helperPackages);
  const project = path.join(sandbox, "analysis"); fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "pyproject.toml"), projectPyproject(data));
  command(["sync", "--project", project], project);
  imports("project", ["run", "--frozen", "--project", project], project, environmentPackages(requiredEnvironments(data, "project")));
  console.log(`\nEnvironment smoke: ${failed ? "FAILED" : "all required modules imported in both targets"}`);
} finally { fs.rmSync(sandbox, { recursive: true, force: true }); }
process.exitCode = failed ? 1 : 0;

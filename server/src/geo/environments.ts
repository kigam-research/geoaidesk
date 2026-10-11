/** Catalogue-owned Python requirements, provisioning and bounded readiness probes. */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { findUv } from "../binaries.ts";
import { HELPERS_DIR, helperPython } from "../helpers-env.ts";
import { geoCatalogueActive, loadGeoCatalogue, type LoadGeoCatalogueOptions } from "./catalogue.ts";
import type { GeoEnvironment, GeoEnvironmentPackage, GeoEnvironmentTool, GeoEnvironments } from "./catalogue-types.ts";

export type EnvironmentTarget = "helper" | "project";
const normalized = (name: string) => name.toLowerCase().replace(/[-_.]+/g, "-");

export function packageSpec(pkg: GeoEnvironmentPackage): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pkg.name)) throw new Error(`Invalid distribution: ${pkg.name}`);
  if (pkg.version && !/^>=\d+(?:\.\d+)*(?:[a-zA-Z0-9.!+-]*)$/.test(pkg.version)) {
    throw new Error(`Expected a lower bound for ${pkg.name}: ${pkg.version}`);
  }
  for (const module of pkg.imports) {
    if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(module)) throw new Error(`Invalid module: ${module}`);
  }
  return pkg.name + (pkg.version ?? "");
}

/** Ancestors first; unknown parents and cycles are explicit catalogue errors. */
export function environmentClosure(data: GeoEnvironments, id: string): GeoEnvironment[] {
  const result: GeoEnvironment[] = [];
  const visiting = new Set<string>();
  const walk = (key: string): void => {
    if (visiting.has(key)) throw new Error(`Environment cycle: ${[...visiting, key].join(" -> ")}`);
    const env = data.environments.find((entry) => entry.id === key);
    if (!env) throw new Error(`Unknown environment: ${key}`);
    visiting.add(key);
    if (env.extends) walk(env.extends);
    visiting.delete(key);
    result.push(env);
  };
  walk(id);
  return result;
}

export function requiredEnvironments(data: GeoEnvironments, target: EnvironmentTarget): GeoEnvironment[] {
  const found = new Map<string, GeoEnvironment>();
  for (const env of data.environments.filter((entry) => !entry.optional && entry.targets.includes(target))) {
    for (const parent of environmentClosure(data, env.id)) {
      if (parent.targets.includes(target)) found.set(parent.id, parent);
    }
  }
  return [...found.values()];
}

/** Preserve every inherited lower bound when distributions overlap. */
export function environmentPackages(environments: GeoEnvironment[]): GeoEnvironmentPackage[] {
  const found = new Map<string, GeoEnvironmentPackage>();
  for (const env of environments) {
    for (const pkg of env.packages) {
      packageSpec(pkg);
      const key = normalized(pkg.name);
      const previous = found.get(key);
      if (!previous) found.set(key, { ...pkg, imports: [...new Set(pkg.imports)] });
      else {
        previous.imports = [...new Set([...previous.imports, ...pkg.imports])];
        const bounds = [...new Set([...(previous.version?.split(",") ?? []), ...(pkg.version ? [pkg.version] : [])])];
        previous.version = bounds.length ? bounds.join(",") : undefined;
      }
    }
  }
  return [...found.values()];
}

export const environmentImports = (packages: GeoEnvironmentPackage[]): string[] =>
  [...new Set(packages.flatMap((pkg) => pkg.imports))];
export const resolvedPackageSpec = (pkg: GeoEnvironmentPackage): string => pkg.name + (pkg.version ?? "");

export function loadGeoEnvironments(options: LoadGeoCatalogueOptions = {}): GeoEnvironments {
  const data = loadGeoCatalogue(options).environments;
  if (!data || data.schemaVersion !== "geo-environments/v1") throw new Error("Catalogue has no geo-environments/v1 data");
  return data;
}

export function projectPyproject(data: GeoEnvironments): string {
  const packages = environmentPackages(requiredEnvironments(data, "project"));
  return `[project]\nname = "geoaidesk-sandbox"\nversion = "0.1.0"\ndescription = "GeoAIDesk project sandbox (managed by uv)"\nrequires-python = ${JSON.stringify(data.python)}\ndependencies = [\n${packages.map((pkg) => `    ${JSON.stringify(resolvedPackageSpec(pkg))},`).join("\n")}\n]\n`;
}

/** A missing catalogue must not prevent opening or preserving an existing project. */
export function seededProjectPyproject(upstream: string, options: LoadGeoCatalogueOptions = {}): string {
  if (!geoCatalogueActive(options.env, options.repoRoot)) return upstream;
  try { return projectPyproject(loadGeoEnvironments(options)); } catch { return upstream; }
}

export interface CommandResult { code: number | null; stdout: string; stderr: string }
export type CommandRunner = (command: string, args: string[], options: { cwd: string; timeout: number }) => Promise<CommandResult>;
export const runEnvironmentCommand: CommandRunner = (command, args, options) => new Promise((resolve) => {
  execFile(command, args, { ...options, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
    resolve({ code: error ? (typeof error.code === "number" ? error.code : null) : 0,
      stdout, stderr: stderr || (error?.message ?? "") });
  });
});

export function projectPython(sandbox: string, platform = process.platform): string {
  return path.join(sandbox, ".venv", ...(platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]));
}

export interface ImportResult { module: string; status: "ok" | "missing"; error?: string }
export interface DistributionResult { name: string; version: string | null; status: "ok" | "missing"; error?: string }
export interface ToolResult { name: string; version?: string; check: string; optional: boolean; status: "ok" | "missing"; output: string }
export interface EnvironmentReadiness {
  id: string;
  target: EnvironmentTarget;
  packages: GeoEnvironmentPackage[];
  distributions: DistributionResult[];
  imports: ImportResult[];
  tools: ToolResult[];
  ready: boolean;
}

/** One interpreter invocation tests all modules independently, including broken binary imports. */
export function importProbeScript(packages: GeoEnvironmentPackage[]): string {
  const payload = JSON.stringify(packages);
  return `import importlib, importlib.metadata, json, re\npkgs = json.loads(${JSON.stringify(payload)})\nimports = []\ndistributions = []\nfor p in pkgs:\n    try:\n        version = importlib.metadata.version(p['name'])\n        # Catalogue bounds are numeric releases; reject pre/dev releases at the bound.\n        def satisfies(bound):\n            required = tuple(map(int, re.match(r'>=(\\d+(?:\\.\\d+)*)', bound)[1].split('.')))\n            release = re.match(r'(\\d+(?:\\.\\d+)*)(.*)', version)\n            if not release: return False\n            actual = tuple(map(int, release[1].split('.')))\n            n = max(len(required), len(actual))\n            a, b = actual + (0,) * (n-len(actual)), required + (0,) * (n-len(required))\n            return a > b or (a == b and not re.search(r'(?:a|b|rc|dev)', release[2]))\n        ok = all(satisfies(b) for b in p.get('version', '').split(',') if b)\n        distributions.append(dict(name=p['name'], version=version, status='ok' if ok else 'missing', **({} if ok else {'error': 'Installed version does not satisfy ' + p['version']})))\n    except Exception as e:\n        distributions.append(dict(name=p['name'], version=None, status='missing', error=str(e).split('\\n')[-1]))\n    for module in p['imports']:\n        if any(i['module'] == module for i in imports): continue\n        try:\n            importlib.import_module(module)\n            imports.append(dict(module=module, status='ok'))\n        except Exception as e:\n            imports.append(dict(module=module, status='missing', error=type(e).__name__ + ': ' + str(e).split('\\n')[-1]))\nprint(json.dumps(dict(imports=imports, distributions=distributions)))\n`;
}

function stamp(dir: string, interpreter: string): string {
  const files = ["pyproject.toml", "uv.lock", ".venv", ".venv/pyvenv.cfg", ".venv/Lib/site-packages"];
  try {
    for (const entry of fs.readdirSync(path.join(dir, ".venv/lib"))) files.push(`.venv/lib/${entry}/site-packages`);
  } catch { /* no POSIX venv */ }
  return [...files.map((file) => path.join(dir, file)), interpreter].map((file) => {
    try { const s = fs.statSync(file); return `${file}:${s.mtimeMs}:${s.ctimeMs}:${s.size}`; }
    catch { return `${file}:missing`; }
  }).join("|");
}

const tail = (result: CommandResult): string => (result.stderr + "\n" + result.stdout).trim().slice(-8000);
export class EnvironmentPreparationError extends Error {
  constructor(message: string, readonly output: string) { super(message); }
}

export interface EnvironmentServiceOptions {
  runner?: CommandRunner;
  helperDir?: string;
  helperInterpreter?: () => string;
  uv?: () => string | null;
}

export class GeoEnvironmentService {
  private readonly runner: CommandRunner;
  private readonly helperDir: string;
  private readonly helperInterpreter: () => string;
  private readonly uv: () => string | null;
  private readonly cache = new Map<string, { expires: number; value: Promise<EnvironmentReadiness> }>();
  private readonly preparing = new Set<string>();
  constructor(options: EnvironmentServiceOptions = {}) {
    this.runner = options.runner ?? runEnvironmentCommand;
    this.helperDir = options.helperDir ?? HELPERS_DIR;
    this.helperInterpreter = options.helperInterpreter ?? helperPython;
    this.uv = options.uv ?? findUv;
  }

  async readiness(data: GeoEnvironments, id: string, target: EnvironmentTarget, sandbox: string, fresh = false): Promise<EnvironmentReadiness> {
    const environment = data.environments.find((env) => env.id === id);
    if (!environment || !environment.targets.includes(target)) throw new Error(`Unknown environment target: ${id}/${target}`);
    const closure = environmentClosure(data, id).filter((env) => env.targets.includes(target));
    const packages = environmentPackages(closure);
    const dir = target === "helper" ? this.helperDir : sandbox;
    const interpreter = target === "helper" ? this.helperInterpreter() : projectPython(sandbox);
    const key = JSON.stringify([dir, id, target, closure, stamp(dir, interpreter)]);
    const cached = this.cache.get(key);
    if (!fresh && cached && cached.expires > Date.now()) return cached.value;
    const value = this.probe(id, target, packages, closure.flatMap((env) => env.tools ?? []), dir, interpreter);
    if (this.cache.size >= 128) this.cache.clear();
    this.cache.set(key, { expires: Date.now() + 60_000, value });
    return value;
  }

  private async probe(id: string, target: EnvironmentTarget, packages: GeoEnvironmentPackage[], declaredTools: GeoEnvironmentTool[], dir: string, interpreter: string): Promise<EnvironmentReadiness> {
    const result = await this.runner(interpreter, ["-I", "-c", importProbeScript(packages)], { cwd: dir, timeout: 60_000 });
    let imports: ImportResult[];
    let distributions: DistributionResult[];
    try {
      if (result.code !== 0) throw new Error(tail(result) || "Interpreter failed");
      const parsed = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
      if (!Array.isArray(parsed.imports) || !Array.isArray(parsed.distributions)) throw new Error("Invalid import probe response");
      imports = environmentImports(packages).map((module) => parsed.imports.find((row: ImportResult) => row.module === module) ?? { module, status: "missing", error: "No probe result" });
      distributions = packages.map((pkg) => parsed.distributions.find((row: DistributionResult) => row.name === pkg.name) ?? { name: pkg.name, version: null, status: "missing", error: "No probe result" });
    } catch (error) {
      const message = (error as Error).message.slice(-2000);
      imports = environmentImports(packages).map((module) => ({ module, status: "missing", error: message }));
      distributions = packages.map((pkg) => ({ name: pkg.name, version: null, status: "missing", error: message }));
    }
    const tools: ToolResult[] = [];
    for (const tool of declaredTools) {
      let command: string;
      let args: string[];
      if (tool.name === "chromium" && tool.check === "python -m playwright install --dry-run chromium") {
        // Playwright dry-run exits 0 even when Chromium is absent. Inspect its actual executable instead.
        command = interpreter;
        args = ["-I", "-c", "from playwright.sync_api import sync_playwright\nfrom pathlib import Path\nwith sync_playwright() as p:\n f = Path(p.chromium.executable_path)\n print(f)\n raise SystemExit(0 if f.is_file() else 1)"];
      } else {
        const parts = tool.check.trim().split(/\s+/);
        command = parts[0]; args = parts.slice(1);
        // Checks are argv, never a shell; unsupported checks are reported, not executed.
        if (!/^[\w.-]+$/.test(command) || args.some((arg) => !/^[\w.=-]+$/.test(arg))) {
          tools.push({ name: tool.name, version: tool.version, check: tool.check, optional: !!tool.optional, status: "missing", output: "Unsupported tool check" });
          continue;
        }
      }
      const checked = await this.runner(command, args, { cwd: dir, timeout: 15_000 });
      tools.push({ name: tool.name, version: tool.version, check: tool.check, optional: !!tool.optional, status: checked.code === 0 ? "ok" : "missing", output: tail(checked) });
    }
    return { id, target, packages, imports, distributions, tools,
      ready: imports.every((i) => i.status === "ok") && distributions.every((d) => d.status === "ok") && tools.every((t) => t.optional || t.status === "ok") };
  }

  async prepare(data: GeoEnvironments, id: string, target: EnvironmentTarget, sandbox: string): Promise<EnvironmentReadiness> {
    // Validate before discovering uv or mutating anything.
    const before = await this.readiness(data, id, target, sandbox, true);
    const dir = target === "helper" ? this.helperDir : sandbox;
    if (this.preparing.has(dir)) throw new EnvironmentPreparationError("Environment preparation already running", "");
    const uv = this.uv();
    if (!uv) throw new EnvironmentPreparationError("uv is unavailable", "Install uv and retry preparation.");
    this.preparing.add(dir);
    try {
      const missing = before.packages.filter((pkg) => before.distributions.some((dist) => dist.name === pkg.name && dist.status === "missing"));
      const args = target === "helper" ? ["sync", "--frozen"] : missing.length ? ["add", "--", ...missing.map(resolvedPackageSpec)] : null;
      if (args) {
        const result = await this.runner(uv, args, { cwd: dir, timeout: 5 * 60_000 });
        if (result.code !== 0) throw new EnvironmentPreparationError("Environment preparation failed", tail(result));
      }
      this.cache.clear();
      return await this.readiness(data, id, target, sandbox, true);
    } finally { this.preparing.delete(dir); }
  }
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as catalogue from "../src/geo/catalogue.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { GeoEnvironments } from "../src/geo/catalogue-types.ts";
import { environmentClosure, environmentImports, environmentPackages, GeoEnvironmentService, packageSpec, projectPyproject, projectPython, requiredEnvironments, seededProjectPyproject, type CommandRunner } from "../src/geo/environments.ts";
import { registerGeoEnvironmentRoutes } from "../src/geo/routes/environments.ts";
import { resolvePaths } from "../src/projects.ts";
import { seedSandboxFiles } from "../src/sandbox-seed.ts";

const data: GeoEnvironments = {
  schemaVersion: "geo-environments/v1", python: ">=3.12", environments: [
    { id: "core", title: { ko: "기본" }, targets: ["helper", "project"], packages: [{ name: "numpy", version: ">=2.0", imports: ["numpy"] }] },
    { id: "gis", title: { ko: "GIS" }, extends: "core", targets: ["helper", "project"], packages: [{ name: "rasterio", version: ">=1.4", imports: ["rasterio"] }] },
    { id: "report", title: { ko: "보고서" }, extends: "core", optional: true, targets: ["project"], packages: [{ name: "pillow", imports: ["PIL"] }], tools: [{ name: "rhwp", check: "rhwp --version", optional: true }] },
    { id: "acquisition", title: { ko: "수집" }, extends: "gis", optional: true, targets: ["project"], packages: [], tools: [{ name: "chromium", check: "python -m playwright install --dry-run chromium", optional: true }] },
  ],
};
const dirs: string[] = [];
const temp = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geo-env-test-")); dirs.push(dir); return dir; };
afterEach(() => { vi.restoreAllMocks(); for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function harness() {
  const installed = new Set(["numpy"]);
  const calls: { command: string; args: string[]; cwd: string; timeout: number }[] = [];
  let fail = false;
  let brokenImport = false;
  const runner: CommandRunner = async (command, args, options) => {
    calls.push({ command, args, ...options });
    if (command === "uv-test") {
      if (fail) return { code: 1, stdout: "resolver log", stderr: "failed lower bound" };
      if (args[0] === "sync") { installed.add("rasterio"); }
      else for (const spec of args.slice(2)) installed.add(spec.split(">=")[0]);
      return { code: 0, stdout: "prepared", stderr: "" };
    }
    if (args[0] === "-I" && args[2].includes("pkgs = json.loads")) {
      const literal = args[2].split("pkgs = json.loads(")[1].split("\n")[0].slice(0, -1);
      const packages = JSON.parse(JSON.parse(literal)) as { name: string; imports: string[] }[];
      return { code: 0, stderr: "", stdout: JSON.stringify({
        distributions: packages.map((p) => ({ name: p.name, version: installed.has(p.name) ? "9.9" : null, status: installed.has(p.name) ? "ok" : "missing" })),
        imports: packages.flatMap((p) => p.imports.map((module) => ({ module, status: installed.has(p.name) && !brokenImport ? "ok" : "missing", error: "ImportError: example" }))),
      }) };
    }
    return { code: 1, stdout: "", stderr: "tool missing" };
  };
  const dir = temp();
  const service = new GeoEnvironmentService({ runner, uv: () => "uv-test", helperDir: dir, helperInterpreter: () => "helper-python" });
  return { service, runner, dir, calls, installed, fail: () => { fail = true; }, breakImport: () => { brokenImport = true; } };
}

describe("catalogue environment resolution and project seeding", () => {
  it("resolves ancestors, required targets and the union of module imports", () => {
    expect(environmentClosure(data, "gis").map((e) => e.id)).toEqual(["core", "gis"]);
    expect(requiredEnvironments(data, "helper").map((e) => e.id)).toEqual(["core", "gis"]);
    expect(requiredEnvironments(data, "project").map((e) => e.id)).toEqual(["core", "gis"]);
    expect(environmentImports(environmentPackages(requiredEnvironments(data, "project")))).toEqual(["numpy", "rasterio"]);
    expect(packageSpec(data.environments[0].packages[0])).toBe("numpy>=2.0");
    const overlap = structuredClone(data.environments[0]);
    overlap.packages = [{ name: "NumPy", version: ">=2.1", imports: ["numpy.linalg"] }];
    expect(environmentPackages([data.environments[0], overlap])).toEqual([{ name: "numpy", version: ">=2.0,>=2.1", imports: ["numpy", "numpy.linalg"] }]);
  });
  it("rejects missing parents, cycles and invalid package/module names", () => {
    expect(() => environmentClosure(data, "unknown")).toThrow("Unknown environment");
    const cycle = structuredClone(data); cycle.environments[0].extends = "gis";
    expect(() => environmentClosure(cycle, "gis")).toThrow("cycle");
    expect(() => packageSpec({ name: "--index-url", imports: [] })).toThrow("Invalid distribution");
    expect(() => packageSpec({ name: "safe", version: "git+https://example.com", imports: [] })).toThrow("lower bound");
    expect(() => packageSpec({ name: "safe", imports: ["x;evil()"] })).toThrow("Invalid module");
  });
  it("generates required-only geo dependencies and falls back when off or unavailable", () => {
    const text = projectPyproject(data);
    expect(text).toContain('requires-python = ">=3.12"');
    expect(text).toContain('"cmcrameri>=1.10"');
    expect(text).toContain('"SciencePlots>=2.2.2"');
    expect(text).toContain('"pypdf>=6.21.2"');
    expect(text).toContain('"numpy>=2.0"'); expect(text).toContain('"rasterio>=1.4"'); expect(text).not.toContain('"pillow"');
    vi.spyOn(catalogue, "geoCatalogueActive").mockReturnValue(false);
    expect(seededProjectPyproject("upstream")).toBe("upstream");
    vi.spyOn(catalogue, "geoCatalogueActive").mockReturnValue(true);
    vi.spyOn(catalogue, "loadGeoCatalogue").mockImplementation(() => { throw new Error("archive missing"); });
    expect(seededProjectPyproject("upstream")).toBe("upstream");
    vi.spyOn(catalogue, "loadGeoCatalogue").mockReturnValue({ environments: data } as GeoCatalogue);
    expect(seededProjectPyproject("upstream")).toBe(text);
  });
  it("seeds in both modes without replacing existing or deliberately deleted pyprojects", () => {
    const paths = { ...resolvePaths("geo-env-seed"), sandbox: temp(), kadyDir: temp() };
    vi.spyOn(catalogue, "geoCatalogueActive").mockReturnValue(false);
    seedSandboxFiles(paths);
    const file = path.join(paths.sandbox, "pyproject.toml");
    expect(fs.readFileSync(file, "utf8")).toContain('name = "kady-sandbox"');
    fs.writeFileSync(file, "# edited project\n");
    vi.spyOn(catalogue, "geoCatalogueActive").mockReturnValue(true);
    vi.spyOn(catalogue, "loadGeoCatalogue").mockReturnValue({ environments: data } as GeoCatalogue);
    seedSandboxFiles(paths, { force: true });
    expect(fs.readFileSync(file, "utf8")).toBe("# edited project\n");
    fs.rmSync(file); seedSandboxFiles(paths); expect(fs.existsSync(file)).toBe(false);
    seedSandboxFiles(paths, { force: true }); expect(fs.readFileSync(file, "utf8")).toBe(projectPyproject(data));
    expect(projectPython("sandbox", "win32")).toBe(path.join("sandbox", ".venv", "Scripts", "python.exe"));
  });
});

describe("readiness and explicit preparation", () => {
  it("uses isolated target interpreters and caches probes until relevant mtimes change", async () => {
    const h = harness();
    const first = await h.service.readiness(data, "gis", "project", h.dir);
    expect(first.ready).toBe(false); expect(first.imports[1]).toMatchObject({ module: "rasterio", status: "missing", error: "ImportError: example" });
    expect(h.calls[0]).toMatchObject({ command: projectPython(h.dir), cwd: h.dir, timeout: 60_000 });
    expect(h.calls[0].args.slice(0, 2)).toEqual(["-I", "-c"]);
    await h.service.readiness(data, "gis", "project", h.dir); expect(h.calls).toHaveLength(1);
    fs.writeFileSync(path.join(h.dir, "uv.lock"), "changed");
    await h.service.readiness(data, "gis", "project", h.dir); expect(h.calls).toHaveLength(2);
    await h.service.readiness(data, "gis", "helper", h.dir); expect(h.calls.at(-1)?.command).toBe("helper-python");
  });
  it("adds exactly missing catalogue distributions with bounds, never tools or import names", async () => {
    const h = harness();
    const prepared = await h.service.prepare(data, "report", "project", h.dir);
    expect(prepared.ready).toBe(true);
    expect(prepared.tools[0]).toMatchObject({ name: "rhwp", status: "missing", optional: true });
    expect(h.calls.filter((c) => c.command === "uv-test").map((c) => c.args)).toEqual([["add", "--", "pillow"]]);
    const gis = await h.service.prepare(data, "gis", "project", h.dir);
    expect(gis.ready).toBe(true); expect(h.calls.filter((c) => c.command === "uv-test").at(-1)?.args).toEqual(["add", "--", "rasterio>=1.4"]);
    await h.service.prepare(data, "gis", "helper", h.dir);
    expect(h.calls.filter((c) => c.command === "uv-test").at(-1)?.args).toEqual(["sync", "--frozen", "--python", "3.12"]);
  });
  it("does not install a distribution just because an installed module is broken", async () => {
    const h = harness(); h.breakImport();
    expect((await h.service.prepare(data, "core", "project", h.dir)).ready).toBe(false);
    expect(h.calls.some((c) => c.command === "uv-test")).toBe(false);
  });
  it("returns command failure details, and reports interpreter failures per module", async () => {
    const h = harness(); h.fail();
    await expect(h.service.prepare(data, "gis", "project", h.dir)).rejects.toMatchObject({ output: expect.stringContaining("failed lower bound") });
    const service = new GeoEnvironmentService({ runner: async () => ({ code: null, stdout: "", stderr: "ENOENT interpreter" }) });
    expect((await service.readiness(data, "gis", "project", h.dir)).imports).toEqual([
      { module: "numpy", status: "missing", error: "ENOENT interpreter" }, { module: "rasterio", status: "missing", error: "ENOENT interpreter" },
    ]);
  });
  it("checks Chromium's executable instead of using an installation-shaped dry-run", async () => {
    const h = harness();
    const result = await h.service.readiness(data, "acquisition", "project", h.dir);
    expect(result.tools[0].status).toBe("missing");
    expect(h.calls.at(-1)?.args[2]).toContain("p.chromium.executable_path");
    expect(h.calls.some((c) => c.args.includes("install"))).toBe(false);
  });
  it("validates routes before preparation and reports optional tools without installing them", async () => {
    const h = harness(); const app = Fastify();
    await registerGeoEnvironmentRoutes(app, { service: h.service, load: () => data, active: () => true, sandbox: () => h.dir });
    try {
      const missing = await app.inject({ method: "POST", url: "/geo/environments/unknown/prepare", payload: {} });
      expect(missing.statusCode).toBe(404); expect(h.calls).toHaveLength(0);
      expect((await app.inject({ method: "POST", url: "/geo/environments/report/prepare", payload: { target: "helper" } })).statusCode).toBe(404);
      expect((await app.inject({ method: "POST", url: "/geo/environments/gis/prepare", payload: { target: "other" } })).statusCode).toBe(400);
      const result = await app.inject({ method: "GET", url: "/geo/environments" });
      expect(result.statusCode).toBe(200);
      expect(result.json().environments.find((e: { id: string }) => e.id === "report").targets[0].tools[0].status).toBe("missing");
      expect(h.calls.some((c) => c.command === "uv-test")).toBe(false);
      expect((await app.inject({ method: "POST", url: "/geo/environments/gis/prepare" })).json().ready).toBe(true);
      h.installed.delete("rasterio"); h.fail();
      const failed = await app.inject({ method: "POST", url: "/geo/environments/gis/prepare", payload: {} });
      expect(failed.statusCode).toBe(503); expect(failed.json().output).toContain("failed lower bound");
    } finally { await app.close(); }
  });
});

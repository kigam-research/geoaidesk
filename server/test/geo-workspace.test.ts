import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_ID, PROJECTS_ROOT } from "../src/config.ts";
import { ensureProjectExists, type ProjectPaths } from "../src/projects.ts";
import { createSession, disposeProjectSessions } from "../src/agent/session-registry.ts";
import { geoExposureIssue, readSessionExposure } from "../src/geo/context.ts";
import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import type { EnvironmentReadiness } from "../src/geo/environments.ts";
import { registerGeoWorkspaceRoutes } from "../src/geo/routes/workspace.ts";
import { checkRecipe } from "../src/geo/workspace/recipes.ts";
import { taxonomyFormat } from "../src/geo/workspace/formats.ts";
import { registerSessionRoutes } from "../src/api/sessions.ts";
import { registerGeoCatalogueRoutes } from "../src/geo/routes/catalogue.ts";
import { makeScientificResultTool, scientificResultFromDetails } from "../src/agent/scientific-result.ts";
import type { GeoInspection } from "../../web/src/geo/contracts/inspection.ts";
import type { GeoWorkflowsResponse, GeoSuggestionsResponse } from "../../web/src/geo/contracts/workspace.ts";

const PROJECT = DEFAULT_PROJECT_ID;
const ko = (text: string) => ({ ko: text, en: text });

const role = (id: string, formats: string[], required = true) => ({ id, label: ko(id), formats, required });
const workflow = (id: string, skillIds: string[], env: string, roles: ReturnType<typeof role>[], extra: object = {}) => ({
  schemaVersion: "geo-workflow/v1",
  id,
  title: ko(`${id} title`),
  description: ko(`${id} description`),
  inputRoles: roles,
  requiredScientificChoices: [
    { id: "always", label: ko("always"), why: ko("why") },
    { id: "sometimes", label: ko("sometimes"), requiredWhen: ko("when") },
  ],
  prompt: ko(`${id} prompt`),
  skillIds,
  environmentProfile: env,
  expectedArtifacts: [{ id: "out", label: ko("out"), skill: skillIds[0], output: "out", required: true }],
  boundary: ko("no interpretation"),
  exampleCaseIds: [],
  ...extra,
});

const CATALOGUE = {
  version: "0.2.0",
  label: "geo-catalogue@0.2.0+test",
  index: {
    catalogueVersion: "0.2.0",
    skills: [
      { id: "kigam/well-log-qc-quicklook", runtimeName: "well-log-qc-quicklook", title: ko("Well log QC"), exampleIds: ["force-25-9-1"] },
      { id: "kigam/assay-composition-explorer", runtimeName: "assay-composition-explorer", title: ko("Assay"), exampleIds: [] },
      { id: "kigam/geo-map-and-crs", runtimeName: "geo-map-and-crs", title: ko("Map"), exampleIds: [] },
      { id: "kigam/hwpx-handoff-report", runtimeName: "hwpx-handoff-report", title: ko("Handoff"), exampleIds: [] },
    ],
  },
  manifest: { runtimeSkills: [] },
  workflows: [
    workflow("well-log-qc", ["kigam/well-log-qc-quicklook"], "geo-core", [role("logs", ["las-welllog"]), role("context", ["csv"], false)]),
    workflow("assay-composition", ["kigam/assay-composition-explorer"], "geo-core", [role("assays", ["csv", "xlsx"]), role("metadata", ["json"])]),
    workflow("geo-map-and-crs", ["kigam/geo-map-and-crs"], "geo-gis", [role("layers", ["shapefile", "geopackage", "geojson", "geotiff"])]),
    workflow("research-handoff", ["kigam/hwpx-handoff-report"], "geo-report", [role("results", ["markdown", "csv", "png", "json"])]),
    workflow("not-shipped", ["kigam/missing-skill"], "geo-core", [role("logs", ["las-welllog"])], { compatibilityRef: "kigam/x/install-1" }),
  ],
  environments: {
    schemaVersion: "geo-environments/v1",
    python: ">=3.12",
    environments: [
      { id: "geo-core", title: ko("Core"), targets: ["helper", "project"], packages: [] },
      { id: "geo-gis", title: ko("GIS"), extends: "geo-core", targets: ["helper", "project"], packages: [] },
      { id: "geo-report", title: ko("Report"), optional: true, targets: ["project"], packages: [] },
    ],
  },
} as unknown as GeoCatalogue;

function readiness(id: string, ready: boolean): EnvironmentReadiness {
  return {
    id,
    target: "project",
    packages: [],
    distributions: ready ? [] : [{ name: "lasio", version: null, status: "missing", error: "not installed" }],
    imports: ready ? [] : [{ module: "lasio", status: "missing" }],
    tools: [],
    ready,
  };
}

const fakeService = (readyEnvs: string[]) => ({
  readiness: async (_data: unknown, id: string) => readiness(id, readyEnvs.includes(id)),
});

function installSkill(paths: ProjectPaths, name: string, disabled = false): void {
  const dir = path.join(disabled ? path.join(paths.sandbox, ".pi", "skills-disabled") : paths.skillsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: test\n---\n`);
}

function inspection(format: GeoInspection["asset"]["format"], extra: Partial<GeoInspection> = {}): GeoInspection {
  return {
    schemaVersion: "geo-inspection/v1",
    asset: { projectId: PROJECT, path: "x", sourceFiles: [], format, family: "table", sizeBytes: 1, fingerprint: "f" },
    issues: [],
    inspector: { name: "test", version: "1" },
    ...extra,
  };
}

let paths: ProjectPaths;
beforeEach(() => {
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  paths = ensureProjectExists(PROJECT);
});
afterEach(async () => {
  await disposeProjectSessions(PROJECT);
});

async function app(options: { readyEnvs?: string[]; inspections?: Record<string, GeoInspection>; catalogue?: GeoCatalogue | null } = {}) {
  const server = Fastify();
  const catalogue = options.catalogue === undefined ? CATALOGUE : options.catalogue;
  await registerGeoWorkspaceRoutes(server, {
    service: fakeService(options.readyEnvs ?? ["geo-core", "geo-gis", "geo-report"]),
    catalogue: () => catalogue,
    status: () => (catalogue ? { state: "ready", version: "0.2.0" } : { state: "off", version: null }),
    paths: () => paths,
    inspect: async (rel) => {
      const hit = options.inspections?.[rel];
      if (!hit) throw new Error("not inspected");
      return hit;
    },
  });
  return server;
}

function touch(rel: string): void {
  fs.mkdirSync(path.dirname(path.join(paths.sandbox, rel)), { recursive: true });
  fs.writeFileSync(path.join(paths.sandbox, rel), "x");
}

describe("GET /geo/workflows readiness", () => {
  it("keeps skills, environment and run record apart", async () => {
    installSkill(paths, "well-log-qc-quicklook");
    installSkill(paths, "assay-composition-explorer", true);
    installSkill(paths, "geo-map-and-crs");
    installSkill(paths, "hwpx-handoff-report");
    const server = await app({ readyEnvs: ["geo-core", "geo-report"] });
    const body = (await server.inject({ method: "GET", url: "/geo/workflows" })).json() as GeoWorkflowsResponse;
    const state = Object.fromEntries(body.workflows.map((w) => [w.id, w.readiness]));
    expect(state["well-log-qc"].state).toBe("ready");
    expect(state["well-log-qc"].runRecord).toBe("none");
    expect(state["assay-composition"].state).toBe("missing-skills");
    expect(state["assay-composition"].skills[0]).toMatchObject({ installed: true, enabled: false });
    expect(state["geo-map-and-crs"].state).toBe("needs-environment");
    expect(state["geo-map-and-crs"].environment).toMatchObject({ state: "missing", missing: ["lasio", "import lasio"] });
    expect(state["not-shipped"]).toMatchObject({ state: "unavailable", runRecord: "recorded", compatibilityRef: "kigam/x/install-1" });
    const wl = body.workflows.find((w) => w.id === "well-log-qc")!;
    expect(wl.inputRoles[0]).toMatchObject({ formats: ["las-welllog"], extensions: ["las"] });
    expect(wl.boundary).toEqual(ko("no interpretation"));
  });

  it("reports an inactive catalogue without workflows", async () => {
    const server = await app({ catalogue: null });
    expect((await server.inject({ method: "GET", url: "/geo/workflows" })).json()).toEqual({
      catalogue: { state: "off", version: null },
      workflows: [],
    });
  });

  it("never reports an unprobed environment as ready", async () => {
    installSkill(paths, "well-log-qc-quicklook");
    const server = Fastify();
    await registerGeoWorkspaceRoutes(server, {
      service: { readiness: async () => { throw new Error("uv missing"); } },
      catalogue: () => CATALOGUE,
      status: () => ({ state: "ready", version: "0.2.0" }),
      paths: () => paths,
    });
    const body = (await server.inject({ method: "GET", url: "/geo/workflows" })).json() as GeoWorkflowsResponse;
    const wl = body.workflows.find((w) => w.id === "well-log-qc")!;
    expect(wl.readiness.state).toBe("needs-environment");
    expect(wl.readiness.environment).toMatchObject({ state: "unknown", detail: "uv missing" });
  });
});

describe("POST /geo/suggestions", () => {
  it("prioritizes installed methods by declared format, keeps exposure, and works without a catalogue", async () => {
    const dir = path.join(paths.skillsDir, "table-method");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), "---\nname: table-method\ndescription: Table analysis\n---\n");
    fs.writeFileSync(path.join(dir, "gaid-method.json"), JSON.stringify({
      schemaVersion: "gaid-method/v1", methodId: "local/table-method", revision: 1, version: "0.1.0",
      lifecycle: "draft", implementation: "implemented", codeOrigin: "supplied", title: ko("Installed table method"),
      sources: [], recipes: [],
      workflows: [{ id: "assay-composition", title: ko("Installed table method"), inputRoles: [role("grid", ["csv"])],
        requiredScientificChoices: [], prompt: ko("Analyze table"), skillIds: ["local:table-method"], environmentProfile: "geo-core",
        expectedArtifacts: [{ id: "out", label: ko("Output"), files: ["out.csv"], required: true }], boundary: ko("Review before interpretation") }],
    }));
    fs.writeFileSync(path.join(paths.sandbox, "a.csv"), "Au,Cu,Ni\n1,2,3\n");
    for (const catalogue of [CATALOGUE, null]) {
      const server = await app({ catalogue });
      const response = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "a.csv" } })).json() as GeoSuggestionsResponse;
      expect(response.suggestions[0]).toMatchObject({ workflowId: "assay-composition", exposure: "method:table-method:assay-composition", workflow: { inputRoles: [{ id: "grid" }] } });
      await server.close();
    }
  });
  it("suggests from a specific format and lists the unconditional choices", async () => {
    installSkill(paths, "well-log-qc-quicklook");
    touch("logs/w1.las");
    const server = await app({ inspections: { "logs/w1.las": inspection("las") } });
    const body = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "logs/w1.las" } })).json() as GeoSuggestionsResponse;
    expect(body.format).toBe("las-welllog");
    expect(body.suggestions.map((s) => s.workflowId)).toEqual(["well-log-qc", "not-shipped"]);
    expect(body.suggestions[0].match).toMatchObject({ roleId: "logs", required: true });
    expect(body.suggestions[0].needs).toEqual([ko("always")]);
    expect(body.suggestions[1].readiness.state).toBe("unavailable");
  });

  it("needs a content signal for a generic table", async () => {
    touch("a.csv");
    touch("b.csv");
    const columns = (names: string[]) => names.map((name) => ({ name, type: "number" })) as GeoInspection["columns"];
    const server = await app({
      inspections: {
        "a.csv": inspection("csv", { columns: columns(["sample", "Au_ppb", "Cu_ppm", "Ni", "SiO2"]) }),
        "b.csv": inspection("csv", { columns: columns(["id", "value"]) }),
      },
    });
    const a = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "a.csv" } })).json() as GeoSuggestionsResponse;
    expect(a.suggestions.map((s) => s.workflowId)).toEqual(["assay-composition"]);
    expect(a.suggestions[0].match.signal).toEqual({ kind: "element-columns", columns: ["Au_ppb", "Cu_ppm", "Ni", "SiO2"] });
    const b = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "b.csv" } })).json() as GeoSuggestionsResponse;
    expect(b.format).toBe("csv");
    expect(b.suggestions).toEqual([]);
  });

  it("names a categorical field of a polygon layer", async () => {
    installSkill(paths, "geo-map-and-crs");
    touch("rect.gpkg");
    const layer = { name: "rect", geometryType: "Polygon", fields: [{ name: "class", type: "object" }, { name: "n", type: "int64" }] };
    const server = await app({ inspections: { "rect.gpkg": inspection("geopackage", { layers: [layer] }) } });
    const body = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "rect.gpkg" } })).json() as GeoSuggestionsResponse;
    expect(body.suggestions[0]).toMatchObject({ workflowId: "geo-map-and-crs", match: { signal: { kind: "categorical-field", columns: ["class"] } } });
  });

  it("does not treat an ordinary TIFF or a result manifest as task input", async () => {
    touch("photo.tif");
    touch("out/map.geomap.json");
    const server = await app({ inspections: { "photo.tif": inspection("tiff") } });
    for (const p of ["photo.tif", "out/map.geomap.json"]) {
      const body = (await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: p } })).json() as GeoSuggestionsResponse;
      expect(body).toMatchObject({ format: null, suggestions: [] });
    }
  });

  it("rejects paths outside the sandbox and bad bodies", async () => {
    const server = await app();
    expect((await server.inject({ method: "POST", url: "/geo/suggestions", payload: {} })).statusCode).toBe(400);
    expect((await server.inject({ method: "POST", url: "/geo/suggestions", payload: { path: "../x.las" } })).statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("recipes", () => {
  const recipe = {
    schemaVersion: "geo-start/v1",
    workflowId: "well-log-qc",
    catalogueVersion: "0.2.0",
    skillIds: ["kigam/well-log-qc-quicklook"],
    exampleId: "force-25-9-1",
    choices: { always: "MD" },
    unresolvedChoices: ["sometimes"],
  };

  it("turns a valid recipe into an editable setup", () => {
    expect(checkRecipe(recipe, CATALOGUE)).toEqual({
      ok: true,
      issues: [],
      setup: { workflowId: "well-log-qc", choices: { always: "MD" }, unresolvedChoices: ["sometimes"], skillIds: ["kigam/well-log-qc-quicklook"], exampleId: "force-25-9-1" },
    });
  });

  it("reports the checkGeoStart errors", () => {
    const codes = (value: unknown) => checkRecipe(value, CATALOGUE).issues.map((issue) => issue.code);
    expect(codes({ ...recipe, catalogueVersion: "0.1.0" })).toEqual(["catalogue-version"]);
    expect(codes({ ...recipe, workflowId: "nope" })).toEqual(["unknown-workflow"]);
    expect(codes({ ...recipe, skillIds: ["kigam/assay-composition-explorer"], exampleId: undefined })).toEqual(["workflow-skill"]);
    expect(codes({ ...recipe, choices: { other: 1 } })).toEqual(["unknown-choice"]);
    expect(codes({ ...recipe, skillIds: [...recipe.skillIds, "x/unknown"] })).toEqual(["unknown-skill"]);
    expect(codes({ ...recipe, exampleId: "elsewhere" })).toEqual(["unknown-example"]);
    expect(codes({ ...recipe, choices: { always: "MD", sometimes: "x" } })).toEqual(["choice-state"]);
    expect(codes({ ...recipe, schemaVersion: "geo-start/v2", extra: 1 })).toEqual(["schema", "schema"]);
    expect(checkRecipe(recipe, null).issues[0].code).toBe("catalogue-off");
  });

  it("is served without executing anything", async () => {
    const server = await app();
    const body = (await server.inject({ method: "POST", url: "/geo/recipes/check", payload: { recipe } })).json();
    expect(body.ok).toBe(true);
    expect((await server.inject({ method: "POST", url: "/geo/recipes/check", payload: {} })).statusCode).toBe(400);
  });

  it("saves checked recipes under a chosen or new category and re-checks them on list", async () => {
    let catalogue: GeoCatalogue | null = CATALOGUE;
    const server = Fastify();
    await registerGeoWorkspaceRoutes(server, {
      service: fakeService(["geo-core"]), catalogue: () => catalogue,
      status: () => ({ state: "ready", version: "0.2.0" }), paths: () => paths,
    });
    expect((await server.inject({ method: "GET", url: "/geo/recipes" })).json()).toEqual({ categories: [], recipes: [] });
    const bad = await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe: { ...recipe, workflowId: "nope" }, title: "x" } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().issues[0].code).toBe("unknown-workflow");
    expect((await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: " " } })).statusCode).toBe(400);
    expect((await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "x", category: "user-9" } })).statusCode).toBe(400);
    const first = (await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "MD 기준 QC" } })).json();
    expect(first.recipes[0]).toMatchObject({ title: "MD 기준 QC", category: "geoscience", check: { ok: true } });
    const second = (await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "현장 A", newCategory: "현장 조사" } })).json();
    expect(second.categories).toEqual([{ id: "user-1", label: "현장 조사" }]);
    const third = (await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "현장 B", newCategory: "현장 조사" } })).json();
    expect(third.categories).toHaveLength(1);
    expect(third.recipes.map((row: { category: string }) => row.category)).toEqual(["geoscience", "user-1", "user-1"]);
    const upstream = (await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "논문", category: "paper" } })).json();
    expect(upstream.recipes[3].category).toBe("paper");

    // A catalogue change keeps the recipe and reports why it cannot open.
    catalogue = null;
    const stale = (await server.inject({ method: "GET", url: "/geo/recipes" })).json();
    expect(stale.recipes).toHaveLength(4);
    expect(stale.recipes[0].check.issues[0].code).toBe("catalogue-off");
    catalogue = CATALOGUE;

    // Removing the last recipe of a user category removes the category.
    for (const row of third.recipes.slice(1)) {
      const res = await server.inject({ method: "DELETE", url: `/geo/recipes/${row.id}` });
      expect(res.statusCode).toBe(200);
    }
    expect((await server.inject({ method: "GET", url: "/geo/recipes" })).json().categories).toEqual([]);
    expect((await server.inject({ method: "DELETE", url: `/geo/recipes/${third.recipes[1].id}` })).statusCode).toBe(404);

    // A malformed store is reported, never rewritten.
    const store = path.join(paths.kadyDir, "geo", "recipes.json");
    fs.writeFileSync(store, "{\"x\":1}");
    expect((await server.inject({ method: "GET", url: "/geo/recipes" })).statusCode).toBe(409);
    expect((await server.inject({ method: "POST", url: "/geo/recipes", payload: { recipe, title: "y" } })).statusCode).toBe(409);
    expect(fs.readFileSync(store, "utf-8")).toBe("{\"x\":1}");
  });
});

describe("started-task sessions", () => {
  it("records the task's exposure for a session created with geoExposure", async () => {
    const session = await createSession(PROJECT, paths, { geoExposure: "workflow:well-log-qc" });
    expect(readSessionExposure(paths, session.sessionId)?.mode).toBe("workflow:well-log-qc");
  });

  it("validates POST /sessions bodies", async () => {
    expect(geoExposureIssue("workflow:Bad Id")).toMatch(/invalid workflow id/);
    expect(geoExposureIssue("catalogue")).toBeNull();
    const server = Fastify();
    await registerSessionRoutes(server);
    const bad = await server.inject({ method: "POST", url: "/sessions", payload: { geoExposure: "everything" } });
    expect(bad.statusCode).toBe(400);
    const ok = await server.inject({ method: "POST", url: "/sessions", payload: { geoExposure: "workflow:well-log-qc" } });
    expect(ok.statusCode).toBe(200);
    expect(readSessionExposure(paths, ok.json().id)?.mode).toBe("workflow:well-log-qc");
    const plain = await server.inject({ method: "POST", url: "/sessions" });
    expect(plain.statusCode).toBe(200);
  });
});

describe("prompt-budget preview of a started task", () => {
  it("previews the task's exposure and validates it", async () => {
    const server = Fastify();
    await registerGeoCatalogueRoutes(server);
    expect((await server.inject({ method: "GET", url: "/geo/context/preview?exposure=everything" })).statusCode).toBe(400);
    const body = (await server.inject({ method: "GET", url: "/geo/context/preview?exposure=workflow:well-log-qc" })).json();
    expect(body.exposure).toMatchObject({ mode: "workflow:well-log-qc", preview: true });
  });
});

describe("formats", () => {
  it("maps inspected formats and extensions to taxonomy ids", () => {
    expect(taxonomyFormat("a/b.shp", "shapefile")).toBe("shapefile");
    expect(taxonomyFormat("a/b.dbf", "shapefile")).toBeNull();
    expect(taxonomyFormat("r.tif", "geotiff")).toBe("geotiff");
    expect(taxonomyFormat("r.tif")).toBeNull();
    expect(taxonomyFormat("notes.md")).toBe("markdown");
    expect(taxonomyFormat("run.geo-start.json")).toBeNull();
  });
});

describe("scientific_result geo-result card", () => {
  const run = (params: unknown) =>
    makeScientificResultTool(PROJECT).execute("tc_geo", params as never, undefined, undefined, undefined as never);

  it("accepts a reference to a matching geo-result/v1 manifest", async () => {
    fs.mkdirSync(path.join(paths.sandbox, "out"), { recursive: true });
    fs.writeFileSync(path.join(paths.sandbox, "out/lith.geomap.json"), JSON.stringify({ schemaVersion: "geo-result/v1", kind: "map-layer" }));
    fs.writeFileSync(path.join(paths.sandbox, "out/lith.png"), "png");
    const result = await run({ kind: "geo-result", title: "Lithology map", resultKind: "map-layer", manifestPath: "out/lith.geomap.json", thumbnailPath: "out/lith.png", rows: [[1]] });
    const card = scientificResultFromDetails(result.details);
    expect(card).toMatchObject({ kind: "geo-result", resultKind: "map-layer", manifestPath: "out/lith.geomap.json", thumbnailPath: "out/lith.png" });
    expect(card).not.toHaveProperty("rows");
  });

  it("rejects a manifest of another kind or a non-image thumbnail", async () => {
    fs.mkdirSync(path.join(paths.sandbox, "out"), { recursive: true });
    fs.writeFileSync(path.join(paths.sandbox, "out/w.depth.json"), JSON.stringify({ schemaVersion: "geo-result/v1", kind: "depth-track" }));
    fs.writeFileSync(path.join(paths.sandbox, "out/notes.txt"), "x");
    await expect(run({ kind: "geo-result", title: "t", resultKind: "map-layer", manifestPath: "out/w.depth.json" })).rejects.toThrow(/kind/);
    await expect(run({ kind: "geo-result", title: "t", resultKind: "depth-track", manifestPath: "out/notes.txt" })).rejects.toThrow(/JSON/);
    await expect(run({ kind: "geo-result", title: "t", resultKind: "depth-track", manifestPath: "out/w.depth.json", thumbnailPath: "out/notes.txt" })).rejects.toThrow(/image/);
    await expect(run({ kind: "geo-result", title: "t", resultKind: "depth-track" })).rejects.toThrow(/manifestPath/);
  });
});

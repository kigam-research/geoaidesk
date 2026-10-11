import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import { registerGeoTableRoutes } from "../src/geo/routes/tables.ts";
import { resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
const app = Fastify();
const ids = ["geo-tables-a", "geo-tables-b"];
app.addHook("onRequest", (req, _reply, done) => withActiveProject(String(req.headers["x-project-id"] ?? ids[0]), done));
await registerGeoTableRoutes(app);
beforeAll(async () => { for (const id of ids) { const p = resolvePaths(id); await fs.mkdir(p.sandbox, { recursive: true }); await fs.writeFile(path.join(p.sandbox, "data.csv"), `sample_id,value\n${id},<1\n`); } });
afterAll(async () => { await app.close(); for (const id of ids) await fs.rm(resolvePaths(id).root, { recursive: true, force: true }); });
it("uses request project scope for files and ignores a body project override", async () => {
  for (const id of ids) {
    const res = await app.inject({ method: "POST", url: "/geo/tables/inspect", headers: { "x-project-id": id }, payload: { path: "data.csv", projectId: "not-used", mapping: { sample_id: 0 } } });
    expect(res.statusCode).toBe(200); expect(res.json().projectId).toBe(id); expect(res.json().preview[0].values).toEqual([id, "<1"]);
  }
});
it("maps invalid body and sandbox failures without successful assessment payloads", async () => {
  for (const [payload, status] of [[null, 400], [{ path: "../x.csv" }, 403], [{ path: ".pi/x.csv" }, 404], [{ path: "missing.csv" }, 404], [{ path: "data.csv", mapping: { value: -1 } }, 400]] as const) {
    const res = await app.inject({ method: "POST", url: "/geo/tables/inspect", payload }); expect(res.statusCode).toBe(status); expect(res.json().schemaVersion).toBeUndefined();
  }
});

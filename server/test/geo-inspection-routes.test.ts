import fs from "node:fs";
import Fastify from "fastify";
import { beforeEach, afterEach, expect, it } from "vitest";
import { registerGeoInspectionRoutes } from "../src/geo/routes/inspection.ts";
import { resolvePaths } from "../src/projects.ts";
import { withActiveProject } from "../src/scope.ts";
import { las2 } from "./fixtures/geo/factories.ts";
const app = Fastify();
app.addHook("onRequest", (req, _reply, done) => withActiveProject(String(req.headers["x-project-id"] ?? "inspect-a"), done));
await registerGeoInspectionRoutes(app);
beforeEach(() => { for (const id of ["inspect-a", "inspect-b"]) { fs.mkdirSync(resolvePaths(id).sandbox, { recursive: true }); fs.writeFileSync(`${resolvePaths(id).sandbox}/log.las`, id === "inspect-a" ? las2 : las2.replace("STRT.M 100", "STRT.M 900")); } });
afterEach(() => { for (const id of ["inspect-a", "inspect-b"]) fs.rmSync(resolvePaths(id).root, { recursive: true, force: true }); });
it("uses the active project and caps preview rows without accepting a body project override", async () => {
  const a = await app.inject({ method: "POST", url: "/geo/inspect", headers: { "x-project-id": "inspect-a" }, payload: { path: "log.las", projectId: "inspect-b", previewRows: 5000 } });
  expect(a.statusCode).toBe(200); expect(a.json().asset.projectId).toBe("inspect-a"); expect(a.json().depth.start).toBe(100);
  const b = await app.inject({ method: "POST", url: "/geo/inspect", headers: { "x-project-id": "inspect-b" }, payload: { path: "log.las" } }); expect(b.json().depth.start).toBe(900);
});
it("maps invalid requests/paths to sandbox-compatible 400/403/404", async () => {
  for (const [payload, status] of [[{}, 400], [{ path: "log.las", previewRows: -1 }, 400], [{ path: "log.las", previewRows: "5" }, 400], [{ path: "../outside" }, 403], [{ path: ".pi/x" }, 404], [{ path: "absent" }, 404], [{ path: "." }, 400]] as const) {
    const res = await app.inject({ method: "POST", url: "/geo/inspect", payload }); expect(res.statusCode).toBe(status);
  }
});

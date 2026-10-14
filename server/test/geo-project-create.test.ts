import fs from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/index.ts";
import { PROJECTS_ROOT } from "../src/config.ts";
import { setNewProjectProvisionerForTests } from "../src/api/projects.ts";
import { getProject } from "../src/projects.ts";

const app = await buildApp();

beforeEach(() => {
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
});
afterEach(() => setNewProjectProvisionerForTests(null));
afterAll(async () => {
  await app.close();
  fs.rmSync(PROJECTS_ROOT, { recursive: true, force: true });
});

describe("POST /projects geo provisioning", () => {
  it("provisions the new project before replying", async () => {
    const provisioned: string[] = [];
    setNewProjectProvisionerForTests(async (id) => {
      // The project exists on disk when the provisioner runs.
      expect(getProject(id)).not.toBeNull();
      provisioned.push(id);
    });
    const res = await app.inject({ method: "POST", url: "/projects", payload: { name: "Geo trial" } });
    expect(res.statusCode).toBe(201);
    expect(provisioned).toEqual([res.json().id]);
  });

  it("still creates the project when provisioning fails", async () => {
    setNewProjectProvisionerForTests(async () => {
      throw new Error("catalogue archive missing");
    });
    const res = await app.inject({ method: "POST", url: "/projects", payload: { name: "Geo fallback" } });
    expect(res.statusCode).toBe(201);
    expect(getProject(res.json().id)).not.toBeNull();
  });
});

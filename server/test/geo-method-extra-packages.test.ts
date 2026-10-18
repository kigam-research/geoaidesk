import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { GeoCatalogue } from "../src/geo/catalogue.ts";
import { extraPackages } from "../src/geo/methods/extra-packages.ts";

const catalogue = {
  index: { skills: [] },
  environments: {
    environments: [
      { id: "geo-core", title: { ko: "기본" }, targets: ["project"], packages: [{ name: "pandas", imports: ["pandas"] }], tools: [] },
      { id: "geo-mpm", title: { ko: "MPM" }, targets: ["project"], extends: "geo-core", packages: [{ name: "xgboost", imports: ["xgboost"] }], tools: [] },
    ],
  },
} as unknown as GeoCatalogue;

function method(atlas: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-extra-"));
  fs.writeFileSync(path.join(dir, "atlas.yaml"), atlas);
  return dir;
}

describe("extraPackages", () => {
  it("lists declared packages the Workflow environment does not install", () => {
    const dir = method(`dependencies:
  - {name: xgboost, kind: required}
  - {name: pandas, kind: required}
  - {name: numpy, kind: required}
  - {name: Scikit_Gstat, kind: required}
  - {name: shap, kind: optional}
  - {name: python, kind: runtime}
`);
    expect(extraPackages(dir, catalogue, "geo-mpm")).toEqual([
      { name: "scikit-gstat", required: true },
      { name: "shap", required: false },
    ]);
  });
  it("returns nothing for an unknown environment or a missing atlas.yaml", () => {
    expect(extraPackages(method("dependencies: []\n"), catalogue, "nope")).toEqual([]);
    expect(extraPackages(fs.mkdtempSync(path.join(os.tmpdir(), "gaid-extra-")), catalogue, "geo-core")).toEqual([]);
  });
});

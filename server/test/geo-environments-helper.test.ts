import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { cataloguePin, loadGeoCatalogue, locateArchive } from "../src/geo/catalogue.ts";
import { environmentPackages, requiredEnvironments } from "../src/geo/environments.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pin = cataloguePin(root);
let archive: string | null = null;
try { if (pin) archive = locateArchive(pin, process.env, root); } catch { /* visible test skip on hosts without the pinned asset */ }

it.skipIf(!archive)("helper pyproject declares every helper package and lower bound in the pinned catalogue (SKIPPED when asset absent)", () => {
  const catalogue = loadGeoCatalogue({ repoRoot: root, env: { ...process.env, GAID_CATALOGUE: "on", GAID_CATALOGUE_ARCHIVE: archive! } });
  expect(catalogue.environments).not.toBeNull();
  const text = fs.readFileSync(path.join(root, "server/src/helpers/pyproject.toml"), "utf8");
  const project = text.split(/^\[project\]\s*$/m)[1].split(/^\[/m)[0];
  const array = project.match(/^dependencies\s*=\s*\[([\s\S]*?)\]/m)?.[1];
  expect(array).toBeDefined();
  const declarations = [...array!.matchAll(/"([^"\n]+)"/g)].map((match) => match[1]);
  for (const pkg of environmentPackages(requiredEnvironments(catalogue.environments!, "helper"))) {
    expect(declarations, `Missing helper distribution ${pkg.name}${pkg.version ?? ""}`).toContain(pkg.name + (pkg.version ?? ""));
  }
  expect(text).toContain('requires-python = ">=3.11"');
  const required = text.match(/^required-environments\s*=\s*\[([\s\S]*?)\]/m)?.[1];
  expect(required).toBeDefined();
  const markers = [...required!.matchAll(/"([^"\n]+)"/g)].map((match) => match[1]);
  expect(markers).toEqual([
    "sys_platform == 'darwin' and platform_machine == 'x86_64' and python_version == '3.12'",
    "sys_platform == 'darwin' and platform_machine == 'arm64' and python_version == '3.12'",
    "sys_platform == 'win32' and platform_machine == 'AMD64' and python_version == '3.12'",
    "sys_platform == 'linux' and platform_machine == 'x86_64' and python_version == '3.12'",
  ]);
});

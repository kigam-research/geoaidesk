/**
 * Python packages an installed method declares (atlas.yaml `dependencies`) that its Workflow's catalogue environment
 * does not install. GAID prepares only the catalogue environment, so the hub's preparation step lists these and says
 * the AI agent installs them during the run (the package check requires SKILL.md to give the install command).
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

import type { GeoCatalogue } from "../catalogue.ts";
import { environmentClosure } from "../environments.ts";
import { distributionOf, normalizeDependency, withBundled } from "../authoring/python.ts";
import type { MethodExtraPackage } from "../../../../web/src/geo/contracts/methods.ts";

const MAX_PACKAGES = 24;

export function extraPackages(methodDir: string, catalogue: GeoCatalogue | null, environmentId: string): MethodExtraPackage[] {
  const data = catalogue?.environments;
  if (!data?.environments.some((env) => env.id === environmentId)) return [];
  let deps: unknown;
  try {
    deps = (parse(fs.readFileSync(path.join(methodDir, "atlas.yaml"), "utf8")) as { dependencies?: unknown } | null)?.dependencies;
  } catch {
    return [];
  }
  if (!Array.isArray(deps)) return [];
  let installed: Set<string>;
  try {
    installed = withBundled(environmentClosure(data, environmentId).flatMap((env) => env.packages.map((pkg) => pkg.name)));
  } catch {
    return [];
  }
  const out: MethodExtraPackage[] = [];
  const seen = new Set<string>();
  for (const dep of deps) {
    if (!dep || typeof dep !== "object") continue;
    const { name, kind } = dep as { name?: unknown; kind?: unknown };
    if (typeof name !== "string" || (kind !== "required" && kind !== "optional")) continue;
    const n = normalizeDependency(name);
    if (!n || seen.has(n) || installed.has(n) || installed.has(distributionOf(n))) continue;
    seen.add(n);
    out.push({ name: n, required: kind === "required" });
    if (out.length >= MAX_PACKAGES) break;
  }
  return out;
}

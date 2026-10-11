/**
 * The geo catalogue in the shape the upstream installer consumes
 * (`FetchedCatalogue` from agent/skills-fetch.ts). `commit` carries the
 * catalogue label, so each project's `skills-sync.json` records which pinned
 * catalogue it last applied.
 */
import type { CatalogueSkill, FetchedCatalogue } from "../agent/skills-fetch.ts";
import { geoCatalogueActive, geoCatalogueSkillDirs, loadGeoCatalogue } from "./catalogue.ts";

export { geoCatalogueActive };

export async function fetchGeoCatalogue(): Promise<FetchedCatalogue> {
  const catalogue = loadGeoCatalogue();
  const skills = new Map<string, CatalogueSkill>();
  for (const [name, dir] of geoCatalogueSkillDirs(catalogue)) skills.set(name, { dir });
  // The staged tree is shared and re-verified per process; nothing to release.
  return { skills, commit: catalogue.label, cleanup: () => {} };
}

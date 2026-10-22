/**
 * Vocabularies the coauthor and the checks use: Atlas taxonomy terms (vendored in geo/hub/taxonomy, see
 * geo/hub/SOURCE.md) and the environments and skill names of GAID's pinned geo catalogue. No skill_hub
 * checkout is read at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "../../config.ts";
import { geoCatalogueActive, loadGeoCatalogue } from "../catalogue.ts";

export type TaxonomyFacet = "disciplines" | "tasks" | "dataTypes" | "formats" | "scales";
export interface TaxonTerm {
  id: string;
  label: string | { ko: string; en?: string };
}
export type Taxonomy = Record<TaxonomyFacet, TaxonTerm[]>;

export interface VocabularyEnvironment {
  id: string;
  purpose: string;
  /** Distribution names installed by the environment and the ones it extends. */
  packages: string[];
  /** Import names those distributions provide (when the catalogue lists them). */
  imports: string[];
}

export interface Vocabulary {
  taxonomy: Taxonomy;
  environments: VocabularyEnvironment[];
  /** Runtime names of catalogue skills (a new slug must differ). */
  catalogueNames: Set<string>;
  /** Atlas ids of catalogue skills (Workflow skillIds may reference them). */
  catalogueIds: Set<string>;
  /** Slugs already packaged by other authoring projects. */
  hubNames?: Set<string>;
  /** Hub shelf skills the researcher chose for this draft (gaid-hub-skills); bound as `source: "hub"` pins. */
  hubChosen?: { name: string; description: string; revision: number; treeHash: string }[];
}

export const HUB_INPUTS_DIR = path.join(REPO_ROOT, "geo", "hub");

let taxonomyCache: Taxonomy | undefined;
export function loadTaxonomy(dir = path.join(HUB_INPUTS_DIR, "taxonomy")): Taxonomy {
  if (taxonomyCache && dir === path.join(HUB_INPUTS_DIR, "taxonomy")) return taxonomyCache;
  const taxonomy: Taxonomy = { disciplines: [], tasks: [], dataTypes: [], formats: [], scales: [] };
  for (const name of fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".yaml"))
    .sort()) {
    const doc = parse(fs.readFileSync(path.join(dir, name), "utf8")) as { facet: TaxonomyFacet; terms: TaxonTerm[] };
    if (doc?.facet in taxonomy) taxonomy[doc.facet] = doc.terms ?? [];
  }
  if (dir === path.join(HUB_INPUTS_DIR, "taxonomy")) taxonomyCache = taxonomy;
  return taxonomy;
}

interface CatalogueEnvironment {
  id: string;
  extends?: string;
  purpose?: { ko?: string; en?: string } | string;
  packages?: { name: string; imports?: string[] }[];
}

/** Environments in the catalogue's geo-environments/v1 shape → closure of packages per environment. */
export function environmentVocabulary(environments: CatalogueEnvironment[]): VocabularyEnvironment[] {
  const byId = new Map(environments.map((e) => [e.id, e]));
  const closure = (id: string, seen = new Set<string>()): { name: string; imports?: string[] }[] => {
    const e = byId.get(id);
    if (!e || seen.has(id)) return [];
    seen.add(id);
    return [...(e.packages ?? []), ...(e.extends ? closure(e.extends, seen) : [])];
  };
  return environments.map((e) => {
    const packages = closure(e.id);
    return {
      id: e.id,
      purpose: typeof e.purpose === "string" ? e.purpose : (e.purpose?.en ?? e.purpose?.ko ?? ""),
      packages: [...new Set(packages.map((p) => p.name))].sort(),
      imports: [...new Set(packages.flatMap((p) => p.imports ?? []))].sort(),
    };
  });
}

/** The vocabulary from the pinned catalogue; empty catalogue parts when the catalogue is off. */
export function loadVocabulary(): Vocabulary {
  const taxonomy = loadTaxonomy();
  if (!geoCatalogueActive()) return { taxonomy, environments: [], catalogueNames: new Set(), catalogueIds: new Set() };
  const catalogue = loadGeoCatalogue();
  const envs = (catalogue.environments?.environments ?? []) as unknown as CatalogueEnvironment[];
  return {
    taxonomy,
    environments: environmentVocabulary(envs),
    catalogueNames: new Set(catalogue.index.skills.map((s) => s.runtimeName).filter(Boolean)),
    catalogueIds: new Set(catalogue.index.skills.map((s) => s.id)),
  };
}

export function vocabularyText(v: Vocabulary): string {
  const terms = (facet: TaxonomyFacet) =>
    v.taxonomy[facet]
      .map((t) => `${t.id} (${typeof t.label === "string" ? t.label : (t.label.en ?? t.label.ko)})`)
      .join(", ");
  return [
    `disciplines: ${terms("disciplines")}`,
    `tasks: ${terms("tasks")}`,
    `dataTypes (also input semanticType): ${terms("dataTypes")}`,
    `formats (input/output/inputRole formats): ${terms("formats")}`,
    `methods: free kebab-case ids`,
    `output kinds: map-raster, map-vector, figure, table, report, model, document, dataset, log`,
    `environmentProfile (id: purpose; Python packages it installs): ${v.environments
      .map((e) => `${e.id}: ${e.purpose}; ${e.packages.join(", ") || "none"}`)
      .join(" | ")}`,
    `catalogue skill ids (runtime name = final path segment): ${[...v.catalogueIds].sort().join(", ")}`,
    `existing catalogue skill names (slug must differ): ${[...v.catalogueNames].sort().join(", ")}`,
    ...(v.hubChosen?.length
      ? [`hub skills the researcher chose (add each as source "hub", role "supporting"; name it in the steps that use it): ${v.hubChosen.map((s) => `${s.name}: ${s.description}`).join(" | ")}`]
      : []),
  ].join("\n");
}

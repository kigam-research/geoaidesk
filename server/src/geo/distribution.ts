/**
 * GeoAIDesk distribution manifest (`geo/distribution.json`) as the backend
 * reads it. Kept dependency-free and synchronous because `config.ts` uses it
 * at import time. A missing manifest means an upstream checkout: no policy.
 * A malformed one throws, because silently ignoring it would fetch sources
 * the distribution excludes.
 */
import fs from "node:fs";
import path from "node:path";

export interface CatalogueExclusion {
  /** `owner/repo` of the excluded source. */
  repo: string;
  /** Skill names to drop from that source; absent = the whole source. */
  skills?: string[];
  reason: string;
}

export interface DistributionRelease {
  repository: string;
  releaseTagPrefix: string;
  version: string;
}

export const DISTRIBUTION_FILE = path.join("geo", "distribution.json");

function readManifest(repoRoot: string): Record<string, unknown> | null {
  const file = path.join(repoRoot, DISTRIBUTION_FILE);
  let text: string;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${file}: expected a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/** `catalogue.excludedSources` of the manifest, validated. */
export function readDistributionExclusions(repoRoot: string): CatalogueExclusion[] {
  const manifest = readManifest(repoRoot);
  if (!manifest) return [];
  const catalogue = manifest.catalogue as { excludedSources?: unknown } | undefined;
  const raw = catalogue?.excludedSources ?? [];
  if (!Array.isArray(raw)) {
    throw new Error(`${DISTRIBUTION_FILE}: catalogue.excludedSources must be an array`);
  }
  return raw.map((entry, index) => {
    const where = `${DISTRIBUTION_FILE}: catalogue.excludedSources[${index}]`;
    if (!entry || typeof entry !== "object") throw new Error(`${where} must be an object`);
    const { repo, skills, reason } = entry as Record<string, unknown>;
    if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new Error(`${where}.repo must be "owner/repo"`);
    }
    if (skills !== undefined && (!Array.isArray(skills) || !skills.every((s) => typeof s === "string"))) {
      throw new Error(`${where}.skills must be an array of skill names`);
    }
    if (typeof reason !== "string" || !reason.trim()) throw new Error(`${where}.reason is required`);
    return { repo, ...(skills ? { skills: skills as string[] } : {}), reason };
  });
}

/** Release identity used by the update check; null in an upstream checkout. */
export function readDistributionRelease(repoRoot: string): DistributionRelease | null {
  const manifest = readManifest(repoRoot);
  if (!manifest) return null;
  const { repository, releaseTagPrefix, version } = manifest;
  if (typeof repository !== "string" || typeof version !== "string") {
    throw new Error(`${DISTRIBUTION_FILE}: repository and version are required`);
  }
  return {
    repository,
    releaseTagPrefix: typeof releaseTagPrefix === "string" ? releaseTagPrefix : "v",
    version,
  };
}

/**
 * Drop excluded skills from catalogue sources; a source left without skills
 * is dropped. Repository names compare case-insensitively, like GitHub.
 */
export function applyCatalogueExclusions<T extends { repo: string; skills: readonly string[] }>(
  sources: readonly T[],
  exclusions: readonly CatalogueExclusion[],
): T[] {
  const out: T[] = [];
  for (const source of sources) {
    const rules = exclusions.filter((rule) => rule.repo.toLowerCase() === source.repo.toLowerCase());
    if (rules.some((rule) => !rule.skills)) continue;
    const dropped = new Set(rules.flatMap((rule) => rule.skills ?? []));
    const skills = source.skills.filter((name) => !dropped.has(name));
    if (skills.length > 0) out.push({ ...source, skills });
  }
  return out;
}

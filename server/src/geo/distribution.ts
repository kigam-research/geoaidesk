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
  /** `preview` (default) publishes GitHub prereleases; `stable` does not. */
  channel: string;
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

/** `productName` of the manifest; null in an upstream checkout or when unset. */
export function readDistributionProductName(repoRoot: string): string | null {
  const name = readManifest(repoRoot)?.productName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Release identity used by the update check; null in an upstream checkout. */
export function readDistributionRelease(repoRoot: string): DistributionRelease | null {
  const manifest = readManifest(repoRoot);
  if (!manifest) return null;
  const { repository, releaseTagPrefix, version, channel } = manifest;
  if (typeof repository !== "string" || typeof version !== "string") {
    throw new Error(`${DISTRIBUTION_FILE}: repository and version are required`);
  }
  return {
    repository,
    releaseTagPrefix: typeof releaseTagPrefix === "string" ? releaseTagPrefix : "v",
    version,
    channel: typeof channel === "string" ? channel : "preview",
  };
}

/** `[major, minor, patch, prerelease?]` of a semver string, or null. */
function parseVersion(value: string): [number, number, number, string | null] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ?? null] : null;
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] as number) - (pb[i] as number);
  if (pa[3] === pb[3]) return 0;
  if (pa[3] === null) return 1;
  if (pb[3] === null) return -1;
  return pa[3] < pb[3] ? -1 : 1;
}

/**
 * The newest app version among GitHub releases (`GET /repos/{repo}/releases`):
 * published (not draft) releases whose tag is `<prefix><semver>`. GitHub's
 * `/releases/latest` skips prereleases, and a preview channel publishes only
 * prereleases, so it would never report an update; other tags in the same
 * repository (e.g. the catalogue release `geo-catalogue-0.2.1`) are ignored.
 */
export function pickLatestRelease(
  releases: readonly { tag_name?: unknown; draft?: unknown; prerelease?: unknown }[],
  prefix: string,
  includePrereleases: boolean,
): string | null {
  let best: string | null = null;
  for (const release of releases) {
    if (release.draft === true || typeof release.tag_name !== "string") continue;
    if (release.prerelease === true && !includePrereleases) continue;
    if (!release.tag_name.startsWith(prefix)) continue;
    const version = release.tag_name.slice(prefix.length);
    if (!parseVersion(version)) continue;
    if (best === null || compareVersions(version, best) > 0) best = version;
  }
  return best;
}

/** The catalogue archive a distribution pins (`catalogue.status: "pinned"`). */
export interface CataloguePin {
  version: string;
  /** Archive file name, e.g. `geo-catalogue-0.2.0.tar.gz`. */
  archive: string;
  sha256: string;
}

/**
 * `catalogue` of the manifest when it pins an archive; null in an upstream
 * checkout or while the status is `pending`. A pinned entry with missing or
 * malformed fields throws: a half-pinned catalogue must not fall back to the
 * upstream sources silently.
 */
export function readDistributionCatalogue(repoRoot: string): CataloguePin | null {
  const manifest = readManifest(repoRoot);
  const catalogue = manifest?.catalogue as Record<string, unknown> | undefined;
  if (!catalogue || catalogue.status !== "pinned") return null;
  const { version, archive, sha256 } = catalogue;
  const where = `${DISTRIBUTION_FILE}: catalogue`;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+([-+][\w.-]+)?$/.test(version)) {
    throw new Error(`${where}.version must be a semver string`);
  }
  if (typeof archive !== "string" || !/^[\w.-]+\.tar\.gz$/.test(archive)) {
    throw new Error(`${where}.archive must be a .tar.gz file name`);
  }
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(`${where}.sha256 must be a lower-case sha256 hex digest`);
  }
  return { version, archive, sha256 };
}

/** Manifest identity of the geo catalogue in each project's `skills-sync.json`. */
export const GEO_CATALOGUE_REPO = "geo-catalogue";
export const GEO_CATALOGUE_BRANCH = "release";

/**
 * Geo catalogue mode: the distribution pins an archive, `GAID_CATALOGUE` is not
 * `off`, and the user did not point `KADY_SKILLS_REPO` at another catalogue.
 * When active, the archive replaces the upstream catalogue sources.
 */
export function geoCatalogueEnabled(repoRoot: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.GAID_CATALOGUE?.trim().toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  if (env.KADY_SKILLS_REPO?.trim()) return false;
  return readDistributionCatalogue(repoRoot) !== null;
}

/** Distribution-only feature policy, also safe to import in detached child runners.
 * The launcher marker distinguishes start-gaid from the upstream dev launchers.
 * No credentials/config module is loaded here. Existing project data is untouched.
 */
export function remoteComputeEnabled(
  repoRoot = path.resolve(import.meta.dirname, "../../.."),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.GAID_DISTRIBUTION !== "1" || !geoCatalogueEnabled(repoRoot, env)) return true;
  const features = readManifest(repoRoot)?.features as { remoteCompute?: unknown } | undefined;
  const value = features?.remoteCompute;
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`${DISTRIBUTION_FILE}: features.remoteCompute must be a boolean`);
  }
  return value !== false;
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

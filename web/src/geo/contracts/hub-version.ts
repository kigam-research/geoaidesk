/**
 * Hub Workflow versions (gaid-hub-versions; user decisions 2026-10-23): the term "version" replaces 판. A first registration
 * is 0.1.0; each update the registrant chooses a patch, minor or major step (1.0.0 = the main release). Revisions registered
 * before versions read 0.1.0, 0.1.1, 0.1.2 … in order. IO-free; server and web import it.
 */

export type HubVersionBump = "patch" | "minor" | "major";
export const HUB_VERSION_BUMPS: readonly HubVersionBump[] = ["patch", "minor", "major"];
/** Version of a first registration; 1.0.0 is the main release the registrant declares with a `major` step. */
export const FIRST_HUB_VERSION = "0.1.0";
const SEMVER = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;

export function parseHubVersion(value: unknown): [number, number, number] | null {
  const m = typeof value === "string" ? SEMVER.exec(value) : null;
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** patch 0.1.2 → 0.1.3, minor 0.1.2 → 0.2.0, major 0.1.2 → 1.0.0. */
export function bumpHubVersion(version: string, bump: HubVersionBump): string {
  const v = parseHubVersion(version);
  if (!v) throw new Error(`Not a hub version: ${version}`);
  const [major, minor, patch] = v;
  return bump === "major" ? `${major + 1}.0.0` : bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

/** The versions an update may take after `current` (null: nothing registered yet, only the first version). */
export function nextHubVersions(current: string | null): Record<HubVersionBump, string> | null {
  return current === null ? null : {
    patch: bumpHubVersion(current, "patch"),
    minor: bumpHubVersion(current, "minor"),
    major: bumpHubVersion(current, "major"),
  };
}

/**
 * Effective version of each revision, in order: the stored `version`, else (revisions registered before versions existed)
 * the previous one's patch step, the first 0.1.0. Revisions 1, 2, 3 of an older record read 0.1.0, 0.1.1, 0.1.2.
 */
export function hubRevisionVersions(revisions: readonly { version?: string }[]): string[] {
  const out: string[] = [];
  for (const r of revisions) {
    const previous = out.at(-1);
    out.push(parseHubVersion(r.version) ? r.version! : previous ? bumpHubVersion(previous, "patch") : FIRST_HUB_VERSION);
  }
  return out;
}

/** The version of revision `n` (default: the latest) of an entry, or null when it has no such revision. */
export function hubVersionOf(entry: { revisions: readonly { revision: number; version?: string }[] }, revision?: number): string | null {
  const versions = hubRevisionVersions(entry.revisions);
  const index = revision === undefined ? versions.length - 1 : entry.revisions.findIndex((r) => r.revision === revision);
  return index >= 0 ? (versions[index] ?? null) : null;
}

/** Older install records and draft links carry only the revision number; before versions, revision n was 0.1.(n-1). */
export const legacyHubVersion = (revision: number): string => `0.1.${Math.max(0, revision - 1)}`;

/** Is `next` one allowed step after `current` (first registration: exactly 0.1.0)? */
export function allowedHubVersion(current: string | null, next: string): boolean {
  if (current === null) return next === FIRST_HUB_VERSION;
  return HUB_VERSION_BUMPS.some((bump) => bumpHubVersion(current, bump) === next);
}

/** Version of a recorded hub reference (install origin, draft link); older records carry only the revision. */
export function hubRefVersion(ref: { revision: number; version?: string } | null | undefined): string | null {
  if (!ref) return null;
  return parseHubVersion(ref.version) ? ref.version! : legacyHubVersion(ref.revision);
}

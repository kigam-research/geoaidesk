/**
 * Where a catalogue skill was taken from (gaid-brand-copy). Skills that came
 * from another project's repository — the K-Dense scientific-agent-skills in
 * particular — name that source wherever the skill is shown; GAID/KIGAM-owned
 * catalogue skills have none.
 *
 * Geo catalogue mode reads the pinned index (`sourceRevision.kind: "import"`
 * with repository, commit and path). Upstream catalogue mode (development
 * launchers) attributes catalogue skills to the configured catalogue
 * repository, or to the named extra source recorded on the skill.
 */
import { GEO_CATALOGUE_MODE, SKILLS_REPO } from "../config.ts";
import { loadGeoCatalogue, type GeoCatalogue } from "./catalogue.ts";

export interface SkillUpstream {
  /** Display name of the source project, e.g. "K-Dense". */
  name: string;
  /** `owner/repo` on GitHub. */
  repository: string;
  /** Link to the source: the skill folder at the imported commit when known. */
  url: string;
}

/** GitHub owners with a project name users know; any other source shows `owner/repo`. */
const KNOWN_OWNERS: Record<string, string> = { "K-Dense-AI": "K-Dense" };

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function upstreamFor(repository: string, commit?: string, folder?: string): SkillUpstream | undefined {
  if (!REPO_RE.test(repository)) return undefined;
  const owner = repository.split("/")[0];
  const base = `https://github.com/${repository}`;
  const url =
    commit && /^[0-9a-f]{7,40}$/.test(commit) && folder && !folder.split("/").includes("..")
      ? `${base}/tree/${commit}/${folder.split("/").map(encodeURIComponent).join("/")}`
      : base;
  return { name: KNOWN_OWNERS[owner] ?? repository, repository, url };
}

interface ImportRevision {
  kind?: unknown;
  repository?: unknown;
  commit?: unknown;
  path?: unknown;
}

/** runtimeName → source for every imported skill of a geo catalogue. */
export function geoCatalogueUpstreams(catalogue: Pick<GeoCatalogue, "index">): Map<string, SkillUpstream> {
  const out = new Map<string, SkillUpstream>();
  for (const skill of catalogue.index.skills) {
    const rev = skill.sourceRevision as ImportRevision | undefined;
    if (rev?.kind !== "import" || typeof rev.repository !== "string") continue;
    const upstream = upstreamFor(
      rev.repository,
      typeof rev.commit === "string" ? rev.commit : undefined,
      typeof rev.path === "string" ? rev.path : undefined,
    );
    if (upstream) out.set(skill.runtimeName, upstream);
  }
  return out;
}

/**
 * Resolver for one listing: `(name, origin, source?) → SkillUpstream | undefined`.
 * Never throws; a catalogue that cannot be loaded attributes nothing.
 */
export function skillUpstreamResolver(
  options: { geoMode?: boolean; skillsRepo?: string; load?: () => Pick<GeoCatalogue, "index"> } = {},
): (name: string, origin: string, source?: string) => SkillUpstream | undefined {
  const geoMode = options.geoMode ?? GEO_CATALOGUE_MODE;
  if (geoMode) {
    let map: Map<string, SkillUpstream>;
    try {
      map = geoCatalogueUpstreams((options.load ?? loadGeoCatalogue)());
    } catch {
      map = new Map();
    }
    return (name, origin) => (origin === "catalogue" ? map.get(name) : undefined);
  }
  const repo = options.skillsRepo ?? SKILLS_REPO;
  return (_name, origin, source) => (origin === "catalogue" ? upstreamFor(source ?? repo) : undefined);
}

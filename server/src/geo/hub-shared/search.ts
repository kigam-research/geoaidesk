import type { AtlasTextInput, MethodDraft } from "../../../../web/src/geo/contracts/authoring.ts";
import type { HubEntry } from "../../../../web/src/geo/contracts/hub-shared.ts";

/** Small commodity vocabulary, not stemming or scientific equivalence between different commodities. */
const ALIASES = [
  ["니켈", "ni", "nickel"], ["구리", "cu", "copper"], ["금", "au", "gold"],
  ["은", "ag", "silver"], ["아연", "zn", "zinc"], ["납", "pb", "lead"],
  ["리튬", "li", "lithium"], ["코발트", "co", "cobalt"],
  ["백금족", "pge", "platinum group", "platinum group elements", "platinum-group", "platinum-group-elements"],
  ["희토류", "ree", "rare earth", "rare earth elements", "rare-earth", "rare-earth-elements"],
  ["철", "fe", "iron"], ["우라늄", "u", "uranium"], ["텅스텐", "w", "tungsten"],
  ["몰리브덴", "mo", "molybdenum"], ["주석", "sn", "tin"], ["흑연", "graphite"],
];
const aliases = new Map(ALIASES.flatMap((group) => group.map((term) => [term, group] as const)));
const texts = (value: AtlasTextInput | undefined): string[] =>
  typeof value === "string" ? [value] : Object.values(value ?? {});

/** All query words must occur, but may occur in different fields or languages. */
export function matchesHubSearch(query: string, fields: string[]): boolean {
  const haystack = fields.join(" ").normalize("NFKC").toLowerCase();
  let normalized = query.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
  // Keep known multiword English commodity names together before the AND-word split.
  for (const [term, group] of [...aliases].filter(([term]) => term.includes(" ")).sort(([a], [b]) => b.length - a.length)) {
    normalized = normalized.replace(new RegExp(`\\b${term}\\b`, "g"), group[0]);
  }
  return normalized.split(/\s+/).filter(Boolean).every((word) =>
    (aliases.get(word) ?? [word]).some((term) =>
      // Short symbols/acronyms must not match the middle of an English word (Ni vs unlabelled).
      /^[a-z]{1,3}$/.test(term) ? new RegExp(`\\b${term}\\b`).test(haystack) : haystack.includes(term),
    ),
  );
}

/** Search only the registered snapshot, never a later private draft or generated code. */
export function hubSearchFields(
  entry: Pick<HubEntry, "title" | "summary" | "author" | "tags">,
  draft: MethodDraft,
  taxonomyLabels: Map<string, string>,
): string[] {
  const p = draft.profile;
  return [
    entry.title, entry.summary, entry.author, ...entry.tags, draft.description,
    ...texts(p.title), ...texts(p.tagline), ...texts(p.summary), ...texts(draft.workflow?.description),
    ...Object.values(p.taxonomy).flat().flatMap((id) => [id, taxonomyLabels.get(id) ?? ""]),
    ...(p.inputs ?? []).flatMap((input) => [...texts(input.label), ...texts(input.description)]),
    ...p.outputs.flatMap((output) => [...texts(output.label), ...texts(output.interpretation)]),
    ...p.limitations.flatMap((limit) => [...texts(limit.text), ...texts(limit.consequence), ...texts(limit.alternative)]),
  ];
}

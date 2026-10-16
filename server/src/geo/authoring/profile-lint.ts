/**
 * Atlas profile (`atlas.yaml`, atlas-profile/v1) of an authored package and the lints that apply to one profile:
 * the per-profile part of skill_hub's catalogue compile (web/shared/atlas/compile.ts at 54fe477) without cases,
 * evidence records or the rest of the catalogue.
 */
import type { AtlasTextInput, DraftProfile } from "../../../../web/src/geo/contracts/authoring.ts";
import type { Taxonomy, TaxonomyFacet } from "./vocabulary.ts";

export interface LicenseEntry {
  component: string;
  declared: string;
  spdx?: string;
  noticeFile?: string;
  paths?: string[];
}

export interface AtlasProfile extends DraftProfile {
  schemaVersion: "atlas-profile/v1";
  id: string;
  source: { kind: "owned" | "import"; path: string; upstreamVersion?: string };
  release: { atlasVersion: string; state: string };
  credits: { publisher: string; authors: { name: string }[]; citation?: string };
  licenses: LicenseEntry[];
}

export interface LintFinding {
  level: "error" | "warning";
  code: string;
  path: string;
  message: { ko: string };
}

const ko = (value: AtlasTextInput) => (typeof value === "string" ? value : value.ko);

export function lintProfile(
  raw: AtlasProfile,
  taxonomy: Taxonomy,
  at: string,
  skillMd: { name: string; version: string; license: string },
): LintFinding[] {
  const findings: LintFinding[] = [];
  const find = (level: LintFinding["level"], code: string, path: string, message: string) =>
    findings.push({ level, code, path, message: { ko: message } });
  const slug = raw.id.split("/")[1] ?? "";
  const terms = Object.fromEntries(
    (Object.keys(taxonomy) as TaxonomyFacet[]).map((facet) => [facet, new Set(taxonomy[facet].map((t) => t.id))]),
  ) as Record<TaxonomyFacet, Set<string>>;

  if (skillMd.name !== slug) find("error", "skill-name", at, "패키지 name과 스킬 id가 다릅니다");
  if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(skillMd.version))
    find("error", "skill-version", at, "SKILL.md metadata.version에 문자열 semver가 필요합니다");
  if (!skillMd.license) find("error", "skill-license", at, "SKILL.md license가 필요합니다");
  for (const component of ["skill-text", "code"])
    if (!raw.licenses.some((l) => l.component === component))
      find("error", "license-component", at, `${component} 이용 조건이 필요합니다`);
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) find("error", "duplicate-id", at, `${label} id가 중복됩니다`);
  };
  unique(
    raw.procedure.nodes.map((n) => n.id),
    "단계",
  );
  unique([...(raw.inputs ?? []).map((n) => n.id), ...raw.outputs.map((n) => n.id)], "입출력");
  unique(
    (raw.decisions ?? []).map((n) => n.id),
    "판단",
  );
  if (raw.source.kind === "owned" && !raw.source.path.endsWith(`/${slug}`))
    find("error", "owned-folder", at, `스킬 폴더 이름이 ${slug}와 다릅니다: ${raw.source.path}`);
  const facetChecks: [TaxonomyFacet, string[] | undefined, string][] = [
    ["disciplines", raw.taxonomy.disciplines, "taxonomy.disciplines"],
    ["tasks", raw.taxonomy.tasks, "taxonomy.tasks"],
    ["dataTypes", raw.taxonomy.dataTypes, "taxonomy.dataTypes"],
    ["formats", raw.taxonomy.formats, "taxonomy.formats"],
    ["scales", raw.taxonomy.scales, "taxonomy.scales"],
  ];
  for (const [facet, ids, path] of facetChecks)
    for (const id of ids ?? [])
      if (!terms[facet].has(id)) find("error", "taxonomy-unknown", `${at}#${path}`, `분류에 없는 값입니다: ${id}`);
  for (const input of raw.inputs ?? []) {
    if (!terms.dataTypes.has(input.semanticType))
      find(
        "error",
        "taxonomy-unknown",
        `${at}#inputs/${input.id}`,
        `분류에 없는 자료 종류입니다: ${input.semanticType}`,
      );
    for (const f of input.formats)
      if (!terms.formats.has(f))
        find("error", "taxonomy-unknown", `${at}#inputs/${input.id}`, `분류에 없는 형식입니다: ${f}`);
  }
  const nodeIds = new Set(raw.procedure.nodes.map((n) => n.id));
  const decisionIds = new Set((raw.decisions ?? []).map((d) => d.id));
  const portIds = new Set([...(raw.inputs ?? []).map((i) => i.id), ...raw.outputs.map((o) => o.id)]);
  if (raw.procedure.nodes.length < 3 || raw.procedure.nodes.length > 12)
    find("error", "procedure-size", `${at}#procedure`, "단계는 3–12개여야 합니다");
  for (const e of raw.procedure.edges)
    for (const end of [e.from, e.to])
      if (!nodeIds.has(end)) find("error", "edge-endpoint", `${at}#procedure/edges`, `없는 단계입니다: ${end}`);
  for (const n of raw.procedure.nodes) {
    for (const d of n.decisionIds ?? [])
      if (!decisionIds.has(d)) find("error", "decision-ref", `${at}#procedure/${n.id}`, `없는 판단 기준입니다: ${d}`);
    for (const port of [...(n.inputs ?? []), ...(n.outputs ?? [])])
      if (!portIds.has(port))
        find("warning", "port-ref", `${at}#procedure/${n.id}`, `입력·산출물 목록에 없는 값입니다: ${port}`);
  }
  for (const u of raw.userDecisions ?? [])
    if (u.at && !nodeIds.has(u.at))
      find("error", "user-decision-node", `${at}#userDecisions/${u.id}`, `없는 단계입니다: ${u.at}`);
  if (ko(raw.tagline).length > 90)
    find("warning", "tagline-length", `${at}#tagline`, "한 줄 기능은 90자 이내를 권장합니다");
  for (const output of raw.outputs)
    for (const f of output.formats ?? [])
      if (!terms.formats.has(f)) find("error", "taxonomy-unknown", at, `산출물 형식이 분류에 없습니다: ${f}`);
  for (const lic of raw.licenses)
    if (
      lic.spdx === undefined &&
      !/unknown|미지정|private|no code/i.test(lic.declared) &&
      lic.component !== "example-data"
    )
      find("warning", "license-spdx", `${at}#licenses/${lic.component}`, `SPDX 식별자가 없습니다: ${lic.declared}`);
  return findings;
}

# GAID builds its own catalogue releases

Status: accepted (2026-10-22, gaid-library-next)

## Context

The pinned geo catalogue archive (`geo/distribution.json` `catalogue`) was produced by skill_hub's
`web/scripts/export-byok.ts`. The 2026-10-20 Workflow ADR made skill_hub legacy and moved the Workflow format into GAID,
but left the catalogue archive "unchanged", so AGENTS.md, the distribution note and `configs/inputs.toml` still named
skill_hub as the producer. When gaid-research-hub#8 (literature skills) needed a new catalogue version, the writer sent the
work to skill_hub. The user asked (verbatim, 2026-10-22): "gaid-catalogue-0-3-0 작업을 왜 skill_hub 워크스페이스에
물어보는 것인가? 이제 GAID 허브와 시스템은 본 워크스페이스에서 모두 작업하고 있다. 잘못된 지침이 남아 있는 것인가?"

## Decision

Catalogue releases from 0.3.0 on are built in this repository by `geo/catalogue-build.mjs` from
`geo/catalogue-src/releases/<version>.json`:

- The previous pinned archive is the verified base (archive sha256 and every manifest file digest are checked). Its skills,
  workflows, data sources and examples carry over byte for byte unless the release file says otherwise.
- Added imported skills come from a named, pinned source asset (for K-Dense: `k_dense_scientific_agent_skills`,
  `K-Dense-AI/scientific-agent-skills@92ace75a`), checked against per-file hashes in `geo/catalogue-src/sources.lock.json`.
  The runtime package is the upstream skill folder plus the repository's `LICENSE.md` and `CITATION.cff` (same layout as
  skill_hub's imports). Runtime names stay the SKILL.md `name`.
- Each added skill has a GAID-owned profile `geo/catalogue-src/imports/<publisher>/<slug>.yaml` (atlas-profile/v1 shape,
  Korean text). `catalogue/details/<id>.json` for GAID-built entries carries `{schemaVersion, profile}` only; the Atlas
  site summary/install blocks are not produced (GAID reads only `profile.procedure`).
- The output keeps the `geo-catalogue/v1` index and `geo-catalogue-manifest/v1` contracts the app already verifies;
  `generatedFrom` names `kigam-research/geoaidesk` and the build commit.

## Alternatives

- Keep producing in skill_hub (rejected: contradicts the user's direction; skill_hub is legacy).
- Port skill_hub's exporter with its Atlas loader/validator (rejected for now: large, and it would bring the Atlas site
  model back into GAID for one added list of skills). A later unit can rebuild owned skills from source if needed.

## Consequences

- AGENTS.md, the distribution note, `configs/inputs.toml` and `geo/catalogue-release.mjs` name GAID as the producer.
- Owned KIGAM skills keep the bytes exported in 0.2.1 until a release file replaces them.

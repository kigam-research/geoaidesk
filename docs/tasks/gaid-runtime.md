---
format: 1
status: active
updated: 2026-10-11T03:04:06Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"b82d61f9-5a6a-4f75-927c-8fa251f33d2c","pid":3628209,"provider":"claude","session":"bb619be9-c3b3-4f12-a95f-244d4d2f2c38","start":"15227338","token":"4f8fd5c979bc3f8cf27ceb58e285e3aee5e10c1aae29218d216f1df7838df552"}
branch: task/gaid-runtime
target: main
parent: 
---
# gaid-runtime

## Goal and done criteria
Request from the starter:

# Writer brief: WP03 `gaid-runtime` (geoaidesk)

This unit answers forwarded goal 29a3428c445f from the skill_hub project hub. The full forwarded request,
including the user's verbatim words, is in /home/seongin3/data/geoaidesk/work/hub/29a3428c445f.md — read it
first; it is the authoritative scope. Summary only:

- User decisions (verbatim): "2번 GeoAIDesk(약칭 GAID), 나머지는 권장방식으로 하자." and "구현 시작하자."
- Package WP03 `gaid-runtime` (geo-byok-plan.md in kigam-research/skill_hub main 0228785):
  Goal: prepared environments, exact catalogue provisioning, useful file summaries, and workable local-model setup.
  Owns: environment/profile loaders; catalogue staging adapter; shared inspection contract/dispatch;
  `server/src/geo/{context,tools,read-hints}.ts`; session/seed/config/backend registration seams; local-model
  setup component.
  Done: both helper and analysis environments have required packages; selected model/context persists; initial
  prompt budget is visible; task exposure does not corrupt source packages; unsuitable large-file reads return a
  bounded next action. Deterministic tests cover these behaviors and existing-project preservation.
  Publishes stable interfaces for WP04/WP05/WP07 (see "Frontend registry seam" in plan 2.1 Review amendments).
- Inputs and status:
  - WP02 gaid-fork-base is merged on geoaidesk main (report reports/2026-10-11-gaid-fork-base/index.md, be24bb1).
  - WP01 contracts/export on skill_hub main: docs/specs/gaid-{product,interfaces,migration}.md, schemas,
    web/scripts/export-byok.ts. WP06 gaid-workflows (skill_hub) finished: release 0.2.0 (13 skills incl.
    kigam/geo-map-and-crs, 7 workflows) under registry/byok/; use the latest release on skill_hub main.
  - WP00 design/copy is still running in skill_hub; its artifacts arrive later — do not block on them.
  - Read skill_hub files with
    `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
    (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under
  ~/data/geoaidesk/work/gaid-runtime/, never inside the repo.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

## Current state
- 2026-10-11: resumed; plan, contracts and trial notes read. Catalogue 0.2.0 exported from skill_hub main
  0228785 (clean `git archive` copy under ~/data/geoaidesk/work/gaid-runtime/skill_hub-0228785, `npm ci`, exporter
  with `--source-commit`): `geo-catalogue-0.2.0.tar.gz` sha256 0998908e…a205 (6.86 MB),
  `geo-examples-0.2.0.tar.gz` 943c8bab…f38d; two exports gave identical bytes. Exporter warnings: k-dense/geopandas
  and k-dense/uncertainty-and-units address scripts as `skills/<name>/scripts` (WP01 open point, checked here).
- Archive is over the 5 MB Git limit, so it is a named asset, not a tracked file.
- 98e995e: shared interfaces committed (catalogue loader/staging, exposure/context, geo route + session hubs,
  geo-inspection/v1 contract, web viewer seam, defineGeoStrings). Children started from it (2026-10-11 ~11:56):
  `gaid-runtime--env` (writer 0becd10a), `gaid-runtime--local-model` (writer 6868fb3e), `gaid-runtime--inspect`
  (writer c3f9df1b); briefs in ~/data/geoaidesk/work/gaid-runtime/children/prompt-*.md.
- Writer-side done since: catalogue/provision/context tests (server/test/geo-{catalogue,provision,context}.test.ts:
  staging + digests + real 0.2.0 asset, existing-project preservation, version follow, exposure in a live Pi
  session, budget + preview routes), runtime support skills (pi-subagents) kept in every exposure, concise geo
  guidance via appendSystemPromptOverride (geo mode only), web start-prompt budget chip + new-chat skill selection
  (web/src/geo/context/, seam in chat-tab.tsx) with vitest.
## Next steps
1. While children run: production smoke update (geo catalogue provisioned / archive-missing without fallback),
   scripts/check steps, measurement of the start-prompt budget (all vs catalogue vs workflow) on the real catalogue.
2. On each child finish: review, `task complete gaid-runtime--<child>`, integrate (boundaries file entries for their
   seams, scripts/check step for geo/tests/environments-smoke.mjs), rerun checks.
## Failed approaches
## Notes and decisions
### Plan (2026-10-11)
Sequential decisions (writer, first):
1. Catalogue delivery: archive as asset `~/assets/geo-catalogue/0.2.0/` (+ `configs/inputs.toml` entry);
   `geo/distribution.json` `catalogue.{version,archive,sha256}` pins it. The backend locates it via
   `GAID_CATALOGUE_ARCHIVE` → `<GAID_HOME>/catalogue/<archive>` → `<checkout>/geo/catalogue/<archive>` (ignored,
   accompanying in a release bundle), verifies sha256 and every package digest, unpacks into the skills cache with
   a dependency-free tar reader. No network fetch until a public release asset exists (open item).
2. Staging adapter: in geo mode `fetchCatalogue()` returns the unpacked `runtime/skills` trees; `skills-sync.ts`
   stays the only installer. Manifest identity is constant (`geo-catalogue`/`release`), the catalogue label
   (`geo-catalogue@<version>+<sha12>`) is recorded per project in `upstreamCommit`. New projects are seeded through
   sync (no sibling copy); existing projects get the geo skills added once per pinned version, everything else
   untouched (untracked skills are preserved as customized).
3. Task exposure: per-session record `.kady/geo/exposure/<sessionId>.json` (`all` | `catalogue` | `workflow:<id>`)
   applied through Pi's `skillsOverride` (non-exposed skills get `disableModelInvocation`; files untouched, still
   `/skill:` invocable). New chats take the project default (`catalogue` in geo mode); chats with history and no
   record stay `all` (unchanged behaviour).
4. Prompt budget: `GET /geo/context?sessionId=` from the live session (system prompt + active tool schemas,
   chars/4 estimate), model context window/max output, exposed/total skills, observed context usage.
Independent packages (after the interfaces are committed):
- child `env` (Codex general work): environment loader/closure from `environments.json`, helper
  `pyproject.toml`/`uv.lock` (geo-core + geo-gis), geo project seed pyproject, import tests in both targets,
  readiness route. Owns `server/src/geo/environments.ts`, `server/src/geo/routes/environments.ts`,
  `server/src/helpers/{pyproject.toml,uv.lock}`, seam lines in `sandbox-seed.ts`/`helpers-env.ts`.
- child `local-model` (Codex general work): Ollama context check/derived-model creation, custom-model entry with
  explicit context, default model; Settings card. Owns `server/src/geo/local-model.ts`,
  `server/src/geo/routes/local-model.ts`, `web/src/geo/local-model/`.
- child `inspect` (Codex general work): geo-inspection/v1 inspectors (TS sniffers + `geo_inspect_helper.py`),
  `POST /geo/inspect`, `geo_inspect`/`geo_read_window` tools, read-hint extension, generic inspection viewer.
  Owns `server/src/geo/{inspection,tools,read-hints}.ts`, `server/src/geo/routes/inspection.ts`,
  `server/src/helpers/geo_inspect_helper.py`, `web/src/geo/viewers/`.
Writer keeps: catalogue/context/exposure modules, every registration seam (`index.ts`, `session-registry.ts`,
`config.ts`, `skills*.ts`, `prep.ts`, web registry/use-sandbox/file-preview-panel hook lines), the boundaries
file, `scripts/check`, distribution manifest, report. Integration order: writer interfaces → env, local-model,
inspect in parallel → writer integration + checks.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

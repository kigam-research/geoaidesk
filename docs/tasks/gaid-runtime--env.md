---
format: 1
status: waiting
updated: 2026-10-11T02:56:16Z
writer: {"host":"seongin3","reserved":"1dbe8a1fa32d526ab7c5c2b60daed9de22e6bb23df710da310f3db8bd3d7953a"}
branch: task/gaid-runtime--env
target: task/gaid-runtime
parent: gaid-runtime
---
# gaid-runtime--env

## Goal and done criteria
Request from the starter:

# Child brief: `env` — helper and analysis environments from the catalogue (GAID WP03)

Goal (WP03 done criterion): "both helper and analysis environments have required packages", tested by importing every
declared module in BOTH targets; existing projects are preserved.

Input: the catalogue's `environments.json` (`geo-environments/v1`, types `GeoEnvironments` in
server/src/geo/catalogue-types.ts; skill_hub docs/specs/gaid-interfaces.md §9). Non-optional entries are `geo-core`
and `geo-gis` (extends core), targets helper+project; optional `geo-mpm`, `geo-acquisition`, `geo-report` target the
project only and have `tools` (reported, never installed silently). `python: ">=3.12"`.

Deliver:
1. `server/src/geo/environments.ts`: resolve an environment's `extends` closure (cycle = error), required set per
   target (non-optional environments whose `targets` include it), package specs (`name` + `version` lower bound),
   import lists, pure functions plus a loader from `loadGeoCatalogue().environments`.
2. Helper target: add the helper packages of geo-core + geo-gis to `server/src/helpers/pyproject.toml` with the
   declared lower bounds and regenerate `server/src/helpers/uv.lock` with `uv lock` (keep the existing
   `[tool.uv] required-environments`; do NOT change `requires-python`). If a package cannot resolve for one of the
   required platforms, stop and report it rather than dropping the platform. Add a deterministic test that the
   helper pyproject declares every helper package of the pinned catalogue (parse the toml text; the test reads the
   catalogue from the asset when present and skips visibly otherwise).
3. Project (analysis) target: in geo catalogue mode new project sandboxes get a generated `pyproject.toml`
   (geo-core + geo-gis project packages, `requires-python` from the catalogue's `python`) instead of upstream's
   numpy/pandas/matplotlib/scipy file. Seam: `server/src/sandbox-seed.ts` chooses the seeded pyproject text through
   one call into your module (upstream text when not in geo mode or the catalogue is unavailable). An existing
   sandbox `pyproject.toml` is never rewritten (seed writes only missing files — keep that), and do not touch
   AGENTS.md handling (the parent owns the AGENTS.md text).
4. Readiness + explicit preparation, `server/src/geo/routes/environments.ts` (stub exists; keep the export name):
   - `GET /geo/environments` → per environment and target: declared packages, import-test result per module
     (ok / missing with the error line), tool checks for optional tools, `ready` boolean. Cache results keyed by the
     mtimes of the relevant pyproject.toml/uv.lock/.venv so polling is cheap.
   - `POST /geo/environments/:id/prepare` (project target, active project) → `uv add` exactly the missing declared
     distributions of that environment closure (verified names from environments.json, lower bounds kept) and
     re-run the import test; helper target → `uv sync` of the helper venv. Never install undeclared packages. Use
     `findUv()` (server/src/binaries.ts) and bounded timeouts; return the command output tail on failure.
   - Import tests run the target interpreter with `-I -c` (helper: `helperPython()` from server/src/helpers-env.ts;
     project: the sandbox `.venv` interpreter, Windows path aware like helperPython).
5. `server/src/helpers-env.ts` may get at most a small seam if needed (say so in the report).
6. Tests (server/test/geo-environments*.test.ts): closure/cycle/required-set, generated pyproject text, geo-mode seed vs
   upstream seed, existing pyproject preserved, readiness/prepare with an injected command runner (no real uv),
   route validation (unknown environment 404, optional tools reported not installed).
7. A real import check script `geo/tests/environments-smoke.mjs` (node, no deps) that: imports every helper-target
   module with the synced helper venv (`uv run --frozen --project server/src/helpers python -I -c ...`), and creates
   a temporary sandbox under the OS temp dir from the generated project pyproject, runs `uv sync`, and imports every
   project-target module of geo-core + geo-gis. Print a clear per-module table; exit non-zero on a missing module.
   Run it once and paste the result in your final report. The parent appends it to scripts/check.

Out of scope: AGENTS.md text, the model-facing tools, catalogue staging, any UI.
Owned files: server/src/geo/environments.ts, server/src/geo/routes/environments.ts, server/src/helpers/pyproject.toml,
server/src/helpers/uv.lock, server/test/geo-environments*.test.ts, geo/tests/environments-smoke.mjs; seam lines in
server/src/sandbox-seed.ts (and helpers-env.ts only if needed).
## Common rules for this child unit (parent: geoaidesk task gaid-runtime, WP03)
- Repository: kigam-research/geoaidesk (GeoAIDesk = GAID, fork of K-Dense BYOK). Read AGENTS.md and
  docs/tasks/gaid-runtime.md (section "Plan") in your worktree first. The plan source is skill_hub
  docs/specs/geo-byok-plan.md §3.2 and §3.8; a local copy is at
  /home/seongin3/data/geoaidesk/work/gaid-runtime/specs/geo-byok-plan.md (read-only).
- Network: raw.githubusercontent.com is blocked on the KIGAM network. Use
  `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept: application/vnd.github.v3.raw"` if you need a GitHub file.
- The pinned geo catalogue archive is at ~/assets/geo-catalogue/0.2.0/geo-catalogue-0.2.0.tar.gz (read-only asset);
  an unpacked copy for reading is at /home/seongin3/data/geoaidesk/work/gaid-runtime/cat-0.2.0/ (environments.json,
  workflows.json, catalogue/index.json, runtime/skills/). Code loads it through `loadGeoCatalogue()`
  (server/src/geo/catalogue.ts); tests pass explicit options and must not depend on ~/assets (build a small fixture
  archive in the test, or skip visibly when the asset is absent).
- Settled interfaces you build on (do not change their signatures; ask the parent through your task document /
  final report if one must change): server/src/geo/{catalogue,catalogue-types,context,session,routes,inspection}.ts,
  web/src/geo/contracts/inspection.ts, web/src/geo/viewers/registry.ts, web/src/geo/i18n.ts (`defineGeoStrings`).
- server/vitest.config.ts sets `GAID_CATALOGUE=off` so upstream tests keep the upstream catalogue path; geo-mode tests
  set the env per test (and reset module state) or pass explicit options.
- GAID code lives in server/src/geo/, web/src/geo/. Any edit to an upstream file is a seam: keep it to the lines
  named in your brief and list every such file in your final report; the parent records them in
  geo/integration-boundaries.json (do not edit that file yourself).
- Visible UI strings: Korean first, English second, in a `strings.ts` next to your component built with
  `defineGeoStrings`; plain wording, no marketing claims, no claim that something is tested when it is not.
- Server style: match the surrounding upstream code (TypeScript run by tsx, typebox, fastify, vitest in server/test/).
  Tests deterministic, no network to model providers, no paid model runs. Put test fixtures under
  server/test/fixtures/geo/ (small files only, nothing over 200 KB).
- App data for manual checks goes under ~/data/geoaidesk/work/gaid-runtime/<your-slug>/, never inside the repo.
- Checks before finishing: `cd server && npm run typecheck && npx vitest run <your tests>`, `cd web && npx tsc --noEmit`
  and the web tests you touched, plus a full `cd server && npm test` once. Report exact commands and results; do not
  write "tests passed" for tests you did not run.
- Use the task CLI for saving/finishing (`task save`, `task finish`); your finish notifies the parent.

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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

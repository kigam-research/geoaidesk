---
format: 1
status: ready
updated: 2026-10-11T03:19:49Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"0becd10a-f4fd-4f39-92ef-a666bfd98820","pid":3657853,"provider":"codex","session":"01a128e3-dbba-7443-9d73-f1900d0e9424","start":"15338416","token":"1dbe8a1fa32d526ab7c5c2b60daed9de22e6bb23df710da310f3db8bd3d7953a"}
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
- Implemented catalogue closure/spec generation, required target selection, geo project pyproject generation and the one-call sandbox seed seam.
- Implemented GET readiness and explicit POST preparation with injected command runner, isolated interpreters, bounded subprocesses, distribution-version/import results, tool checks and mtime-keyed cache.
- Helper manifest declares all 13 required catalogue distributions; uv.lock regenerated successfully for all four required platforms. Existing `requires-python >=3.11` and `required-environments` are unchanged.
- Targeted tests: 11 passed across two files. Backend `npm run typecheck` and frontend `npx tsc --noEmit` passed.
- Real smoke passed: every one of 13 declared modules imported in BOTH helper and freshly generated project environments, 26/26 checks; log `/home/seongin3/data/geoaidesk/work/gaid-runtime/env-smoke.log`.
- Full unfiltered backend suite completed: 1502 passed, 8 skipped, 3 failed (1513). Fixed the introduced native-require syntax regression; rerun of notebook-store plus both environment files passed 22/22. The remaining two failures are the existing mzML/PSI-MS vocabulary network cases handled explicitly by scripts/check. Log `/home/seongin3/data/geoaidesk/work/gaid-runtime/env-backend-tests.log`.
- Final scripts/check first attempt: backend 1522 passed, 11 skipped; web 887 passed, 2 failed due to the documented lazy editor timeout under parallel load. The failing file reran alone successfully (4/4). Retrying task finish with CPU affinity 0-3; Vitest uses availableParallelism(), so this bounds worker concurrency without changing code/check coverage.
- No deployment or user-project preparation performed. Helper venv synced by the real smoke and declared checks only.

### Plan and ownership
- Sequential: pure closure/spec generation → helper manifest/lock resolution → seed seam → readiness/preparation service and routes → tests and real import smoke.
- This child has no nested writers. The implementation is tightly coupled and stays with this writer.
- Own the files named in the brief; leave AGENTS.md content and integration-boundaries.json to the parent. One necessary parent-module compatibility fix is included: catalogue.ts GeoCatalogueError uses explicit readonly fields instead of parameter properties, with identical constructor/API, so the new static seed import does not break the existing native require() notebook-store test.
- Route interface: GET returns each catalogue environment with target readiness; POST accepts `{target: "project" | "helper"}` (project by default) and validates membership before any command.
- Integration: parent records `sandbox-seed.ts` and `helpers/pyproject.toml`, `helpers/uv.lock` seams and appends `node geo/tests/environments-smoke.mjs` to scripts/check. helpers-env.ts has one small seam: helper sync explicitly selects Python 3.12, matching the four required platform targets; explicit helper preparation and the smoke select it too.

## Next steps
<!-- task:closed -->
Closed 2026-10-11T03:19:49Z: ready; the parent gaid-runtime integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Stopped the second finish check (own process group, before publication) to add the necessary explicit Python-3.12 helper selection; otherwise a host with only Python 3.11 could choose an interpreter excluded by the catalogue support markers. No recorded task job was stopped; retry finish in place after the fix.
- First task finish failed only on two existing lazy-editor wait timeouts in web/src/components/file-preview-panel.test.tsx (4 s); isolated rerun passed all 4. Preserve the tests and constrain execution parallelism instead of increasing waits.
- Initial helper lock resolution failed on Python 3.11: catalogue numpy>=2.5.3 requires >=3.12. A Python-only uv environment marker still attempted unsupported Windows ARM64 and failed on RDKit. Neither split was among the four required Python-3.12 platform targets.
- Resolved by setting `[tool.uv].environments` to the four shipped platforms with Python >=3.12 (catalogue requirement), preserving every required platform marker and upstream requires-python verbatim. `uv lock` then succeeded; no package bound was weakened.
- `task job run` could not create a snapshot because inherited `.env.example` is forbidden. No job receipt was created and no job is pending. Recorded logs above for the explicitly requested checks; no forbidden file was read or changed.

## Notes and decisions
- uv supported environments are explicitly the distribution platforms (Linux x86_64, macOS x86_64/arm64, Windows AMD64) and Python>=3.12, matching the catalogue. Python 3.11 and Windows ARM64 are not prepared or claimed supported by the geo helper environment.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Child contribution to the parent's canonical implementation report (no separate child report).

### Delivered result
- Both required geo environments are declared in the helper and generated analysis manifests. Real imports succeeded in both targets on PC74 (2026-10-11).
- Existing pyprojects, including edited files and deliberate deletions, survive normal seeding. Only a missing, never-seeded pyproject gets the geo manifest automatically; explicit force restoration still never overwrites an existing file.
- API exposes package declarations, installed distribution versions, per-module errors and tool checks. Preparation uses `uv add -- <missing verified specs>` for the active project and `uv sync --frozen` for helper; tools are checked but never installed.
- Optional missing tools do not block Python readiness. Required tool check failures do. Chromium readiness checks its actual executable path, not Playwright's misleading successful install dry-run.
- Readiness caches for at most 60 seconds, keyed by target manifest/lock/venv/site-packages/interpreter mtimes and catalogue closure; repeated polls reuse the result.

### Real import smoke output
Command: `node geo/tests/environments-smoke.mjs` (exit 0).

| Module | Helper | Fresh analysis project |
| --- | --- | --- |
| numpy | ok | ok |
| pandas | ok | ok |
| scipy | ok | ok |
| matplotlib | ok | ok |
| PIL | ok | ok |
| sklearn | ok | ok |
| lasio | ok | ok |
| pyproj | ok | ok |
| yaml | ok | ok |
| rasterio | ok | ok |
| shapely | ok | ok |
| pyogrio | ok | ok |
| geopandas | ok | ok |

`Environment smoke: all required modules imported in both targets`

### Checks and integration notes
- `cd server && npm run typecheck && npx vitest run test/geo-environments.test.ts test/geo-environments-helper.test.ts`: exit 0, 11/11 tests. Includes asset-backed helper declaration check, preserved required platform markers, geo/upstream seeding, preservation, closure errors, cache invalidation, route validation, no-body default POST and explicit preparation failures.
- `cd web && npx tsc --noEmit`: exit 0. No web files/tests changed.
- `uv lock --project server/src/helpers`: exit 0; all required platforms retained. Cross-platform resolution is verified, but actual imports were executed only on PC74 Linux.
- Full unfiltered backend `cd server && npm test`: exit 1, 1502 passed / 8 skipped / 3 failed. Introduced notebook-store native-require regression fixed; final `cd server && npm run typecheck && npx vitest run test/notebook-store.test.ts test/geo-environments.test.ts test/geo-environments-helper.test.ts`: exit 0, 22/22. Remaining two PSI-MS vocabulary cases use the repository's existing visible network skip in scripts/check. The final task CLI check result is recorded by task finish.
- Additional parent-owned geo file: `server/src/geo/catalogue.ts` (GeoCatalogueError syntax only; unchanged API). Native require() cannot strip parameter properties; the new seed dependency exposed this in notebook-store.test.ts.
- Upstream seams: `server/src/sandbox-seed.ts` (one import + seed-text selection), `server/src/helpers/pyproject.toml`, `server/src/helpers/uv.lock`. `server/src/helpers-env.ts` (one argv seam, selecting Python 3.12 for helper sync).
- Parent next steps: append the smoke to scripts/check, record helper manifest/lock ownership in boundaries, integrate with `task complete gaid-runtime--env`.
- Logs: `/home/seongin3/data/geoaidesk/work/gaid-runtime/env-smoke.log`, `/home/seongin3/data/geoaidesk/work/gaid-runtime/env-backend-tests.log`.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

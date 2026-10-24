---
format: 1
status: done
updated: 2026-10-24T13:12:01Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"4b8e0e17-3fea-48d0-b063-69304df1ad95","pid":2429809,"provider":"claude","session":"63970a14-62e0-4041-afb8-314c6e8a5445","start":"73218387","token":"a2a1e3d206cb0ff8ffa8126fa33175459610479150f50ccbaef399569abbec08"}
branch: task/gaid-check-speed
target: main
parent: 
---
# gaid-check-speed

## Goal and done criteria
Request from the starter:

Goal: make geoaidesk's declared check (scripts/check) faster without losing coverage, following the backbone check-speed standard.

Verified facts (backbone, PC74 records 2026-10-10..24): check p50 528 s; 141 failed check logs in two weeks; finish re-ran the full check 20 times when main moved. scripts/check runs npm ci three times (server/, web/, geo/ui/quality/); all three are needed, so reuse each install keyed on its own package-lock.json instead of removing one. The check also probes the network (psims vocabulary, production smoke's first-start catalogue and sandbox environment, UI quality kit): declare those steps or make them use local caches. Also look at why so many checks fail (flaky or environment-dependent stages) once the stages are timed.

Standard (backbone docs/project-standard.md §3.1, task check-speed-standard; it may reach ~/backbone only after that unit is rolled out, so the rules are repeated here):
1. Keep coverage: do not drop or skip tests for speed. Record test counts and results before and after.
2. Reuse installs: do not install dependencies fresh on every run. Per install location, store the hash of its own lockfile next to the install and skip the install when it matches. Keep every needed location. A new worktree installs from the package manager cache (uv cache, npm cache, pnpm store).
3. Parallel tests: size workers with TASK_CHECK_JOBS (free CPUs, 1..16, set by the task CLI after rollout) and a project default when unset, e.g. pytest -n "${TASK_CHECK_JOBS:-4}". Do not grab all CPUs (-n auto). Fix tests that break in parallel by giving each test its own temp dir, port or DB; keep only order-dependent tests serial.
4. No network downloads in the declared check unless the AGENTS.md check line declares that step and why.
5. Stage markers: print one `task-stage: <name>` line at the start of each stage (shell echo, unbuffered). After rollout the task CLI records stage times and `task check-times` shows per-stage median/p90.
6. Measure first: add the markers, measure the stages (task check-times after rollout, or timestamps in the check log), then change the slow stages and compare with the same measurement.

Done: stage markers in scripts/check; measured stage times before and after in the task document; the slow stages reduced without lost coverage; scripts/check passes. The scripts/check edit belongs to this repository; ask backbone through its hub if the task CLI itself needs a change.
Source: backbone reports/2026-10-24-worktree-workflow-review/index.md §3.4 and §3.7 item 3; user decision (verbatim, 2026-10-24): "모두 권장으로 하자. 그리고 각 프로젝트에 요청하는 것이 아니라 글로벌로 적용해야하는 것이 아닌가?" (apply the standard globally; each repository applies it to its own check).

## Project facts known to the hub (verify before relying on them)
- Server vitest: VITEST_MAX_WORKERS=2+ overrides the serial files and breaks the suite; it passes with 1 or unset. Parallelism must keep
  those order-dependent/serial files serial.
- Under high load (>25) unrelated web tests time out; past finishes waited for load <14 and reran once. Treat these as candidate flaky
  stages when you time the stages.
- scripts/check is also run by `task finish`; other units (gaid-authoring-cache, gaid-ia-connect-workspace finishing, gaid-library-prep)
  are active, so keep the change self-contained in scripts/check and its helpers; do not touch the review app or the hub server.

## Current state
Result: scripts/check passes on PC74 in 394-451 s (3 runs after the change, all exit 0) against a baseline of about
1020 s that also failed on 5 load timeouts in the web tests. Coverage unchanged: server 2324 passed / 8 skipped (212 files),
web 1341 passed (211 files), geo 58 pass / 1 skipped (59 tests; the maps split keeps all 13 maps tests).

| stage (task-stage) | baseline s | after 1 / 2 / 3 s | change |
|---|---|---|---|
| server-install | 45 | 0 / 0 / 0 | npm ci only when package-lock.json changes (scripts/npm-ci-locked.mjs) |
| helper-env | 1 | 0 / 0 / 0 | unchanged (uv sync --frozen already reused) |
| server-typecheck | 27 | 15 / 22 / 13 | unchanged (load) |
| server-unit | 571 | 128 / 105 / 118 | files in parallel (TASK_CHECK_JOBS, default 8), one projects root / Pi agent dir / skills cache per worker |
| web-install | 27 | 0 / 0 / 0 | install reuse |
| web-unit | 68 (5 failed) | 95 / 110 / 110 | workers capped at TASK_CHECK_JOBS (was all CPUs but one); waitFor 5 s, test timeout 20 s; 0 failures |
| geo-tests | 39 | 53 / 72 / 31 | maps-helper tests split into three files (run 3) |
| geo-environments | 8 | 15 / 11 / 14 | unchanged |
| production-smoke | 196 | 101 / 85 / 75 | no second npm ci of server and web (shared launcher stamp) |
| ui-quality-install + ui-quality | 1 + 35 | 1+37 / 0+40 / 0+31 | install reuse |
| others (launchers, copy, guide) | ~2 | ~5 / ~2 / ~2 | |
| total | ~1020 | 451 / 447 / 394 | |

Load differed (baseline 45-78, after 23-38); the server-unit gain holds at equal load (563 s serial vs 114 s with 8 workers,
both at load ~50, srv8 experiment). The web-unit stage is slower than before because the standard forbids all-CPU workers;
with the task CLI's TASK_CHECK_JOBS (up to 16) after rollout it gets more workers. Failure causes from 142 failed PC74 logs:
load timeouts in web/server tests (addressed for web by the longer waits) and missing integration-boundaries entries (real
failures, not flakes). Network: remaining steps are declared in AGENTS.md "Checks" (cache misses, the PSI-MS probe, Playwright
Chromium once per PC).
Re-verify: `scripts/check` (prints `task-stage:` lines and a stage table at exit); logs of the runs above in
~/data/geoaidesk/work/gaid-check-speed/{baseline1,baseline-tail,after1,after2,after3}.log on PC74.
## Next steps
<!-- task:closed -->
Closed 2026-10-24T13:12:01Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Plan (sequential, done by this writer; small and tightly coupled, no child units): 1) stage markers in scripts/check
  (`task-stage: <name>` + an exit summary of stage seconds, since `task check-times` is not rolled out on PC74 yet);
  2) baseline run; 3) changes to the slow stages; 4) same measurement after. Owned files: scripts/check,
  scripts/npm-ci-locked.mjs, server/vitest.config.ts, server/test/setup-worker-dirs.ts, web vitest settings if needed.
- Past logs (PC74 `~/.local/state/backbone/check-logs/beb99bb9d216ecd9`, 142 failed logs kept, passing logs are deleted):
  last stage of a failed run: Frontend tests 52, Backend tests 45, distribution checks 24, production smoke 7, other 14.
  The most frequent failing tests are load timeouts (`Test timed out in 5000ms`, `Unable to find role=...` after
  waitFor's 1 s): map viewer GPKG paging (20), file-preview draft retention (26), CSV pagination (11+7), settings
  Modal credentials (10). Backend vitest took 324–638 s in those logs (fully serial, `fileParallelism: false`; about
  half is module import), frontend vitest 28–72 s (default workers = all CPUs but one).
  Failed distribution checks are almost all `integration boundaries list existing seams with an owner` (23): a
  writer edited an upstream file without adding it to geo/integration-boundaries.json, a real failure, not a flake.
- Baseline 1 (scripts/check of main 901f1b76 + markers, PC74, load 45-78, log
  ~/data/geoaidesk/work/gaid-check-speed/baseline1.log): server-install 45 s, helper-env 1 s, server-typecheck 27 s,
  server-unit 571 s (vitest 563 s; 211 files passed, 1 skipped; 2324 tests passed, 8 skipped), web-install 27 s, web-unit
  68 s (31 default workers; failed: 5 of 1341 tests, all load timeouts — file-preview draft, settings Modal credentials,
  workflows-locale, map viewer x2). The run stopped there (exit 1), so the later stages are measured separately
  (baseline-tail.sh, same commands).
- Experiments: server vitest with --maxWorkers=8 and per-worker dirs: 114 s, same counts, exit 0 (load ~50). Web vitest
  --maxWorkers=8: 115 s (slower than 31 workers), 1 failure (settings Modal credentials, findByText after 1 s).
  Decision: keep TASK_CHECK_JOBS (default 8) for web too (standard: never all CPUs) and raise the web async wait to 5 s
  and the test timeout to 20 s, which removes the load timeouts without dropping tests.
- Baseline tail (same commands as main, stamps removed as every main run leaves them; load ~30-45):
  launcher-check 0, geo-tests 39 (59 tests: 58 pass, 1 skipped), ui-copy 1, ui-guide 1, geo-environments 8,
  gaid-launcher-check 0, production-smoke 196 (start 1 re-ran npm ci for server and web: the stamps reappeared), ui-quality
  npm ci 1, ui-quality 35. Baseline total ~1020 s (571 + 68 + 196 dominate).
- After 1 / after 2 (scripts/check with the changes, load 23-38): 451 s / 447 s, exit 0 both; server-unit 128 / 105,
  web-unit 95 / 110, geo-tests 53 / 72, production-smoke 101 / 85, installs 0 s. Counts unchanged (server 2324 passed
  8 skipped; web 1341 passed; geo 58 pass 1 skipped).
- geo-tests was then bound by one file: maps-helper.test.mjs alone took 40-60 s (55 sequential GDAL helper calls); split
  into three files with a shared setup module (geo/tests/maps-helper-common.mjs): 13/13 pass in 18 s.
- The production smoke rebuilds the UI on every run because it picks free ports and NEXT_PUBLIC_ADK_API_URL carries the
  backend port into the build stamp (geo/start.mjs). Left as is (the smoke checks a real first start); see Optional.
- Found: scripts/check's `npm ci` deletes `node_modules/.launcher-ci-stamp`, so the production smoke's first
  `start-gaid` start runs `npm ci` again for server and web. One stamp shared by scripts/check and start.mjs fixes both.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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

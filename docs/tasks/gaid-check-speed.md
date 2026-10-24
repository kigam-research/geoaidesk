---
format: 1
status: active
updated: 2026-10-24T13:03:56Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. Baseline check runs as systemd user unit `gaid-check-speed-base1` (log ~/data/geoaidesk/work/gaid-check-speed/baseline1.log,
   stage summary at its end). When it ends, record the stage times, then apply the prepared changes
   (scripts/npm-ci-locked.mjs, parallel server vitest with per-worker dirs) and measure again.
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

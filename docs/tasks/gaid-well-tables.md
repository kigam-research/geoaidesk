---
format: 1
status: active
updated: 2026-10-11T05:49:52Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"cd7c561a-0a57-452c-9026-bbf129244c36","pid":3981134,"provider":"codex","session":"01a12945-9f27-71e2-b32a-5bbc545ac45a","start":"15979142","token":"29bed9d06311d3f15e6cd0567d9374e9a4a03a112c2135a1ce904ef6fe2f5004"}
branch: task/gaid-well-tables
target: main
parent: 
---
# gaid-well-tables

## Goal and done criteria
Request from the starter:

# Writer brief: WP04 `gaid-well-tables` (geoaidesk)

This unit answers forwarded goal 77519c124e1c from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, status and inputs, is in /home/seongin3/data/geoaidesk/work/hub/77519c124e1c.md — read
it first; it is the authoritative scope (goal, owned files, done criteria, order). Do not add required items.

Verified facts from the hub (2026-10-11):
- geoaidesk main is at or after 5d9fe8d with WP02 gaid-fork-base and WP03 gaid-runtime merged; their reports are
  reports/2026-10-11-gaid-fork-base/index.md and reports/2026-10-11-gaid-runtime/index.md. WP03 publishes the
  inspection/viewer interfaces this package uses.
- WP04 `gaid-well-tables` and WP05 `gaid-maps` run in parallel as separate units right now. Shared seams
  (web/src/lib/viewers/registry.ts, the file-preview dispatch in web/src/components/file-preview-panel.tsx,
  web/src/lib/use-sandbox.ts): append only your own entries; non-additive changes belong to WP07. Integrate
  shared seams serially: run `task sync` before finishing and resolve append-only conflicts by keeping both sides.
- Read skill_hub files with
  `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
  (raw.githubusercontent.com is blocked on the KIGAM network; pass this to any worker using the network).
- Writer setup: started with the Paseo profile "고급 Fast worker" by the user's choice ("이미 작업중인 것은 끝까지
  진행하고 이후 작업부터 고급 fastworker를 쓰게하자."). You orchestrate and do the work yourself; keep fast
  (service_tier priority) through resume and handoff.
- No paid model runs unless the user asks.
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under ~/data/geoaidesk/work/gaid-well-tables/,
  never inside the repo. After your last check, remove regenerable build caches from the worktree
  (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts,
  web/tsconfig.tsbuildinfo) so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

## Current state
- LAS milestone integrated by `task sync`: db00f688bd9b, full scripts/check passed (backend 145 passed files, 1 skipped; 1,579 passed tests, 11 skipped). CLI production smoke completed; no deployed service changed.
- Focused LAS checks: `node --test geo/tests/well.test.mjs` passed (9 Python known-answer cases); backend depth 4 tests after shared-header-basis check, frontend depth 5 tests after reader fixes, backend/frontend typechecks passed. Shared header-basis reuse was then added and the depth API tests passed again.
- FORCE concordance: 4,841,277-byte source, 16,132 LAS rows; 15,743 uniquely matched reference rows, seven curves exact values and null masks (max difference 0, no null-mask disagreements). Header STOP discrepancy 0.1128047 m is preserved. Output checks/force-concordance.json under external task work.
- Real Chromium application check: opened FORCE LAS without bulk text fetch; applied 1800–2400 m window; manifest spike link reached logical row 12002 with project-scoped data/code links. Korean screenshots external under task checks, copied into canonical report figures. Constructed flags test UI only, not scientific QC.
- Table child completed and closed through task complete/task close after removing its ignored Next build cache; code integrated through 3bdaf71; current application snapshot ebbe2e0 includes its 13 focused tests. First `task complete` combined check passed backend 1,593 tests (11 skipped), frontend 905 tests, geo/environment checks, but production build found missing fields in a new parent test fixture. Fixed by giving it the full DepthWindow type and fields, not by an unsafe cast.
- After that fix: `cd web && npx tsc --noEmit --incremental false` passed; depth/table-option 7 UI tests passed; `node geo/tests/production-smoke.mjs` passed start/stop/restart in a clean data home. Final source/report snapshot is saved as 6debc9559c30; all test/production stages have passed, and the parent task finish performs the required final whole-check/integration.
- Combined real-browser smoke passed: explicit table overlay/suggestions, expected overlap/gap, `<0.01` retained, original file bytes unchanged, return to ordinary table; LAS depth-window and exact row 12002/source/code links rechecked. Current Korean screenshots and all four registered output hashes verified.
- Direct checks authorized by hub/user ("제안대로 하자.") while .env.example snapshot policy is fixed. Routed request env-sample-jobs-gaid-well-tables consumed and reported. No paid model runs.
## Next steps
1. Run `VITEST_MAX_WORKERS=1 task finish` on the final checked-result snapshot. All child code is integrated and the child is closed; no new source changes or deployment are planned.
2. After finish's last check, remove the explicitly listed regenerable caches (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts, web/tsconfig.tsbuildinfo and Python __pycache__); await the hub's final completion report and give it once.
## Failed approaches
- First parent `task complete` failed only at production TypeScript checking because the new singleton UI test fixture omitted fingerprint/wrapped and curve metadata. Fixed the fixture to match the contract; frontend typecheck, 7 affected UI tests and standalone production smoke then passed. Original full check evidence: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-w3bfbkvw.log.
- 2026-10-11: first task job run (dependency install + focused type/numerical/API/UI checks) failed before receipt creation: "job snapshot blocked: forbidden path .env.example". The inherited path was not read or changed. task/jobs.py validates all ls-tree paths before git archive (even export-ignore cannot resolve it). Do not bypass task CLI with manual long-running jobs. At that point no tests had run. Hub subsequently authorized direct checks; current results are above.
- Focused command after unblock: task job run -- bash -lc 'set -e; npm --prefix server ci --no-audit --no-fund; npm --prefix web ci --no-audit --no-fund; uv sync --frozen --project server/src/helpers --python 3.12.14 --python-preference only-managed; npm --prefix server run typecheck; cd web; npx tsc --noEmit; npm test -- src/geo/viewers/depth/viewer.test.tsx; cd ../server; npx vitest run test/geo-depth.test.ts; cd ..; node --test geo/tests/well.test.mjs'

## Notes and decisions
- Sequential decisions: preserve raw values/order/nulls; unknown depth basis/datum stay unknown; LAS 2.0 numerical support only, LiDAR and LAS 3 explicit unsupported. Full-data operations capped separately from metadata inspection. Display reduction retains spikes and explicit gap boundaries.
- Independent package: tables child owns new table helper/routes/contracts/viewer/tests only. Parent owns LAS helper/routes/depth UI/manifest/tests and all shared glue, integration boundaries, AGENTS and canonical report.
- Interfaces settled: table child exports registerGeoTableRoutes(app) and default TableRolesViewer(ViewerProps), on explicit user choice from existing table surfaces; it never replaces generic table editing. Both use WP03 sandbox resolution and inspection conventions. No overlap in owned files.
- Read-only LAS review: native reader /root/las_review, current working tree (HEAD db00f688 plus pending basis/label changes); no writes/runs allowed, concrete outcome blockers only. Review found invisible single-point segments and an inverted-range retry trap. Fixed with visible source-linked singleton markers and local range validation; focused regressions added and all 5 depth UI tests passed. No additional blockers found in numerical parsing/reduction/source links.
- Integration order: LAS first; complete child and append table routes/UI entry; task sync with WP05 keeping both append-only entries; final scripts/check. No separate review quota.
## Open items
None.
## Report
Report: reports/2026-10-11-gaid-well-tables/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: done
updated: 2026-10-11T05:04:40Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"85450614-1e51-40d8-81d3-2d03affeb189","pid":3993687,"provider":"codex","session":"01a12947-5e03-7991-a7c3-7c4f3fb3d496","start":"15990571","token":"4532bddaeed252d92fb3ced998e7493b4011111ccf99357f24fd5d925521b444"}
branch: task/gaid-runtime-followups
target: main
parent: 
---
# gaid-runtime-followups

## Goal and done criteria
Request from the starter:

# Writer brief: `gaid-runtime-followups` (geoaidesk)

User answer in the geoaidesk hub (2026-10-11, verbatim): "gaid-runtime#1을 포함하여 #1,2,3,4 모두 권장안으로 진행하자."

This unit implements the geoaidesk code part of two answered items from WP03 `gaid-runtime`
(item text: docs/open-items/closed/gaid-runtime.md on main after the hub records them; evidence in
reports/2026-10-11-gaid-runtime/index.md sections 5 and 6):

1. gaid-runtime#1, option 가): state 64K context as the minimum for local models and remove the 32K
   proposed profile. The 64K/98K real-task trials are NOT in this unit; they belong to WP10
   `gaid-release-proof` (later package from skill_hub).
2. gaid-runtime#3, option 가): add a seam so the local model entry (`gaid-local`) is billed as `local`
   ($0, not cap-counted) instead of zero-cost payg, so a project over its spend limit can still run it.
   Note AGENTS.md: cost/billing.ts, cost/ledger.ts and agent/subagent-bridge.ts must stay in sync for
   local billing.

Not in scope: gaid-runtime#2 (catalogue archive on GitHub Release, WP10) and #4 (skill_hub hub).

Context:
- WP04 `gaid-well-tables` and WP05 `gaid-maps` are running in parallel in other units; do not touch their
  owned files (depth/map viewers, registry/file-preview/use-sandbox seams).
- Writer setup: started with the Paseo profile "고급 Fast worker" by the user's choice ("이미 작업중인 것은
  끝까지 진행하고 이후 작업부터 고급 fastworker를 쓰게하자."). Keep fast (service_tier priority) through
  resume and handoff.
- No paid model runs unless the user asks. Checks: `scripts/check`. App data under
  ~/data/geoaidesk/work/gaid-runtime-followups/. After your last check, remove regenerable build caches from
  the worktree (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next,
  web/next-env.d.ts, web/tsconfig.tsbuildinfo) so the unit can close.
- Small change: no ADR; a short report is enough.

## Current state
- Implemented the 64K minimum/default, removed the proposed 32K profile, preserved existing saved settings, and documented untested release-proof scope.
- Added the pure gaid-local identity and shared local classification across billing, ledger inference, child bridge/meter and picker metadata. Other custom providers remain payg.
- Focused regression run: 4 files / 54 tests passed (2026-10-11). No paid model calls.
- Full rerun passed backend typecheck and 1,582 tests (11 skipped), frontend 898 tests, and the development launcher check. Distribution validation rejected the seam owner slug; changed ownership metadata to the parent WP03 package gaid-runtime, then all 11 distribution tests passed. Environment imports, GAID launcher, and production start/restart checks passed directly under the hub-authorized exception. Production smoke verified 13 skills, excluded sources absent, persistence, and unchanged tracked files.
- task sync fetched and merged main dad53b41 into the unit; no conflicts. Current snapshot before fixture fix: 1133236ee2ff.
## Next steps
<!-- task:closed -->
Closed 2026-10-11T05:04:40Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- task job run -- scripts/check failed before launch because inherited .env.example is a forbidden snapshot path. No job/receipt was created; no protected file was read or changed. Use the CLI's declared-check integration path (task sync/finish), not a manual publication workaround.
- Initial lead-run regression reported cost but zero tokens: the ledger intentionally skips zero-cost/zero-token rows after local normalization. The corrected fixture reports two tokens. An intervening focused attempt ran the stale fixture because the correction script was initially invoked from server/ instead of the worktree root; the root invocation and fresh rerun passed.
- Distribution boundaries accept package names, not follow-up task slugs: corrected gaid-runtime-followups to gaid-runtime without widening the allowed-owner list.
- First production smoke completed start/restart but was invalidated by this writer updating the task document during its tracked-tree snapshot check. A second unchanged-tree run passed (production-check.log).
## Notes and decisions
- Sequential decisions: 64K = 65,536 tokens; reject new configurations below it, preserve existing saved configurations, remove only the proposed 32K option. Existing 96K evidence remains a one-machine trial, not release proof.
- Ownership: this writer owns geo local-model profiles/UI/tests, a pure geo provider identity, and narrow billing/ledger/subagent/custom-picker seams plus their regression tests and documentation. No WP04/WP05 files.
- Work packages: context settings and local billing are small; billing consumers are tightly coupled. No substantial independent child package; implement directly.
- Integration order: declare upstream boundaries; pure identity and billing policy; consumers; context UI/API; regression checks; report and finish.
- Hub route env-sample-jobs-gaid-runtime-followups consumed and reported completed: direct checks in the writer worktree are explicitly authorized while backbone fixes snapshot handling; never remove or rename .env.example.
- No rollout or paid model execution in this unit. WP10 owns real-task 64K/98K trials and catalogue release distribution.
Closes: gaid-runtime#1
Closes: gaid-runtime#3
## Open items
None; remaining release-proof work stays in WP10, as already assigned.
## Report
Report: reports/2026-10-11-gaid-runtime-followups/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

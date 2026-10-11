---
format: 1
status: active
updated: 2026-10-11T04:47:35Z
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
- Resumed in the original printed worktree; clean initial tree at bad86f1.
- Source lookup: exact worktree has no codegraph index; inspected native source instead.
- Existing defaults offer 32K; gaid-local falls through to payg, including picker metadata.
## Next steps
1. Implement the minimum/default/profile and shared local-billing seam.
2. Run focused regressions and scripts/check as a recorded job; no paid model calls.
3. Write the short result report, remove regenerable worktree caches, save and finish.
## Failed approaches
## Notes and decisions
- Sequential decisions: 64K = 65,536 tokens; reject new configurations below it, preserve existing saved configurations, remove only the proposed 32K option. Existing 96K evidence remains a one-machine trial, not release proof.
- Ownership: this writer owns geo local-model profiles/UI/tests, a pure geo provider identity, and narrow billing/ledger/subagent/custom-picker seams plus their regression tests and documentation. No WP04/WP05 files.
- Work packages: context settings and local billing are small; billing consumers are tightly coupled. No substantial independent child package; implement directly.
- Integration order: declare upstream boundaries; pure identity and billing policy; consumers; context UI/API; regression checks; report and finish.
- No rollout or paid model execution in this unit. WP10 owns real-task 64K/98K trials and catalogue release distribution.
Closes: gaid-runtime#1
Closes: gaid-runtime#3
## Open items
None; remaining release-proof work stays in WP10, as already assigned.
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

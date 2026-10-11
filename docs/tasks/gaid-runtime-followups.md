---
format: 1
status: waiting
updated: 2026-10-11T04:44:53Z
writer: {"host":"seongin3","reserved":"4532bddaeed252d92fb3ced998e7493b4011111ccf99357f24fd5d925521b444"}
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

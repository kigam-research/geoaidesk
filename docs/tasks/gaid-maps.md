---
format: 1
status: waiting
updated: 2026-10-11T04:42:48Z
writer: {"host":"seongin3","reserved":"525532c561304251f1b7cd09aedacc4c46d7ca47b8b06c05ffe31f837880c5e3"}
branch: task/gaid-maps
target: main
parent: 
---
# gaid-maps

## Goal and done criteria
Request from the starter:

# Writer brief: WP05 `gaid-maps` (geoaidesk)

This unit answers forwarded goal 432814c7cee1 from the skill_hub project hub. The full forwarded request, including the
user's verbatim words, package text, status and inputs, is in /home/seongin3/data/geoaidesk/work/hub/432814c7cee1.md — read
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
- Checks: `scripts/check` (see AGENTS.md). App data for task work goes under ~/data/geoaidesk/work/gaid-maps/,
  never inside the repo. After your last check, remove regenerable build caches from the worktree
  (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next, web/next-env.d.ts,
  web/tsconfig.tsbuildinfo) so the unit can close.
- When the unit completes, its outcome returns to the skill_hub hub automatically through the goal link.

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

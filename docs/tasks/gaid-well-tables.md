---
format: 1
status: active
updated: 2026-10-11T04:47:58Z
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
- Resumed at the printed worktree; clean initial checkout. Read authoritative forwarded request and WP03 interfaces.
- Source contracts fetched read-only from skill_hub main to external task inputs. Exact worktree is not codegraph-indexed; native source reads used.
- Child tables: gaid-well-tables--tables, writer 8b4d426a-82dc-444e-9347-60354a8ffce4; owns table-only files. Complete it before final integration.
- LAS first implementation: read-only lasio 2.0 helper (64 MiB / 1M sample caps), bounded series routes, depth viewer and `.depth.json` manifest adapter, focused numerical/API/UI tests. Not yet verified.
- FORCE fixture exists at assets/force2020-welllogs/c8d01ee9; no model runs authorized or needed.
## Next steps
1. Implement LAS helper, bounded series API, depth viewer and manifest adapter.
2. Integrate independent table package after LAS slice, run focused and full checks, task sync, report, remove regenerable caches, task finish.
## Failed approaches
## Notes and decisions
- Sequential decisions: preserve raw values/order/nulls; unknown depth basis/datum stay unknown; LAS 2.0 numerical support only, LiDAR and LAS 3 explicit unsupported. Full-data operations capped separately from metadata inspection. Display reduction retains spikes and explicit gap boundaries.
- Independent package: tables child owns new table helper/routes/contracts/viewer/tests only. Parent owns LAS helper/routes/depth UI/manifest/tests and all shared glue, integration boundaries, AGENTS and canonical report.
- Interfaces settled: table child exports registerGeoTableRoutes(app) and default TableRolesViewer(ViewerProps), on explicit user choice from existing table surfaces; it never replaces generic table editing. Both use WP03 sandbox resolution and inspection conventions. No overlap in owned files.
- Integration order: LAS first; complete child and append table routes/UI entry; task sync with WP05 keeping both append-only entries; final scripts/check. No separate review quota.
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

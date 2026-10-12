---
format: 1
status: active
updated: 2026-10-12T09:11:30Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"3deaaa94-6146-4a8e-bcdd-a4b418119648","pid":3104588,"provider":"claude","session":"faf47acc-261b-40ba-9a0d-c18d0e922752","start":"26228112","token":"6a36ad34b48eccc61baf2cd33f8b62570ba6f59749ebdf9f20c421a3674a4a1f"}
branch: task/gaid-map-table-ux
target: main
parent: 
---
# gaid-map-table-ux

## Goal and done criteria
Request from the starter:

## User request (verbatim, Korean, 2026-10-12, geoaidesk hub; the user reviews GAID hands-on from PC71)
Screenshots (copies, read them): /home/seongin3/data/geoaidesk/work/hub/screens-2026-10-12/
map-layout.png (1st), attribute-table.png (2nd), geoscience-workflows.png (3rd), kdense-workflows.png (4th).

> "첨부한 이미지처럼 맵과 관련해서는 맵 오른쪽 패널에 범례와 기본 정보가 표시되어야 이용자들이 스크롤 없이 확인 가능하다. 그리고 2번째
> 이미지처럼 테이블의 경우 상단 컬럼 이름에서는 필터 및 오름/내림 차순과 같은 기능을 적용하여 테이블 조회를 할 수 있어야 한다. 그리고
> 선택된 포인트의 정보는 최하단에 위치하는 것이 아니라 맵에서 미니팝업으로 정보가 표시되어야 한다. 그리고 세번째 이미지처럼 대화창
> 상단의 workflow를 클릭하면 Geoscience 작업에 대한 레시피가 표시되는데 기존 K-Dense workflow에서 제공하는 4번째 디자인과 같이
> 일관되게 ui를 개선해야하며, Geoscience 카테고리를 추가하고 workflow를 4번째 디자인과 같이 구성하는 것이 필요하다. 레시피를
> 추가할때 카테고리를 선택하게 하는 방식으로 해야 자유도와 기능 확장성을 만족할 수 있을 것이다. 그리고 스킬을 추가할 때에는
> skill_hub 프로젝트에서 작업한 skill_hub 사이트를 클릭하여 스킬을 탐색하고 해당 사이트에서 스킬을 가져올 수 있게 연계하는 방안도
> 검토 후 적용해보아야 한다."

The geoaidesk hub split this into two parallel units: `gaid-map-table-ux` (map side panel, attribute-table column
filter/sort, map mini-popup) and `gaid-workflow-catalog` (workflow panel, Geoscience category, recipe add with category,
skill_hub site link for adding skills). Do only your unit's part; add no other required items.

# Writer brief: `gaid-map-table-ux` (geoaidesk)
Scope (from the request):
1. Map viewer: legend and basic layer information (CRS, extent, units, source/attribution, layer list/opacity as fits) in a
   panel to the right of the map, visible without scrolling; narrow widths need a sensible fallback.
2. Attribute table: column-header controls for filter and ascending/descending sort when browsing the table.
3. Selected feature/point information shown as a mini popup on the map instead of the list at the bottom.
Files: web/src/geo/viewers/map/ and the table component it uses (server routes in server/src/geo/maps/ only if filter/sort
must run server-side for paged layers — then state the limits). Keep the WP05 rules: preview/tile values never feed area
analysis; source CRS vs display CRS stay distinct.
## Common facts and rules (verified by the hub)
- Base: geoaidesk main f8cd1a4 (includes gaid-map-tiles, reports/2026-10-12-gaid-map-tiles/index.md). The other unit runs
  in parallel; keep to your files. If you must touch a shared seam (e.g. web/src/geo/locales/*/ or
  geo/integration-boundaries.json), append only and integrate with `task sync` before finishing; keep both sides on conflict.
- Review instance the user is using: unit `gaid-review` from ~/deploy/geoaidesk, ports 3000 (UI) / 18000 (backend), data
  ~/.geoaidesk with samples under projects/default/sandbox/user_data/samples/. Do not stop or modify it or its data; run
  your own instance on other ports. The hub updates the review instance after your unit is merged.
- Visible strings follow AGENTS.md "UI copy and locales" (web/src/geo/locales/, geo/copy/ validator; Korean first).
- Writer setup: you are the Claude top-level orchestrator; child writers/workers use the Paseo profile "general work"
  (gpt-6.1-sol high) at normal speed. No paid model runs unless the user asks.
- Evidence: browser screenshots at desktop and narrow widths of the changed screens (small PNGs in the report folder).
  Checks: `scripts/check`. App data under ~/data/geoaidesk/work/<slug>/. After your last check remove regenerable build
  caches from the worktree (server/node_modules, server/src/helpers/.venv, web/node_modules, web/.next,
  web/next-env.d.ts, web/tsconfig.tsbuildinfo, __pycache__) so the unit can close.

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

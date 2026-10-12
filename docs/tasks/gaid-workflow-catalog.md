---
format: 1
status: waiting
updated: 2026-10-12T09:11:23Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"3bd27baa-1dd6-4dc1-8996-69912d62ed83","pid":3106452,"provider":"claude","session":"4dd2c1b6-66b7-42cc-9f2d-f81be1d0f80f","start":"26229284","token":"fc2e7c07fe890e3f4986ff5dd2613f603b3589ae70ba499e96df0ca073ac705c"}
branch: task/gaid-workflow-catalog
target: main
parent: 
---
# gaid-workflow-catalog

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

# Writer brief: `gaid-workflow-catalog` (geoaidesk)
Scope (from the request):
1. The chat-header "workflow" panel: make the Geoscience recipes consistent with the upstream K-Dense workflow design
   (search box, category chips, grouped list rows with icon, title, one-line description and badges such as
   "Needs user data"); upstream component: web/src/components/workflows-panel.tsx. Add a Geoscience category (recipes from
   the pinned catalogue, now shown as large cards in a separate section, see geoscience-workflows.png) and lay it out like
   the K-Dense list. Keep GAID readiness states (ready / environment needed / untested) as badges, not removed.
2. Adding a recipe ("레시피 가져오기"): the user chooses its category, so categories stay extensible.
3. Adding skills: review, then apply, a link to the skill_hub site so the user can browse skills there and bring a skill
   into GAID. Facts: the currently published skill_hub sites are the old Geo Skill Atlas
   (https://kigam-research.github.io/skill-atlas/ static, and https://k0010499-4310.jpe1.devtunnels.ms with GitHub login);
   the new GAID public site (skill_hub WP08 gaid-public-site) is built but not published (WP11). Read skill_hub sources
   read-only with `gh api repos/kigam-research/skill_hub/contents/<path>?ref=main -H "Accept: application/vnd.github.v3.raw"`
   (raw.githubusercontent.com is blocked) — e.g. registry/byok/, the catalogue archive format, Studio export packages.
   GAID's existing preview→install path (skills-install.ts, stagingToken, user acknowledgement) must stay the install
   gate. If the link needs a change on the skill_hub side (e.g. an "add to GAID" link or package download), do the
   GAID side and send the skill_hub part to the geoaidesk hub as a request for the skill_hub hub; do not edit skill_hub.
   Record the review (options, chosen approach, limits) in your report.
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

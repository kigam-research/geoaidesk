---
format: 1
status: waiting
updated: 2026-10-22T03:09:03Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"849a23ad-50f2-46d5-a50d-429f6e051f84","pid":3074695,"provider":"claude","session":"3c8f1177-4ae1-4859-8c7e-ac80e5eff692","start":"52649086","token":"0f5c55bfa3a4a46f74e8582d253c36414bdd254b78e1e7147c11f4a48355f209"}
branch: task/gaid-hub-layout
target: main
parent: 
---
# gaid-hub-layout

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-layout (user feedback 2026-10-22)

User feedback (verbatim): "추가 피드백으로 첨부한 이미지처럼 GAID 허브에서 추천 워크플로우의 워크플로우를 클릭하면 왼쪽 사이드 패널이 사라지고 있다. 이것은 일관성이 없는 UIUX이다."
Screenshot (user's review app, main 28c9323d): ~/data/geoaidesk/work/hub/feedback/2026-10-22-hub-detail-no-sidebar.png —
the hub Workflow detail opened from 추천 Workflow shows only "‹ 허브 목록" and the page, with no left sidebar.

Scope (layout consistency, guide v2 §3 and navigation rules; gaid-ui-v2-debts already added L1/L2/N2/N6 on main):
- Keep the same left sidebar (and app bar) on hub detail views as on the hub home: Workflow detail opened from 추천 Workflow,
  from 허브에 등록된 Workflow, from 내가 만든 Workflow, catalogue cards, drafts/authoring and any other hub sub-page. Check every
  hub route for the same inconsistency and fix them together; the back link can stay as a secondary affordance.
- Same review rules: 2 styles × 2 themes, 1440x900 and 1280x800 (plus 1024–1279 px with L1), check-ui passes.
Brief report with screenshots. Own GAID_HOME under ~/data/geoaidesk/work/gaid-hub-layout/; do not modify ~/.geoaidesk. Avoid files owned by the active gaid-research-visuals children. Outside check: no outside check.

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

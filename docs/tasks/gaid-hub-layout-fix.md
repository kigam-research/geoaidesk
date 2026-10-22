---
format: 1
status: waiting
updated: 2026-10-22T03:48:14Z
writer: {"host":"seongin3","reserved":"ea331793c1373217fa254345a44f114b47defad1bea78ef444303ba67d7e3444"}
branch: task/gaid-hub-layout-fix
target: main
parent: 
---
# gaid-hub-layout-fix

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-layout-fix

Hub finding (2026-10-22): gaid-hub-layout merged to main (PR #60, 9a6dd5d2) without two untracked paths, because `task save`
without paths pushes tracked edits only. main now imports `./hub-sidebar` from web/src/geo/hub/hub-screen.tsx, hub-home.tsx and
shared-browse.test.tsx, but web/src/geo/hub/hub-sidebar.tsx is missing, so the web build/tests on main fail. The unit's report
folder reports/2026-10-22-gaid-hub-layout/ is also missing (its task document declares it).
This fixes the integration of the user's request in gaid-hub-layout ("GAID 허브에서 추천 워크플로우의 워크플로우를 클릭하면 왼쪽 사이드
패널이 사라지고 있다. 이것은 일관성이 없는 UIUX이다.", 2026-10-22).

Recovered copies (taken from the old worktree before cleanup; sha256):
- ~/data/geoaidesk/work/hub/recover/gaid-hub-layout/hub-sidebar.tsx (29af08ee477abe3669f0ca6aa7be7fc3ab95e19b2e160610258fdea87fec9b8c)
- ~/data/geoaidesk/work/hub/recover/gaid-hub-layout/report/ (index.md 09d32a39…, figures/*.png)
Do: add hub-sidebar.tsx at web/src/geo/hub/ and the report at reports/2026-10-22-gaid-hub-layout/ (save with explicit paths),
confirm main's code matches this file (types/exports used by hub-screen.tsx, hub-home.tsx, shared-browse.test.tsx), run
scripts/check, then task finish. No other changes. Outside check: no outside check.

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

---
format: 1
status: waiting
updated: 2026-10-18T11:26:47Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"81c1eacb-84d7-460a-b61b-4e2be6067a45","pid":160287,"provider":"claude","session":"f33cd217-a4a1-4543-b115-693a0e6a8e72","start":"21075456","token":"1535f0d6ef859e6718f8fef67ae04e89df7f05e795203b4fd9ce36f9f83891fa"}
branch: task/gaid-system-ui-followups
target: main
parent: 
---
# gaid-system-ui-followups

## Goal and done criteria
Request from the starter:

# Request: gaid-system-ui-followups

User decision (verbatim, 2026-10-18, to the geoaidesk hub): "따로 작은 작업으로 권장 방식으로 지적 처리하고 output 작업도 별도작업으로 진행하자."
It chooses the hub's recommended option 나): a small separate unit for two findings forwarded by gaid-hub-novice-review
(request f5448549a275, first-time-user review round 3). gaid-system-ui, which owned these screens, had already closed.

Forwarded findings (verbatim from gaid-hub-novice-review; evidence pc74:~/data/geoaidesk/work/gaid-hub-novice-review/novice3/
summary.md findings 2 and 7, log.md steps 3, 7, 13-18, screenshots novice3/shots/16-csv-preview-error.png, 09-start-settings.png):

1. File panel, CSV over the preview limit (a 16 MB CSV): the size-limit error is parsed as CSV, so the table shows
   "[오류: 파일이 미리보기 크기 한도(CSV 8 MB" and "다른 텍스트 512 KB)를 초과합니다. 전체 파일을 보려면 다운로드하세요.]" as
   two column headers with "조건에 맞는 행이 없습니다." Suggest a dedicated size-limit state (and, if cheap, a bounded
   header + first rows sample or a link to the inspection action).
2. Workflow list row of an installed registered hub method shows "레시피", "준비됨", "미시험", "사용자 자료 필요" and
   "초안" at once, still "사용자 자료 필요" after the CSV was uploaded; the researcher cannot tell which badge describes
   the package, the project or a run. gaid-system-ui's 8ae7682 (now on main) caps rows at three badges; check this case.

Note: that review round may have run before gaid-system-ui merged; reproduce on current main first.
Done: both fixed per docs/design/ui-guide.md and the copy rules, checked in the real app (Korean screenshots
1440x900 and 1280x800). Report briefly. Outside check: no outside check (UI fixes).

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

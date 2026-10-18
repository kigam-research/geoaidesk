---
format: 1
status: done
updated: 2026-10-18T11:47:38Z
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
- Both findings fixed and checked in the real app (dev instance with the novice-review data, the same 16 MB CSV and
  installed hub method), Korean, 1440x900 and 1280x800; screenshots in the report.
  1. Over-limit text files: `use-sandbox` marks a 413 tab `previewLimited`; `FileViewer` shows `PreviewLimit`
     (`web/src/geo/viewers/preview-limit.tsx`: size, limits, download, first 8 rows/8 columns from `POST /geo/inspect`,
     estimated total rows); no Retry. Edit is hidden for size-limited and failed loads (a save would have written the
     notice over the file).
  2. Hub method badges name their scope (`허브 초안`; tooltips "현재 프로젝트…"); `사용자 자료 필요` removed; the
     Workflow card in the method detail drops its duplicate badge row.
- Tests: web vitest for file-preview-panel, methods, workspace pass; copy validator 0 errors (61 warnings, as main);
  check-ui 0 errors; web tsc clean. Full `scripts/check` passed (exit 0, 2026-10-18).
- Dev instance `gaid-suf-dev` stopped; its data stays in `~/data/geoaidesk/work/gaid-system-ui-followups/`.

## Next steps
<!-- task:closed -->
Closed 2026-10-18T11:47:38Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Orchestration: two small, tightly coupled UI fixes; done by the writer alone, no child units.
- Fix 1 (owned files: `web/src/lib/use-sandbox.ts`, `web/src/components/file-preview-panel.tsx`, new
  `web/src/geo/viewers/preview-limit.tsx`, files locale): the tab carries a preview-limit flag; the viewer shows a
  dedicated state (what the limit is, the file size, a bounded first-rows sample from `POST /geo/inspect`, download);
  no Retry; Edit hidden for any load-error or size-limited tab.
- Fix 2 (owned files: `web/src/geo/methods/methods.tsx`, methods/workspace locales): each badge names its scope (hub
  package stage, GAID trials in this project, environment); `사용자 자료 필요` leaves the badges (the inputs line already
  lists required inputs).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-18-gaid-system-ui-followups/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

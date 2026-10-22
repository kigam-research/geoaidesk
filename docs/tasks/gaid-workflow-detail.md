---
format: 1
status: active
updated: 2026-10-22T04:38:44Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"f0f8b936-04ba-445e-8692-977c00c3f2ca","pid":3727117,"provider":"claude","session":"0108f72c-c60f-4f11-aa8e-848e1936429e","start":"53182089","token":"50a39945d0d6bb4b5db11aca3fce31f50cb45aede646d1658cbd771f06add8e2"}
branch: task/gaid-workflow-detail
target: main
parent: 
---
# gaid-workflow-detail

## Goal and done criteria
Request from the starter:

# Request: gaid-workflow-detail

User decision (verbatim, 2026-10-22): "우선 첫표 두항목은 권장안대로 하자." — answers gaid-system-ui#1 with option 가).
Item: the Workflow (method) detail dialog shows the trial record's tool-call counts, hub check IDs and English messages as they are
(UI guide R1, R3, P3). Option 가): turn it into a researcher-facing summary plus a "기록 보기" (view record) that holds the raw trial
record, consistent with how the hub shows the same information (hub Workflow detail, workflow-view.tsx).
Done: implemented per docs/design/ui-guide.md v2 (copy rules in geo/copy/: Korean first, no agent internals in researcher views),
2 styles × 2 themes at 1440×900 and 1280×800, check-ui and scripts/check pass; brief report.
Coordination: gaid-workflow-strip (Workflow suggestion strip above files) and gaid-research-visuals are active; avoid their files.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-detail/; do not modify ~/.geoaidesk. Outside check: no outside check.

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

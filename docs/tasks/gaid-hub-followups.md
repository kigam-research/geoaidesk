---
format: 1
status: active
updated: 2026-10-18T04:35:23Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"9359a03e-346b-46ab-8fd2-b550d5f2892a","pid":2509241,"provider":"claude","session":"eb90d3f8-ef5f-4682-a9ac-f9f30fcfb71b","start":"18601177","token":"2d3dd8390a92fcf9b4abf90fd2ccf7992fce26cc1f0b454ab49bb9a35e29d5e0"}
branch: task/gaid-hub-followups
target: main
parent: 
---
# gaid-hub-followups

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-followups

User request (verbatim, 2026-10-18, to the geoaidesk hub):
- "gaid-hub-integration와 gaid-hub의 작업 및 개선 작업에 대해 권장 옵션으로 작업 진행하자."
- After the hub's scope confirmation: "시작하자."

Open items this unit answers (recorded with `task item answer ... --follow-up gaid-hub-followups`):
- gaid-hub-integration#1 가): re-run the same limited trial with a revised hub package (same instruction text as
  the gaid-hub-integration trial); confirm the method reaches its first check point.
- gaid-hub-integration#2 가): fix the remaining GAID defects together, under the same screen rules.
- gaid-hub#2, #3, #4, #5: do them.
gaid-hub#1 (user's own screen review) and the gaid-release-proof items are out of scope.

Scope confirmed with the user (the hub's summary, accepted with "시작하자."):

1. PU method revised package and re-trial (gaid-hub-integration#1, gaid-hub#5). Authoring moved into GAID in
   gaid-hub, so the revised package is produced inside GAID. Fix the package defects listed in
   reports/2026-10-16-gaid-hub-integration/index.md section 6 (variogram compute scale, variogram library install
   name / availability in the MPM analysis environment, expected result file names, display names for scientific
   choices, "(선택)" in input names, empty source title / English check warnings, Workflow request text) and in
   reports/2026-10-16-gaid-hub/index.md section 5 (expected outputs/... names vs actual results/, figures/
   locations; BaggingPU taking 11 min in quick mode). Then re-run the same trial with the same instruction text.
   Where a defect comes from GAID's authoring rules rather than this one package, fix the rule so later drafts get
   it too.
2. GAID defects (gaid-hub-integration#2, gaid-hub#2): progress indication for long runs; installed hub methods
   in task suggestions for uploaded files; stop the repeated preview requests for CSV over 8 MB left open in the
   file panel (413 loop); a text label on the "send this analysis to skill_hub draft" icon; verify the hub-side
   receive (bundle attached as draft material); chat "실행 중단" must also stop background computation the agent
   started; the data-protection confirmation dialog must not block unattended trials.
3. Hub improvements (gaid-hub#3, #4): a list of methods other researchers registered on the hub front page
   (folders + search); authoring questions for "원본 코드 포함" and "빠른 시험용 줄인 설정"; start-setting defaults
   that follow the researcher's intent (currently the paper's values).

Delivery: one unit; the writer may split the three packages into non-overlapping child units. One report for the
user. After this unit completes, the review app (gaid-review on PC74, ~/deploy/geoaidesk) is updated once to the
new main (user's standing practice: update the review app once after work completes).

Outside check: no outside check (app work; the re-trial is the acceptance evidence for package 1).

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

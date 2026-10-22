---
format: 1
status: waiting
updated: 2026-10-22T12:06:39Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c7c994c8-9104-4a2d-91ca-02598ddfa51c","pid":3710652,"provider":"claude","session":"71412738-bdac-483a-bb75-b3200c12f5e4","start":"55874657","token":"7300838461defcef07e6e5adf36f6fd631e6d0e4dc5860a2c9bdad6b1f73a570"}
branch: task/gaid-first-use-fixes
target: main
parent: 
---
# gaid-first-use-fixes

## Goal and done criteria
Request from the starter:

# Request: gaid-first-use-fixes

User decision (verbatim, 2026-10-22): "gaid-user-acceptance#1 가) 후속 작업 하나로 묶어 고침"
Fix, in one unit, the 8 screen problems a first-time researcher hit in the acceptance test (evidence and screenshots:
reports/2026-10-22-gaid-user-acceptance/index.md §3.5 "처음 쓰는 사용자가 막히거나 헷갈린 점"):
1. a new chat's default model is not connected;
2. two models with the same name in the picker;
3. links shown as "[blocked]";
4. the citation column of wide tables in chat (clipped/unreadable);
5. arXiv suggested in bibliography recommendations;
6. the "모두 읽음" wording;
7. "형식 확인 필요" shown far too often;
8. a progress card in Japanese.
For each: reproduce, find the cause, fix it, verify in the real app (2 styles × 2 themes where UI changes; 1440×900 and 1280×800),
copy per geo/copy rules and UI per docs/design/ui-guide.md v2. scripts/check passes; report per item before/after.
Coordination: gaid-hub-server-trial is connecting the user's review app (PC74 :3000) to the hub server — do not touch the review app or
~/.geoaidesk; own GAID_HOME under ~/data/geoaidesk/work/gaid-first-use-fixes/ (copy review-app data read-only if you need realistic state).
gaid-orcid is active (accounts/ORCID); avoid its files. Outside check: no outside check.

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

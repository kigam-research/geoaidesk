---
format: 1
status: waiting
updated: 2026-10-22T08:53:44Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"400aacd9-7779-4bf3-ab8c-e98d550c4052","pid":1863145,"provider":"claude","session":"b20776ed-6e09-404a-9a44-f314dc51b675","start":"54717064","token":"e6b2d7e50e6e07340078e8ed28d9158f46d4e63bfcf7a50af80c3fc8d260fc7d"}
branch: task/gaid-hub-server-trial
target: main
parent: 
---
# gaid-hub-server-trial

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-server-trial

User words (verbatim, 2026-10-22, to the geoaidesk hub): "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자. 사용자가 직접 확인해야하는 부분과 관련해서는 유료 구독 모델 시험의 경우 3000번 시험용 앱을 사용하여라. 그리고 PU빠른 시험은 제외해도 된다. gaid-release proof#2를 제외하고는 직접 테스트 에이전트(GPT 6.1 sol high 워커)를 GAID 허브와 시스템을 모르는 이용자라고 간주한 뒤 테스트를 진행하게 하면 된다. gaid-zotero-web-fix는 인증서 문제를 이미 해결한 것으로 이해하고 있다. 웹 서재에도 논문을 추가해두었다."

Items answered with this unit as follow-up (texts in docs/open-items/gaid-backend.md; report reports/2026-10-22-gaid-backend/index.md §6):
1. gaid-backend#1 가): run the institute GAID hub server on PC74 as a fixed service at the merged main SHA (new services run from
   ~/deploy/<project> at a pinned SHA; use a user systemd unit with file logs; port not clashing with 3000/18000 or other units),
   create the user's admin account invite code and hand it to the user in your tab, migrate the review hub's 5 Workflows to the
   server with an author mapping the user decides (ask in your tab).
2. gaid-backend#3 가): move hub skill records (gaid-hub-skills shelf) to the hub server the same way as HubRecordStore entries.
3. gaid-backend#2 가): HTTPS before the trial widens beyond the test group. Prepare and document the switch (reverse proxy or certificate,
   config only); do not widen without it. Record in the report what is needed to turn it on.
Coordination (important): unit gaid-user-acceptance is testing in the user's review app (PC74 :3000/:18000, data ~/.geoaidesk) at the same
time. Do not restart, reconfigure or point the review app at the hub server until the hub says that testing is done; read its hub store
only to migrate (copy, never modify ~/.geoaidesk). After that, ask the hub to connect the review app to the server.
gaid-hub-skills-2 (reviewer roles, admin disable, reports, GitHub upstream compare) starts after this unit; keep the account model ready
for a reviewer role. UI per docs/design/ui-guide.md v2. Outside check: no outside check.

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

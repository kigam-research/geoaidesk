---
format: 1
status: waiting
updated: 2026-10-22T04:40:54Z
writer: {"host":"seongin3","reserved":"cb3fe81ab18b49eee1407e968dd49a72031d140445992e9a34169e97d8776bc3"}
branch: task/gaid-zotero-web-fix
target: main
parent: 
---
# gaid-zotero-web-fix

## Goal and done criteria
Request from the starter:

# Request: gaid-zotero-web-fix

User report (verbatim, 2026-10-22, answering gaid-library-folders#2): "gaid-library-folders#2 와 관련해서 PC Zotero는 앱이 켜져있을 때 연결되는 것을 확인했고, 웹키로는 연결은 되었는데 닿지 못했다고 한다."
Screenshot: ~/data/geoaidesk/work/hub/feedback/2026-10-22-zotero-web-unreachable.png — library header shows "Zotero 연결 안 됨" while
the Zotero card shows "연결됨 · 아직 갱신 전" and the warning "Zotero에 닿지 못했습니다. 잠시 뒤 다시 시도하세요."; library has 0 papers.
Hub facts: the test ran on the review app on PC74 (main d66762a7, backend :18000; its log shows POST /geo/library/zotero/web);
api.zotero.org answers HTTP 200 from PC74 (checked 2026-10-22), so plain network reachability is not the cause; the root cause is
not yet known.

Do:
1. Find why a saved Zotero Web API key ends in "닿지 못했습니다" on refresh (code: server/src/geo/library/zotero/**, routes, web
   screens web/src/geo/library/**). Check user/group library id resolution, key permissions, request headers/version, proxy/timeout
   handling, error mapping (a 403/404/invalid-library error must not be shown as "unreachable"). You may read the review app log
   ~/data/geoaidesk/work/review-app/launcher.log; never read keys or ~/.geoaidesk config/env files, and do not modify ~/.geoaidesk.
   If a real key is needed to reproduce, ask the user in your tab to enter one in your test app (never paste it into files/chat).
2. Fix the inconsistent status: the header and the Zotero card must report the same state (PC connection vs web key, and
   "connected but not refreshed / refresh failed with reason").
3. Show the actual cause and next action in researcher copy (geo/copy rules), e.g. wrong key permission, wrong library.
4. Note for the PC (Local API) path: it works only while the Zotero app is running (user-confirmed); make the UI say so.
Done: web-key refresh works with a valid key (verified with the user's key in your test app, or a documented reproduction), status
consistent, tests added for the error mapping, scripts/check passes, UI per guide v2 (2 styles × 2 themes). Brief report.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-zotero-web-fix/. Outside check: no outside check.

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

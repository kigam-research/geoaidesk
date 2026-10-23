---
format: 1
status: waiting
updated: 2026-10-23T08:36:52Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"63c6aa87-c4a4-4624-9c99-d7f3096d74a3","pid":3356915,"provider":"claude","session":"abfb67d2-5d61-4efb-96c3-d2f9ec8416bb","start":"63255981","token":"96268dc30643485eaa762b4dfbb47ec9211b079885bf6e4624511700c1495289"}
branch: task/gaid-hub-rollout-versions
target: main
parent: 
---
# gaid-hub-rollout-versions

## Goal and done criteria
Request from the starter:

# Goal: gaid-hub-rollout-versions — redeploy the institute hub server to main and bring the review app to the same SHA

## User decision (verbatim, 2026-10-23)

> 권장대로 진행하자.

Answer to the hub's question (option 가): redeploy the institute hub server (PC74 :8700, now 982389c5) to current main so
Workflow removal/restore and semantic versions (gaid-hub-versions) work, and update the review app to the same SHA once
gaid-pocheon-trial (D) says the review app is free. ORCID phase 2 code comes along but stays inactive: do NOT set an ORCID
client secret on the hub server (open item gaid-orcid#1 stays open).

## Done

1. Hub server: `node geo/hub-server.mjs backup` + `check-backup` (home `~/data/geoaidesk/hub-server/home`, service
   `gaid-hub-server.service`, current snapshot `~/deploy/geoaidesk-hub-server/982389c5…`). Deploy a pinned snapshot of
   origin/main (git archive + npm ci, as gaid-hub-feeds-rollout did — see docs/tasks/gaid-hub-feeds-rollout.md on main) to
   `~/deploy/geoaidesk-hub-server/<sha>`, back up the unit file, repoint, restart. Confirm migrations 4 and 5 applied, health OK
   with the same serverId, accounts/Workflows (5)/files/comments/stars/library sync/feeds intact, existing revisions shown as
   0.1.0, 0.1.1 … in order, and that ORCID shows "not configured". Keep the old snapshot; record the rollback steps.
2. Review app: only after the hub forwards D's "review app free" (or D tells you directly) — update once to the same main SHA.
   It now runs LOOPBACK-ONLY on the user's instruction (2026-10-23 17:34 KST "검토용 앱과 관련해서 우선은 토큰 접속은 꺼두자. 차주
   월요일에 다시 켤것이다."): restart recipe WITHOUT KADY_HOST / NEXT_PUBLIC_ADK_API_URL / KADY_AUTH_TOKEN:
   `systemctl --user stop gaid-review`; detach-checkout the SHA in ~/deploy/geoaidesk; `systemd-run --user --unit gaid-review --collect
   -p WorkingDirectory=/home/seongin3/deploy/geoaidesk -E PATH=/home/seongin3/.local/bin:/usr/local/bin:/usr/bin:/bin -E HOME=/home/seongin3
   -E KADY_PORT=18000 -p StandardOutput=append:/home/seongin3/data/geoaidesk/work/review-app/launcher.log
   -p StandardError=append:/home/seongin3/data/geoaidesk/work/review-app/launcher.log /home/seongin3/deploy/geoaidesk/start-gaid.sh`.
   Back up ~/.geoaidesk config first; keep pi-agent/hub-server/connection.json. Verify on http://127.0.0.1:3000 (playwright-cli):
   hub status (admin), Workflow list with versions, remove + restore one test entry you create (not the user's), 서재 research-note
   category and PDF side panel, 자료 소식.
3. PROJECT.md: record both SHAs (it still lists a8d35c6b for the review app) and the loopback mode.

Ops change: no ADR, no report. Outside check: none. Ask the user only on a failed migration or data mismatch.
Main at request time: 7703739a.

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

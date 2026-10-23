---
format: 1
status: done
updated: 2026-10-23T09:37:29Z
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
1. Hub server DONE 2026-10-23 08:39Z. Backup `~/data/geoaidesk/hub-server/backups/2026-10-23-before-7703739a` (+ unit file copy
   `gaid-hub-server.service.982389c5`), `check-backup` passed: accounts 1, hub_entries 7 (the user registered two since the
   last rollout), hub_files 19, stars 1, comments 5, installs 8, library_objects 9, library_files 5, feed_sources 18,
   feed_items 334. Snapshot `git archive 7703739a` + `npm ci` in `server/` at `~/deploy/geoaidesk-hub-server/7703739a…`
   (npm skipped install scripts as before); smoke-served a copy of the backup on 127.0.0.1:8791 first (migrations 4+5 applied,
   same serverId). Unit repointed (comment, Description, WorkingDirectory, TASK_SOURCE_SHA), daemon-reload, restart: active,
   health same serverId `hub-1f510d4fd3f6345b1d11c3506d878fc6`, migrations 4 and 5 applied 2026-10-23T08:39:31Z, all row counts
   unchanged, `hub_entry_removals` 0. No `orcid-client.json` in the home (ORCID not configured). The review app (still
   b74950e7) reaches the hub as admin and lists the 7 entries.
   Rollback: `cp <backup>/gaid-hub-server.service.982389c5 ~/.config/systemd/user/gaid-hub-server.service`,
   `systemctl --user daemon-reload && systemctl --user restart gaid-hub-server` (migrations 4/5 only add tables/columns; if
   needed restore the backup with check-backup first). Old snapshot `982389c5…` kept.
2. Review app DONE 2026-10-23 ~18:31 KST at origin/main `3171c57c` (contains D's 1684c887, PR #91, and gaid-authoring-evidence-view;
   hub confirmed no hub-server code change since 7703739a). Config backup
   `~/data/geoaidesk/work/review-app/config-backup-20261023T183027` (config.env + pi-agent without packages/sessions);
   stopped, detached ~/deploy/geoaidesk at 3171c57c, restarted with the loopback recipe (env PATH, HOME, KADY_PORT only);
   `next build` ran; listens on 127.0.0.1:3000 and 127.0.0.1:18000 only. `pi-agent/hub-server/connection.json` untouched;
   `/geo/hub-server/status` = admin seongin@kigam.re.kr, reachable, same serverId.
   Browser checks (playwright-cli 1440x900, screenshots in `~/data/geoaidesk/work/gaid-hub-rollout-versions/playwright/`):
   - Workflow list 8 → the 2-revision entry shows version 0.1.1 with history 0.1.0, 0.1.1; others 0.1.0 (also via API).
   - Remove + restore on a test entry I created (`entry-ap-rollout-test1`, "[시험] 삭제·복원 확인용 (지울 항목)", folder 일반):
     made from a copy of the user's draft ap-04567077-100 with a new id/slug/title (copy edited on disk; the review app was
     restarted once at the same SHA because the authoring store caches projects). Removed in the UI with a reason → list 7,
     entry read 404, 제거된 Workflow 1; restored from 제거된 Workflow → list 8, removed 0. Cleanup: removed it again (stays
     hidden in the hub server's removed list, records kept as designed; re-registration of that id refused) and deleted the
     test draft (DELETE /geo/authoring/projects/ap-rollout-test1 → 204). The user's entries and drafts untouched.
   - ORCID: `/geo/orcid` hub state `not-configured`; 서재 shows "허브에 ORCID 연결이 설정되지 않았습니다."
   - 서재: 논문 7 / 정리 노트 0 switch present; a paper's "PDF 열기" opens the PDF side panel with page navigation.
   - 자료 소식: 18 approved sources, 166 items, last collection 17:40; 0 console errors.
3. PROJECT.md: hub server 7703739a + backup, review app 3171c57c + config backup, loopback mode recorded.
Re-verify: `curl -s http://127.0.0.1:8700/hub/v1/health`; `git -C ~/deploy/geoaidesk rev-parse HEAD`;
`ss -ltn | grep -E ':3000|:18000'`; `curl -s http://127.0.0.1:18000/geo/hub-server/status`.
## Next steps
<!-- task:closed -->
Closed 2026-10-23T09:37:29Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Editing an authoring project.json while the review app runs does not take effect: the authoring store caches
  projects in memory and writes its copy back on the next mutate. Edit with the app stopped (or restart it).
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

---
format: 1
status: active
updated: 2026-10-23T01:02:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"9c871e42-f08d-4084-805b-aa4958eac902","pid":2393155,"provider":"claude","session":"b2eda6a9-60b9-413a-beca-e844bbb3f536","start":"60526576","token":"e9030db486b261cf9fb91c9d4af7a9aa8f225ada86c78b31dd759dd66adee37e"}
branch: task/gaid-hub-feeds-rollout
target: main
parent: 
---
# gaid-hub-feeds-rollout

## Goal and done criteria
Request from the starter:

# Goal: gaid-hub-feeds-rollout — put the feed sources live on the institute hub server

## User decision (verbatim, 2026-10-23, answer to open item gaid-hub-feeds#1)

> gaid-hub-feeds 권장안으로 승인한다.

The recommended option was 가): approve all 18 proposed sources (10 geoscience, 7 tool news, 1 GitHub skill search),
after updating the trial hub server (PC74:8700) to main. Source: reports/2026-10-22-gaid-hub-feeds/index.md §6.

## Done

1. Hub server on main: back up first (`node geo/hub-server.mjs backup` then `check-backup`), deploy a pinned snapshot of
   current origin/main to `~/deploy/geoaidesk-hub-server/<sha>` (the service `gaid-hub-server.service` now runs from
   `.../cb63b1184f8839e3d0fc34b9f5981e59614350f1`, `serve --host 0.0.0.0 --port 8700`), restart, confirm migrations applied
   and the existing accounts, 5 Workflows and library sync data are intact. Keep the old snapshot for rollback.
2. As the admin account (seongin@kigam.re.kr), approve all 18 proposed sources (CLI or Settings → 기관 GAID 허브 →
   허브 서버 관리 → 자료 소식 출처), run one collection, and record per-source item counts and any failures.
3. Review app (PC74, systemd user unit `gaid-review`, checkout `~/deploy/geoaidesk`, data `~/.geoaidesk`, ports
   3000/18000): update once to the same main SHA so the researcher screen shows 자료 소식 and the hub skill shelf uses
   the server (it runs 52d8ca9d now). This was the deferred "update the review app once after gaid-hub-server-trial"
   step. Keep `~/.geoaidesk` and its hub-server connection file (`<agentDir>/hub-server/connection.json`); back up config
   first. Restart recipe: `systemctl --user stop gaid-review`, detach-checkout origin/main in ~/deploy/geoaidesk, then
   `systemd-run --user --unit gaid-review --collect -p WorkingDirectory=/home/seongin3/deploy/geoaidesk -E PATH=... -E HOME=...
   -E KADY_PORT=18000 -p StandardOutput=append:/home/seongin3/data/geoaidesk/work/review-app/launcher.log
   -p StandardError=append:/home/seongin3/data/geoaidesk/work/review-app/launcher.log /home/seongin3/deploy/geoaidesk/start-gaid.sh`
   (absolute script path). Check in a browser (playwright-cli) that 자료 소식 lists items while logged in.
4. Record deployed SHAs in PROJECT.md if it lists them, and the result in the task document `## Current state`.
   This is an ops change: no ADR; a short report only if useful.

Outside check: none. Ask the user only for things needing their access or a judgment (e.g. a failed migration).

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

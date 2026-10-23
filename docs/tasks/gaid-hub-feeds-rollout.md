---
format: 1
status: active
updated: 2026-10-23T01:06:15Z
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
Done 2026-10-23 (all four done items; ops change only, no ADR, no report):
1. Hub server: backup `~/data/geoaidesk/hub-server/backups/2026-10-23-before-982389c5` (+ old unit file copy), `check-backup`
   passed (accounts 1, hub_entries 5, hub_files 17, library_objects 4, library_files 3). Snapshot of origin/main
   `982389c59f5cda2b666fc9893d0d27a8017cad6c` via `git archive` + `npm ci` in `~/deploy/geoaidesk-hub-server/982389c5…`;
   unit file repointed, daemon-reload, restart. Health OK (same serverId), migration 3 applied 2026-10-23T01:03:38Z, row
   counts unchanged. Old snapshot `cb63b118…` kept; rollback = restore the unit file copy from the backup folder + restart.
2. Approved all 18 proposed sources as admin seongin@kigam.re.kr through the review app proxy
   (`PATCH /geo/hub-server/admin/feeds/sources/:id`; audit `feeds.approve` with the admin account id), then one fetch
   (`POST /geo/hub-server/admin/feeds/fetch`): all 18 ok, no failures. Items per source: nature-geoscience 8, nature 6,
   eos 15, solid-earth 20, hess 20, nhess 20, ocean-science 20, carbon-brief 12, nasa-earth-observatory 10,
   ore-geology-reviews 100, geeknews 9, pi-releases 10, pi-subagents-releases 10, pi-web-access-releases 10,
   skills-cli-releases 10, claude-code-releases 10, codex-releases 1, github-geo-skills 36 (sum 327; feed_items holds 326).
   Scheduled collection continues every 6 h.
3. Review app: config backup `~/data/geoaidesk/work/review-app/config-backup-20261023T100357` (config.env + pi-agent
   without packages/sessions); stopped, detached ~/deploy/geoaidesk at 982389c5, restarted with the recorded recipe
   (absolute script path). `~/.geoaidesk` and `pi-agent/hub-server/connection.json` untouched; `/geo/hub-server/status`
   shows the admin account, reachable. playwright-cli at 1440x900 `#hub/feeds`: heading 자료 소식, "승인한 출처 18곳",
   항목 164개 (unfiltered per-source cap 10), last collection 10:05, 0 console errors
   (screenshot `~/data/geoaidesk/work/gaid-hub-feeds-rollout/playwright/feeds-1440.png`). `/geo/hub/skills` answers `[]`
   (server shelf is empty; local shelf has no skills dir either).
4. PROJECT.md deployed SHAs updated.
Re-verify: `curl -s http://127.0.0.1:8700/hub/v1/health`; `curl -s http://127.0.0.1:18000/geo/hub/feeds | head -c 300`.
## Next steps
1. None; task finish.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-hub-feeds#1
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

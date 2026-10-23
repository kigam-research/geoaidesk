---
format: 1
status: active
updated: 2026-10-23T04:04:34Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"037fe804-20b3-4b8d-9e0c-c1be1dd8fd8c","pid":489203,"provider":"claude","session":"22c1f103-16a1-439b-abc6-3bf6b0e57fc0","start":"61617457","token":"dac1280ed95fd7a5b9961c7cfbcb087bf7a31151fc22f6199affc785e973e137"}
branch: task/gaid-review-app-sync
target: main
parent: 
---
# gaid-review-app-sync

## Goal and done criteria
Request from the starter:

# Goal: gaid-review-app-sync — bring the review app up to current main (ORCID phase 2 + project resume)

## User request (verbatim, 2026-10-23)

> 이제 촬영이 끝났으므로 oricd를 포함하여 검토용 앱에 통합 안된 부분이 있다면 통합해줘.

Also answers forwarded goal 3f6784ba6639 (gaid-orcid writer, user-confirmed): "아직은 기관 허브서브에 배포하지 않는다. 검토용 앱에
통합은 할 것이다." — timing "홍보 녹화가 끝난 뒤", which the user now says has happened.

## Verified facts (hub, 2026-10-23)

- Review app: PC74 systemd user unit `gaid-review`, checkout `~/deploy/geoaidesk` detached at ad9399d1, data `~/.geoaidesk`,
  log `~/data/geoaidesk/work/review-app/launcher.log`. origin/main is a8d35c6b (gaid-orcid phase 1+2 PR #79, gaid-project-resume
  PR #81; 45 app files differ). gaid-promo-video-v2--study reports its capture finished ("Ready for parent integration").
- Current unit environment (keep exactly): PATH=/home/seongin3/.local/bin:/usr/local/bin:/usr/bin:/bin, HOME=/home/seongin3,
  KADY_PORT=18000, KADY_HOST=0.0.0.0, NEXT_PUBLIC_ADK_API_URL=http://10.13.15.74:18000,
  KADY_AUTH_TOKEN=$(cat ~/data/geoaidesk/work/review-app/access-token) (fixed token; users open
  http://10.13.15.74:3000/#kady-token=<token> from institute PCs — do not print the token in Git or logs).
- Restart recipe: `systemctl --user stop gaid-review`; in ~/deploy/geoaidesk `git fetch` + `git checkout --detach <main sha>`;
  `systemd-run --user --unit gaid-review --collect -p WorkingDirectory=/home/seongin3/deploy/geoaidesk -E ...(all env above)
  -p StandardOutput=append:<launcher.log> -p StandardError=append:<launcher.log> /home/seongin3/deploy/geoaidesk/start-gaid.sh`
  (absolute script path). The launcher rebuilds the UI when inputs change.

## Done

1. Back up `~/.geoaidesk` config first (config.env + pi-agent without packages/sessions, as earlier backups in
   `~/data/geoaidesk/work/review-app/`). Keep `pi-agent/hub-server/connection.json` (admin login to http://10.13.15.74:8700).
2. Update the review app once to current origin/main with the recipe and environment above.
3. Verify over the LAN address with the token (playwright-cli): app opens; hub-server status shows the admin account;
   자료 소식 lists items; 서재 ORCID card works for a typed iD / public works (expected: "허브에 ORCID 연결이 설정되지
   않았습니다" instead of the 본인 확인 button, because the institute hub server stays on an older build — intended);
   project workspace state is saved server-side (`/geo/workspace-state`) and restored in a fresh browser. API without token → 401.
4. Record the review-app SHA (and the unchanged hub-server SHA 982389c5) in PROJECT.md (it still lists 982389c5 for the app).

Do NOT redeploy the institute hub server (PC74 :8700) — user decision, open item gaid-orcid#1. Ops change: no ADR, no report.
Outside check: none.

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

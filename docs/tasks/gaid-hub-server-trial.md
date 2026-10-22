---
format: 1
status: active
updated: 2026-10-22T09:45:52Z
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
- Hub server deployed on PC74 (item 1, first pass): pinned snapshot `~/deploy/geoaidesk-hub-server/8a9fc2f6c5342b9ec5a80d6c3b790caa611a621a`
  (`git archive` of origin/main), user unit `~/.config/systemd/user/gaid-hub-server.service` (enabled, `0.0.0.0:8700`,
  Restart=on-failure, UMask 0077), home `~/data/geoaidesk/hub-server/home`, log `~/data/geoaidesk/hub-server/logs/hub-server.log`.
  Verified: `curl http://10.13.15.74:8700/hub/v1/health` → serverId `hub-1f510d4fd3f6345b1d11c3506d878fc6`.
- Admin invite created for seongin@kigam.re.kr (role admin, id `inv-49843145f05301e8f9791a84751c48c7`, expires 2026-10-29); the
  code was given to the user in this tab only (never in files).
- Import source frozen: `~/data/geoaidesk/hub-server/import-source/2026-10-22-review-hub/shared` (cp -a of the review app's
  `~/.geoaidesk/pi-agent/skill-hub/shared`, 5 entries, 0 skills, `SHA256SUMS` beside it) and `authors.json` (all 5 names →
  seongin@kigam.re.kr). Import waits for the admin account to exist (the user accepts the invite in a GAID).
- Item 2 interface settled: `server/src/geo/hub-skills/records.ts` (`HubSkillRecordStore`), wire section in
  `server/src/geo/hub-server/protocol.ts`, contract fields `authorId`/`mine`/`registeredById`/review `byId` + `verified: boolean`.
- Package A done on this branch: per-request shelf (`hub-skills/active.ts`), `RemoteHubSkillStore`, actor ids in
  register/review/view/routes, consumers use `activeHubSkillStore()`, Settings annotation reads the remote record cache, web
  detail uses `mine`/`verified`. Checked: server `npx tsc --noEmit`, `npx vitest run test/geo-hub-skills.test.ts
  test/geo-hub-skill-workflows.test.ts test/geo-hub-shared.test.ts test/geo-hub-e2e.test.ts` (30/30), web `npx tsc --noEmit`,
  `npx vitest run src/geo/hub-skills` (13/13).
- Package C: GAID side `GAID_HUB_SERVER_CA` (`hubTransport`), test `server/test/geo-hub-client-tls.test.ts` (openssl CA, pass);
  guide `docs/geo/hub-server-https.md` written.
- Package B integrated (child gaid-hub-server-trial--skills-server completed at 179f8fac): `hub-server/skills.ts`
  (`SQLiteHubSkillStore`), migration 2, `/hub/v1/skills` routes, backup/check-backup cover skill archives, `import-hub` imports
  `skills/`; child checks: server tsc, `vitest run test/geo-hub-server*` 52/52.
- e2e `server/test/geo-hub-skills-e2e.test.ts` passes (first full check failed it: the fixture installed with a custom agentDir
  that `installedHubSkill` does not read; fixed at ae5118cf).
- PC74 TLS files prepared (not active): `~/data/geoaidesk/hub-server/tls/` (CA key in `ca/`, `gaid-hub-ca.crt` sha256
  57621a32…cee2, `hub.crt` SAN IP:10.13.15.74, expires 2029-01-24). Throwaway TLS instance on 10.13.15.74:8701 with a temp
  home: HTTPS health OK with the CA, plain HTTP and no-CA refused; stopped and removed.
- Full `scripts/check` passed on 59a8fbe4 (backend 2203 passed/8 skipped, web 1202 passed, GAID checks; log check-1.log);
  `task sync` integrated into main (PR #71, main cb63b118).
- Redeployed the service at main `cb63b1184f8839e3d0fc34b9f5981e59614350f1` (snapshot `~/deploy/geoaidesk-hub-server/cb63b118…`,
  unit updated, restarted): health same serverId, `schema_migrations` 1 and 2, the admin invite still unused. Backup before the
  switch `~/data/geoaidesk/hub-server/backups/2026-10-22-before-cb63b118` passed check-backup.
- Report draft `reports/2026-10-22-gaid-hub-server-trial/index.md` (check result, commit and import still to fill).
- Server TLS: `serve --tls-cert/--tls-key` (or env), `--trust-proxy` (loopback), tested in `geo-hub-client-tls.test.ts` (4/4).
## Next steps
Blocked: waiting for the user to create the admin account (invite code given in this tab; GAID or terminal route).
1. After the account exists: `import-hub --from ~/data/geoaidesk/hub-server/import-source/2026-10-22-review-hub/shared
   --authors .../authors.json` dry-run, then `--apply` (run from the deployed snapshot with GAID_HUB_SERVER_HOME set); backup +
   check-backup; fill the report (§3.1, §4, commit) and finish.
2. When the hub says gaid-user-acceptance testing is done: ask the hub to connect the review app to the server.
3. Pending cleanup after finish: old snapshot `~/deploy/geoaidesk-hub-server/8a9fc2f6…` (kept for rollback).
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- User decisions 2026-10-22 (asked in this tab): author mapping "모두 내 계정 (권장)" — all 5 review-hub Workflows go to the
  admin account; admin email "seongin@kigam.re.kr". Comments/stars by the mapped names collapse to that account (star counts
  drop where several test names starred one entry).
- Deploy layout: the review app owns `~/deploy/geoaidesk` (transient unit gaid-review), so the hub server uses
  `~/deploy/geoaidesk-hub-server/<sha>` and its own data under `~/data/geoaidesk/hub-server/`. Port 8700 (free; review app 3000/18000).
- Reviewer-role readiness: reviews carry `byId`; the server routes every review through one permission check. A reviewer role
  should be a capability next to admin/member (the `accounts.role` CHECK only allows admin|member; a new role value needs a
  table rebuild), decided in gaid-hub-skills-2.
- Work packages (sequential decision first: interface above, done):
  - A (me): client side. `hub-skills/{store,register,review,view,routes,install,installed}.ts` move to Actor ids and the
    `HubSkillRecordStore` interface; `hub-client/remote-skills.ts`; active resolution next to `hub-shared/active.ts`;
    `routes/hub-shared.ts`, `routes/hub-server.ts`, `methods/hub-pin-install.ts`, `cli-export.ts`, `authoring/hub-skills.ts`;
    web `hub-skills/detail.tsx` (`mine`, `verified`) and locale text if needed; client tests.
  - B (child writer, "general work"): server side. New `server/src/geo/hub-server/skills.ts` (SQLite store, migration 2 in
    `core.ts`, `HUB_TABLES`), routes in `hub-server/index.ts`, backup blob references in `backup.ts`, skill import in `import.ts`
    (same author map; reviews/comments/stars legacy identities), operator guide `docs/geo/hub-server.md` skill sections,
    server tests `server/test/geo-hub-server*.test.ts`. Must not edit package A files or `records.ts`/protocol wire (ask me).
  - C (me): HTTPS switch prepared and documented (reverse proxy config, client URL/CA handling), no widening.
  - Integration order: B merged into this branch → e2e (two accounts, skill register/review/star/comment/install over HTTP)
    → scripts/check → redeploy.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-hub-server-trial/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

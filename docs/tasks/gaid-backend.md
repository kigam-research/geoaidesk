---
format: 1
status: active
updated: 2026-10-22T07:05:05Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"42c1d2eb-e8f7-49ac-b219-57ca9a2a1563","pid":3555477,"provider":"claude","session":"16841b69-907f-41ff-a4bd-8c87d2613dbe","start":"53044540","token":"3b49ca809aad8a333d258181d137a929d513d7ef1ea2d3c8ee82dda27c379e91"}
branch: task/gaid-backend
target: main
parent: 
---
# gaid-backend

## Goal and done criteria
Request from the starter:

# Request: gaid-backend

User request (verbatim, 2026-10-22, to the geoaidesk hub):
"다음 작업으로 GAID허브와 GAID 시스템과 관련하여 현재 백엔드 시스템이 구현되지 않아 있다. 사용자가 활용할 수 있는 백엔드 시스템을 우선 무료 티어 수준의 도구로 검색하고 어떻게 설계해야할지 사용자와 논의하면서 진행할 수 있게 해야한다. 우선 최대 사용자 50명이며, 일반적으로 10~20명 정도 사용할 테스트 수준으로 구현하려고 한다."

Order: research → design proposal discussed with the user → implement only the agreed scope.
1. Diagnose what "backend" GAID lacks today: GAID runs per researcher (local Fastify backend + Next.js); the shared hub assumes one
   institute GAID with display names in X-GAID-User and no accounts (server/src/geo/hub-shared/); the library is per user
   (gaid-research-hub ADR docs/adr/2026-10-21-research-hub-library.md: institute accounts planned after the phase-1 pilot, before
   내 논문; default model for unpublished manuscripts/reviews/ideas = institute-internal model). List which features need a shared
   backend (accounts/auth, shared hub entries, stars/comments, shared library or sync, files/PDFs, notifications…) and which stay local.
2. Research free-tier options (oracle-search, Extra High default, Pro if needed; KIGAM network blocks raw.githubusercontent.com):
   hosted BaaS (e.g. Supabase, Firebase, Appwrite Cloud, Convex, Cloudflare Workers/D1/R2, Neon) and self-hostable open source
   (e.g. PocketBase, Supabase self-host, Appwrite) on an institute PC/server; current free-tier limits (users, DB size, storage,
   egress, inactivity pausing), auth options (email, institute SSO/OIDC), data residency and the KIGAM network/security context
   (unpublished research data), cost when the test grows, lock-in and migration path. Target: max 50 users, usually 10–20, test level.
3. Proposal with 2–3 options and a recommendation (architecture, what moves to the backend first, data model, auth, deployment,
   backup), discussed with the user in the writer tab (task review-copy); ADR for the chosen architecture; then implement the agreed
   first phase.
Before proposing new accounts/services, check PROJECT.md and past sessions (knowledge-lookup) for what the user already has.
Creating external accounts or paid plans needs the user's approval. UI follows docs/design/ui-guide.md v2. Own GAID_HOME under
~/data/geoaidesk/work/gaid-backend/; do not modify ~/.geoaidesk. Outside check: no outside check (architecture/app work).

## Current state
Result (2026-10-22): the institute GAID hub server chosen by the user is implemented and verified; report
reports/2026-10-22-gaid-backend/index.md. Phase 1 = accounts (admin invites, email + password), shared hub records on the
server (register, revisions, folders, stars, comments, edit/copy by account, pinned install), per-account library sync
(items, folders, PDFs; conflicts kept), backup + check-backup, import of an existing local hub. Researchers connect in
Settings → 서비스 → 기관 GAID 허브; without a hub server GAID keeps the local hub. Plain HTTP on the LAN (user decision).
Verification:
- Children P1/P2/P3 integrated and closed (their checks: hub-server 38, hub-client 24, hub-ui 17 new tests; full suites
  passed in their finishes). E2E `server/test/geo-hub-e2e.test.ts` passes (real HTTP hub, two accounts, two PCs of one
  account, conflict, isolation). Re-verify: `cd server && GAID_CATALOGUE=off npx vitest run test/geo-hub-e2e.test.ts
  test/geo-hub-server.test.ts test/geo-hub-client.test.ts test/geo-library-sync.test.ts test/geo-hub-shared.test.ts`.
- Real LAN run (report §3.2): hub server on PC74 :8700 (test home `~/data/geoaidesk/work/gaid-backend/hub-home`, test
  accounts seongin-admin@test.gaid / researcher@test.gaid, passwords in `.../logs/*password.txt` mode 600), test GAID on
  PC74 (GAID_HOME `.../gaid-home`, ports 3420/18420) connected via http://10.13.15.74:8700, member joined from PC70 by curl,
  5 legacy entries imported (idempotent), library synced and pulled from PC70, isolation and backup verified. Both test
  services were stopped (transient units gaid-backend-app, gaid-backend-hubtest); data kept under the work dir.
- No persistent deployment; deployed SHAs unchanged.
## Next steps
1. `task finish` (runs scripts/check). Then the user's open decision: start the pilot (persistent hub server on PC74 from
   ~/deploy at the merged SHA, admin invite for the user, import the 5 entries with the user's author mapping).
## Failed approaches
- 2026-10-22: committing the e2e test before P1 was integrated broke `task complete gaid-backend--hub-client`'s check
  (missing module); parked the test outside the repo.
## Notes and decisions
- User decision 2026-10-22 on report §6 (verbatim): "2번 다, 4번 나로 하고 나머지는 권장으로 하자." → 1 가 institute GAID
  hub server, 2 다 phase 1 = accounts + shared hub + 5 existing entries + backup + personal library sync, 3 가 admin
  invite + email/password, 4 나 plain HTTP on the LAN, 5 가 SQLite. Confirmations (SSO/SMTP/certificates, PC74 as host) not
  answered: unknown; PC74 is the pilot host. ADR docs/adr/2026-10-22-gaid-hub-server.md.
- Work packages (shared interfaces settled first, P0 above). Integration order P1 → P2 → P3.
  - P1 `hub-server` (child, general work): server/src/geo/hub-server/** except protocol.ts semantics, geo/hub-server.mjs,
    server/test/geo-hub-server*.test.ts, docs/geo/hub-server.md. SQLite, accounts, sessions, invites, admin, browser refusal,
    hub records with server-side write rules, files, library sync server, audit, CLI (serve/invite/users/backup/
    check-backup/import-hub).
  - P2 `hub-client` (child, general work): server/src/geo/hub-client/**, server/src/geo/library/sync/**,
    server/src/geo/routes/hub-server.ts + one registration line in server/src/geo/routes.ts, server/test/geo-hub-client*,
    geo-library-sync*. Connection store, RemoteHubStore, provider registration, /geo/hub-server/*, /geo/library/sync.
  - P3 `hub-ui` (child, general work): web/src/geo/hub-server/**, locales namespace hubServer, identity edits in
    web/src/geo/hub/{shared-api.ts,shared-entry.tsx,hub-screen.tsx,hub-dialogs.tsx}, library sync status in
    web/src/geo/library/, Settings seam, web tests, screenshots.
  - Top writer: contracts, integration, e2e test, real run, import of existing entries, report, checks.
- Plan (sequential): diagnose → research → proposal → user decision → ADR → implement phase 1. Work packages for
  implementation are decided after the user picks the architecture (shared interface first, then children if large).
- Existing services (knowledge-lookup, 2026-10-22): no past record of Supabase/Firebase/Cloudflare/Neon/PocketBase/
  Appwrite/Convex accounts, a VPS, institute server or SMTP for GAID. Network constraint from the user (2026-09-14,
  [세션] 01a09e72-00e4-7c51-8654-650c96c01f0e:29): outside the intranet the internal IPs are unreachable; port opening or
  a VPN such as Tailscale needs separate permission (tailcat via DERP worked).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- Coordination 2026-10-22 (route 0095d2a0c339, from gaid-hub-skills): its four storage/auth assumptions (immutable
  sha256 skill archives like Workflow packages; skill entry metadata moves with hub entries; author/reviewer identity
  from accounts, display name "not verified" until then; installation stays client-side) do not conflict with any of the
  three options. Under option 가 entry metadata becomes DB rows rather than JSON files; the shape carries over. Phase 1
  should keep entry storage generic enough to add a skill entry kind and a reviewer role later. No reply sent.
## Open items
- [결정] 연구자가 쓰는 시험 운영 시작 — 가) PC74에서 허브 서버를 병합한 판으로 고정 서비스로 띄우고, 사용자 관리자 계정 초대 코드를 드린 뒤, 검토용 허브의 Workflow 5건을 사용자가 정한 작성자 연결로 옮김 — 나) 기관 서버나 다른 원내 PC가 정해질 때까지 대기 — 권장: 가) 기능 시험은 끝났고 실제 연구자 사용으로 알림·부하·운영 문제를 알 수 있음 — 막힌 일: 연구자 시험 운영 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
- [부채] 원내 HTTP로 비밀번호·로그인 열쇠·Workflow·서재 PDF가 암호화 없이 원내망을 지남(사용자 결정 4 나) — 가) 시험 그룹보다 넓히기 전에 HTTPS(리버스 프록시 또는 인증서) 적용 — 나) 유지 — 권장: 가) 자료 변경 없이 설정으로 바꿀 수 있음 — 막힌 일: 시험 그룹 밖 사용 — 근거: reports/2026-10-22-gaid-backend#5-한계
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-backend/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

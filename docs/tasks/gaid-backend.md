---
format: 1
status: active
updated: 2026-10-22T05:25:31Z
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
Phases 1-2 done and proposal written, 2026-10-22; no code changes yet. Waiting for the user's decisions in this tab.
- Diagnosis (Explore over base 79fb145d; notes `~/data/geoaidesk/work/gaid-backend/diagnosis.md`): no accounts; the
  shared hub is a per-instance file store reached same-origin, identity = unchecked `X-GAID-User`; exposing one GAID on the
  LAN shares one `KADY_AUTH_TOKEN` that also drives the agent shell; no remote-hub client for stars/comments/registration;
  library owner "local"; no notifications. 5 entries in the review instance hub (`~/.geoaidesk`, read only).
- Research: Oracle Pro note `웹 조사/geoaidesk/2026-10-22-research-question-2026-10-22--a9eaa9446b.md` (27 min).
- PC74: no docker/postgres/caddy, sudo needs a password, disk 88% (196 GB free), LAN IP 10.13.15.74, Node v24.21.0.
- Proposal: `reports/2026-10-22-gaid-backend/index.md` (options 가 원내 GAID 허브 서버 [recommended] / 나 PocketBase /
  다 Supabase Free Seoul; 5 decisions in §6 + 2 confirmations).
## Next steps
1. Take the user's answers to report §6 here; record them under Notes and decisions; write ADR
   `docs/adr/2026-10-22-gaid-hub-server.md`; then plan phase-1 work packages (shared contract first) and implement.
## Failed approaches
## Notes and decisions
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
- [결정] 공유 백엔드 구성 — 가) 원내 GAID 허브 서버 — 나) 원내 PocketBase — 다) Supabase Free 서울 — 권장: 가) 비용 없음, 지금 허브 코드 재사용, 미공개 자료 원내 유지, 기관 서버 이전이 가장 쉬움 — 막힌 일: 1단계 구현 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
- [결정] 1단계 범위 — 가) 계정 + 공유 허브 이전 + 기존 허브 자료 5건 + 백업 — 나) 가) + 앱 안 알림 — 다) 가) + 개인 서재 동기화 — 권장: 가) 공유가 실제로 되는 최소 범위 — 막힌 일: 1단계 구현 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
- [결정] 로그인 방식 — 가) 관리자 초대 + 이메일·비밀번호 — 나) 처음부터 기관 SSO — 권장: 가) 메일 서버·기관 협조 없이 시작, SSO는 같은 계정에 나중에 연결 — 막힌 일: 계정 구현 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
- [결정] 원내망 접속 보호 — 가) 원내 HTTPS(자체 인증서, PC마다 한 번 설치) — 나) 원내 HTTP — 다) 기관 도메인·인증서 — 권장: 가) 비밀번호와 로그인 열쇠 암호화 — 막힌 일: 배포 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
- [결정] 허브 DB — 가) SQLite 파일 — 나) PostgreSQL — 권장: 가) PC74에 관리자 설치 없이 시작, 표준 SQL로 나중에 이전 — 막힌 일: 서버 구현 — 근거: reports/2026-10-22-gaid-backend#6-결정할-일
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

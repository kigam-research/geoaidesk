---
format: 1
status: waiting
updated: 2026-10-22T04:14:59Z
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

---
format: 1
status: active
updated: 2026-10-22T06:14:37Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"edaeb9e4-ff55-462d-8fd3-fe7b95285c4b","pid":224911,"provider":"codex","session":"01a16239-b9a5-7411-a110-2e2802b598b6","start":"53725166","token":"4f2b949910fa0fe4f0fbfdb3636e45b6b5bb0bf443db7cd1d6f17ff91402cb0c"}
branch: task/gaid-backend--hub-ui
target: task/gaid-backend
parent: gaid-backend
---
# gaid-backend--hub-ui

## Goal and done criteria
Request from the starter:

Parent unit: gaid-backend (geoaidesk), top writer Claude. Read in your worktree: AGENTS.md, docs/tasks/gaid-backend.md (Notes:
user decisions + work packages), ADR docs/adr/2026-10-22-gaid-hub-server.md (the design; follow it), and the shared contracts:
server/src/geo/hub-shared/records.ts (HubRecordStore, Actor), server/src/geo/hub-shared/active.ts (resolveHub,
setRemoteHubProvider), server/src/geo/hub-server/protocol.ts (/hub/v1 wire), web/src/geo/contracts/hub-server.ts (routes of the
researcher's GAID for the UI), web/src/geo/contracts/hub-shared.ts. Do not change contract semantics; if a contract needs a
change, make the smallest additive change, note it in your task document and in your final message. Stay inside your owned
files; another child owns the others (P1 hub-server, P2 hub-client, P3 hub-ui).
User decisions (verbatim, 2026-10-22): "2번 다, 4번 나로 하고 나머지는 권장으로 하자." = institute GAID hub server; phase 1
accounts + shared hub + existing entries + backup + personal library sync; admin invite + email/password; plain HTTP on the
institute LAN; SQLite.
Environment: KIGAM network blocks raw.githubusercontent.com (use gh api ... -H "Accept: application/vnd.github.v3.raw" or
codeload.github.com). Run dependencies with `npm ci` in server/ and web/ of your worktree if node_modules is missing. Use
`uv run`, never bare python/pip. Keep any app data/test homes under ~/data/geoaidesk/work/<your slug>/; never touch
~/.geoaidesk or ~/.geoaidesk-hub. Server tests: `cd server && GAID_CATALOGUE=off npx vitest run <files>`, typecheck
`npx tsc --noEmit -p .`; web: `cd web && npx vitest run <files>`, `npx tsc --noEmit`. Run `scripts/check` before finishing if
time allows; report what passed/failed exactly. No new external services or accounts.
Done: your scope implemented with tests, task document updated (Current state with re-verification commands), `task finish`.
Write your task document and final message in English. No report of your own; put user-facing findings in your final message.
Goal: P3 `hub-ui` — the screens for the hub server connection, accounts and library sync (ADR decisions 2, 4, 7).
Owned files: web/src/geo/hub-server/** (new), locale namespace web/src/geo/locales/hubServer/{ko,en}.json (+ registration in
web/src/geo/locales/index.ts), identity edits in web/src/geo/hub/{shared-api.ts,shared-entry.tsx,hub-screen.tsx,hub-dialogs.tsx},
a sync status line in web/src/geo/library/ (library-screen.tsx or a new component there), the Settings seam (one card; if that
means editing an upstream file such as web/src/components/settings/services-panel.tsx or providers-panel.tsx, first add it to
geo/integration-boundaries.json with owner gaid-backend; prefer the narrowest seam, the way LocalModelCard is mounted), web tests.
Read first: docs/design/ui-guide.md sections 1, 2, 10 and the components you touch; geo/copy/gaid-writing.md, terminology.csv
(the AGENTS.md "UI copy and locales" and "UI guide v2" bullets are binding: strings only in locale catalogues, Korean first,
buttons = next action, no question titles, no decorative emoji, role tokens only, check-ui rules).
Build against the contract web/src/geo/contracts/hub-server.ts (the backend routes are being built in parallel by P2; mock
fetch in tests):
1. Settings card "기관 GAID 허브": address field (disabled with a note when fromEnv), connection state (reachable/error, server
   version), not logged in → two forms: "로그인" (email, password) and "초대 코드로 가입" (code, display name, password + confirm;
   rules from HUB_ACCOUNT_RULES), logged in → account line (display name, email, role), change display name / password, "로그아웃",
   "연결 끊기" (remove address). One sentence stating that this connection uses plain HTTP on the institute network
   (passwords and files are not encrypted) — the limitation must stay visible, not hidden.
2. Admin section (role admin): members list (name, email, role, disabled), make admin / member, disable / enable (last-admin
   409 shown as a sentence), invites list, "초대 만들기" (email, role) showing the code once with a copy button and expiry.
3. Hub identity: when `/geo/hub/me` returns `account: true`, never ask for a display name; use the account name; edit vs copy
   from `entry.mine` (fallback: name compare); writes no longer depend on localStorage `gaid:hub-user` in account mode. Without a
   hub server keep today's behaviour. When the hub server is configured but logged out, hub actions point to the Settings card
   (deep link via openSettings) instead of the name dialog.
4. Library: a compact sync line on the library screen (last synced time, pending count, conflicts count, error) and
   "지금 동기화" (POST /geo/library/sync), shown only when `available`.
5. Tests (vitest + testing-library like existing geo tests). Screenshots per AGENTS.md "UI guide v2": Korean, both styles
   (계측/도폭) and both themes at 1440×900 and 1280×800 for the Settings card (logged out, logged in admin) and the library sync
   line, using a mocked backend; keep them under ~/data/geoaidesk/work/gaid-backend--hub-ui/screens/ and copy 2-4 small PNGs
   (<=1600 px wide) into reports/2026-10-22-gaid-backend/figures/ (do not edit the report text). List string ids with Korean
   and English in your final message, and rule ids followed/broken.
Run `cd web && npx vitest run` for your tests, `npx tsc --noEmit`, `node geo/copy/validate-copy.mjs web/src/geo/locales`,
`node geo/ui/check-ui.mjs`.

## Current state
Implementation in progress: connection/account/admin components, hubServer locales, Settings service seam, account-aware named actions, and library sync line are added. Dependencies installed with npm ci in web/. Copy validator and UI validator pass (existing warnings/debt unchanged).

Sequential decisions: keep existing researcher-backend contracts; distinguish configured-but-logged-out through status before named actions; use account ownership entry.mine, not display names. No contract changes.

Owned interfaces: web/src/geo/hub-server/** and hubServer locales; ServicesPanel mount only; existing hub identity seams and library sync mount. Integration order: Settings/account components -> identity -> sync -> mocked tests -> screenshots -> task finish. No child workers (tightly coupled UI).
## Next steps
1. Finish mocked interaction tests, run TypeScript and web tests, capture both styles/themes/sizes, then finish.
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

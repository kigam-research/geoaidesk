---
format: 1
status: active
updated: 2026-10-22T06:18:30Z
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
Implemented the institute hub connection/account/admin UI, account-aware named actions and ownership, and the library sync line. No backend contract changed. No application data or real accounts were touched. Narrow Settings seam: ServicesPanel mounts HubServerCard.

Verified: 17 new interaction tests plus existing seam tests (31 tests in 6 files) pass; web TypeScript passes; focused ESLint passes; copy validator passes (0 errors, 61 existing warnings); UI validator passes (0 errors, 88 existing accepted debts, none added). Full web suite job 2 passed: 181 files, 1173 tests, exit 0 (67.32s), at source c94189b2b7d4. Keyboard path email -> password -> sign-in preserves focus-visible. Browser console has 0 errors after loading all fixture screens; fixture service and browser have been stopped. scripts/check has not been run in this child; parent owns integrated backend/end-to-end verification.

Screenshots: 24 mocked-backend PNGs at ~/data/geoaidesk/work/gaid-backend--hub-ui/screens/ (Settings logged out, Settings admin with members open, library sync; instrument/mapsheet, light/dark, 1440x900 and 1280x800). Horizontal overflow false in every screenshot; Settings cards fit within 1280x800. Vite fixture, API mock and capture.js are external to Git. Four representative 1280px PNGs are under the parent report figures/; report text unchanged.

Safe re-verification: cd web && npx vitest run src/geo/hub-server/ src/geo/workflow/workflow-mounts.test.tsx src/geo/hub/shared-entry.test.tsx src/components/settings/services-panel.test.tsx; npx tsc --noEmit; npx eslint src/geo/hub-server src/geo/library/sync-line.tsx. From repo root: node geo/copy/validate-copy.mjs web/src/geo/locales; node geo/ui/check-ui.mjs. Screenshot harness: external browser-fixture/server.mjs, screenshots/capture.js; no real backend.

Sequential decisions: keep existing researcher-backend contracts; distinguish configured-but-logged-out through status before named actions; use account ownership entry.mine, not display names. No contract changes.

Owned interfaces: web/src/geo/hub-server/** and hubServer locales; ServicesPanel mount only; existing hub identity seams and library sync mount. Integration order: Settings/account components -> identity -> sync -> mocked tests -> screenshots -> task finish. No child workers (tightly coupled UI).
## Next steps
1. task finish; parent integrates with task complete. No implementation work remains in this child.
## Failed approaches
- Job job-geoaidesk-gaid-backend--hub-ui-1 exited 127: immutable job source has no node_modules (vitest not found). Fix the job environment by including npm ci before tests; no source workaround.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
### UI guide conformance

Followed: P2/P3 (one selected auth task, details for address/account/admin), P9 (connection vs account vs sync states), I2/I7/I8/I12/I13 (role tokens and existing style rules), T1 (new prose/control labels at 13/15px; card legend 17px), B3 (next-action labels), F4/F5/R2 (actionable failures with collapsed technical details and copy), A1/A2/A5 (labels, keyboard controls, pressed/busy state, status/alert), W1-W6 (short copy and progressive disclosure), V1-V9 (no new banned decorations or hard-coded colors). No new UI baseline exceptions. Member management uses grouped list rows, not a data table. Logged-in account overview has only secondary actions until the researcher opens a form; avoids an arbitrary destructive/default filled action (B1 interpretation).

### String additions (previously absent)

All 72 IDs below are hubServer-prefixed; no existing Korean/English string changed.

| ID | Korean | English |
|---|---|---|
| hubServer.title | 기관 GAID 허브 | Institute GAID hub |
| hubServer.http | 기관 네트워크의 HTTP 연결에서는 비밀번호와 파일을 암호화하지 않습니다. | Over HTTP on the institute network, passwords and files are not encrypted. |
| hubServer.https | 기관 GAID 허브에 HTTPS로 연결합니다. | Connects to the institute GAID hub over HTTPS. |
| hubServer.loading | 연결 상태를 읽는 중입니다. | Reading connection status. |
| hubServer.working | 처리 중 | Working |
| hubServer.notConfigured | 기관 허브를 연결하지 않았습니다. | No institute hub is connected. |
| hubServer.reachable | 기관 허브에 연결했습니다. | Connected to the institute hub. |
| hubServer.unreachable | 기관 허브에 연결하지 못했습니다. | Could not connect to the institute hub. |
| hubServer.unchecked | 연결 상태를 확인하지 않았습니다. | Connection has not been checked. |
| hubServer.serverVersion | 서버 버전 {version} | Server version {version} |
| hubServer.failed | 요청을 처리하지 못했습니다. 연결과 입력을 확인한 뒤 다시 시도하세요. | Could not complete the request. Check the connection and fields, then try again. |
| hubServer.rateLimited | 로그인 시도가 많습니다. 잠시 후 다시 시도하세요. | Too many login attempts. Wait a moment, then try again. |
| hubServer.technical | 기술 정보 | Technical details |
| hubServer.copyTechnical.button | 기술 정보 복사 | Copy technical details |
| hubServer.unknownDate | 시간 미확인 | Time unknown |
| hubServer.address | 허브 서버 주소 | Hub server address |
| hubServer.addressSettings | 연결 주소 설정 | Connection address settings |
| hubServer.fromEnv | 시작 환경에서 정한 주소입니다. 설정 화면에서는 바꿀 수 없습니다. | The address is set by the launch environment and cannot be changed in Settings. |
| hubServer.connect.button | 허브 연결 | Connect hub |
| hubServer.refresh.button | 상태 새로 읽기 | Refresh status |
| hubServer.disconnect.button | 연결 끊기 | Disconnect hub |
| hubServer.auth.title | 허브 계정 연결 | Hub account connection |
| hubServer.auth.login.title | 로그인 | Sign in |
| hubServer.auth.invite.title | 초대 코드로 가입 | Join with invite code |
| hubServer.auth.login.button | 계정 로그인 | Sign in to account |
| hubServer.auth.invite.button | 계정 만들기 | Create account |
| hubServer.email | 이메일 | Email |
| hubServer.displayName | 표시 이름 | Display name |
| hubServer.password | 비밀번호 | Password |
| hubServer.confirmPassword | 비밀번호 재입력 | Confirm password |
| hubServer.currentPassword | 현재 비밀번호 | Current password |
| hubServer.newPassword | 새 비밀번호 | New password |
| hubServer.passwordRule | 비밀번호는 {min}~{max}자로 입력하세요. | Use {min}–{max} characters for the password. |
| hubServer.passwordMismatch | 비밀번호가 일치하지 않습니다. 다시 입력하세요. | Passwords do not match. Enter them again. |
| hubServer.accountLine | {email} · {role} | {email} · {role} |
| hubServer.role.title | 역할 | Role |
| hubServer.role.member | 구성원 | Member |
| hubServer.role.admin | 관리자 | Admin |
| hubServer.logout.button | 계정 로그아웃 | Sign out of account |
| hubServer.changeName.button | 표시 이름 변경 | Change display name |
| hubServer.changePassword.button | 비밀번호 변경 | Change password |
| hubServer.cancel.button | 변경 취소 | Cancel changes |
| hubServer.saveAccount.button | 계정 변경 저장 | Save account changes |
| hubServer.saved | 변경 사항을 적용했습니다. | Changes applied. |
| hubServer.admin.title | 구성원과 초대 관리 | Manage members and invites |
| hubServer.admin.users.title | 구성원 | Members |
| hubServer.admin.invites.title | 초대 | Invites |
| hubServer.admin.failed | 관리 요청을 처리하지 못했습니다. 상태를 새로 읽고 다시 시도하세요. | Could not complete the admin request. Refresh status and try again. |
| hubServer.admin.lastAdmin | 마지막 관리자는 구성원으로 바꾸거나 사용을 중지할 수 없습니다. | The last admin cannot be made a member or disabled. |
| hubServer.admin.disabled | 사용 중지됨 | Disabled |
| hubServer.admin.makeMember.button | 구성원으로 변경 | Make member |
| hubServer.admin.makeAdmin.button | 관리자로 변경 | Make admin |
| hubServer.admin.enable.button | 계정 사용 재개 | Enable account |
| hubServer.admin.disable.button | 계정 사용 중지 | Disable account |
| hubServer.admin.users.empty | 구성원이 없습니다. 상태를 새로 읽으세요. | No members found. Refresh status. |
| hubServer.admin.invites.empty | 만든 초대가 없습니다. | No invites created. |
| hubServer.invite.code | 초대 코드 | Invite code |
| hubServer.invite.create.button | 초대 만들기 | Create invite |
| hubServer.invite.once | 코드는 지금만 표시합니다. 복사해서 초대할 연구자에게 전달하세요. | The code is shown only now. Copy it and pass it to the invited researcher. |
| hubServer.invite.expires | 만료: {when} | Expires: {when} |
| hubServer.invite.copy.button | 초대 코드 복사 | Copy invite code |
| hubServer.invite.copied | 코드를 복사했습니다. | Code copied. |
| hubServer.invite.hide.button | 코드 닫기 | Dismiss code |
| hubServer.invite.used | 가입에 사용한 초대 | Invite used to join |
| hubServer.invite.revoke.button | 초대 취소 | Revoke invite |
| hubServer.sync.title | 기관 허브와 서재 동기화 | Library sync with institute hub |
| hubServer.sync.running | 서재 동기화 중 | Syncing library |
| hubServer.sync.summary | 최근 동기화 {when} · 대기 {pending}개, 충돌 보관 {conflicts}개 | Last synced {when} · {pending} pending, {conflicts} conflicts kept |
| hubServer.sync.never | 동기화 전 · 대기 {pending}개, 충돌 보관 {conflicts}개 | Not yet synced · {pending} pending, {conflicts} conflicts kept |
| hubServer.sync.now.button | 지금 동기화 | Sync now |
| hubServer.sync.failed | 서재를 동기화하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요. | Could not sync the library. Check the connection and try again. |
| hubServer.identity.failed | 허브 계정을 확인하지 못했습니다. 연결 설정을 확인하세요. | Could not check the hub account. Check the connection settings. |

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
- /home/seongin3/data/geoaidesk/runs/gaid-backend--hub-ui-20261022T061449.842101Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-backend--hub-ui-20261022T061623.313366Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

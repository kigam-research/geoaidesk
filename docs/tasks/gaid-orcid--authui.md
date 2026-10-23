---
format: 1
status: ready
updated: 2026-10-23T02:05:53Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"b35bb8b9-c459-4233-ba31-c386537b4e3f","pid":2832900,"provider":"codex","session":"01a16669-3557-7520-b2f1-bc790350ad04","start":"60747240","token":"59f55a1303c7beb853fef07784bf6e29821f7eac7b1cfd62eca996fdd7606311"}
branch: task/gaid-orcid--authui
target: task/gaid-orcid
parent: gaid-orcid
---
# gaid-orcid--authui

## Goal and done criteria
Request from the starter:

# Child unit: UI of ORCID phase 2 (authenticated iD)

Parent: gaid-orcid (writer: Claude orchestrator). Repo geoaidesk (GAID). Read AGENTS.md (ORCID bullet), the ADR
docs/adr/2026-10-23-orcid-authenticated-link.md, docs/tasks/gaid-orcid.md and the contracts first. KIGAM network:
raw.githubusercontent.com is blocked; use gh api or codeload.github.com.

## Goal
Phase 1 (typed, unauthenticated iD + public works import) is on main. Phase 2 server code is pushed on task/gaid-orcid
(commit d278514fb5a7 or later): the hub server holds the ORCID client; a researcher logged into the institute GAID hub can
prove their iD through ORCID sign-in; the hub account and the researcher's hub entries carry the authenticated iD. Build the
researcher-facing screens for that. User decisions 2026-10-22: authenticated iD on hub account and hub entries; secret only
in hub server config (operator CLI, no UI for it).

## Fixed interfaces (do not change; ask the parent if one is wrong)
- `web/src/geo/contracts/orcid.ts`: `OrcidStatus.hub: OrcidHubState` (no-account / unreachable / not-configured / ready /
  linked with `link`), `OrcidProfile.authenticated/environment/authenticatedAt`, `orcidUrl(id, environment)`,
  `OrcidAuthStart`. Routes: POST `/geo/orcid/auth/start` → `{ authorizeUrl, expiresAt }` (409 / 502 with `{ error }`),
  DELETE `/geo/orcid/auth` → OrcidStatus, GET `/geo/orcid` now includes `hub` (can take up to ~5 s when the hub is slow).
  `GET /geo/orcid/callback` is ORCID's redirect target and renders its own static result page (server-side, done).
- `web/src/geo/contracts/hub-server.ts`: `HubAccount.orcid?: HubOrcidLink` ({ id, environment, name?, authenticatedAt }).
- `web/src/geo/contracts/hub-shared.ts`: `HubEntry.authorOrcid?: { id, environment }` (author's current authenticated iD,
  hub server only).

## Scope (owned files)
- `web/src/geo/orcid/` (card, id-display, api, tests). Fix the existing card tests for the new required `hub` field.
- Hub screens: author line of a hub entry (`web/src/geo/hub/shared-method.tsx`, author column in `shared-browse.tsx`) and the
  hub server account card (`web/src/geo/hub-server/account.tsx` or nearest) — small seams only.
- Locales `web/src/geo/locales/orcid/{ko,en}.json` (+ hubServer/hub keys if needed). Korean first, geo/copy rules, buttons name
  the next action, never claim more than verified.

## Behaviour
1. ORCID card by `status.hub.state`:
   - `ready`: primary-ish action "ORCID로 본인 확인" → POST auth/start → `window.open(authorizeUrl, "_blank", "noopener")`
     (open synchronously from the click with a placeholder tab or open after the fetch; avoid popup blockers: prefer
     opening `about:blank` on click and setting its location after the fetch). Short line: sign in on ORCID, then return.
     While waiting, refresh `GET /geo/orcid` when the window regains focus/visibility, so the card updates after the
     researcher closes the ORCID tab.
   - `linked`: show the iD in ORCID's full format with the official AUTHENTICATED icon (already vendored at
     `web/public/geo/orcid/ORCID-iD_icon_vector.svg`) and NO "(unauthenticated)" suffix; link with `orcidUrl(id, environment)`;
     when `environment === "sandbox"` add a plain "ORCID 시험 환경" note (test data). Action to remove the authenticated link
     (confirm first; says the typed iD and own-work marks stay) → DELETE /geo/orcid/auth.
   - `no-account`: one line that ORCID 본인 확인 needs the institute GAID hub login (link to Settings → 서비스 → 기관 GAID
     허브 using the existing settings deep-link helper), typed-iD flow unchanged.
   - `not-configured`: one line that the hub has no ORCID connection yet (ask the hub administrator). `unreachable`: one
     line + retry.
   - The typed-iD input stays for unlinked researchers; once authenticated the input is hidden.
2. Hub entry author: when `authorOrcid` is present, render the inline iD format (authenticated icon after the author name,
   linked to the record, alt/aria per ORCID guidelines). Absent: unchanged.
3. Hub account card: show the account's authenticated iD (same component) when `account.orcid` exists.

## Rules and checks
- UI guide v2 `docs/design/ui-guide.md` (sections 1, 2, 10 + components touched); role tokens only; official icon files
  unchanged; no emoji/AI icons. Design as an impeccable + design-taste-frontend + brand-guide expert.
- Run `cd web && npx tsc --noEmit && npm test`, `node geo/copy/validate-copy.mjs web/src/geo/locales`, `node geo/ui/check-ui.mjs`.
- Real-app check with your own instance and data outside the repo (`~/data/geoaidesk/work/gaid-orcid-auth-ui/`), on free
  ports — NOT 3000, 8000, 8700, 18000 (review app, the parent's end-to-end test and the institute hub use them). Use a local
  test hub server (`node geo/hub-server.mjs serve --home <your dir> --port <free>`, `invite`, accept in GAID Settings) to
  reach `ready`/`not-configured`; for `linked`, write the hub state directly in your test hub's SQLite (`account_orcid`
  row, environment sandbox, iD 0000-0002-1825-0097) since real ORCID sign-in needs the user's sandbox login (the parent
  does that end-to-end). Never create ORCID accounts or clients.
- Korean screenshots of the card in ready / linked (sandbox) / no-account states and a hub entry with an authenticated
  author, both styles (계측, 도폭) and both themes at 1440×900 and 1280×800, checked against ui-guide section 12; small PNGs
  under `reports/2026-10-22-gaid-orcid/figures/orcid2-*.png` (well under 1 MB each).
- No secrets anywhere. No hub server / backend code changes (ask the parent if one is needed).

## Report back (task document + final message to the parent, English)
Changed files, string ids with ko/en text, ui-guide rule ids followed/broken with reason, screenshot paths, check results
with commands, anything not verified. Then `task finish`.

## Current state
- Delivered authenticated ORCID UI for all hub states, synchronous detached-tab sign-in with popup-blocked fallback, event-driven refresh on focus/visibility/hub-account changes, and confirmed auth unlink. Typed iD/public import remain available to unlinked researchers. Shared official iD renderer supplies authenticated author/account links and sandbox labeling; import dialog inherits profile/environment.
- Parent backend fix 0007ad5165d07d0bad312e75d55c05d36a72c10d merged with authorization at 53d3d6d81d9c. Live own HTTP checks now complete for auth DELETE followed by local DELETE; response is profile null + hub ready. ORCID regression suites pass 15/15 after merge.
- Checks: frontend TypeScript passed after the final URL-wrap/column-width changes; focused UI suites 4 files/23 tests passed. Full scripts/check passed on pre-parent-fix snapshot b2f2783d37ab (receipt gaid-orcid--authui-20261023T014402.188704Z; backend 2246 passed/8 skipped, frontend 1231 passed; copy/UI/distribution/environments/startup/restart all passed). Final integration checks will run through task finish.
- Live own QA covers settings deep link and invite acceptance, no-account, not-configured, ready, seeded sandbox linked, author/detail/list/account links, actual auth unlink cancellation and execution; local unlink after the fix. Test account only, no ORCID account/client creation, real secret or real ORCID login. Parent owns real sandbox end-to-end sign-in (see updated parent task/AGENTS).
- Sequential integration: common iD renderer -> card -> small propagation seams -> behavior/type/copy/UI checks -> independent real-app QA -> parent-owned backend regression fix -> final screenshots/report. No independent child package warranted delegation.
- Codegraph is not indexed for the exact worktree; native source reads used under knowledge-lookup fallback.

## Next steps
<!-- task:closed -->
Closed 2026-10-23T02:05:53Z: ready; the parent gaid-orcid integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- RESOLVED by parent fix 0007ad5165d0 and final live recheck: local-iD DELETE after auth unlink hung; direct source reread confirmed a backend deadlock: link/unlink hold serial() while returning status(), which now enters serial() again for hub-ready reconciliation. Parent notified with concrete reproduction and asked to own the backend fix. Rebuilt the QA app with the fix and recaptured the final matrix; status/local unlink now return.
- QA job restart initially rejected a dirty source tree. Tracked disposition changes were saved, but the repeated rejection shared the premise that untracked screenshot files were allowed. Direct `git status --short` showed only untracked screenshots; save their draft evidence paths before starting the final snapshot.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
### Final verification and evidence

- Screenshots: reports/2026-10-22-gaid-orcid/figures/orcid2-{no-account,ready,linked,author,browse,account}-{instrument,mapsheet}-{light,dark}-{1440,1280}.png (48 PNGs, all under 1 MB, expected viewport sizes checked). Section-12 review: card actions visible without scrolling, full iD wraps at the record path, no clipped text, theme/style roles and original icon colours retained, plain limits/test notices visible, one existing filled library action, compact author link distinct from row action. Keyboard/native-link and return-focus behavior covered by native semantics plus component/live action checks.
- External evidence/launcher/Playwright snapshots and logs: /home/seongin3/data/geoaidesk/work/gaid-orcid-auth-ui/. SHA-256 manifest: screenshots.sha256. Final own test services (4318/18118/18718) stopped and browser session orcid2 closed. Zero console errors in final session. Test credentials are synthetic; never used a real client secret or user account.
- `cd web && npx tsc --noEmit`: passed after final layout changes. `cd web && npx vitest run src/geo/orcid src/geo/hub/shared-browse.test.tsx src/geo/hub/shared-method.test.tsx`: 4 files/23 tests passed. Full `npm test` covered by the recorded scripts/check run: 191 files/1231 tests passed.
- `cd server && npx vitest run test/geo-orcid.test.ts test/geo-hub-orcid.test.ts`: 2 files/15 tests passed after parent merge.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 0 errors, 69 warnings; four new warning hits on accurate authenticated/verified ORCID labels, retained after context review. `node geo/ui/check-ui.mjs`: 0 errors, 78 pre-existing accepted debt, no additions. `git diff --check`: passed.
- Humanizer file mode applied to added report prose, using references/korean.md; preserved figures, paths, commands, numbers and uncertainty. Report additions limited to 3.1, 4.1 and appendix evidence rows; parent will update the phase-1 headline/limits for the full phase-2 delivery.
- Not verified by this child: real ORCID OAuth (parent-owned), production redirect acceptance, real researcher account, live service 409/502 failures (component paths cover them). No extra required scope/open items.

### Phase-2 UI delivery details

Changed files: web/src/geo/orcid/{api.ts,id-display.tsx,orcid-card.tsx,orcid-card.test.tsx,import-dialog.tsx}; web/src/geo/hub/{shared-method.tsx,shared-entry.tsx,shared-browse.tsx,shared-method.test.tsx,shared-browse.test.tsx}; web/src/geo/hub-server/account.tsx; web/src/geo/library/library-screen.tsx; web/src/geo/locales/orcid/{ko,en}.json. Parent notified of the minimal shared-entry/library-screen propagation seams. No server/contracts/icon changes.

UI rules followed: P2/P3/P5/P9 (existing library remains primary; honest typed/authenticated/test states); I2/I6/I7/I8/I12/I13 (roles and unchanged official pixels); L4/L7; B1/B2/B3/B5 (outline secondary auth actions preserve Add paper as primary); D2/D3 (explicitly requested auth-unlink confirmation with retained-data consequence); F5/R2 (plain errors, raw error collapsed); A1/A2/A3/A5 (native links/buttons, focus, status announcements); W1-W6; R1/R3; V1/V2/V3/V6. No new exceptions or baseline debt. Compact author links are separate siblings of the row action, not links nested in a button; 28px target and accessible full iD name. Both table/header author columns widened to 8rem.

Strings below are all additions (before: absent); no existing ko/en string was changed.

| String id | Korean | English |
|---|---|---|
| orcid.id.authenticatedLink | 인증된 ORCID iD: {url} | Authenticated ORCID iD: {url} |
| orcid.id.link | ORCID iD: {url} | ORCID iD: {url} |
| orcid.id.sandbox | ORCID 시험 환경 (시험용 기록) | ORCID sandbox (test records) |
| orcid.auth.hint | ORCID에서 로그인한 뒤 GAID로 돌아오세요. | Sign in on ORCID, then return to GAID. |
| orcid.auth.start.button | ORCID로 본인 확인 | Verify iD with ORCID |
| orcid.auth.starting.button | ORCID 연결 중 | Opening ORCID |
| orcid.auth.waiting | ORCID에서 본인 확인을 마치면 돌아와 연결을 확인하세요. | After verifying on ORCID, return here to check the link. |
| orcid.auth.open.button | ORCID 로그인 열기 | Open ORCID sign-in |
| orcid.auth.noAccount | ORCID 본인 확인에는 기관 GAID 허브 로그인이 필요합니다. | To verify your ORCID iD, log in to the institute GAID hub. |
| orcid.auth.settings.button | 기관 허브 설정 열기 | Open institute hub settings |
| orcid.auth.notConfigured | 허브에 ORCID 연결이 설정되지 않았습니다. 허브 관리자에게 문의하세요. | ORCID is not set up on this hub. Ask the hub administrator. |
| orcid.auth.unreachable | 기관 GAID 허브에 연결하지 못했습니다. 연결 상태를 다시 읽으세요. | Could not reach the institute GAID hub. Read the connection status again. |
| orcid.auth.unlink.button | 본인 확인 연결 해제 | Unlink verified iD |
| orcid.auth.unlink.title | ORCID 본인 확인 연결 해제 | Unlink verified ORCID iD |
| orcid.auth.unlink.hint | 허브 계정의 본인 확인 연결을 해제합니다. iD는 인증 안 된 상태로 남고, 가져온 논문과 내 논문 표시는 유지합니다. | Remove the verified link from your hub account. The iD stays as unauthenticated; imported works and own-work marks stay. |
| orcid.error.auth | 본인 확인 연결을 처리하지 못했습니다. 연결 상태를 다시 읽고 시도하세요. | Could not process the verified link. Read the connection status again and retry. |

## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-orcid/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014215.596995Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014224.083641Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014353.337542Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-orcid-auth-ui/playwright"],"reason":"QA app stopped to rebuild the final URL wrap and author-column layout snapshot; live state checks passed.","recorded":"2026-10-23T01:47:41Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014402.188704Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014832.992699Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-orcid-auth-ui/status-after-auth-unlink.json"],"reason":"Own QA instance stopped after reproducing the nested serial/status local-link deadlock; parent owns the backend fix. Restart with the fixed snapshot before final matrix.","recorded":"2026-10-23T01:52:33Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T015317.596352Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-orcid-auth-ui/fixed-after-local-unlink.json"],"reason":"Own final QA completed: parent deadlock fix rechecked, stable no-account/ready/linked and account/author/list screenshots captured; browser closed and all own test services stopped.","recorded":"2026-10-23T01:56:29Z","state":"cancelled"}
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

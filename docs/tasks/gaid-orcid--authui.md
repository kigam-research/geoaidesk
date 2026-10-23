---
format: 1
status: active
updated: 2026-10-23T01:47:11Z
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
- Implemented draft UI: authenticated/typed iD display, sign-in tab handoff and return refresh, confirmed auth unlink, all hub states; author/account display. Initial focused checks passed: frontend TypeScript and 23 tests (ORCID, shared method, shared browse). Copy/UI validators: no errors. Expanded author-link tests added; full checks pending.
- Codegraph is not indexed for this exact worktree; native source reads used (knowledge-lookup fallback).
- Sequential decisions: preserve the fixed server contracts; implement the shared iD renderer first, then card and tiny propagation seams, then behavior tests, own real-app smoke/screenshots, report and task finish. No independent package warrants a reader or child writer.
- Owned interfaces: web/src/geo/orcid/, orcid locales; small shared-entry/library-screen propagation seams notified to parent. No backend edits.
## Next steps
1. Run focused tests/typecheck, then real-app states and screenshot matrix, full required checks, report section and finish.
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
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014215.596995Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014224.083641Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014353.337542Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--authui-20261023T014402.188704Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

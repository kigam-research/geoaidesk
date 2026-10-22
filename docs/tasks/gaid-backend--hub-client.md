---
format: 1
status: active
updated: 2026-10-22T06:08:17Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"0f9f23bb-d4fa-414a-ac24-013ec75bf859","pid":218011,"provider":"codex","session":"01a16239-46ad-76b2-bf26-1542518695ff","start":"53722223","token":"0368e1fa931ceaf97724ae961a53cdcf30c486f1aa68991fa847a4db622d36e9"}
branch: task/gaid-backend--hub-client
target: task/gaid-backend
parent: gaid-backend
---
# gaid-backend--hub-client

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
Goal: P2 `hub-client` — connect a researcher's GAID to the hub server and sync the personal library (ADR decisions 2, 3, 5, 7).
Owned files: server/src/geo/hub-client/**, server/src/geo/library/sync/**, server/src/geo/routes/hub-server.ts (new) + one
registration line in server/src/geo/routes.ts, server/test/geo-hub-client*.test.ts, server/test/geo-library-sync*.test.ts.
Do not edit server/src/geo/library/store.ts (another active unit may touch library code); use LibraryStore's public API
(all/get/put/drop/collections/saveCollections/filePath/storePdf); if a tiny addition is unavoidable, keep it additive and say so.
Build:
1. Connection store `<KADY_PI_AGENT_DIR>/hub-server/connection.json` (mode 0600; dir 0700): { url, token, account, serverId,
   savedAt }. `GAID_HUB_SERVER_URL` overrides the address (fromEnv). URL rules: http or https, host[:port], no path/query/
   userinfo; plain http allowed for this configured server only (ADR decision 5). Token never leaves the backend (not in any
   response or log).
2. HTTP client for /hub/v1 (protocol.ts): bearer token, bounded timeouts (e.g. 10 s JSON, 120 s files), size limits, maps 401 to
   "logged out" (clear token, keep url), 502 with a Korean `{ error }` when unreachable; never sends Origin/Sec-Fetch headers;
   checks `serverId` against the saved one (different server behind the same address → log out, keep url).
3. `RemoteHubStore implements HubRecordStore` over the client (kind "remote"); `serial` process-local. Register
   `setRemoteHubProvider` at route registration so `resolveHub` returns { remote store, actor {id: account.id, name:
   account.displayName} } while logged in. Initialize lazily. Keep the existing /geo/hub/* behaviour; only add what the
   remote case needs.
4. Routes /geo/hub-server/* exactly as in web/src/geo/contracts/hub-server.ts (status, config, login, accept-invite, logout, me,
   admin users/invites passthrough with 403 for non-admins). Registration through server/src/geo/routes/hub-server.ts.
5. Library sync engine (server/src/geo/library/sync/), routes GET/POST /geo/library/sync: state file under the library dir
   `sync/<serverId>-<accountId>.json` { serverVersion, objects: { "<kind>:<id>": { version, hash } }, lastSyncedAt };
   local change = hash differs from state or object new; local deletion = in state but gone locally. Order: pull (since
   serverVersion) → apply remote changes where the local object is unchanged; if both changed, newer `updatedAt` wins (folders:
   remote wins) and the replaced local copy is written to `sync/conflicts/<iso>-<kind>-<id>.json`; download missing PDFs before
   writing an item that names them → push local changes with base versions, uploading PDFs first (HEAD then PUT) → on "stale"
   pull once more and retry once. Folders map to LibraryCollection objects (collections.json as a whole is rewritten through
   saveCollections). Zotero dedupe: a pulled item with `zotero` ref matching a local item by (libraryType, libraryId, itemKey)
   under another id keeps the pulled id and puts the local id into `aliases.ids` (drop the local file). zotero.json and Zotero
   keys never sync. One sync at a time (409). Sync once in the background after login and at startup when logged in; manual via
   POST. Owner field: write the account id into `owner` of objects pulled/pushed? No: leave `owner` as stored; the server
   scopes by account.
6. Tests: against an in-process fake hub server (a small Fastify app implementing the protocol subset you use), or P1's
   `buildHubServer` from server/src/geo/hub-server/ if it is on your branch's base (it is not at start). Cover: config/URL
   rules, login/logout, token never in responses, 401 handling, remote register → star → comment → install through /geo/hub/*
   with the fake, edit vs copy by account, library sync both directions, deletions, conflicts (both sides changed), PDF
   transfer, Zotero dedupe, stale retry.
Report in the final message: modules, routes, test counts, assumptions about P1's server behaviour you relied on.

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

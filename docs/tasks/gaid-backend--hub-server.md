---
format: 1
status: active
updated: 2026-10-22T06:44:20Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"eb2d31aa-1e53-44fb-bc41-429c1eec3733","pid":214565,"provider":"codex","session":"01a16239-1e42-73b2-a1e3-4e088ec201a3","start":"53721186","token":"7929be5dae8e6ce4050b1260c2d83a48b5bd832aedf7e77cb23115d43d1fb6a6"}
branch: task/gaid-backend--hub-server
target: task/gaid-backend
parent: gaid-backend
---
# gaid-backend--hub-server

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
Goal: P1 `hub-server` — the institute GAID hub server process (ADR decisions 1, 3-8).
Owned files: server/src/geo/hub-server/** (protocol.ts: additive only), geo/hub-server.mjs (launcher, like geo/start.mjs runs
tsx), server/test/geo-hub-server*.test.ts, docs/geo/hub-server.md (operator guide in English: install, first admin invite,
serve, backup/check-backup, import-hub, moving to another PC, plain-HTTP caveat). If you must edit an upstream file, first add it
to geo/integration-boundaries.json with owner gaid-backend.
Build:
1. `buildHubServer({ home, now?, random? })` → Fastify app serving exactly the /hub/v1 routes of protocol.ts. Refuse any request
   carrying `Origin` or `Sec-Fetch-Site` (403) before routing. Body limits per route (files 20 MiB, library files 64 MiB, JSON
   small). Errors `{ error }` in Korean like server/src/geo/hub-shared/routes.ts. Home layout: `hub.sqlite` (node:sqlite
   DatabaseSync, WAL, foreign_keys=ON, busy_timeout), `blobs/<sha256>` (write via temp + rename, content-checked),
   `server.json` (serverId, created). Refuse a home inside a git checkout (like geo/start.mjs refuses data in the checkout).
2. Schema with explicit numbered migrations (`schema_migrations`), PostgreSQL-portable SQL (TEXT ids/times, JSON in TEXT):
   accounts, sessions (token sha256, account, device, created/last_used/expires), invites (code sha256, email, role,
   created_by, expires, used_at, account), audit_events, hub_folders, hub_entries (id, record JSON without installs,
   author_id, updated_at), hub_files (entry_id, path, sha256, size), hub_stars (entry_id, account_id), hub_comments,
   hub_installs, library_versions (account, version), library_objects (account, kind, id, version, deleted, data, updated),
   library_files (account, sha256, size). Seed the default folder `general` "일반" like SharedHubStore.initialize.
3. Accounts: scrypt (node:crypto; store params+salt), timing-safe compare; email normalized lower-case; display name 1-40 chars
   (HUB_ACCOUNT_RULES); password 10-200; sessions = 32 random bytes base64url, stored as sha256, 90-day sliding expiry,
   last_used updated at most once a minute; login rate limit (e.g. 10 failures / 15 min per email and per IP → 429); disabled
   accounts refused and their sessions ended; invites single-use, 7 days, code shown once; last admin cannot be demoted or
   disabled (409). Audit every mutation (account id, action, target, small detail JSON, device).
4. Hub records = a server-side `HubRecordStore` (SQLite) enforcing the write rules in records.ts: author/authorId/registeredBy/
   registeredById/comment author always from the account (display name at write time); new entry owned by the caller; existing
   entry writable only by its author: exactly the next revision appended (earlier revisions + snapshots deep-equal), metadata
   and authoringProjectId may change, installs ignored (separate POST); every file a snapshot names (packages/<rev>.tar.gz and
   each visual file/dark file) must be stored for that entry and the package sha256 must equal snapshot.package.sha256;
   files write-once per (entry, path), upload allowed only to a non-existing entry or by its author; stars keyed by account
   id; folder names unique. GET list newest first.
5. Library sync server per protocol.ts + ADR decision 7: per-account monotonically increasing version; push applies each change
   only when baseVersion equals the stored object's version (0 = new), else conflict "stale"; an item whose attachments name a
   stored PDF (attachments[].stored.sha256) missing from library_files → conflict "missing-file"; deletions are tombstones;
   files content-checked (sha256, `%PDF-`), per account. Strictly per account: no admin access.
6. CLI `node geo/hub-server.mjs <cmd>` (home from `--home` or `GAID_HUB_SERVER_HOME`, default ~/.geoaidesk-hub):
   `serve [--host 0.0.0.0] [--port 8700]` (prints the URL researchers enter), `invite --email E [--role admin|member]`
   (prints code + expiry), `users`, `backup --to DIR` (VACUUM INTO + blobs + manifest.json with sha256s), `check-backup DIR`
   (restore into a temp dir, open, verify hashes and row counts, print summary), `import-hub --from <shared hub dir> --authors
   <json map display name → account email>` (reads a local SharedHubStore layout read-only: folders.json, entries/*/entry.json,
   files, stars.json, comments.jsonl; maps authors only through the map, refuses unmapped authors unless `--unmapped-to EMAIL`;
   stars/comments by unmapped names are kept with a placeholder display name; dry-run by default, `--apply` to write; idempotent).
7. Tests (vitest, temp homes): auth (invite→accept→login→me→logout, wrong password, rate limit, disabled, last admin), browser
   refusal, write rules (forged author, non-author revision, skipped revision, changed old snapshot, missing file, different
   bytes), stars/comments/installs, library push/pull/conflicts/tombstones/files, backup + check-backup, import-hub from a fixture
   built with SharedHubStore. Use `app.inject`.
Report in the final message: routes implemented, CLI usage, test counts, anything deferred.

## Current state
Parent resolved the target ordering issue in b7893fe24aeb: P2 hub-client/routes are integrated and the premature e2e
suite is removed. Verified remote target and its tree. Retrying task finish in place with the Git-free test fixture fix.
The parent will hold its target branch stable until P1/P3 finish. Owner allowlist registration is fixed (7 focused tests).
Implemented the standalone hub server under server/src/geo/hub-server/ (buildHubServer in index.ts), geo/hub-server.mjs,
and docs/geo/hub-server.md. The existing protocol.ts and UI contracts are unchanged. Includes numbered SQLite migrations,
content-addressed blobs, scrypt accounts, single-use invites, sliding hashed sessions, persisted login throttling, admin
rules/audit, account-owned immutable hub revision/file rules, separate stars/comments/installs, per-account library sync,
consistent backup plus restore checking, and dry-run-first/idempotent legacy import. No service deployed; production
homes were not accessed.
Verified: server npm ci; npx tsc --noEmit -p .; npx vitest run test/geo-hub-server.test.ts (38 passed), including a real
launcher HTTP serve/health/browser-refusal/SIGTERM test and CLI invite/users/backup/check-backup smoke. Tests use temporary
homes under ~/data/geoaidesk/work/gaid-backend--hub-server/tests and remove them. Operator prose reviewed in humanizer file
mode. No user-facing UI strings or UI components changed.
Safe re-verification: cd server && GAID_CATALOGUE=off npx vitest run test/geo-hub-server.test.ts; npx tsc --noEmit -p .
First task-finish check on 61d1afab: backend 2107 passed / 8 skipped; frontend 1156 passed; launcher check passed.
Distribution checks reached 48 passed / 1 skipped / 1 failed: the hard-coded seam owner allowlist omitted gaid-backend.
Registered that owner (plus the distribution-test seam); focused distribution tests: 7 passed. Retrying task finish.
Correction after reading the recorded job's actual log and output on its exit notice: the original b61bf500 job failed
in the home-refusal test, not the owner allowlist. The test assumed cwd was a Git checkout, but recorded jobs export a
Git-free source tree. That job had 2105 passed / 8 skipped / 1 failed, stopped in backend tests, and produced only the
unrelated remote-compute-prompt-budget.json check artifact (inspected). Replaced the cwd-dependent assertion with a
self-contained .git worktree-file fixture, complementing the existing .git-directory and symlink cases. Job retained;
not relaunched. After the fixture fix, all 38 focused tests pass both in the task worktree and in a separate Git-free
export at ~/data/geoaidesk/work/gaid-backend--hub-server/gitfree-check-poCsoz (same explicit Vitest file). The separate
export verifies the failed premise directly without repeating the full job.
## Next steps
1. Run task finish against the now-coherent b7893fe2 parent target (no resume or task save after failed finish).
2. Keep the original recorded check job; do not relaunch it. It failed at the now-fixed Git-free test assumption. Its
   terminal disposition can cite the final successful check as evidence, once that check exists.
3. Parent integrates P1/P3 after P2 and performs cross-GAID tests/deployment. No production service deployed by this child.
## Failed approaches
- Recorded job b61bf500 (2105 passed / 8 skipped / 1 failed) exposed a cwd/.git assumption in our test. Fixed the test
  with explicit temporary directory/file Git markers; no runtime change. Earlier statements conflated that job with
  the separate first finish check owner-allowlist failure; this entry corrects the record.
- Finish attempt 2: parent draft e2e suite imported missing P2 modules. This is a target ordering issue; do not weaken
  runtime/tests or add placeholder modules in P1. Requested a coherent target from the parent before retrying.
- First finish failed on the new seam owner's missing allowlist registration, not a hub runtime/test failure. Added the
  exact owner to geo/tests/distribution.test.mjs; all other owner/file/status assertions remain intact. This minimal
  distribution glue extends the owned-file list only as necessary to satisfy the repository's declared check.
- Initial focused suite: default general folder was not first when its creation time tied a new folder. Fixed SQL ordering
  to keep general first; the 37-test suite passed afterward. One file-write command used the server working directory with
  a root-relative path and failed without writing; corrected the working directory immediately.
## Notes and decisions
- Parent integration instruction 2026-10-22: preserve actual Zotero collection ids generated by zoteroCollectionId.
  Library changes now accept URL-encoded zc- ids up to 1024 characters (other ids retain the 200-character bound).
  Regression covers two real-shaped ids, one >200 characters, JSON round-trip, collection membership and tombstones;
  oversized/malformed zc- ids are refused. The existing full-check job is retained, not relaunched. No wire changes.
Sequential decisions: use the accepted wire contract without semantic changes; keep the hub process independent of the
agent runtime/config and its data; perform record/version/audit mutations in the same SQLite transaction; publish blobs
before referencing them. This child owns only its listed server, launcher, tests and operator-guide files. The work is
tightly coupled and stays with this single writer. Parent integrates P1 before P2/P3. No nested writers.
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
- /home/seongin3/data/geoaidesk/runs/gaid-backend--hub-server-20261022T061929.293856Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

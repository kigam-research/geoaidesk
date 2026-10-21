---
format: 1
status: active
updated: 2026-10-21T13:26:47Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8efa9960-157f-4f0e-b907-50fa7ca9186a","pid":2619537,"provider":"codex","session":"01a15e90-4520-7db2-8f1f-5d78d5373035","start":"47581455","token":"245fd43eee5872c64898ddf1d2632eb44ca2341c85e6360286ab326912a17bae"}
branch: task/gaid-library-folders--zotero-writes
target: task/gaid-library-folders
parent: gaid-library-folders
---
# gaid-library-folders--zotero-writes

## Goal and done criteria
Request from the starter:

# Child task: zotero-writes (geoaidesk)

Parent: gaid-library-folders (topic folders in the GAID library, folder-scoped citations, send GAID items to Zotero).
Read the parent task document docs/tasks/gaid-library-folders.md "Notes and decisions" (folder model, membership rule,
send-to-Zotero rule) and the connector README server/src/geo/library/zotero/README.md before you start.

Goal: extend the Zotero connector module (server/src/geo/library/zotero/**) with the confirmed write operations the parent
needs to send GAID items and folders to Zotero. Official APIs only; never read zotero.sqlite.

Functions (export from zotero/index.ts; keep existing ones working, `addItemToInbox` may be reimplemented on top):
1. `ensureCollection(client, library, { name, parentKey? }) -> { key, version, created: boolean }`: list collections; reuse an
   existing collection with exactly that name and parent (`parentCollection` false/absent for top level); otherwise create
   it with `If-Unmodified-Since-Version` (412 -> ZoteroConflictError after re-read, like today). `ensureInboxCollection` may use it.
2. `createItem(client, library, { csl, collectionKeys, tags? }) -> ZoteroItemRef`: cslToZotero + collections + tags, one
   create call, re-read the created object for key/version (as addItemToInbox does today).
3. `addItemToCollections(client, ref, collectionKeys) -> ZoteroItemRef`: add memberships only (never remove), version
   precondition, partition check (connection/serverId/library) as in addTags; no-op when already a member.
4. `uploadAttachment(client, library, parentKey, { bytes, filename, contentType, title?, fullText? }) -> { attachmentKey, uploaded: boolean, indexedChars?: number }`:
   the Zotero file-upload flow (https://www.zotero.org/support/dev/web_api/v3/file_upload; the Local API of Zotero 10 uses
   the same steps): create an `attachment` child item (`linkMode: "imported_file"`, contentType, filename, parentItem),
   POST `<lib>/items/<key>/file` form `md5,filename,filesize,mtime` with `If-None-Match: *` (application/x-www-form-urlencoded)
   -> `{exists:1}` or `{url, contentType, prefix, suffix, uploadKey}`; POST prefix+bytes+suffix to `url` WITHOUT the API key
   (Web: https storage URL; Local: a loopback URL on the Zotero port — validate the URL: https, or same origin as the client base);
   register with POST form `upload=<uploadKey>` + `If-None-Match: *` -> 204. Then, when `fullText` ({content, indexedPages,
   totalPages}) is given and contentType is application/pdf, PUT `<lib>/items/<attachmentKey>/fulltext` (Zotero does not
   index files uploaded through the Local API itself). Bound bytes to MAX_ATTACHMENT_BYTES (64 MiB). The client currently
   sends JSON bodies only: add the minimal client support (form bodies, extra headers) without weakening existing checks
   (no credentials in errors/logs, key never sent to the storage URL, 4-request gate, backoff).
   The existing reference implementation of the same flow against real Zotero 10.0.6 is the `attach_file` function in
   ~/.local/share/office-agent-toolkit/venv/lib/python3.12/site-packages/office_tool/zotero.py (read it; do not import it).
5. A Local write key is single-use unless the researcher chose "Always Allow": report a consumed key as
   ZoteroError("key-rejected") at the step where it happened, never re-authorize automatically (unchanged rule).

Tests: extend server/test/fixtures/geo-zotero-server.ts (fake Local + Web) for collection parents, membership patch,
attachment create, file authorization/upload/registration (exists and new), fulltext PUT, 412 conflicts, a key consumed
mid-flow, storage URL that must not receive the key. Run `cd server && npx vitest run test/geo-library-zotero.test.ts` and
`npx tsc --noEmit`.

Real smoke (required if it works headless; never open a window on the user's screen): `oat-zotero sandbox start --fresh
--dir ~/data/geoaidesk/work/zotero-writes/zotero-sandbox` (headless, port 23129, its own profile;
the sandbox seeds a remembered write key into its profile and into ~/.config/oat-zotero/keys.json — read the key from the
sandbox profile `localAPIKeys.json` only to put it into your test's in-memory secret store; never print it). Run your
functions against http://127.0.0.1:23129/api/ with a synthetic PDF and synthetic metadata: nested collection, item in two
collections, PDF uploaded and readable back (file bytes hash equal), full text present, membership add idempotent. Save a
small JSON evidence file (no key) under ~/data/geoaidesk/work/zotero-writes/, stop the sandbox.
If the Local API refuses a step (e.g. file upload not supported locally), record exactly which step and status, and stop
there; do not work around it by touching Zotero's data directory.

Scope: only server/src/geo/library/zotero/**, the two test files above, append-only entries in geo/integration-boundaries.json
if you add files, the README's entry table and limits. Do not edit the shared contract web/src/geo/contracts/library.ts,
the store, zotero-service.ts, routes or UI (the parent owns them and is editing them now). No new npm dependency.
Network: KIGAM blocks raw.githubusercontent.com (use gh api / codeload).

Evidence for your finish: test summary, typecheck result, the new functions with one line each, the smoke JSON locator and
sha256, and what you could not verify (e.g. Web storage upload against the real api.zotero.org).

## Current state
The connector now exports ensureCollection, createItem, addItemToCollections (including actually-added keys), and
uploadAttachment through the existing index.ts exports. Inbox operations remain compatible. Forms and credential-free
storage upload share the existing four-request gate/backoff; 412 re-reads without overwriting and consumed keys stop
the operation without reauthorization.

Verified: 50 connector tests plus 5 existing Zotero-service tests passed; server `npx tsc --noEmit` and `git diff --check`
passed. Real headless Zotero 10.0.6 passed nested/reused collections, metadata in two collections, additive/no-op
membership, PDF upload/read with equal SHA-256, and fulltext PUT/read. The isolated sandbox was stopped.

Evidence: /home/seongin3/data/geoaidesk/work/zotero-writes/smoke.json
SHA-256: 22b43c3dfde37e6fc93b99996d5dc2ecdea4484110e2765c9bfb3641c9787bd4
Real Web storage/account behavior and Windows/WSL networking remain unverified (fake Web protocol passed).
Initial full scripts/check passed (backend 2059 passed/8 skipped, frontend 1142 passed, production smoke PASS).
task finish merged parent checkpoint 8278864c and rechecked the merged tree; one parent-owned service test is stale:
geo-library-zotero-service.test.ts:75 expects the old sendToZotero item return, but the parent changed it to a result
containing item. 2064 other backend tests passed/8 skipped. The parent fixed the assertion and added upload-count
coverage in pushed checkpoint 0ea99a74. Rerunning task finish will merge that fix and recheck the final tree.
## Next steps
1. Rerun task finish in place (no resume) to merge the pushed parent's service-test fix (0ea99a74) and recheck.
   Do not use task save after this failed published finish.
2. The parent runs task complete after finish succeeds.

## Failed approaches
- Initial npx tsc/vitest had missing local dependencies (not a source failure); installing the lockfile dependencies.
- The external smoke script first used .ts outside a package.json and tsx chose CJS, rejecting top-level await before
  any API operation. Renamed it to .mts; the smoke then passed without any connector workaround.
- First merged finish check failed on the parent-owned service test's old return shape; connector tests passed.
  Log: /home/seongin3/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-89g1v4k3.log. Parent informed directly;
  no speculative connector edit is appropriate for this API-consumer assertion mismatch.
## Notes and decisions
Sequential decisions: preserve the existing four-request gate and backoff; support form encoding only in the narrow
file-authorization/registration methods; storage POST has no API credentials and manual redirects. Collection identity
is exact (name,parent), and membership updates only append. Parent owns deduplication/ref→GAID identity persistence.
Owned files: zotero/{types,client,writes,attachments}.ts, zotero/README.md, geo-library-zotero.test.ts and its fake fixture.
No independent worker package is needed in this bounded child unit. Integration order: connector/API types → protocol
fixture/tests → real Local smoke → parent service wiring (parent-owned). Existing index.ts export-stars expose the additions.
Knowledge lookup: exact worktree codegraph is unavailable (no index); used native reads of the selected files and the
live parent's task Notes and decisions. Official file-upload documentation and installed office_tool attach_file were read.
- Parent follow-up accepted: addItemToCollections returns ZoteroItemRef & {added:string[]}; the list includes only
  unique memberships appended by this call and is empty for a no-op. It does not appear in Zotero request bodies.
- Functions for parent integration:
  - ensureCollection: exact name/parent reuse or library-precondition create; returns key/library version/created.
  - createItem: one CSL-derived metadata creation with unique collections/string tags and re-read reference.
  - addItemToCollections: preserve existing memberships, append only, enforce partition/version, return added keys.
  - uploadAttachment: create imported_file child; MD5 form authorization; credential-free multipart storage POST;
    form registration; optional supplied PDF text PUT. At most 64 MiB file + 1 MiB framing, no storage redirects.
- Checks (2026-10-21): `cd server && npx vitest run test/geo-library-zotero.test.ts test/geo-library-zotero-service.test.ts`
  passed 55/55; `cd server && npx tsc --noEmit` passed. `git diff --check` passed. Full scripts/check is parent-owned.
- Smoke reproduction: only against a freshly started isolated headless sandbox, run
  `cd server && npx tsx /home/seongin3/data/geoaidesk/work/zotero-writes/smoke.mts`, then stop the sandbox. The script
  reads only its seeded sandbox-profile key into memory; never prints it. It generates a valid synthetic 604-byte PDF
  whose upload/download SHA-256 is dac21cd9da9c8198a797abb59108ba74dd9f5f9b0c9aeb5470e9da5c8183867d. The supplied
  text had 29 characters and one indexed/total page. Never rerun creation against a user's library or reuse its key.
- No new dependencies, shared-contract/store/service/route/UI edits, user-library writes, or database access.
  Existing test paths already have integration-boundary entries; no new files were added in the repo.
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

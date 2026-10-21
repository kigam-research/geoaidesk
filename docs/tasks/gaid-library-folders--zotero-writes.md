---
format: 1
status: waiting
updated: 2026-10-21T13:04:26Z
writer: {"host":"seongin3","reserved":"245fd43eee5872c64898ddf1d2632eb44ca2341c85e6360286ab326912a17bae"}
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

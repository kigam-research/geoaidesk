---
format: 1
status: waiting
updated: 2026-10-21T11:24:34Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"e61bf52d-9268-4d06-84a2-99fbdf1887bf","pid":1532697,"provider":"codex","session":"01a15e34-d40a-7262-97ac-59bb6d8bed03","start":"46982181","token":"1fdd4903634b060370661f31b814e1d918a83246483d200dcfc62cb55ea81402"}
branch: task/gaid-research-hub--zotero
target: task/gaid-research-hub
parent: gaid-research-hub
---
# gaid-research-hub--zotero

## Goal and done criteria
Request from the starter:

# Child unit: gaid-research-hub--zotero (Zotero connector module)

Parent: gaid-research-hub (GeoAIDesk). Read the parent's decisions first, in your worktree:
- docs/adr/2026-10-21-research-hub-library.md (decisions 2-4 are your contract)
- web/src/geo/contracts/library.ts (draft contract: LibraryItem, ZoteroItemRef, ZoteroLibraryState, ZoteroWrite, CslItem)
- reports/2026-10-21-gaid-research-hub/index.md §3.5 (what "smooth Zotero integration" means for the researcher)
- AGENTS.md (checks, boundaries file rule, locale/UI rules do not apply: this unit has no UI)

Goal: a tested server module that connects GAID's personal library to a researcher's Zotero, so the parent can
wire it into the library store and routes. No routes, no UI, no store: the parent owns those.

Scope (owned files):
- server/src/geo/library/zotero/** (new)
- server/test/geo-library-zotero.test.ts (new) and its fake Zotero server fixture under server/test/fixtures/ (new)
- one appended entry per new file under server/test/ in geo/integration-boundaries.json (owner gaid-research-hub--zotero,
  status added). Do not edit any other upstream file. You may change web/src/geo/contracts/library.ts only by adding
  optional fields/types the connector needs; say so in your finish summary.

Required behaviour:
1. One `ZoteroClient` interface with two implementations:
   - Local API: base `http://127.0.0.1:23119/api/` (configurable), reads unauthenticated; writes (Zotero 10+) need a
     local key from `POST /api/local/authorize` (user confirms a dialog in Zotero). Read the `Zotero-Server-ID`
     header on every response. Detect states: Zotero not running (connection refused), local API off (403), key
     rejected, unreachable -> map to `ZoteroLibraryState.state`.
   - Web API v3 (`https://api.zotero.org`): per-user key in the `Zotero-API-Key` header; `GET /keys/current` to learn
     userID and accessible groups; respect `Backoff`, `Retry-After`, 429; at most 4 concurrent requests.
   Store the local write key and the web key only through an injected secret-store interface (the parent provides a
   0600 file under the agent dir); never log keys.
2. Incremental sync per (connection, serverId, libraryType, libraryId): `?since=<version>` on items/collections,
   `/deleted?since=` for removals, `If-Modified-Since-Version` 304 handling, `Last-Modified-Version` as the new cursor;
   reset the cursor when the Local API `Zotero-Server-ID` changes; never compare Local and Web versions. Page through
   results (limit 100). Follow `all` or chosen collection keys. Output: upserts (mapped to the contract's LibraryItem
   fields: csl via `include=data,csljson`, zotero ref, citationKey from Zotero's `citationKey` field when present,
   collections, tags, attachments with zoteroAttachmentKey) and removals (the parent marks removedFromSourceAt).
   Keep a deterministic mapping function so the parent can unit-test merges.
3. Full text and files: fetch attachment full text (`/items/<key>/fulltext`) and the attachment file (local: file view
   URL / web: `/file`), bounded (PDF <= 64 MiB), for the parent's page reader.
4. Narrow write-back (ADR decision 3), each a separate function the parent calls only after the researcher confirms:
   ensure the "GAID 수집함" collection exists (create once, remember its key), add an item to it (create the item from
   CSL when it does not exist in Zotero: this is also "Zotero로 보내기"), add a child note linking a GAID research note,
   add tags. Use version preconditions (`If-Unmodified-Since-Version`), handle 412 by re-reading and reporting a
   conflict, batch at most 50 objects. Never edit metadata of existing items, never write annotations, never delete.
5. Deep links: helpers for `zotero://select/library/items/<key>` and `zotero://open-pdf/library/items/<attachmentKey>?page=N`
   (group libraries: `zotero://select/groups/<id>/items/<key>`).
6. Never read zotero.sqlite.

Tests: a fake Zotero HTTP server (node:http) emulating the v3 endpoints you use, including versions, 304, deleted,
Zotero-Server-ID change, 403 local API off, connection refused, 429 with Retry-After, 412 on write. Run
`cd server && npx vitest run test/geo-library-zotero.test.ts` and `npx tsc --noEmit`. Optional, only if it needs no
window on the user's screen: a smoke check against the real Zotero 10 on PC74 (`zotero` and `oat-zotero` are
installed; Zotero is not running and has no data dir; do not start it on the user's desktop). Skip and say so otherwise.

Network: KIGAM blocks raw.githubusercontent.com (use gh api / codeload). Zotero docs: zotero.org/support/dev/web_api/v3/
(local_api, syncing, write_requests). No new npm dependency unless unavoidable; if you add one, pin it exactly, check
its licence is MIT/Apache/BSD, and list the package files in geo/integration-boundaries.json.

Evidence for your finish: test output summary, typecheck result, the module's public functions with one line each, and
anything you could not verify (e.g. `citationKey` presence in real Web API JSON).

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

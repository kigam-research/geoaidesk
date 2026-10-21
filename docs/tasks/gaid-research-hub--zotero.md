---
format: 1
status: active
updated: 2026-10-21T11:50:01Z
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
- Implemented the standalone connector under `server/src/geo/library/zotero/` (public index + README): Local/Web v3 clients, owner-injected secret storage, server-ID partitioning, 100-object pagination, incremental sync/304/deletions, deterministic mapping, bounded attachments/fulltext, narrow confirmed writes, conflict reporting and deep links.
- Targeted fake-HTTP Vitest: 25/25 passed (2026-10-21). Backend `npx tsc --noEmit` passed on the final source. No shared library-contract edits, dependencies, routes, UI or persistent library-store implementation.
- Real isolated **headless** Zotero 10.0.6 smoke passed: own `citationKey`, CSL export normalization, full + unchanged incremental sync (1 then 0 upserts), 609-byte PDF and indexed/total page coverage 1/1. No personal library or `zotero.sqlite` was read. Sandbox stopped successfully.
- Parent integration contract is documented in `server/src/geo/library/zotero/README.md`; `zoteroRefKey` supports the parent's original-ID lookup. `addItemToInbox` returns the created/updated item key, version and partition.
- Real Web API keys/permissions and Web `citationKey`, authorization dialog flow, Better BibTeX generation and Windows/WSL connectivity remain unverified. Confirmed writes are tested against fake HTTP; real sandbox provisioning used installed `oat-zotero`, not this connector's authorization dialog.

## Next steps
<!-- task:closed -->
Closed 2026-10-21T11:37:36Z: ready; the parent gaid-research-hub integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First `task finish` fetched parent changes and stopped on an append-only conflict in `geo/integration-boundaries.json`; preserved all three Zotero/parent test entries. No code conflicts.
- The initial fake mirrored `/deleted` for both APIs. Real Zotero 10.0.6 returned 404 there, so Local sync now tries it once and falls back to full key/version manifests while retaining incremental object bodies. Regression test added.
- The first mapper assumed `include=csljson` returns an object. Real Local API returned a JSON string containing a one-item array. The mapper and fixture now handle that actual export shape. Both assumptions were tested directly in the real sandbox before further fixes.
- One backend typecheck found an optional-version mismatch in the fallback result; corrected its explicit type and rechecked.

## Notes and decisions
- Ownership/integration: this child changed only connector modules, declared synthetic tests, append-only test boundary entries and this task document. Parent owns routes, store, UI and the canonical report. Tightly coupled implementation/testing needed no independent worker.
- Parent accepted API plan and requested stable lookup by connection/server/library/item plus a created-item ref for in-place source transition; both are implemented. No shared-contract change was needed.
- New `/deleted` fallback result fields `sourceItemKeys`/`sourceCollectionKeys` are complete source manifests. Parent must reconcile missing collections against the latter (not only `removedCollectionKeys`), and atomically save the cursor only after successful sync. `reset` means a full snapshot/partition reconciliation. Changing followed collections requires clearing `lastSyncAt`.
- The Local write key is scoped by base URL and server ID. Local authorization requires the server-ID header; key rejection never automatically reopens a dialog. A single-use key can stop a multi-step inbox action after its first confirmed write; repeated actions discover that same inbox rather than duplicating it.
- Scope limit sent to parent: new-CSL send-to-Zotero creates metadata, not PDF uploads. The parent must keep GAID-managed PDFs accessible until an explicit attachment-upload path exists; no transfer is claimed here.
- Official sources verified 2026-10-21: https://www.zotero.org/support/dev/web_api/v3/local_api ; https://www.zotero.org/support/dev/web_api/v3/syncing ; https://www.zotero.org/support/dev/web_api/v3/write_requests ; https://www.zotero.org/support/dev/web_api/v3/basics .
- Smoke evidence: `pc74:~/data/geoaidesk/work/gaid-research-hub--zotero/smoke.json`, SHA-256 `d690e66e291821d8b6654892f7d1574204e5961672a9e8df6715976b72df604b`. Synthetic PDF SHA-256 `7165ad0ade4f4512e50ff444c9e774d384e51ac5ccefb7c01725de3d899dab89`. Sandbox directory is external to Git and stopped.
- Public functions and one-line responsibilities are listed in the connector README's Entry points table.
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

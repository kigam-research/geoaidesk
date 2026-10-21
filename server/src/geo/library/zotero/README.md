# Zotero connector (server module)

No routes or persistent library store. The parent supplies owner-scoped secrets and atomically commits sync results.
The module never reads Zotero's database. Only the confirmed write functions below should be called by routes.

## Entry points

Import from `server/src/geo/library/zotero/index.ts`.

| Entry | Responsibility |
|---|---|
| `LocalZoteroClient({secrets, baseUrl?})` | Unauthenticated reads, Local API server-ID partition, bounded HTTP/file reads. |
| `local.authorize(appName?)` | Explicit user-initiated Zotero 10 authorization; stores the key, returns only `{remember}`. Never opens a dialog automatically after rejection. |
| `WebZoteroClient({secrets, baseUrl?})` | Web v3 API, per-client limit of four requests including body reads, shared Backoff/Retry-After deadline. Use one client per owner/connection. |
| `web.setKey(key)` / `web.clearKey()` | Store/remove a Web key through the injected secret store. |
| `web.discoverAccess()` / `web.discoverLibraries()` | Non-secret key permissions; concrete personal/group library IDs, names and write permissions. |
| `probeZoteroLibrary(client, state)` | Research-language connection state. A changed partition invalidates the cursor. |
| `syncZoteroLibrary(client, state, options)` | Paged incremental item/collection mirror, deleted records, snapshot consistency and bounded restart on changed server/library. |
| `mapZoteroItem(object, options)` | Pure CSL/data → LibraryItem mapping. Supports object CSL or Zotero's JSON-string/one-item-array export. |
| `zoteroRefKey(ref)` | Stable lookup key for connection, server ID, library type/ID and item key, excluding the mutable version. |
| `zoteroCollectionId(ref, key)` | Partition-scoped GAID collection ID. |
| `ensureInboxCollection(client, library)` | Find/create the sole GAID inbox; return key/library version/server ID for the caller to remember. |
| `ensureCollection(client, library, {name,parentKey?})` | Reuse an exact name/parent match or create it with a library-version precondition. Returns `{key,version,created}`; version is the library snapshot, not the collection object's own version. |
| `createItem(client, library, {csl,collectionKeys,tags?})` | Create one new CSL-derived item with unique collection memberships and string tags; re-read its key/version/partition. Caller owns duplicate detection. |
| `addItemToCollections(client, ref, collectionKeys)` | Append memberships only, with partition/object-version checks. Returns the updated reference plus `added: string[]` (empty for no-op). |
| `uploadAttachment(client, library, parentKey, {bytes,filename,contentType,title?,fullText?})` | Create an imported-file child, authorize/upload/register its bytes, optionally PUT supplied PDF fulltext. Returns `{attachmentKey,uploaded,indexedChars?}`; `uploaded: false` means Zotero associated already-existing bytes. |
| `addItemToInbox(client, library, {existing} \| {csl})` | Add collection membership without replacing existing memberships, or create a new Zotero item. Returns its key/version/partition for an in-place GAID source transition. |
| `addResearchNoteLink(client, ref, {url,title})` | Create an escaped child note containing a link, not the research-note body. Returns the new note reference. |
| `addTags(client, ref, tags)` | Add unique tags, preserving existing tags and automatic-tag types. Returns the updated reference. |
| `getAttachmentFullText(client, attachmentRef)` | Indexed content plus page/character coverage from Zotero. |
| `getAttachmentFile(client, attachmentRef, maxBytes?)` | File-view URL locally, Web `/file` + storage redirect remotely; maximum 64 MiB. API credentials never follow storage redirects. |
| `selectItemLink(ref)` / `openPdfLink(library, attachmentKey, page?)` | Validated user/group Zotero deep links. |
| `cslToZotero(csl)` | Conservative creation mapping for journal article, book, chapter, conference paper, report, thesis, webpage, manuscript, preprint/article and dataset. Unsupported types fail before writing. |

`ZoteroError` carries a safe code/status and a `ZoteroLibraryState.state`; it never includes HTTP response bodies or
credentials. `ZoteroConflictError.current` is the re-read object/list after a write precondition fails; there is no
automatic overwrite/retry. Server-ID changes remain `ZoteroServerChangedError` and require sync, not a write retry.

## Parent-store contract

```ts
const result = await syncZoteroLibrary(client, cursor, {
  owner,
  now: new Date().toISOString(),
  existingItems: mirroredItems,
  idForItem: ref => lookupByRef.get(zoteroRefKey(ref)) ?? allocateGaidId(),
});
```

- Commit upserts, removals and `result.state` together only after the entire call succeeds. Keep references/citations
  on removal and mark `removedFromSourceAt`; never delete GAID items. Existing item IDs/read states are preserved.
- The state passed to sync must belong to this exact library. A change in followed collection keys must clear
  `lastSyncAt` before sync so previously unchanged newly-followed items are fetched.
- When `reset` is true, reconcile old mirrored items/collections against the complete new snapshot. This includes
  switching Local/Web or a changed Local server ID. Do not compare their version numbers.
- **Local Zotero 10.0.6 returns 404 for `/deleted`** (verified with an isolated headless sandbox). The connector tries
  that endpoint, then uses complete key/version manifests while keeping item/collection bodies incremental.
  `sourceItemKeys` and `sourceCollectionKeys`, when present, are complete manifests for deletion reconciliation.
  Known vanished items/attachments in `existingItems` also appear in `removals`. Reconcile stored collections with
  `sourceCollectionKeys`; a missing collection is not necessarily in `removedCollectionKeys` on this fallback.
- When moving an existing GAID item to Zotero, add the returned ref→original GAID ID association to `idForItem`
  before syncing. PDF upload is a separate explicit operation; preserve the GAID-managed PDF until it succeeds.
  No metadata update, annotation write or deletion operation is exposed.
- Inject a separate secret store per owner. The Local key slot includes base URL and server ID; the Web key slot
  includes the API base. The parent must enforce 0600 permissions. Do not serialize client/request headers.
- Local keys are single-use unless Zotero's user chose Always Allow. A multi-step action may stop after creating
  the inbox if the key is consumed; report it and request explicit authorization for the next action. The next call
  discovers the existing inbox rather than creating a duplicate. Writes are at most 50 objects per request.
- Attachment input is at most 64 MiB, with at most 1 MiB of multipart framing. Storage URLs must use HTTPS or
  the API base's same HTTP loopback origin. Storage POST sends no Zotero key/server ID and never follows redirects;
  it shares the four-request gate and Backoff/Retry-After deadline. Only 429 storage writes retry automatically.
  File authorization and registration use `If-None-Match: *`; 412 re-reads the attachment then reports a conflict.
- `fullText` is `{content,indexedPages,totalPages}` and is written only for `application/pdf`; `indexedChars` counts
  the supplied content's JavaScript string length. Zotero Local does not index uploaded PDFs itself. The connector
  does not extract PDF text. A failure can leave a created item or attachment; reconcile/persist partial sends in the
  parent rather than blindly repeating creation. No rollback, automatic reauthorization or deletion is attempted.

## Verification and limits

Required checks: `cd server && npx vitest run test/geo-library-zotero.test.ts` and `npx tsc --noEmit`.
The fake server covers Local and Web protocols; real Local Zotero 10.0.6 additionally verified synthetic metadata,
its own `citationKey`, CSL export shape, initial/incremental sync, PDF bytes and indexed full text without a desktop
window. The connector's own write functions also passed a headless 10.0.6 sandbox smoke: nested exact-match collection
reuse, new metadata in two collections, additive/idempotent membership, imported PDF upload, byte-identical download
(SHA-256), and fulltext PUT/read. The sandbox was stopped afterward. Fake Local/Web tests cover new/existing-file
authorization, registration/fulltext, consumed keys mid-flow, write conflicts and credential-free storage requests.
Real Web account/key permissions and storage upload, Web `citationKey`, Better BibTeX generation and Windows/WSL
networking were not tested. Authorization dialogs were tested against the fake server; the real headless sandbox used
its seeded remembered key, not an interactive authorization dialog.

Official API sources (checked 2026-10-21):
[Local API](https://www.zotero.org/support/dev/web_api/v3/local_api),
[basics](https://www.zotero.org/support/dev/web_api/v3/basics),
[syncing](https://www.zotero.org/support/dev/web_api/v3/syncing),
[write requests](https://www.zotero.org/support/dev/web_api/v3/write_requests),
[file upload](https://www.zotero.org/support/dev/web_api/v3/file_upload).

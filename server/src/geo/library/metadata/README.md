# Library metadata adapters

No routes, stores, acceptance decisions or model calls. All lookup records have `metadataConfirmed: false`.
The researcher must confirm them in the parent UI. An empty `signals` array means no update signal in this response,
not a guarantee that a paper has never been retracted.

## Public functions

Import `server/src/geo/library/metadata/index.ts`:

| Function | Result |
|---|---|
| `identifyPdf(file)` | First three pages only: DOI candidates, arXiv IDs, first-page title guess, `textFound`, read/empty pages, tool version, optional extraction error. No OCR or arXiv request. |
| `createMetadataClient(options)` | Reusable client accepting `fetch`, `mailto`, optional keys, deadline, clock/sleep and maximum cooldown wait. Reuse it so rate state survives across requests. |
| `lookupDoi(doi, provider?)` | Crossref CSL mapping, then OpenAlex fallback; optional provider forces one for smoke checks. Throws `MetadataLookupError` with redacted provider errors if none resolves the exact DOI. |
| `searchByTitle(title, authorHint?)` | Crossref bibliographic query, OpenAlex search and optional KCI; ranked candidates, partial-provider errors and `requiresSelection: true`. Same DOI from different sources stays separate so disagreements remain visible. |
| `searchKci(title, authorHint?)` | KCI title search, or `skipped: true` and no request when the key is absent. |
| `resolveUrl(url)` | DOI candidates from path/DOI query parameters, else bounded HTML `citation_doi`, `dc.identifier`, `prism.doi` tags; URL, method, no inferred title metadata. |
| `doiCandidates`, `normalizeDoi`, `arxivCandidates` | Pure identifier helpers. |

`MetadataRecord` contains `csl`, `metadataOrigin`, `metadataConfirmed: false`, `signals`.
Signals preserve direction (`update-to:retraction`, `is-corrected-by`, `update-type:correction`, `is_retracted`). A
retraction notice referring to another paper is not treated as a definitive assertion about the notice itself.

Crossref uses `CROSSREF_MAILTO` or the explicit `mailto` option; no address is invented. `OPENALEX_API_KEY` is optional
for basic singleton and first-page queries; `KCI_API_KEY` enables KCI. Options override environment values (an empty
key explicitly disables it). The module-level convenience functions lazily create one client with those settings.
The embedding server's configured global dispatcher supplies proxy support. Errors do not contain key-bearing URLs.

Per-client requests serialize, including body consumption. Crossref `x-rate-limit-limit` and
`x-rate-limit-interval` pace subsequent requests; `Retry-After` seconds or HTTP dates set a host cooldown. One
429/503 retry is allowed. A wait over the configured budget (default 60 seconds) returns a provider error instead of
requesting early. Publisher redirects reuse authoring's loopback/link-local validator, check every hop, stop after
five hops, cap bodies at 4 MiB and use a 30-second fetch deadline. Provider bodies have the same 4 MiB cap.

## Shared-code boundary

The authoring PDF extractor writes every page into an authoring store. This adapter reuses its `pdftotextVersion`
but duplicates the command shape with a first-three-pages bound and subprocess output/time limits. Publisher intake
reuses `validateSourceUrl` but duplicates the redirect/stream loop because authoring's fetch persists a source. The
parent approved these separate read-only adapters; authoring behaviour is unchanged. These are candidates for a later
shared IO-helper extraction, not a prerequisite for this feature.

## Verified services (PC74, 2026-10-21)

An opt-in smoke called both Crossref and OpenAlex for `10.1038/nphys1170` and
`10.1371/journal.pone.0000308`: four successful exact-DOI responses, without an OpenAlex key. These are metadata-only
requests. They do not verify a paper's findings, licence or retraction completeness.

Primary references:

- Crossref REST: https://www.crossref.org/documentation/retrieve-metadata/rest-api/tips-for-using-the-crossref-rest-api/
- Crossref API schema: https://github.com/CrossRef/rest-api-doc
- OpenAlex authentication: https://help.openalex.org/api/authentication/
- KCI basic-article API field table: https://www.kci.go.kr/kciportal/po/openapi/openDataView.kci?datasetBean.dtstSeqNo=1

KCI's public table documents `key`, `apiCode=articleSearch`, required UTF-8 `title`, optional `author`, `doi`, page and
`displayCount` (maximum 100). It lists XML `record`, `journalInfo/journal-name`, `pub-year`, `articleInfo/title-group/
article-title[lang=original]`, `author-group/author`, `doi`, `fpage`, `lpage`, and `url`. The adapter targets
`https://www.kci.go.kr/kciportal/po/openapi/openApiSearch.kci`. No KCI key was used in this task: the keyed endpoint,
real XML envelope and account entitlement are not live-verified; the XML fixture is explicitly synthetic. KCI service
failure is a separate error and cannot silently approve a candidate.

## Live smoke

From `server/`, opt in explicitly:

```sh
GAID_METADATA_LIVE_SMOKE=1 npx tsx src/geo/library/metadata/live-smoke.ts /external/output/dir
```

The optional output folder receives response captures; it must be outside the checkout. Without that argument the
script only prints one summary per request. Vitest never invokes this script. `server/test/fixtures/library/` holds
only the small recorded fields needed by tests, plus one synthetic KCI response. Test PDFs are generated into an OS
temporary directory, then removed.

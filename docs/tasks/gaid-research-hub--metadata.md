---
format: 1
status: active
updated: 2026-10-21T11:41:20Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"3af53966-052e-46c3-8a2d-2c8d41a23668","pid":1527917,"provider":"codex","session":"01a15e34-6c95-7c51-97f7-fd1699ddd9db","start":"46979518","token":"3b29a99f8472c13cc91477b88811c27fdf13e9ca7893426b125e2c2824d09462"}
branch: task/gaid-research-hub--metadata
target: task/gaid-research-hub
parent: gaid-research-hub
---
# gaid-research-hub--metadata

## Goal and done criteria
Request from the starter:

# Child unit: gaid-research-hub--metadata (GAID-managed items: metadata lookup and bibliography formats)

Parent: gaid-research-hub (GeoAIDesk). Read first, in your worktree:
- docs/adr/2026-10-21-research-hub-library.md (decision 2: GAID-managed items are for researchers who use only web
  search and PDFs; they must stay light)
- web/src/geo/contracts/library.ts (draft contract: CslItem, MetadataOrigin, LibraryItem.citationKey)
- reports/2026-10-21-gaid-research-hub/index.md §3.5 (table "GAID 관리 항목")
- AGENTS.md (checks and the boundaries-file rule; this unit has no UI)
- server/src/geo/authoring/sources.ts and url-sources.ts (existing pdftotext page extraction and bounded URL fetching
  to reuse; do not change their behaviour)

Goal: tested server functions that turn a PDF, a DOI, a URL or a bibliography file into confirmed-ready CSL metadata,
and that export/format library items, so the parent can wire them into its store and routes. No routes, store or UI.

Scope (owned files):
- server/src/geo/library/metadata/** and server/src/geo/library/formats/** (new)
- server/test/geo-library-metadata.test.ts, server/test/geo-library-formats.test.ts (new) and fixtures under
  server/test/fixtures/library/ (new; recorded API responses, small generated PDFs; no copyrighted PDFs)
- appended entries for new server/test files in geo/integration-boundaries.json (owner gaid-research-hub--metadata,
  status added). No other upstream file. You may add optional fields to web/src/geo/contracts/library.ts; report them.

Required behaviour:
1. `identifyPdf(file)`: pdftotext on the first pages (reuse the existing helper) -> DOI candidates (strict DOI regex,
   strip trailing punctuation), arXiv id, title guess from the first page; report whether text was found at all
   (scanned PDFs have none: say so instead of guessing).
2. `lookupDoi(doi)`: Crossref REST (`/works/<doi>`, polite pool with a configurable mailto; respect rate-limit headers)
   with CSL-JSON content negotiation or mapping; fallback OpenAlex (`/works/doi:<doi>`, keyless basic query; optional
   OPENALEX_API_KEY). Return CslItem + MetadataOrigin + retraction/correction signals (Crossref `update-to` /
   `relation` / `update-type`, OpenAlex `is_retracted`).
3. `searchByTitle(title, authorHint?)`: Crossref `query.bibliographic` + OpenAlex search, ranked candidates with a
   similarity score; the researcher picks (no automatic accept).
4. `resolveUrl(url)`: doi.org / publisher URL -> DOI (URL pattern, then bounded HTML fetch reading `citation_doi`,
   `dc.identifier`, `prism.doi` meta tags; reuse the existing bounded fetch and its loopback/size limits).
5. KCI: an optional adapter used only when `KCI_API_KEY` is set (KCI Open API, XML); otherwise skip cleanly. Document
   what you could verify about its API.
6. Formats: parse BibTeX, RIS and CSL-JSON into CslItem[] (with per-entry errors, never drop silently); export
   CslItem[] to BibTeX, RIS and CSL-JSON; `citationKeyFor(csl, taken)` (first author family + year + a/b/c, ASCII
   transliteration for Latin, Korean names romanised only if a library exists, else `kim2024`-style from given data;
   document the rule); `formatReference(csl, "ko"|"en")` producing one plain reference line in an APA-like style.
   Do NOT add citeproc-js (CPAL/AGPL): the parent will decide full CSL style support separately.
7. No live network in vitest: tests use recorded fixtures with an injected fetch. Add one opt-in live smoke script
   (not run by vitest) that looks up two DOIs against Crossref/OpenAlex from PC74; run it once and report.

Checks: `cd server && npx vitest run test/geo-library-metadata.test.ts test/geo-library-formats.test.ts`,
`npx tsc --noEmit`. Network: KIGAM blocks raw.githubusercontent.com (use gh api / codeload); arXiv's export API timed
out from PC74 on 2026-10-21 (do not depend on it). No new npm dependency unless unavoidable; if you add one (e.g. a
BibTeX parser), pin it exactly, check MIT/Apache/BSD licence, and list package files in geo/integration-boundaries.json.

Evidence for your finish: test summary, typecheck, live smoke output, public functions with one line each, and what
you could not verify.

## Current state
Implemented the owned server adapters and pure formats; no routes, store, UI, shared contract or dependencies changed.
- Focused vitest: 19/19 passed (2 files), latest run 2026-10-21 20:40 KST. Global fetch is forbidden; all API requests are injected.
- Server typecheck: npx tsc --noEmit passed after final code changes. git diff --check passed.
- PC74 live smoke: two DOIs, Crossref and OpenAlex each, 4/4 successful; both titles matched the requested DOI and all records remained metadataConfirmed:false. OpenAlex used no key.
- Recorded fields live in server/test/fixtures/library; PDF fixtures are generated in OS temp storage. KCI XML is synthetic, not a keyed response.
- Oracle API-documentation job exited successfully (0). Reconciled its primary sources: corrected KCI to open.kci.go.kr, added Crossref updated-by assertions and retained source/record/date details, and split singleton/list rate buckets. The added interleaved-rate regression test passed.
- Ready for task finish and parent integration. Full-app checks/deployment remain with the parent; this child does not claim them.

## Next steps
1. Run task finish with the checked snapshot. Parent owns integration with task complete and the final full-app check.
2. After finish, wait for the final completion notice; do not archive this writer.

## Work packages and integration order
- Completed sequentially: CSL result shapes, identifier/PDF/URL adapters, provider mapping/backoff, bibliography functions, fixture coverage and smoke.
- Owned: metadata/**, formats/**, two server tests and fixtures; appended only test seams to boundaries.
- No child workers: this is already a child writer and interfaces are tightly coupled.

## Public API for parent integration
- metadata/index.ts: identifyPdf(file) reads first three pages and reports textFound, DOI/arXiv candidates and titleGuess.
- createMetadataClient({fetch, mailto, openAlexApiKey?, kciApiKey?, timeoutMs?, maxRateWaitMs?, now?, sleep?}) retains cooldown state.
- lookupDoi(doi, provider?) returns {csl, metadataOrigin, metadataConfirmed:false, signals}; MetadataLookupError has provider errors.
- searchByTitle(title, authorHint?) returns {candidates, errors, requiresSelection:true}; score is lexical similarity, never acceptance.
- resolveUrl(url) returns {doiCandidates, url, method}; publisher HTML is bounded and validated at each redirect.
- searchKci(title, authorHint?) returns the search result plus skipped; no key means no request.
- formats/index.ts: parseBibliography(text, format) returns {items, errors}; index is one-based per entry, zero for file errors.
- exportBibliography(items, format) writes bibtex, ris or csl-json; pass the persisted citation key as csl["citation-key"] for BibTeX.
- citationKeyFor(csl, taken) generates a unique author/year ASCII key without mutating taken.
- formatReference(csl, ko|en) produces one plain APA-like reference, not arbitrary CSL style processing.
- Details and limitations: server/src/geo/library/metadata/README.md and formats/README.md.

## Failed approaches
- Initial Oracle job launch refused the dirty source before starting. Saved the task document, then launched the one recorded job; no empty recorded job was restarted.
- One initial URL-size test failed because Response(string) defaults to text/plain; it hit the HTML-type guard before the size guard. Corrected the test fixture Content-Type to text/html; the bounded-stream test passed.
- Exact worktree has no codegraph index; used the instructed native source-read fallback.

## Notes and decisions
- Parent approved separate first-three-pages pdftotext adapter and mirrored bounded URL loop. Reuse pdftotextVersion / validateSourceUrl; do not change authoring behaviour. The IO loops are duplicated and could be extracted later.
- Every metadata result stays unconfirmed. Directional update evidence is retained; absence of signals is not proof that a paper is not retracted.
- No Korean romanisation dependency exists here: supplied Kim becomes kim2024, Korean-only family/name becomes ref2024. Never invent a surname; persist the assigned key.
- BibTeX/RIS cover common bibliographic fields and retain uninterpreted original-format fields. Arbitrary CSL extension properties are lossless in CSL-JSON only. Full APA/CSL style support remains a parent-level choice, not a done criterion.
- KCI public request/response field table and official endpoint example were read. No KCI key was used; keyed endpoint, actual XML envelope and entitlement remain live-unverified. Adapter failures are explicit, never silent acceptance.
- Opt-in smoke command (from server): GAID_METADATA_LIVE_SMOKE=1 npx tsx src/geo/library/metadata/live-smoke.ts /home/seongin3/data/geoaidesk/work/gaid-research-hub--metadata/live-smoke
- Live responses: /home/seongin3/data/geoaidesk/work/gaid-research-hub--metadata/live-smoke (external, metadata only). Smoke succeeded for 10.1038/nphys1170 and 10.1371/journal.pone.0000308 against both providers.
- Oracle evidence: job-geoaidesk-gaid-research-hub--metadata-1 exited 0. Saved note: 웹 조사/geoaidesk/2026-10-21-verify-official-crossref-rest-rate--bf1af91b90.md (PC74 vault). Primary endpoint example: https://www.kci.go.kr/kciportal/po/openapi/openApiConnSamp.kci; Crossref update direction: https://www.crossref.org/documentation/register-maintain-records/maintaining-your-metadata/registering-updates/; rate update: https://community.crossref.org/t/refining-rest-api-limits-for-improved-stability-and-reliability/16137.
- Focused checks, not scripts/check, are this child contract. Parent owns full application integration/checks.

## Open items
None for the user. KCI live entitlement and complete CSL style support are documented limits, not new requirements.

## Report
Report: reports/2026-10-21-gaid-research-hub/index.md
Child result belongs to the parent report; no separate report. Parent receives the implementation evidence above and writes the integrated result section.

## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-research-hub--metadata-20261021T112553.095739Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: waiting
updated: 2026-10-21T11:24:07Z
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

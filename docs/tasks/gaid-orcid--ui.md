---
format: 1
status: active
updated: 2026-10-22T09:47:41Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"9f458bbf-4f8e-4cff-a5a0-2274bd08a13e","pid":2326360,"provider":"codex","session":"01a162fc-d2d3-7e42-b4e9-2a978b405909","start":"55003761","token":"df6541df10ed933c083367568e359ab1265179d732259db251292c83dae0b600"}
branch: task/gaid-orcid--ui
target: task/gaid-orcid
parent: gaid-orcid
---
# gaid-orcid--ui

## Goal and done criteria
Request from the starter:

# Child unit: gaid-orcid-ui (UI of ORCID phase 1)

Parent: gaid-orcid (writer: Claude orchestrator). Repo geoaidesk (GAID). Read AGENTS.md, docs/tasks/gaid-orcid.md
(Goal, Notes and decisions) and the contract first. KIGAM network: raw.githubusercontent.com is blocked; use
`gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept: application/vnd.github.v3.raw"` or codeload.github.com.

## Goal
Build the researcher-facing screens for ORCID phase 1 on top of the server and contract already pushed on the parent
branch (`task/gaid-orcid`, commit d47244486e34 or later). User decision 2026-10-22: phase 1 = the researcher types an
ORCID iD (shown as unauthenticated) and imports their public works into the personal library (서재); kept and matched
items become the researcher's own works ("내 논문" basis). No OAuth, no hub changes in this unit.

## Fixed interfaces (do not change; ask the parent if one is wrong)
- Contract: `web/src/geo/contracts/orcid.ts` (OrcidStatus, OrcidWorksPreview, OrcidWork.match kinds new / in-library /
  similar, OrcidConfirmBody/Result, normalizeOrcidId, orcidUrl, ORCID_LIMITS) and in `web/src/geo/contracts/library.ts`:
  `LibraryItemSummary.ownWork`, `LibraryListQuery.filter: "mine"`, `counts.mine`, `MetadataOrigin` "orcid",
  `LibraryItem.ownWork`.
- Routes (server done, tested in `server/test/geo-orcid.test.ts`): GET/PUT/DELETE `/geo/orcid`, POST `/geo/orcid/works`
  (preview, nothing stored), POST `/geo/orcid/works/confirm` (can take tens of seconds: one Crossref/OpenAlex lookup per
  DOI). Errors `{ error, orcid?: "not-found"|"unavailable" }`; 400 invalid iD, 404 no public record, 409 not linked,
  502 ORCID unreachable.

## Scope (owned files)
- `web/src/geo/orcid/` (new): API wrapper (use the existing apiFetch pattern of `web/src/geo/library/api.ts`), an
  ORCID card for the library side panel, the import dialog, an iD display part, tests.
- Seams in `web/src/geo/library/library-screen.tsx` (side panel card next to ZoteroCard; filter chip "내 논문" using
  `counts.mine`, shown only when > 0 or an iD is linked) and, if useful, an own-work mark in the item detail and the
  metadata-origin label for `orcid` (library locale). Keep these seam edits small.
- Locales `web/src/geo/locales/orcid/{ko,en}.json` (+ library namespace keys you need). Korean first; follow
  geo/copy/gaid-writing.md, terminology.csv; buttons name the next action. Do not claim authentication.
- ORCID iD icons as static assets (e.g. `web/public/geo/orcid/`): the official authenticated and UNAUTHENTICATED iD
  icons from the ORCID brand library (linked from https://info.orcid.org/documentation/integration-guide/orcid-id-display-guidelines/
  and https://info.orcid.org/brand-guidelines/; the page states the icon is CC0). If you cannot get the official
  unauthenticated vector, stop and report to the parent instead of drawing one. Record the source URL and licence in
  THIRD_PARTY_NOTICES.md. Phase 1 only shows the unauthenticated icon.

## Behaviour
1. Card, unlinked: short line on what linking does (reads public ORCID record, nothing is written to ORCID), an iD
   input accepting pasted URL forms (validate client-side with normalizeOrcidId), primary action to link.
2. Card, linked: iD in ORCID's display format with the unauthenticated icon followed by "(인증 안 됨)" /
   "(unauthenticated)" (ORCID rule: no other differentiation), link to https://orcid.org/<iD>, record name, own-works
   count, last import date, actions: import works (primary), unlink (confirm first; says items keep their mark).
3. Import dialog: loads the preview; one row per work (title, year, container, DOI, ORCID sources) with a checkbox and
   a match state: 새 논문 (checked by default), 서재에 있음 (checked by default; confirming only marks it as own work;
   already-own ones shown as such, unchecked/disabled), 비슷한 항목 있음 (unchecked by default; shows the similar library
   title so the researcher decides; confirming adds a new item). Select-all-new, optional target folder (existing GAID
   folders), `omitted` notice, confirm button with count, progress state while confirming, result summary (added,
   marked, failed, lookupFailed = filled from ORCID record), then refresh the library list. Handle 409/502/404 states
   with clear copy and a retry. Respect ORCID_LIMITS.confirm.
4. "내 논문" filter chip lists own works (server filter `mine`).

## Rules and checks
- UI guide v2 `docs/design/ui-guide.md` (read sections 1, 2, 10 and the components you touch); role tokens only, no
  hard-coded colours (the ORCID icon file keeps its official colours), no emoji, no AI icons. Design as an impeccable +
  design-taste-frontend + brand-guide expert. Desktop first.
- Run: `cd web && npx tsc --noEmit && npm test`, `node geo/copy/validate-copy.mjs web/src/geo/locales`,
  `node geo/ui/check-ui.mjs`. Full `scripts/check` is run by the parent at integration; run it too if time allows.
- Real-app check: run your own app instance with data outside the repo, e.g. GAID_HOME / KADY_PROJECTS_ROOT under
  `~/data/geoaidesk/work/gaid-orcid-ui/`, on free ports (NOT 3000, 8000, 18000: the review app and acceptance test use
  them; do not touch the review app). Link the public test iD 0000-0002-1825-0097 (Josiah Carberry, ORCID's test
  record) and import its works. Take Korean screenshots of the card (linked/unlinked) and the import dialog in both
  styles (계측 default, 도폭 `data-style="mapsheet"`) and both themes at 1440×900 and 1280×800, check them against
  ui-guide section 12, and save small PNGs for the parent's report under
  `reports/2026-10-22-gaid-orcid/figures/` (keep each well under 1 MB; originals in ~/data/geoaidesk/work/gaid-orcid-ui/).
- Never put secrets anywhere. No hub-server or hub-client code changes.

## Report back (in your task document and final message to the parent, English)
Changed files, string ids with ko/en text, ui-guide rule ids followed/broken with reason, screenshot paths, check
results with commands, anything not verified. Then `task finish`.

## Current state
- Resumed the child worktree and read the parent decisions, fixed ORCID contract, copy kit and UI guide v2. No existing local ORCID icon asset was found. Official brand-library download is in progress.
- Sequential decisions: keep the fixed HTTP contract; cap one confirmation at 200; similar matches stay unselected; already-own works cannot be selected.
- Owned files: new geo/orcid components and tests, locale registration, minimal library seam, official public assets and notices. No workers are needed for this tightly coupled UI. Integration order: assets/API → card/import → library seam → checks and real-app screenshots.
## Next steps
1. Finish official assets and implement the ORCID card/import UI; run the declared frontend checks and isolated real-app check.
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

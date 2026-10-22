---
format: 1
status: ready
updated: 2026-10-22T09:53:55Z
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
- Implemented the ORCID phase-1 UI: public-record link, unauthenticated iD display, import picker with new / existing / similar states, optional GAID folder, 200-work confirmation cap, persistent choices/in-flight results on close, result summary, and library refresh. The mine filter remains available after unlinking when marked papers exist. No OAuth or hub code changed.
- Official authenticated and unauthenticated SVG assets are unmodified, vendored with source/licence notices. Only the unauthenticated icon is displayed.
- Frontend typecheck passed. The full frontend suite passed (187 files / 1205 tests, before the additional card tests); final ORCID checks passed (2 files / 5 tests). Copy and UI validators have no errors. The existing copy warnings remain; the ORCID batch warning is justified by the enforced 200-item request bound.
- Live isolated app: public test iD 0000-0002-1825-0097 linked as Josiah Carberry; six works previewed and imported into the ORCID test folder; result added=6, marked=0, failed=0. All six have own-work marks. Re-reading disables all six already-own checkboxes. The mine query returns six; unlinking preserves all six marks. Re-linking by Enter and opening/closing the picker by Enter/Escape restore focus to Import works. Browser console has no errors.
- Screenshot matrix: 24 Korean PNGs (unlinked, linked, import × Instrument/Map sheet × light/dark × 1440×900/1280×800), each below 180 KB. UI guide section 12 checked: primary sheet action remains visible, scrolling is internal, no clipped ORCID text, original asset colours, legible light/dark surfaces and focus return. Existing library table/sidebar design was kept.
- QA service stopped; ports 4317 and 18117 are free. Job disposition is cancelled because this was a deliberately stopped interactive QA server, not a completed finite batch. Its evidence and screenshots are retained externally.
- Parent integration and full scripts/check remain pending. No release/deployment was performed.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T09:53:55Z: ready; the parent gaid-orcid integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- The first official asset Download click opened a format-choice dialog rather than starting a browser download; selected Original in that dialog and downloaded successfully.
- Initial screenshots captured colour transitions immediately after theme changes; replaced them with settled-state screenshots after 350 ms.
- A browser script expected the previous result view after a dev hot reload had remounted the dialog. Inspected the actual preview, verified six disabled own-work rows, then continued. No repeated import was issued.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
### UI handoff for the parent

Changed files: web/src/geo/orcid/{api,id-display,selection,import-dialog,orcid-card} plus two test files; library/library-screen.tsx; locales/orcid/{ko,en}.json and namespace registration; three library locale keys; public/geo/orcid/*.svg; THIRD_PARTY_NOTICES.md; geo/integration-boundaries.json; this task document; report figures.

Checks:
- cd web && npx tsc --noEmit: passed on final implementation.
- cd web && npm test -- --reporter=dot: 187 files / 1205 tests passed before adding the two card tests.
- cd web && npm test -- --run src/geo/orcid --reporter=dot: 2 files / 5 tests passed after final focus/callback changes.
- node geo/copy/validate-copy.mjs web/src/geo/locales: 0 errors; 65 warnings (one new warning for the accurate per-request batch limit).
- node geo/ui/check-ui.mjs: 0 errors, 78 existing accepted debt entries; no baseline additions.
- git diff --check: passed.

UI rules followed: P2/P3/P5/P9; I2/I5/I6/I7–I9/I12–I14; L4/L7/L9; B3/B5/B6; D2/D7; F1/F2/F5/F7; A1/A2/A3/A5/A6; W1–W6; R1/R2; V1/V2/V3/V6. The import sheet is modal consent before persisting the chosen own-work marks (D1). Card link/import actions use outline emphasis to preserve the existing library's one filled Add paper action (B1); the import sheet has one filled Import action. G1 exception: bibliographic selection rows are taller than the generic 40/56 px list rows so the researcher can distinguish the full paper title, year/container and match state; DOI/source details stay collapsed. This is a source-selection list, not a Workflow catalogue. No machine-check debt was added.

Screenshot paths: reports/2026-10-22-gaid-orcid/figures/orcid-{unlinked,linked,import}-{instrument,mapsheet}-{light,dark}-{1440,1280}.png. External originals and SHA-256 manifest: /home/seongin3/data/geoaidesk/work/gaid-orcid-ui/screenshots/ and screenshots.sha256. Representative report images: orcid-import-instrument-light-1440.png, orcid-import-mapsheet-dark-1280.png, orcid-linked-instrument-dark-1280.png, orcid-unlinked-mapsheet-dark-1280.png.

Evidence: /home/seongin3/data/geoaidesk/work/gaid-orcid-ui/{status-after-import,mine-after-import,status-after-unlink,mine-after-unlink}.json; browser snapshots/network log under playwright/. Test data stays under app/. QA job receipt: /home/seongin3/data/geoaidesk/runs/gaid-orcid--ui-20261022T094805.168541Z/receipt.json.

Not live-forced: 404/409/502 service failures, DOI fallback and library-full failures. Error copy is mapped by HTTP status; the unavailable retry, fallback summary, match-state selection and 200-item cap are covered by component/selection tests. No authenticated login or institute-hub account linking was claimed or tested.

### String catalogue changes

All rows below are additions (before: absent). Existing copy was not replaced.

| String id | Korean | English |
|---|---|---|
| orcid.card.title | ORCID | ORCID |
| orcid.card.hint | 공개 논문을 서재로 가져옵니다. ORCID에는 쓰지 않습니다. | Import public works into your library. Nothing is written to ORCID. |
| orcid.card.label | ORCID iD 또는 주소 | ORCID iD or URL |
| orcid.card.placeholder | 0000-0002-1825-0097 | 0000-0002-1825-0097 |
| orcid.card.loading | ORCID 연결을 읽는 중입니다. | Reading your ORCID link. |
| orcid.card.link.button | iD 연결 | Link iD |
| orcid.card.linking.button | iD 연결 중 | Linking iD |
| orcid.card.import.button | 논문 가져오기 | Import works |
| orcid.card.unlink.button | 연결 해제 | Unlink iD |
| orcid.card.ownWorks | 내 논문 {n}편 | Own works: {n} |
| orcid.card.lastImport | 최근 가져온 날짜: {when} | Last import: {when} |
| orcid.id.unauthenticated | (인증 안 됨) | (unauthenticated) |
| orcid.unlink.title | ORCID 연결 해제 | Unlink ORCID |
| orcid.unlink.hint | 연결을 해제해도 가져온 논문과 내 논문 표시는 유지합니다. | Imported works and their own-work marks stay after unlinking. |
| orcid.import.title | ORCID 논문 가져오기 | Import ORCID works |
| orcid.import.hint | 서재에 넣거나 내 논문으로 표시할 항목을 고르세요. | Choose works to add to your library or mark as your own. |
| orcid.import.loading | ORCID 공개 논문을 읽는 중입니다. | Reading public ORCID works. |
| orcid.import.saving | 선택한 논문의 서지 정보를 채우고 서재에 넣는 중입니다. 창을 닫아도 계속합니다. | Filling reference details and importing selected works. Closing this window does not stop the import. |
| orcid.import.saving.button | 논문 가져오는 중 | Importing works |
| orcid.import.selected | {total}편 중 {n}편 선택 | {n} of {total} works selected |
| orcid.import.selectNew.button | 새 논문 모두 선택 | Select all new works |
| orcid.import.clear.button | 선택 해제 | Clear selection |
| orcid.import.batch | 한 번에 최대 {n}편을 선택합니다. 나머지는 다음에 가져오세요. | Select up to {n} works per import. Import the rest afterward. |
| orcid.import.omitted | 공개 목록에서 {n}편을 더 읽지 못했습니다. 전체 목록은 ORCID에서 보세요. | {n} additional works are not shown. View the full list on ORCID. |
| orcid.import.empty | 공개된 논문이 없습니다. | No public works are listed. |
| orcid.import.similar | 비슷한 항목: {title}. 선택하면 별도 논문으로 넣습니다. | Similar item: {title}. Selecting this work adds a separate item. |
| orcid.import.sourceDetails | DOI와 출처 보기 | View DOI and sources |
| orcid.import.doi | DOI: {doi} | DOI: {doi} |
| orcid.import.sources | ORCID에 등록한 출처: {names} | Sources that added this work to ORCID: {names} |
| orcid.import.noSource | 출처 미기록 | Source not recorded |
| orcid.import.folder | 새 논문을 넣을 폴더 | Folder for new works |
| orcid.import.noFolder | 폴더 지정 안 함 | No folder |
| orcid.import.confirm.button | {n}편 가져오기 | Import {n} works |
| orcid.import.background.button | 창 닫기 | Close window |
| orcid.import.reread.button | 목록 다시 읽기 | Reload works |
| orcid.match.new | 새 논문 | New work |
| orcid.match.in-library | 서재에 있음 | In library |
| orcid.match.similar | 비슷한 항목 있음 | Similar item exists |
| orcid.match.own | 이미 내 논문으로 표시됨 | Already marked as own work |
| orcid.result.title | 가져온 결과 | Import result |
| orcid.result.summary | 새 논문 {added}편, 내 논문 표시 {marked}편, 실패 {failed}편 | Added {added}, marked as own work {marked}, failed {failed} |
| orcid.result.fallback | {n}편은 DOI 서지 조회에 실패해 ORCID 기록으로 채웠습니다. | For {n} works, DOI metadata lookup failed; ORCID record details were used instead. |
| orcid.result.failed | 실패한 논문은 목록을 다시 읽고 선택해 재시도하세요. | Reload the list and select failed works to retry. |
| orcid.error.status | ORCID 연결을 읽지 못했습니다. 다시 읽으세요. | Could not read your ORCID link. Retry loading. |
| orcid.error.invalid | iD가 올바르지 않습니다. 숫자와 마지막 확인 문자를 확인하세요. | Invalid iD. Check the digits and final check character. |
| orcid.error.notFound | 공개 ORCID 기록이 없습니다. iD를 확인하고 다시 시도하세요. | No public ORCID record was found. Check the iD and retry. |
| orcid.error.notLinked | ORCID 연결이 없습니다. 창을 닫고 iD를 다시 연결하세요. | No ORCID iD is linked. Close this window and link your iD again. |
| orcid.error.unavailable | ORCID에서 읽지 못했습니다. 잠시 후 다시 시도하세요. | Could not read ORCID. Try again shortly. |
| orcid.error.failed | 요청을 마치지 못했습니다. 다시 시도하세요. | The request did not finish. Try again. |
| orcid.retry.button | 다시 읽기 | Retry loading |
| orcid.cancel.button | 취소 | Cancel |
| orcid.close.button | 창 닫기 | Close window |
| library.filter.mine | 내 논문 {n} | My works {n} |
| library.detail.ownWork | ORCID에서 선택한 내 논문 | Own work selected from ORCID |
| library.detail.orcidOrigin | 서지 정보 출처: ORCID | Reference details from ORCID |

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
- /home/seongin3/data/geoaidesk/runs/gaid-orcid--ui-20261022T094805.168541Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-orcid-ui/mine-after-unlink.json"],"reason":"Isolated QA server deliberately stopped after successful six-work import, unlink preservation and 24 screenshots.","recorded":"2026-10-22T09:52:47Z","state":"cancelled"}
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

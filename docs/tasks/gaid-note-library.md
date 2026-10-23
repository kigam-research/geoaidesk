---
format: 1
status: done
updated: 2026-10-23T07:25:57Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"64631b91-f6bd-4f6d-ad02-2996e80f1f79","pid":1743744,"provider":"claude","session":"5414cf7f-13a5-428a-ae32-343cc6475005","start":"62319888","token":"b8608a00206a30d58748fdcf6af8f6920102d148e2631acb42ae68af6fd45eee"}
branch: task/gaid-note-library
target: main
parent: 
---
# gaid-note-library

## Goal and done criteria
Request from the starter:

# Goal: gaid-note-library (unit A) — research notes into 서재 as their own category

Your unit is A. Done: a research note (연구노트/<date>-<topic>/index.md) can be brought into 서재 as a library item of a separate category (research notes, distinct from papers), listed/filtered/foldered there, opened back in its project, kept in sync with the note file (the file stays the master), included in institute hub library sync, never written to Zotero. Papers it cites stay linked. Checks: scripts/check; UI guide and copy rules from AGENTS.md. Outside check: none.

## User request (verbatim, 2026-10-23)

> 사용자는 논문 서재에서 시작해서 워크플로우를 만들고 분석을 수행하여 연구 노트를 생성한 후 해당 연구 노트를 다시 서재로 가져오는 흐름을 다른 논문으로 실전 검증하고 싶다. 실전 검증을 통해 부족한 부분이 발견되면 개선까지 진행하고 싶다. 현재 사용자의 zotero pc에 'Application of petrophysically and geologically guided inversion to aeromagnetic and drilling data for investigation of magnetite ore in Pocheon, Korea'이라는 논문을 수집해 두었다. 해당 논문의 데이터는 제공되지 않기 때문에 워크플로우를 만들 때 데이터를 사용하지 못한다. 이런 경우 가장 유사한 공개 데이터를 기반으로 워크플로우를 만들고 이용자들은 본인의 데이터를 올리거나 현재 테스트에서 사용되는 공개 데이터를 기반으로 워크플로우를 테스트 할 수 있게 하여야 한다. 즉, 워크플로우를 이용할 때 사용자가 이상적으로 데이터를 업로드하거나 지정하면 좋겠지만 이것이 어려울 경우 default example이 선택되어야 GAID 시스템에서 분석을 수행해 볼 수 있을 것이다. 그리고 현재 연구 노트를 서재로 다시 가져오는 기능은 구현되지 않은 것으로 알고 있기 때문에 이를 구현하여야 한다. 논문과는 별도의 연구 노트이므로 카테고리를 구분하여 관리할 수 있게 해야한다. 이것은 GAID 시스템에서 대화로그를 바탕으로 워크플로우를 만드는 기능과도 연계되어 있다고 생각하며, 기존 워크플로우 생성 도구에서도 문헌, 논문 뿐만 아니라 다수의 자료를 추가할 수 있게 해야한다. 여러개의 별도 작업트리로 진행해야 하는 작업들이다. 특히 다른 논문으로 워크플로우를 생성해보는 실전 검증의 경우에는 GAID 시스템의 워크플로우를 생성할 때 에이전트 모델은 GPT 6.1 sol high로 지정하고 writer가 직접 이용자 역할로 생성해보아야 한다. 그리고 생성 과정에서 논문의 분석과정과 다른 방식으로 유도되거나 너무 지엽적인 결과만 계산되게 하는 것은 아닌지도 검토하면서 개선점들을 정리하고 개선하여야 한다. 또한, 테스트이므로 너무 과도한 연산이 되지 않게 하여야 한다. 지난번 PU Bagging의 경우 목표와 달리 테스트가 너무 오래걸려서 작업의 진행을 지연시키는 것은 방지해야 한다. 해상도를 Fine하지 않게 하거나 수치 계산 허용 기준을 너무 타이트하게 하지 않는 등의 방법이 있을 것이다. 이외에도 모호한 부분이 있을 것이므로 사용자에게 필요한 사항을 질문하고 작업을 시작할 수 있도록 하자.

The hub proposed four units (A note→library, B Workflow default example data, C more authoring source kinds, D Pocheon
real-use trial) and seven decisions; the user answered (verbatim):

> 모두 권장대로이다. 하지만 워크플로우를 만들때 너무 쉬운 예제 및 논문에서는 많은 자료들을 활용하고 지구물리학적 지식이 포함되어 있는데 단순히 작업만 돌아가게 하는 형태로 구현하면 홍보 및 평가자들의 설득에 실패할 수 있다. 논문에 준하는 수준으로 분석은 이루어져야한다. 해상도는 거칠게 해도 되지만 분석 품질을 낮춰라는 얘기는 아니다. 그리고 writer들은 opus 5.5 high fast로 작업하자.

Recommended answers the user accepted:
1. Order: A, B, C and D start now; D's first pass finds gaps (fixed in D or forwarded to A/B/C through the hub); after A–C
   merge and the hub updates the review app, D verifies the whole cycle once more.
2. Public analogue data: D's writer surveys and picks a small, clearly licensed public dataset closest to the paper
   (aeromagnetic grid + drillholes with susceptibility/petrophysics); if no suitable real data exists, synthetic data built
   with an open tool such as SimPEG, labelled as synthetic.
3. Trial place: the review app (PC74), Workflow registered on the institute hub server as the admin account; connect the
   review app's library to the PC74 Zotero (local API 127.0.0.1:23119; the paper is item 2SUGC6Q2 with its PDF).
4. Compute: one analysis run finishes within 10 minutes; coarse mesh (order of tens of thousands of cells), loose tolerances;
   lower resolution further rather than exceed it. Quality of the method must stay at the paper's level (user, above).
5. Research notes in 서재: GAID library only, included in the institute hub server library sync; no Zotero writes.
6. Authoring sources to add: data files (CSV, shp, GeoTIFF, LAS …), library papers and research notes, several at once.
7. Example data: small examples (~10 MB or less) bundled in the Workflow package; larger ones as public URL + sha256,
   downloaded on first use (package limit 20 MiB compressed).

## Verified facts (hub, 2026-10-23)

- Library items today are papers/files (`LibraryItem` kind `pdf|other`); notes appear only as "used in" links
  (`LibraryUse` kind `note`). No research-note item exists. Contract `web/src/geo/contracts/library.ts`, server
  `server/src/geo/library/`, screens `web/src/geo/library/`.
- Authoring source kinds: `pdf | code | text | gaid-analysis | web` (`web/src/geo/contracts/authoring.ts` `SourceKind`,
  `server/src/geo/authoring/sources.ts`); the chat → Workflow path is `POST /geo/authoring/handoffs` (kind `gaid-analysis`).
- Workflow inputs: `InputPort.exampleRef` exists in the authoring contract; no bundled default example that is selected
  automatically was found.
- Review app: PC74 :3000/:18000, LAN-exposed with a fixed token (`~/data/geoaidesk/work/review-app/access-token`), main
  a8d35c6b, logged in to the institute hub server (admin seongin). Its library is not connected to Zotero yet.
  GPT-6.1 Sol is in its model picker (openai provider configured).
- KIGAM network blocks raw.githubusercontent.com (use `gh api` or codeload.github.com).

## Units and ownership (settle interfaces before overlapping edits)

- A `gaid-note-library`: research note → 서재 as a separate category (library contract/server/screens, notes link).
- B `gaid-workflow-example`: Workflow default example data (method package/Workflow input declaration, install,
  Workflow start settings choosing the example when the user gives no data, readiness).
- C `gaid-authoring-sources`: authoring tool accepts several sources at once, data files, library papers and research
  notes; aligned with the chat-log → Workflow handoff.
- D `gaid-pocheon-trial`: real-use trial and improvements.
- B ↔ C interface: C stores data-file sources in the authoring store with sha256; B lets an input port's example point to a
  bundled file (from such a source or an upload) or a public URL + sha256. Whoever merges second rebases onto the first.
- Do not restart or change the review app except D as a user of it; the hub updates the review app after A–C merge.

## Current state
- Implemented: contract, `server/src/geo/library/notes.ts`, routes, uses links, exclusions (export, folder check,
  citation scope/tools, ORCID, Zotero send), hub sync refresh + push batching, 서재 논문/정리 노트 switch, note
  table/detail (cited paper titles), 정리 노트 가져오기 dialog, note view 더 보기 → 서재에 넣기, 프로젝트에서 열기
  hand-off, glossary entry, AGENTS.md and docs/geo/research-notes.md.
- Verified: typechecks; new server (6) and web (3) tests; related suites (server 143, web 109); copy validator and
  check-ui 0 errors; trial app (pc74 :13610/:18610, data ~/data/geoaidesk/work/gaid-note-library/home, unit
  gaid-note-library-app stopped) walked add → list → detail → open in project → add from note view; 8 UI-guide shots.
- scripts/check: run 1 stopped at one backend timeout (geo-hub-server launcher CLI test; passes alone 38/38). Run 2
  (check-2.log): backend 2261 pass / 8 skipped; frontend stopped at one settings-dialog Modal test (passes alone 5/5).
  Remaining steps run in check order (check-3-rest.log): frontend 1239/1239, start.sh --check, geo tests 58 pass / 1
  skipped, copy and UI 0 errors, environments smoke, start-gaid --check, production smoke PASS.
- Route a-workflow-button (from D via hub): fixed in e72dda34 and reported with task route-report.
- Report review copy: Obsidian vault 연구 보고서/geoaidesk/2026-10-23-gaid-note-library (sync service inactive).
## Next steps
<!-- task:closed -->
Closed 2026-10-23T07:25:57Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First `task finish`: its scripts/check run hit the same geo-hub-server launcher CLI timeout (7.7 s > 5 s) a second
  time. Shared premise of both failures: the test's 5 s default does not fit five sequential launcher processes under the
  full parallel suite. Fix: explicit 30 s timeout on that test (owner gaid-backend noted in the boundaries file).
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)

Design (settled 2026-10-23, writer):
- Contract (`web/src/geo/contracts/library.ts`): `LibraryItem.kind?: "paper" | "note"` (absent = paper, older items stay
  valid) and `LibraryItem.note?: LibraryNoteRef` = { origin (this GAID instance id; projects are per machine and
  `default` exists everywhere), originLabel (host name), projectId, projectName, noteId (folder id that
  `getResearchNote(paths, id)` takes), path, date, status, headline?, markdown snapshot (≤ 64 KiB, `truncated`),
  contentSha256, fileUpdatedAt, refreshedAt, citations [{ key, itemId?, locators[] }], missingAt? }. Note items are
  `source: "gaid"`, `metadataOrigin: "note"`, `csl { type: "document", title, issued }`, no citationKey, no attachments,
  `read.coverage: "full"`. `LibraryItemSummary.kind` + `note` { projectId, noteId, projectName, date, status, headline?,
  local, missing?, cites }. List query `kind=paper|note` (default: all? → screen sends paper/note), counts `papers`, `notes`.
  Note-use rows carry `libraryItemId` when the citing note is in the library.
- Server: `server/src/geo/library/notes.ts` (instance id in `<libraryDir>/instance.json`; add = idempotent per origin +
  project + note; refresh on library list/item read and before hub sync: re-read when the file mtime/size changed, mark
  `missingAt` when gone; only the origin instance refreshes). Routes `POST /geo/library/notes` {projectId?, noteId},
  `GET /geo/library/notes/candidates` (notes of local projects with their library item id). Removal deletes only the
  library item. Notes excluded from: bibliography export, folder check, agent `library_*` tools, ORCID matching,
  "Zotero로 보내기" (skipped reason `research-note`; single item 409). Folder membership of a note is GAID's (no Zotero write).
- Hub sync: note items sync as ordinary items (no files); push is split into ≤ 3 MiB / ≤ 500-change requests.
- Web: 서재 category switch 논문 / 연구 노트 with its own table, note detail (project, status, headline, cited papers,
  snapshot, 프로젝트에서 열기, remove); `연구 노트 가져오기` dialog; note detail in the project gets `서재에 넣기`.
  `web/src/geo/notes/open-note.ts` pending request (like hub handoff) opens the project, its notebook tab and the note;
  paper-detail note uses open the note too. Seams: page.tsx, file-preview-panel.tsx (boundaries file).
- Sibling C relies on `note.projectId`/`note.noteId` on item and summary and `kind=note` in the list query (told C).
- Work packages: all tightly coupled (contract → server → web); done by this writer, no child writers.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-note-library/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

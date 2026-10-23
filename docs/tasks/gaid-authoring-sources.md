---
format: 1
status: active
updated: 2026-10-23T06:20:10Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"d9c962d0-e8cb-40ea-99b0-533c123efd1e","pid":1749971,"provider":"claude","session":"f1d989bf-fb2e-4eca-99d5-c8f12b163333","start":"62322102","token":"2bd23210d4cf17c490186594ae6dcd5bda7a1d6ef94946851c8cc2c5a5a4bc7c"}
branch: task/gaid-authoring-sources
target: main
parent: 
---
# gaid-authoring-sources

## Goal and done criteria
Request from the starter:

# Goal: gaid-authoring-sources (unit C) — more and multiple sources in Workflow authoring

Your unit is C. Done: the hub authoring tool accepts several sources at once and new kinds: data files (CSV, shp set, GeoTIFF, LAS, …) with bounded intake and sha256, papers and research notes chosen from 서재 (unit A adds note items; use the library contract), alongside PDF/code/text/web/gaid-analysis; the chat-log → Workflow handoff uses the same multi-source path; the authoring agent sees and uses them (data files summarised through the existing inspection dispatcher, not read raw). Checks: scripts/check; UI guide and copy rules. Outside check: none.

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
Plan settled (below); implementation by the top writer (no child writers: contract, server and screen are tightly
coupled).
- P1 server done: contract (`SourceKind` data/note, `DataFileSummary`, `AddSourceBody.files`, `AUTHORING_SOURCE_LIMITS`,
  library/note bodies), `server/src/geo/authoring/{data-files,library-sources}.ts`, `storeSource`/`removeSource` in
  `sources.ts`, routes (DELETE source, POST sources/notes, POST /geo/library/authoring, handoff notes/libraryItemIds),
  prompts mention data files and research notes (versions 2026-10-23.1). Verified: `cd server && npm run typecheck`,
  `npx vitest run test/geo-authoring-sources.test.ts test/geo-hub-handoff.test.ts` (22 passed) and the earlier
  authoring/library/handoff suites (168 passed).
## Next steps
1. P2 screens (source step, library picker, handoff dialog, locales), then scripts/check and screenshots.
## Failed approaches
## Notes and decisions
- Plan (2026-10-23). P1 server (`server/src/geo/authoring/`, contract `web/src/geo/contracts/authoring.ts`):
  - `SourceKind` adds `data` and `note`. A data source is one file or a set (`AddSourceBody.files[]`, e.g. a shapefile
    set picked together, or a .zip of data). Files live at `sources/<sid>/files/<path>`, listed in
    `extractions[sid].files[]` with sha256; each geo file gets `CodeFileEntry.data` (compact `DataFileSummary` from
    `inspectGeoFile` run over a pseudo sandbox = that files folder; companions marked `companionOf`). The same
    inspection runs on data files inside code archives and gaid-analysis bundles (handoff path). The agent context shows
    the summary, never raw bytes; anchors on a data file check against its summary text.
  - Bounded intake: 30 MiB per source (unchanged), at most 30 sources and 300 MiB per authoring project, 40 inspected
    files per source.
  - `DELETE /geo/authoring/projects/:id/sources/:sid` (refused while a draft's code files use it).
  - Library sources: `server/src/geo/authoring/library-sources.ts`; `POST /geo/library/authoring {itemIds[], authoringId?}`
    adds papers (stored PDF; Zotero PDF read first; else a metadata-only text source) and research notes (A's contract:
    `LibraryItem.kind === "note"`, `item.note {projectId, noteId, markdown snapshot}`; local project → index.md + figures,
    else the snapshot). Library "used in" links recorded as before. `POST /geo/authoring/projects/:id/sources/notes`
    adds project research notes directly.
  - Handoff: `/geo/authoring/handoffs` also takes `notes[]` and `libraryItemIds[]` and adds them through the same
    functions; the handoff dialog preselects the session's notes and the project's cited papers.
  - P2 screens: source step accepts data files (shp companions grouped into one set), shows data lines, remove button,
    "서재에서 추가" picker (논문 / 연구 노트 tabs, several at once); handoff dialog lists notes and papers.
- Interfaces sent to siblings (2026-10-23): B gets `{sourceId, sourcePath, sha256}` addressing for data-file examples;
  A confirmed note item shape (`kind`, `note.{projectId,noteId,markdown,...}`, summary `note.local`; `GET /geo/library?kind=note`).
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

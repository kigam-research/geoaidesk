---
format: 1
status: ready
updated: 2026-10-18T04:55:30Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"03077f19-d7c4-4f7d-9814-7922a8e164f0","pid":2568287,"provider":"codex","session":"01a14d52-83a7-7210-aa24-5a0e1d29ac97","start":"18655459","token":"2df86b15744ca28cbee2c16419a110bf67b00f4a71a8d124f2ca31e90ac1332d"}
branch: task/gaid-hub-followups--hub-browse
target: task/gaid-hub-followups
parent: gaid-hub-followups
---
# gaid-hub-followups--hub-browse

## Goal and done criteria
Request from the starter:

# Child unit: gaid-hub-followups--hub-browse (GeoAIDesk)

Parent: gaid-hub-followups (Claude writer). User request, verbatim (2026-10-18): "gaid-hub-integration와 gaid-hub의 작업 및 개선 작업에 대해 권장 옵션으로 작업 진행하자." then "시작하자."
Your package = open item gaid-hub#3: "허브 첫 화면에 다른 연구자가 등록한 방법 목록(폴더·검색) 추가"
(reports/2026-10-16-gaid-hub/index.md section 5: the first-time researcher could not browse methods other researchers
registered, by folder and search, from the hub home).

Network note: the KIGAM network blocks raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"`.

## Context
- Hub home: web/src/geo/hub/hub-home.tsx (recommended cards on top; "나의 스킬 · Workflow" = the researcher's own authoring
  projects in folders below). Shared hub client web/src/geo/hub/shared-api.ts (folders, entries(folder), entry, register,
  star, comment, install, recommended); server server/src/geo/hub-shared/routes.ts (GET /geo/hub/entries already accepts
  `folder` and `q`), store.ts; contract web/src/geo/contracts/hub-shared.ts. Registered method page:
  web/src/geo/hub/shared-entry.tsx. Design: docs/design/hub-authoring-service.md and AGENTS.md "GAID hub".
- Screen rules: docs/design/ui-guide.md — read sections 1 and 9, then G (lists/cards: G1–G4, search G3), N, F3 (empty
  state), W5 budget. Copy: AGENTS.md "UI copy and locales"; strings under web/src/geo/locales/hub/{ko,en}.json; add your keys
  under a new `home.browse.*` prefix (the parent edits other hub keys).

## Goal (done)
On the hub home, a "허브에 등록된 방법" section (or tab next to "나의 스킬 · Workflow" — choose by P1/P3/W5; one primary
action per view) lists entries every researcher registered: topic folders (with counts) + one search box (title, tagline,
author, taxonomy labels), result cards per G4 (title, one-line tagline, author, star count, folder), empty/no-result states
per F3, click opens the existing registered-method page. Search runs server-side via `q` (extend the server match if it
does not cover tagline/author/taxonomy) with a small debounce. Sorted by stars then recency; folder "전체" default.
Tests: server route test for q/folder filtering; a web test for the list (search + folder switch + empty state).

## Rules
- Work only in your printed worktree. Own: web/src/geo/hub/hub-home.tsx, web/src/geo/hub/shared-api.ts,
  server/src/geo/hub-shared/**, web/src/geo/contracts/hub-shared.ts, new files under web/src/geo/hub/ for the list, the
  `home.browse.*` locale keys. Do not touch other web/src/geo/hub files, server/src/geo/authoring/**, or chat/workspace files
  (parent and sibling own them). If you need a change there, note it in your task document and tell the parent.
- Checks: targeted vitest + `cd server && npm run typecheck`, `cd web && npx tsc --noEmit`, `node geo/ui/check-ui.mjs`,
  `node geo/copy/validate-copy.mjs web/src/geo/locales`; full scripts/check once before task finish.
- Visual: Korean screenshots 1440x900 and 1280x800 with at least 3 registered entries in 2 folders (seed them through the
  app's own API on your dev instance; data under ~/data/geoaidesk/work/gaid-hub-followups--hub-browse/, ports 3350/18350,
  launched with `systemd-run --user` and file logs; never inside the repo; playwright-cli skill). Small PNGs under
  ~/data/geoaidesk/work/gaid-hub-followups/figures/hub-browse/ and a Korean section text for the parent's report (rule ids,
  string ids with ko/en) in your task document's Current state. No report of your own.
- Finish with `task finish`.

## Current state
Implemented shared registry browsing on hub home (commit 5ca74651a991). The default tab lists all researchers' methods; personal drafts remain in a separate tab. Folder counts, server-side title/tagline/author/taxonomy-label search (250 ms debounce), stars/recency order, recovery states and existing registered-entry navigation are delivered. Optional tagline is derived from registered snapshots; existing callers/stored records stay compatible.

Verified: server typecheck and shared-hub Vitest 7/7; web tsc and hub Vitest 11/11; UI checker 0 errors (102 existing debt); copy validator 0 errors (57 existing warnings). Korean real-app browser QA at 1440×900 and 1280×800 used 3 API-registered examples in 2 topic folders. Folder/search/reset, arrow-key tabs and Enter-to-detail passed; no console errors. One primary button, no horizontal overflow. Temporary browser/API/web services are closed. Full scripts/check job 1 exited 1: backend 1858 passed/11 skipped (including the documented network PSI-MS skips), frontend 1064 passed, launcher passed; distribution failed only because the new seam owner was a child slug outside the allowed package list. Corrected the seam owner to existing package gaid-hub; targeted distribution recheck passed 7/7. Remaining full-check stages have not run. Receipt stays in Running jobs as failure evidence.

Re-verify safely: server npm test -- test/geo-hub-shared.test.ts and npm run typecheck; web npm test -- src/geo/hub/shared-browse.test.tsx src/geo/hub/hub.test.tsx and npx tsc --noEmit; node geo/ui/check-ui.mjs; node geo/copy/validate-copy.mjs web/src/geo/locales. Seed harness/logs live outside Git under ~/data/geoaidesk/work/gaid-hub-followups--hub-browse/. Seed used real create/source/analyze/draft/register/star HTTP APIs, with scripted model transport only for synthetic authoring; screenshots use the normal full backend.

### Parent report section (Korean, humanizer file-mode reviewed)

허브 첫 화면에 **허브에 등록된 방법** 탭을 추가했습니다. 처음 열면 다른 연구자가 등록한 방법 전체가 보입니다. 기존 초안과 개인 작업은 옆의 **나의 스킬 · Workflow** 탭에 유지했습니다. 탭을 바꾸어도 검색어와 선택한 폴더가 남습니다.

주제 폴더에는 등록 방법 개수를 표시합니다. 검색은 제목, 한 줄 설명, 연구자 이름과 한·영 분류명을 대상으로 서버에서 실행합니다. 결과는 star가 많은 순서로 정렬하고, star 수가 같으면 최근 등록한 방법부터 보여 줍니다. 카드에는 제목, 한 줄 설명, 연구자, star 수와 폴더를 표시하며, 선택하면 기존 등록 방법 화면이 열립니다.

검색 결과가 없으면 검색어나 폴더를 바꾸라는 안내와 전체 목록으로 돌아가는 버튼을 표시합니다. 등록된 방법이 없는 상태와 목록을 읽지 못한 상태를 구분하고, 오류 상태에는 다시 읽기 버튼을 제공합니다.

화면은 P1·P3·W5에 따라 등록 방법과 개인 작업을 탭으로 나누고, 기존 만들기 버튼 하나만 주요 버튼으로 유지했습니다. N1·N2에 따라 텍스트 탭과 선택 상태를 제공하며, G1·G4에 따라 카드 제목과 설명을 한 줄로 제한했습니다. F3·F4·R2에 따라 빈 목록, 검색 결과 없음, 오류와 기술 정보를 구분했습니다. A1·A2·A5에 맞춰 접근 가능한 이름, 키보드 이동, 결과 상태를 제공합니다. G3의 서버 검색을 추가했습니다. 최근 검색어·추천 검색어 기능은 이번 요청 범위에 포함하지 않았습니다. 새 UI 부채는 추가하지 않았습니다.

한국어 1440×900·1280×800 화면에서 등록 방법 3개와 두 주제 폴더를 확인했습니다. 가로 넘침은 없으며, 만들기 버튼과 목록이 첫 화면에 보입니다. 방법 제목·설명·연구자·폴더 등 등록 자료를 제외한 고정 본문은 W5의 300자 이내입니다. 방향키로 탭을 바꾸고 Enter 키로 등록 방법을 열었습니다. 브라우저 콘솔 오류는 없었습니다. 전체 검사에서 서버 시험 1,858개와 웹 시험 1,064개가 통과했습니다. 배포 검사에서 테스트 파일의 소유 패키지 표기가 허용 목록과 맞지 않아 멈췄습니다. 표기를 바로잡은 뒤 배포 검사 7개가 통과했습니다. 나머지 전체 검사는 최종 제출 때 실행합니다.

### Screenshot handoff (parent copies chosen PNGs into its report figures/)

- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/hub-browse/hub-browse-1440x900.png; sha256 bfc900d8ecbc8fad26d99d301640f8eea3635eaea7e7bdce1feee702898dffe8
- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/hub-browse/hub-browse-1280x800.png; sha256 f9553a71775eb8daeac3efc272115728827621bedcacca304a670bbaa560c45f
- /home/seongin3/data/geoaidesk/work/gaid-hub-followups/figures/hub-browse/hub-browse-no-results.png; sha256 ba6fb79d9e4901067c7682336c17fe6ded42e0add623c64bd6976280b5231323

### Added strings (existing strings unchanged)

| String id | Korean before → after | English before → after |
|---|---|---|
| hub.home.browse.title | 없음 → 허브에 등록된 방법 | Absent → Methods registered in the hub |
| hub.home.browse.tabs | 없음 → 방법 목록 | Absent → Method lists |
| hub.home.browse.all | 없음 → 전체 | Absent → All |
| hub.home.browse.folders | 없음 → 등록 방법 주제 폴더 | Absent → Registered method topic folders |
| hub.home.browse.search.label | 없음 → 등록 방법 검색 | Absent → Search registered methods |
| hub.home.browse.search.placeholder | 없음 → 제목, 한 줄 설명, 연구자, 분류 검색 | Absent → Search title, tagline, author or taxonomy |
| hub.home.browse.order | 없음 → star 많은 순 · 최근 등록순 | Absent → Most stars · Newest registration |
| hub.home.browse.count | 없음 → 방법 {count}개 | Absent → {count} methods |
| hub.home.browse.loading | 없음 → 등록 방법을 읽는 중입니다. | Absent → Reading registered methods. |
| hub.home.browse.error | 없음 → 등록 방법을 읽지 못했습니다. 목록을 다시 읽으세요. | Absent → Could not read registered methods. Reload the list. |
| hub.home.browse.retry.button | 없음 → 목록 다시 읽기 | Absent → Reload list |
| hub.home.browse.noResults | 없음 → 조건에 맞는 방법이 없습니다. 검색어나 폴더를 바꾸세요. | Absent → No methods match. Change the search term or folder. |
| hub.home.browse.empty | 없음 → 등록된 방법이 없습니다. 추천 Workflow를 살펴보세요. | Absent → No methods are registered. Browse recommended Workflows. |
| hub.home.browse.reset.button | 없음 → 전체 방법 보기 | Absent → View all methods |
| hub.home.browse.recommended.action | 없음 → 추천 Workflow 보기 | Absent → View recommended Workflows |
| hub.home.browse.open | 없음 → {title} 열기 | Absent → Open {title} |
| hub.home.browse.stars | 없음 → star {count}개 | Absent → {count} stars |

## Next steps
<!-- task:closed -->
Closed 2026-10-18T04:55:30Z: ready; the parent gaid-hub-followups integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- Full-check job 1 failed the integration-boundaries owner whitelist: used child task slug instead of an established owning package. Corrected to gaid-hub without changing check policy.
- Initial web assertions assumed whitespace in the accessible folder name and CSS-based hidden state in jsdom. Match the name flexibly and use explicit hidden attributes; all tests now pass.
- Initial keyboard browser assertion read aria-selected before Radix focus activation settled. Waiting for the actual selected state confirmed keyboard behavior; no source change needed.
- task job run refused dirty source without starting a job. Saved reviewed implementation and launched one recorded full-check job.
- External seed .ts was treated as CommonJS; renamed it to .mts before any API side effects, then seeded successfully.
## Notes and decisions
- Sequential decisions: shared browse is the default tab; personal drafts remain a separate tab to follow P1/P3/W5. One primary create action remains in the header.
- Interfaces: entries(folder?, q?) preserves existing callers; optional tagline derives from the immutable registered snapshot for old records. Server owns search/sort.
- Owned implementation: hub-home/shared list, shared-api, shared routes/contract and home.browse locale keys. A focused server route test extends server/test/geo-hub-shared.test.ts (existing GAID test). No delegated packages: this child is tightly coupled and nested children are unsupported.
- Integration order: server search/sort and client API, list/tab UI, targeted checks, API seed/browser QA, full checks, finish.
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
- /home/seongin3/data/geoaidesk/runs/gaid-hub-followups--hub-browse-20261018T044659.107690Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

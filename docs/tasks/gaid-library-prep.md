---
format: 1
status: active
updated: 2026-10-24T07:23:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"7bb1c54f-ec00-4ede-b538-8689a6d7266d","pid":1785127,"provider":"claude","session":"3dbb251a-b5a3-49b3-8474-ccc8cde7b5f6","start":"71315213","token":"0c6b923018272ee28d6b79696503be8b04037904a1f5d58759fec6ee23f1986e"}
branch: task/gaid-library-prep
target: main
parent: 
---
# gaid-library-prep

## Goal and done criteria
Request from the starter:

# Goal: gaid-library-prep — prepared literature material in 서재 (made with the general literature Workflows or imported from Gemini Notebook) that a Workflow can start from

## User request (verbatim, 2026-10-24, full message)

> 이전작업중 notebooklm 과 비교하고 개선한 작업이 있을것이다. 해당 내용은 모두 개선되었나? 그리고 워크플로우 생성을 위해 에이전트 토큰이 많이 소요되는것이 맞나? 보통 cli에 논문을 주고 이해하고 작업하는 토큰이랑 비슷한수준이면 많은 소비량이 아닐수 있다. 이점은 점검할 필요가 있다. 그리고 서재에서 워크플로우로 논문이나 자료를 읽히는 과정과 관련하여 더 체계적으로 개선가능하다. 현재 기본 BYOk 워크플로우들에는 논문 검색 부터 이해하고 정리하고 인용정리하는 워크플로우가 다수 있다. 내서재에서 해당 기능들을 사용하여 미리 자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한 자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다. 다음으로 GAID 워크스페이스에서 워크플로우 입력을 받을 때 자료가 없으면 에이전트가 자료를 검색해서 유사한 토이샘플을 구하거나 합성예제 또는 별도지시를 선택하여 워크플로우 시작시 에이전트가 질문할수 있게 해야한다. 마지막으로 검토용앱에는 최종 예시들만 두고 중간 테스트 프로젝트나 논문, 연구노트들은 제거해두자.

User decision on this split (2026-10-24, hub question, option "둘은 지금, library-prep은 뒤"): design now; implement only after
gaid-ia-connect-workspace--library-panels is integrated (it reshapes 서재 as side panels and overlaps these screens).
This unit owns: "서재에서 워크플로우로 논문이나 자료를 읽히는 과정과 관련하여 더 체계적으로 개선가능하다. ... 내서재에서 해당 기능들을 사용하여 미리
자료들에 대해 정리한 자료가 있으면 워크플로우에서도 해당자료를 기반으로 바로시작할수 있을것이다. 이것은 GAID 서재에서도 구현하지만 gemini 노트북과 연계한
자료를 업로드 하게 하는것도 같이 구현해두면 사용자의 선택폭을 넓힐수 있다."

## Context (verified)

- reports/2026-10-24-gaid-notebooklm-review decision 2 가 (user: "gaid-notebooklm-review 모두 권장대로 진행하자."): link saving and the
  public export were built (gaid-note-bundle-export, --notebook-links); "Gemini Notebook 결과 가져오기" (proposal 다: import exported
  reports/Docs→Word/PDF, Sheets→CSV, notes into 서재 as 외부 정리, source Gemini Notebook, 검토 전, never a citation source) was deferred
  "그 뒤" — this unit is that follow-up. Drive sync and the Enterprise API stay deferred (security office).
- General (upstream BYOK) Workflows include literature search, understanding, summarising and citation organising; catalogue 0.3.0 adds
  `paper-lookup`, `citation-management`, `literature-review`, `pyzotero` (seeded disabled). 서재 already mirrors research notes as items
  (gaid-note-library) and gives Workflow source papers (gaid-workflow-cite-scope).

## Phase 1 now (no app change outside a dev mockup page)

- Diagnose today's path from 서재 to a Workflow (start window, hub authoring sources, citation scope) and design: (a) running a general
  literature Workflow on 서재 papers/folders to produce a prepared summary/citation set stored in 서재 (with what it covers, which papers,
  model, date, 검토 전 until the researcher confirms); (b) importing Gemini Notebook outputs as 외부 정리 items; (c) starting a Workflow (and
  hub authoring) from such prepared material so the agent reads it first instead of re-reading every paper. Mockups with real tokens/parts
  per docs/design/ui-guide.md, Korean screenshots; give them via `task review-copy` and ask the user to approve or adjust.
- Wait for gaid-ia-connect-workspace--library-panels integration before phase 2; build on its 서재 panel structure.

## Phase 2 (after approval and that integration)

- Implement the approved design; scripts/check; real-app check with one folder of papers; report under reports/ (Korean, result first).

Do not touch the review app or the hub server. Outside check: none.

## Current state
Phase 1 design delivered for user review (2026-10-24): report reports/2026-10-24-gaid-library-prep/index.md with 6 mockup
screens (서재 문헌 정리 list/detail, make sheet, Gemini import sheet, start window intro + summary, Connect picker).
Mockup page /dev/library-prep (web/src/app/dev/library-prep/page.dev.tsx, web/src/geo/dev/library-prep/, locale namespace
devLibraryPrep). Checks: web tsc clean; copy validator 0 errors, 0 warnings in devLibraryPrep; check-ui 0 errors.
48 screenshots (6 screens × 계측/도폭 × light/dark × 1440×900/1280×800) in pc74:~/data/geoaidesk/work/gaid-library-prep/shots/
(re-shoot: start `npx next dev -p 3241` in web/, then ~/data/geoaidesk/work/gaid-library-prep/shoot.sh shots <w> <h> [screens]).
No app behaviour changed. The user approved all three recommendations (see Notes). Phase 2 not started: waiting for the
library panel on main.
## Next steps
1. Phase 2 once gaid-ia-connect-workspace--library-panels is on main (checked 2026-10-24: origin/main 75227da7 has an interim
   sync of the parent, but not the library panel): rebase on fresh main, then gaid-ia-connect-workspace--library-panels on main: decide work packages (server digest item kind
   + import + make flow; start-window/start-message + agent `library_digest` tool; authoring source kind on top of
   gaid-authoring-tokens; fix hub-synced PDFs lacking a page cache), implement, scripts/check, real-app check with one folder.
Blocked: gaid-ia-connect-workspace--library-panels is not yet on main (user decision 2026-10-24: implement after it).
## Failed approaches
## Notes and decisions
- Diagnosis (2026-10-24, code read): chat/start read attached papers via library_search (3 snippets/paper) and library_read (5
  pages/call); start message lists 근거 논문 + one "check" sentence; authoring sends up to 260,000 chars of paper text per model
  call (analyze/draft/revise); general literature Workflows (summarize-paper, compare-papers, methods-comparison, …) use web
  search and write sandbox Markdown, never 서재; no import path for Gemini output. Correction to the goal text: only `pyzotero`
  is in DEFAULT_DISABLED_SKILLS; paper-lookup, citation-management, literature-review are enabled (no Workflow uses them).
  Found: hub-synced PDFs are stored without a page cache (sync/index.ts), so library_read may return empty pages there.
- Design: new 서재 item kind "문헌 정리" (origins GAID-made via a general Workflow, or 외부 정리 imported from Gemini Notebook);
  검토 전 until 확인함; never cited itself (citations go to original paper pages); start window offers "먼저 읽을 정리";
  authoring picker gets a 문헌 정리 segment with "다룬 논문도 근거 자료로 넣기". Authoring token mechanics stay with
  gaid-authoring-tokens.
- User decision 2026-10-24 on report §6 (verbatim): "모두 권장으로 하자." → (1) phase 2 as mocked, after library-panels is on
  main, authoring part on top of gaid-authoring-tokens; (2) the 서재 item is named "문헌 정리", Gemini imports are marked
  "외부 정리"; (3) 외부 정리 is offered in the Workflow start window as "참고로만 읽음", never pre-selected. Glossary and
  terminology entries for 문헌 정리/외부 정리 go in with the phase-2 implementation.
- Orchestration (phase 1): sequential and tightly coupled (diagnosis → design → mockup → report); done by the writer alone,
  no child writers. Phase 2 packages (server digest store/import, start-window/authoring wiring, agent instructions) are
  decided after approval.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-library-prep/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

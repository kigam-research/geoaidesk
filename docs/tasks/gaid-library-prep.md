---
format: 1
status: active
updated: 2026-10-24T07:00:53Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
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

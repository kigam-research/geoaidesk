---
format: 1
status: active
updated: 2026-10-24T01:22:47Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"69425b78-d16e-474b-81c8-6378bfc1d28d","pid":780318,"provider":"claude","session":"254af796-1400-4a2e-aa38-aeb0c37c99eb","start":"69105472","token":"c7338ccd182951a8d9472e383f1059d02101897697f5d7b0d3f61a8479e1dd49"}
branch: task/gaid-notebooklm-review
target: main
parent: 
---
# gaid-notebooklm-review

## Goal and done criteria
Request from the starter:

# Goal: gaid-notebooklm-review — compare GAID hub/system with Google NotebookLM, propose differentiation and integration

## User request (verbatim, 2026-10-24)

> 다음 작업으로 현재 구축중인 GAID 허브와 시스템과 구글의 notebooklm(현재는 Gemini notebook)과 비교하여 장단점을 비교하고 어떻게하면 notebooklm보다 독창적이면서 해당도구가 커버하지 못하는 기능을 강화하여 상품성을 높일수 있을지 진단 및 검토하고 제안하자. 또한 도구간의 연계방안도 함께 검토해보자.

## Done (user's outcome)

One report for the user (`reports/<date>-gaid-notebooklm-review/index.md`, result first, Korean, from backbone templates/report.md):
1. Current facts about Google NotebookLM / its Gemini successor as of today, from official and dated sources (name and product status
   — verify the user's note "현재는 Gemini notebook" rather than assume it; features, source types and limits, audio/video overviews,
   sharing, Enterprise/Workspace tiers, API or export options, pricing/availability in Korea, data handling). Mark anything unverified.
2. GAID as it is today (AGENTS.md "GeoAIDesk fork" section, PROJECT.md, recent reports 2026-10-20…24): research cycle 서재 → Workflow
   authoring from papers/data/analyses → GAID hub sharing with versions → analysis by the AI agent with geo viewers (maps, LAS, tables)
   → research notes → back to 서재; institute hub server, Zotero/ORCID, example data, local models, provenance.
3. Side-by-side strengths and weaknesses for the researcher's jobs (literature understanding, data analysis, code execution, geospatial
   viewing, reproducibility/provenance, sharing methods in an institute, local/sensitive data, cost), without overstating GAID: only what
   it actually does; limits and untested parts stay visible.
4. Diagnosis and proposals: where GAID can be original and cover what NotebookLM does not, prioritised (impact, effort, risk), with the
   few changes that most raise product value; note what GAID should not try to copy.
5. Integration options between the tools (e.g. exporting GAID research notes/Workflow 지침/sources into NotebookLM, importing
   NotebookLM outputs into 서재, links, Workspace/Drive paths, any official API), each with feasibility, data-governance caveats
   (KIGAM data leaving the institute) and a recommendation.

## Notes

- Web research: use the `oracle-search` skill (Extra High by default; Pro if the comparison needs it). KIGAM network blocks
  raw.githubusercontent.com. Use the `aside` skill only if a logged-in Google page is required; do not upload KIGAM data anywhere.
- No app code changes in this unit; follow-up implementation would be separate units decided by the user. Run the humanizer skill
  (Korean rules) on the report prose before review-copy; give the user the `task review-copy` vault path.
- Outside check: none (product review, not a data analysis).

## Current state
- Plan (2026-10-24): no child units; research + report are tightly coupled and done by this writer.
- Done: NotebookLM/Gemini Notebook facts via oracle-search Pro (session `2026-10-24-google-notebooklm`); four key
  facts re-checked by the writer from official pages (rename 2026-07-16 + standalone + code execution; sources/limits/
  Drive sync; chat code execution labelled experimental; Workspace Data Regions excludes Gemini Notebook).
- Done: GAID facts from AGENTS.md, PROJECT.md, PRODUCT.md and reviewed reports; code check (Explore) that library
  citations in chat/notes are plain text (PdfPane pageRequest used only by hub dialogs), notes have no export, and
  there is no Google Drive/NotebookLM code.
- Done: report written, humanizer applied (Korean rules: bold labels removed, one name "Gemini Notebook" in prose,
  0-row conclusion shortened). No app code changed; no automated checks apply (report-only unit).
## Next steps
1. task save, task review-copy, then task finish.
## Failed approaches
## Notes and decisions
- 2026-10-24 web research: vault `웹 조사/geoaidesk/2026-10-24-2026-10-24-google-notebooklm--a6dfb78488.md`
  (oracle Pro, prompt/output `~/data/geoaidesk/work/gaid-notebooklm-review/q1.*`).
- Enterprise notebooks API page could not be fetched by WebFetch (header parse error); its scope is cited from the
  oracle answer only.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
- [결정] 다음에 만들 차별화 기능의 순서 — 가) 인용을 눌러 PDF 쪽 열기와 연구 노트 결과 묶음을 먼저 만들고 나머지는 그 뒤에 정함 — 나) 지역 단위로 모으기를 먼저 만듦 — 다) 서재 질문의 토큰 줄이기와 원내 모델 준비를 먼저 함 — 권장: 가) 이미 있는 기능을 잇는 일이라 노력이 작고 문헌 약점과 재현성 강점을 함께 보여 줌 — 근거: reports/2026-10-24-gaid-notebooklm-review#6-결정할-일
- [결정] Gemini Notebook과의 연계 범위 — 가) 노트북 링크 저장과 확인 화면이 있는 공개 자료 내보내기만 만들고, 결과 가져오기는 그 뒤, Drive 연동과 Enterprise API는 기관 보안 부서 판단 뒤로 미룸 — 나) 연계 기능을 만들지 않음 — 다) 기관 보안 부서에 Enterprise 도입 가능 여부를 먼저 묻고 API 연동까지 검토 — 권장: 가) 연구자가 반출 자료를 매번 고르고 Google API 변화에 묶이지 않음 — 근거: reports/2026-10-24-gaid-notebooklm-review#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-notebooklm-review/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

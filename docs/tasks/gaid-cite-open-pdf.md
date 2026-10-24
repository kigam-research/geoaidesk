---
format: 1
status: active
updated: 2026-10-24T01:43:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"a40bea4b-32d3-43d4-86f1-faa4a73d4a0a","pid":1127991,"provider":"claude","session":"012393d4-bfa3-4202-9c56-0c5c032003d1","start":"69413115","token":"6efd65ed0c26adb861904a36c68e3a3d1ccd1486b88a96f826851f987d1a58fb"}
branch: task/gaid-cite-open-pdf
target: main
parent: 
---
# gaid-cite-open-pdf

## Goal and done criteria
Request from the starter:

# Goal: gaid-cite-open-pdf — clicking a 서재 citation in chat or a research note opens that PDF page in the side panel

Done (proposal 1): a library citation in chat answers and in research notes (key + page, as the agent and note citation check write them) is clickable and opens the paper's PDF in the side PDF panel at the cited page (reuse PdfPane from gaid-library-pdf-panel; original pixels). A citation that cannot be resolved (no PDF, unknown key, page out of range) says so instead of failing silently. Works in the workspace and in 서재 note views. Running in parallel: gaid-note-bundle-export (note export) and gaid-uiux-skills-scan (research only).

## User decision (verbatim, 2026-10-24)

> gaid-notebooklm-review 모두 권장대로 진행하자.

Answers recorded on open items gaid-notebooklm-review#1 (가: build proposal 1 "인용을 눌러 PDF 쪽 열기" and proposal 2 "연구 노트 결과
묶음" first; 3–5 later) and #2 (가: now only "노트북 링크 저장" and "공개 자료 내보내기" with a confirmation screen; "결과 가져오기" later;
Drive sync and the Enterprise API wait for the institute security office). Source: `reports/2026-10-24-gaid-notebooklm-review/index.md`
§3.4 (proposals table) and §3.5 (integration table). The report found: chat and note citations are text only and do not open the PDF;
the PDF side panel (gaid-library-pdf-panel, `web/src/geo/pdf/pdf-pane.tsx`, `pageRequest`) can go to a page but is used only in hub
authoring; notes cannot be exported with their evidence; the existing evidence-package feature (`server/src/evidence/*`) is the base.

Checks: scripts/check; UI guide v2 (sections 1, 2, 10 + components touched; Korean screenshots both styles/themes at 1440×900 and
1280×800) and copy rules ("version", never 판). Do not touch the review app (PC74, loopback-only) or the hub server; the hub deploys
after integration. Outside check: none.

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

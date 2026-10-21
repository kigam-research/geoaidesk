---
format: 1
status: active
updated: 2026-10-21T14:38:36Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"db2f7129-57f9-4fa6-9097-90b13452fe46","pid":3154881,"provider":"claude","session":"cd9289a9-65a8-44df-8345-9053511b897a","start":"48141488","token":"2bdb9bbe3697d1aed3710ff379c4e9911149eb4cf734f8bc0d299d98901f9fa3"}
branch: task/gaid-library-next
target: main
parent: 
---
# gaid-library-next

## Goal and done criteria
Request from the starter:

# Request: gaid-library-next

User instruction (verbatim, 2026-10-21, to the geoaidesk hub): "남은 서재 관련항목 3건도 개선 작업 완료후 진행하자."
The improvement work (gaid-library-folders) completed 2026-10-21 (report reports/2026-10-21-gaid-library-folders/index.md),
so this unit starts now. Items recorded as answered with this unit as follow-up:
- gaid-research-hub#7 [확인] Does the agent find page-level evidence with the library tools and cite it in a real model chat?
  Option 가): check with the user's own chats. The user is the only tester; PC70 and PC74 can act as two researchers
  (user, 2026-10-21: "1단계를 시험할 연구자는 사용자 혼자로 충분하다. 그리고 이미 70, 74PC로 2명의 역할을 할 수 있다.").
  Prepare the test (real papers in a library folder, questions, what to look for), run what you can with the connected
  institute model, and hand the user a short checklist for their own chat check.
- gaid-research-hub#8 [부채] Literature skills (paper search, bibliography, literature review, Zotero) are missing from the
  distributed skill list. Option 가): put them into a new catalogue version (upstream literature skills absent in geo mode
  per reports/2026-10-21-gaid-research-hub §inventory: paper-lookup, citation-management, literature-review, pyzotero, …).
  Mind the Workflow model (docs/adr/2026-10-20-workflow-runtime-form.md) and the geo catalogue pin/verification.
- gaid-research-hub#9 [대기] Better BibTeX-dependent features (manuscript citations → Zotero collection, citekey pinning).
  Option 가): first re-check BBT's Zotero 10 compatibility and issues #3602/#3626 (use gh api; raw.githubusercontent.com is
  blocked); build only if resolved, otherwise record the state and leave it waiting.
Context: Windows is the usual researcher PC; colleagues use Zotero and EndNote, most keep PDFs in Windows Explorer folders.
Follow the design direction from gaid-design-identity (role variables only; no hard-coded colours/gradients/blur;
see ~/data/geoaidesk/work/hub/fded6f8b87d6.md) for any UI. Own GAID_HOME under ~/data/geoaidesk/work/gaid-library-next/;
do not modify ~/.geoaidesk. Outside check: no outside check (app work).

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

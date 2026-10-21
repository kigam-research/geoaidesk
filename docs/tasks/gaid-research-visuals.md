---
format: 1
status: active
updated: 2026-10-21T12:13:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"2cceca91-be2c-417d-91fa-2a00abf81f69","pid":1932750,"provider":"claude","session":"e8de1a21-2787-4813-95a5-2b6a9c27ca47","start":"47273338","token":"501f86af919f32bb08716719b3c938d6acf50b8cfd0b76739f71dbd3db63e5b0"}
branch: task/gaid-research-visuals
target: main
parent: 
---
# gaid-research-visuals

## Goal and done criteria
Request from the starter:

# Request: gaid-research-visuals

User words (verbatim, 2026-10-21, to the geoaidesk hub):
- Question: "gaid 허브 개선을 위해 oracle로 chatgpt와 claude 조사결과가 4개나 모였다. 해당 관점에서 GAID 허브 시스템 뿐만 아니라 사용자의 연구 방식과 관련하여 연구 정리 및 아이디어 시각화나 논문 그림 생성, 인용의 입장에서도 더 개선할 수 있는 부분은 없었나?"
- Decision on the hub's proposal (item 2 = this unit): "1~3번 모두 진행하자. 2번의 경우에는 이미 4개의 보고서에서 도입하거나 벤치마크하거나 스킬로 활용할 도구들도 많이 조사되어 있다고 생각한다."

Goal: paper figure generation and idea visualization for GAID researchers, research → design proposal → discuss with the user
→ implement the agreed scope (same pattern as gaid-research-hub).

Start from the existing research, as the user asked:
- Four inputs (read first; reuse their tools for adoption, benchmarking or as skills):
  ~/data/geoaidesk/work/gaid-research-hub/oracle/q1.harvest.md, oracle/q2.answer.md,
  ~/data/geoaidesk/work/gaid-research-hub/inputs/claude-web-survey.txt (PDF beside it), inputs/claude-research-2-notes.md.
  Hub extraction (verified facts, 2026-10-21): visualization tools they cover include Connected Papers (closed backend,
  clients MIT), Litmaps/ResearchRabbit (commercial), Inciteful (AGPL), Semantic Scholar Recommendations / Research Feeds,
  Scholar Inbox, ORKG comparisons (MIT backend), Gemini Notebook concept maps, Consensus gap matrix, evidence-based idea
  cards and idea/novelty tools (STORM, AI-Researcher, CodeScientist …). For figure generation the hub's extraction found no
  concrete tool in the four inputs (only figure-level evidence anchors, Docling figure extraction, figures linked to
  reviewer comments in phase 2). Re-check that yourself; do new web research (oracle-search skill, Extra High default,
  Pro when needed; KIGAM network blocks raw.githubusercontent.com) only for what the four inputs do not cover.
- GAID inventory: hub concept pictures (gpt-image-2 via the OpenAI Codex (legacy) login), map/depth/table viewers,
  upstream K-Dense scientific skills and Workflows (check which visualization/figure/writing ones exist and whether they are
  available in geo mode), research notes, the agent's own plotting via Python.
- Plan of the sibling unit gaid-research-hub (read-only): reports/2026-10-21-gaid-research-hub/index.md and
  docs/adr/2026-10-21-research-hub-library.md in ~/worktrees/geoaidesk/gaid-research-hub (or main once merged). Its
  library/paper→claim→note→Workflow links are the data an idea/connection graph view would show; do not edit its owned
  files (server/src/geo/library/**, web/src/geo/library/**, contracts/library.ts); coordinate through the hub if needed.

Scope to cover in the proposal: (a) paper figures — plots from analysis results, schematics/graphical abstracts,
publication-ready styling and journal requirements, reproducibility (figure ↔ script ↔ data provenance, GAID already records
provenance), figure QA; (b) idea visualization — an internal graph view of papers/claims/notes/Workflows/manuscripts,
literature maps (link out vs integrate), idea boards. Researcher value first: say why a researcher would use it in GAID
rather than the tool they use now; name things to integrate rather than build.
Discuss in the writer tab (task review-copy the proposal); implement only the agreed scope; ADR for architecture choices.
Use your own GAID_HOME under ~/data/geoaidesk/work/gaid-research-visuals/; do not modify ~/.geoaidesk.
Outside check: no outside check (product design and app work).

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

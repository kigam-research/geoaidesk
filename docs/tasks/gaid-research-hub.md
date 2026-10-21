---
format: 1
status: waiting
updated: 2026-10-21T06:35:12Z
writer: {"host":"seongin3","reserved":"61f95d84aad4187c55e866862d9c3219f3e0125a0467796adb84c101b79dfcce"}
branch: task/gaid-research-hub
target: main
parent: 
---
# gaid-research-hub

## Goal and done criteria
Request from the starter:

# Request: gaid-research-hub

User request (verbatim, 2026-10-21, to the geoaidesk hub):
"GAID 허브를 크게 개선하고 싶다. 현재는 워크플로우를 생성하고 공유하는 용도로 구축되어 있다. 일반적으로 연구자는 본인의 연구 산출물을 관리하고 논문을 수집하고 서지 관리하고, 수집한 논문에서 인사이트와 새로운 연구 아이디어를 얻고 싶어한다. 또한, 본인이 게재한 논문, 투고한 논문, 투고할 논문들을 관리해야한다. 이러한 기능은 zotero를 포함하여 현재 AI연계 도구들이 있다고 생각한다. 또한, BYOK내에 K-dense 워크플로우와 스킬에서도 문헌연구, 연구비 계획과 같은 카테고리에 관련 워크플로우를 제공하고 있다. 사용자는 GAID허브에 해당 기능을 구현하여 연구자가 논문작성 및 연구에 도움이 될 수 있는 시스템을 만들어서 유인하고 이를 GAID 허브의 워크플로우 생성 기능과 연계하고 나아가 GAID 시스템에서 에이전트 기반 작업과 연구노트를 생성하고 다시 이를 연계하는 시스템을 만들고 싶다. 이를 위해서는 관련 정보들과 현재 최신 오픈소스 도구들도 조사하여야 하며, 어떻게 시스템을 설계할 것인지도 벤치마킹하고, 현 시스템에 맞춰서 커스터마이징 하고 설계할 필요가 있다. 시스템을 구현하는 것은 에이전트나 기계가 볼 때 유의미한 것이 아니라 이용자(사람)가 해당 도구를 사용할 가치가 있어야 한다. 더 편한 도구가 있거나 유인이 없다면 상품성의 측면에서 설계가 잘못되었다고 볼 수 있다. 이를 위해서 별도의 작업 트리를 열어서 관련한 내용들을 조사하고 논의하여 구현하는 작업을 시작하자."

Scope (research → discuss → implement; same pattern as gaid-notebook-review / gaid-workflow-model):
- Phase 1, research and design proposal (no product code yet):
  - Survey current tools a researcher would otherwise use: reference managers (Zotero and its API/plugins, others), AI
    literature tools (open-source and commercial: discovery, reading/QA over papers, citation graphs, idea generation),
    publication/submission tracking, research-output management. Prefer current open-source projects that GAID could
    integrate with instead of rebuilding. Use the oracle-search skill for web research (Extra High by default, Pro when
    needed); KIGAM network blocks raw.githubusercontent.com (use gh api / codeload).
  - Inventory what GAID already has: GAID hub (Workflow authoring/sharing from papers and code), research notes, chat
    agent, Paperclip literature MCP connector, upstream K-Dense Workflows and skills in literature review, grant planning
    and similar categories.
  - Researcher value first: for each proposed feature, say why a researcher would use it in GAID instead of (or together
    with) the tool they already use, and what would make them come back. Name features that should not be built because a
    better tool exists (integrate instead).
  - Proposal with options and a recommendation: information architecture (library / my papers and submissions /
    insights and ideas), data model and storage, links to hub Workflow authoring, to agent work in the GAID system and to
    research notes (both directions), and a phased plan.
- Discuss the proposal with the user in the writer tab (task review-copy the proposal); implement in later phases only the
  agreed scope. Architecture decisions with real alternatives go in docs/adr/.
- Use your own GAID_HOME under ~/data/geoaidesk/work/gaid-research-hub/; do not modify the review app data (~/.geoaidesk).
Outside check: no outside check (product design and app work; researcher-value judgement is discussed with the user).

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

---
format: 1
status: waiting
updated: 2026-10-18T11:26:58Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"cf3c2630-5a5a-41da-8ca1-d21368a34174","pid":165774,"provider":"claude","session":"9b0b1311-fa15-49ef-bbc6-156ac66a94d3","start":"21076687","token":"ae93645b472f334531a322a6678e004f8dcc942d075e067c3a6e63b8bed5282d"}
branch: task/gaid-output-style
target: main
parent: 
---
# gaid-output-style

## Goal and done criteria
Request from the starter:

# Request: gaid-output-style

User request (verbatim, 2026-10-18, to the geoaidesk hub):
"gaid-notebook-review와 관련하여 연구노트를 작성하거나 agent가 대화창에서 답변할 때 현재 backbone 워크트리 시스템의 출력 방식처럼 attention control korean과 휴머나이저 스킬을 사용하여 명료하면서 이해가 잘되도록 연구노트가 작성되고 답변 될 수 있게 하자. GAID시스템의 출력에 대한 피드백이다."
After the hub's scope proposal: "따로 작은 작업으로 권장 방식으로 지적 처리하고 output 작업도 별도작업으로 진행하자." (this unit = the "output 작업").

Scope confirmed with the user (hub proposal):
1. Chat answers: the GAID AI agent's user-facing answers follow Attention Control Korean (result first, 합니다체,
   one point per sentence, no translationese or empty hedges, unverified things stated as unverified). Put a compact
   version into GAID's base instructions; when the conversation is in English, apply the same principles in English.
   Source: backbone `instructions/style-ko.md` (pc74:~/backbone/instructions/style-ko.md; origin
   https://github.com/aaddrick/attention-control).
2. Research notes (the summary notes from gaid-notebook-review): when the agent writes or updates a note, it polishes
   the prose with the humanizer rules (including the Korean rules) without changing facts or confidence. Add these
   rules as a GAID skill used by the note-writing step. Source: pc74:~/backbone/skills/humanizer (based on
   Wikipedia "Signs of AI writing").
Also:
- Measure how much the start prompt grows (local models such as institute Qwen run with a 64K context) and keep it short.
- GAID is a public repo: check the source/licence of any vendored text and show attribution.
- Run the same analysis request before and after with institute Qwen and put compared examples of chat answers and
  notes in the report.
Out of scope: fixed UI copy (already governed by geo/copy/).
Outside check: no outside check (app output-style work; the before/after comparison is the evidence).

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

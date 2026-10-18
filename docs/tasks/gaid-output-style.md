---
format: 1
status: done
updated: 2026-10-18T11:57:38Z
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
- P1-P3 done and pushed: `REPLY_STYLE_RULE` (728 chars) in GEO_INSTRUCTIONS; skill `geo/skills/gaid-note-style/`
  (4,908 chars) seeded by `server/src/geo/note-style.ts` (session start + provisioning), always exposed; note rule names
  it; notices in THIRD_PARTY_NOTICES.md; docs in AGENTS.md and docs/geo/research-notes.md.
- Checks run: server tsc; new tests 8; server geo tests 42 files / 334 pass (geo-provision expectation 2 -> 3 skills).
  Full scripts/check runs in task finish.
- P4 trial done (institute Qwen, same Seoul litho request): before (main scratch) 1 run, after 2 runs (2nd after
  tightening skill register/term rules and adding "no dashes" to the reply rule). Start prompt 30,335 -> 31,694 chars
  (+339 tokens by chars/4). Answers now lead with the result, no decorative bold; notes read the skill first, no bold
  or dashes; notes stayed 해라체 despite a 합니다체 skill rule, so the skill now says "one register per note" (as the
  source Korean rules) and the register is an open decision. That last one-line skill change was not re-run.
- Trial apps stopped (units gaid-style-before/after); data and evidence in ~/data/geoaidesk/work/gaid-output-style/.
  Scratch checkout ~/worktrees/geoaidesk/_scratch/9b471037dcac (main b4749e6) left for the CLI to clean.
## Next steps
<!-- task:closed -->
Closed 2026-10-18T11:57:38Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-output-style.md.

## Failed approaches
## Notes and decisions
- Orchestration: small, tightly coupled change; the top writer does all packages itself (no child writers).
  Order: P1 chat-answer rule -> P2 note-style skill + seeding + exposure -> P3 notices/docs/tests -> P4 trial -> report.
- P1 `REPLY_STYLE_RULE` in `server/src/geo/instructions.ts` (compact Attention Control Korean, English equivalent),
  appended to GEO_INSTRUCTIONS (geo catalogue mode only, like the other rules).
- P2 skill `gaid-note-style` shipped in `geo/skills/gaid-note-style/` (compact rewrite for research notes, ko+en; not the
  32 KB upstream file, for the 64K local context). Seeded into each geo project's `.pi/skills/` by
  `server/src/geo/note-style.ts` (seed once; upgrade only an unedited copy; a deleted/disabled copy stays so), always
  offered by `applyExposure`, and named in RESEARCH_NOTE_RULE.
- Sources/licences: attention-control (MIT, aaddrick; Ayoub Ghriss portions), blader/humanizer (MIT, Siqi Chen;
  patterns from Wikipedia "Signs of AI writing"), backbone Korean adaptations (kigam-research/backbone, private, same
  org) paraphrased, not copied. Notices in THIRD_PARTY_NOTICES.md and the skill's LICENSE/SOURCE.
- Trial: same request as gaid-notebook-review (Seoul 1:250k litho area table + map) with `kigam-qwen/qwen3.8-flash-next`,
  before = main (task scratch), after = this branch; data under `~/data/geoaidesk/work/gaid-output-style/`.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [결정 gaid-output-style#1] 연구노트 문체를 하나로 정할까요? — 가) 정하지 않음(AI agent가 노트마다 한 문체로 씀, 시험에서는 해라체) — 나) 합니다체로 고정 — 권장: 나) 요청한 backbone 출력 방식의 보고서와 채팅 답변이 모두 합니다체입니다 — 막힌 일: 없음 — 조건: 나)이면 노트 지시에 한 줄을 넣고 기관 Qwen으로 다시 시험 — 근거: reports/2026-10-18-gaid-output-style#6
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-18-gaid-output-style/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

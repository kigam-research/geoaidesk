---
format: 1
status: active
updated: 2026-10-18T12:15:34Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"62008f86-1be6-4772-943a-a951ffca285d","pid":468448,"provider":"claude","session":"85b4150d-ec81-4480-967e-62529d54438c","start":"21342974","token":"5b8b5067b5c9f3de1c1fb5825e3148f5d6bbd2ebb965c023135d08bfdc476cdc"}
branch: task/gaid-note-style
target: main
parent: 
---
# gaid-note-style

## Goal and done criteria
Request from the starter:

# Request: gaid-note-style

User decision (verbatim, 2026-10-18, to the geoaidesk hub): "나로 진행하자."
It answers open item gaid-output-style#1 ("연구노트 문체를 하나로 정할까요?") with option 나) 합니다체로 고정.

Context (reports/2026-10-18-gaid-output-style/index.md section 6): gaid-output-style added chat-answer rules to GAID's
base instructions and a note-polishing skill (humanizer rules) for research notes. In the institute Qwen trial the
notes still came out in 해라체; the skill instruction alone was not followed. The report's condition for 나): add one
line to the note-writing instructions (the research-note instructions from gaid-notebook-review) and re-test with
institute Qwen.

Done: research notes are written in 합니다체 (Korean notes; English notes unaffected); re-test with institute Qwen using
the same request as the gaid-output-style comparison, showing the resulting note. Keep the change small; brief report.
Outside check: no outside check.

## Current state
- Edited: `RESEARCH_NOTE_RULE` (server/src/geo/instructions.ts) gains one sentence fixing Korean notes to 합니다체;
  the `gaid-note-style` skill's register line now says 합니다체 (was "one register, keep the researcher's");
  docs/geo/research-notes.md "Prose style"; one assertion in server/test/geo-note-style.test.ts.
- Trial: unit `gaid-notestyle-app` (this worktree, ports 3373/18373), GAID_HOME
  `~/data/geoaidesk/work/gaid-note-style/home` (config/pi-agent copied from gaid-output-style/before), same request
  `tools/msg1.md`, model `kigam-qwen/qwen3.8-flash-next`, logs in `~/data/geoaidesk/work/gaid-note-style/logs/`.
## Next steps
1. Run the trial chat, read the note, write the brief report, scripts/check, finish.
## Failed approaches
## Notes and decisions
- Small, tightly coupled change: done by the top writer, no child units.
Closes: gaid-output-style#1
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

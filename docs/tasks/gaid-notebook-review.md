---
format: 1
status: active
updated: 2026-10-18T10:19:18Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"2a0d6567-6722-4491-9400-da914dac4c4e","pid":1485640,"provider":"claude","session":"292656f0-3260-4849-aaaa-e3598dfcdb42","start":"19718604","token":"033a89b7f46acbfd1b417e923adeab15d24a42da090cd0ec87b3944e17a0b622"}
branch: task/gaid-notebook-review
target: main
parent: 
---
# gaid-notebook-review

## Goal and done criteria
Request from the starter:

# Request: gaid-notebook-review

User message (verbatim, 2026-10-18, to the geoaidesk hub, after reading reports/2026-10-18-gaid-hub-followups/index.md):
"보고서를 확인하였다. GAID 허브는 비교적 OneUI기반의 프로젝트의 디자인 가이드를 기반으로 개선되었는데 GAID 시스템에서는 덜 반영된 곳들이 있다. workflow를 불러올 때 뜨는 팝업창에는 여전히 글자 수도 많고 디자인 완성도와 이용자 시인성이 부족한 편이다. 그리고 연구노트와 관련해서도 해당 기능이 개선될 필요가 있다. 사용자의 관점에서 obsidian vault 연구보고서를 정리하는 것을 참고하여 현재 연구노트 기능이 개선되었으면 한다. 지금의 방식은 단순히 에이전트의 작업 흐름만 따라가는 형태로 보이며, 해당 연구노트가 어디에 저장되고 어떻게 활용되는지에 대한 연계가 부족하다고 생각한다. 연구노트의 경우에는 별도 작업 트리로 현황을 진단해보고 어떻게 개선 수정하면 좋을지 검토 후 사용자와 논의하여 시스템을 개선할 필요가 있다. GAID 허브의 경우에는 GPT sol 6.1high 워커가 허브를 배경 지식과 맥락없이 처음 이용하는 이용자의 역할을 부여하였을 때 해당 허브를 올바르게 사용할 수 있는지를 검토하게 하는 작업을 통해 누락되거나 개선이 필요한 부분들을 개선하는 작업을 별도의 작업트리에서 수행하여야 한다."
After the hub proposed three units (gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui with option 가) for its scope): "권장대로 하고 모두 진행하자."

Sibling units started together: gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui.

Scope confirmed with the user:
- Phase 1 (diagnosis only, no code changes): diagnose the current research notebook (Lab Notebook) from the
  researcher's point of view: where notes are stored, how they are reused, what they link to (project files,
  results, reports, hub methods, exports), and where it merely follows the agent's work flow. Use as the reference
  how the user organizes research reports in the Obsidian vault (~/vaults/cmds-main on PC74, read-only; e.g. the
  reports copied there by `task review-copy` / task complete and the 결정 대기 note). Produce an improvement
  proposal (options with a recommendation) for the user.
- Then discuss the proposal with the user (ask through the writer tab; the user talks to it directly). Phase 2
  implements only the scope the user agrees to. Do not implement before that agreement.
- UI work follows docs/design/ui-guide.md and the copy rules in AGENTS.md.

Outside check: no outside check (app/system design work).

## Current state
- Phase 1 (diagnosis) done, no code changes. Report `reports/2026-10-18-gaid-notebook-review/index.md` (figures: current
  notebook screenshot from the review app, static HTML mockup of option 가). Evidence: native Explore surveys of the
  notebook code and the vault (findings with file:line in report appendix A); review app `gaid-review` (~/.geoaidesk,
  project `default`, 2 notebook sessions, 5 entries); screenshots/mockup source in `~/data/geoaidesk/work/gaid-notebook-review/`.
- Key findings: notebook = per-chat hidden JSONL agent log (`.kady/notebook/`), no topic/conclusion/decision/status, user can
  only pin/comment/note (note box hidden in default all-chats scope), no visible Markdown, exports/methods draft in English,
  R1 violations (command lines, session/tool-call ids), no link to GAID methods/trials/recipes/hub handoff (handoff skips dot
  dirs). The agent already writes a reader-facing report into `results/*.md` that the notebook treats as just an artifact.
- User decision 2026-10-18 (verbatim): "모두 권장으로 진행하자." → report §6 1-가 (research-note-first) and 2-가 (the agent
  writes/updates a note when an analysis has results; 노트 정리 prefills a request). Phase 2 in progress.
- Shared interfaces settled by the top writer: contract `web/src/geo/contracts/research-notes.ts`, format/behaviour spec
  `docs/geo/research-notes.md`.
- W done and saved (0515475): `web/src/geo/notes/` panel + tests (7 pass), notes locales, notebook-tab seam in
  `file-preview-panel.tsx`/`page.tsx`, AGENTS.md + docs/lab-notebook.md lines; web tsc, copy validator, check-ui clean;
  related existing web tests 57 pass. Live check waits for S.
- Workers: child units `gaid-notebook-review--notes-server` (S) and `gaid-notebook-review--record-cleanup` (C), both
  "general work", started 2026-10-18; prompts in `~/data/geoaidesk/work/gaid-notebook-review/prompts/`.
## Next steps
Blocked: notes-server child's `task finish` is still running its full check; `task complete` waits for its finish record.
1. C integrated and closed (2ddf4de). Children run S and C (below); top writer builds W against the contract, then integrates S → C → W, runs scripts/check,
   screenshots (UI guide §10), updates the report (result of Phase 2, §6 answered) and finishes.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Phase 2 plan (scope = option 가 + 2-가 only):
- Sequential decisions (top writer, done): note location `연구노트/<YYYY-MM-DD>-<topic>/index.md` + `figures/`; file is the
  master, agent writes with ordinary write/edit (no new tool: tool schemas already dominate the start prompt); server
  parses frontmatter + sections; `.kady/geo/notes.json` maps note → chats; method link derived from method-trial records
  of those chats; status `pending|confirmed|superseded`, only the researcher confirms; 노트 정리 = chat prefill (no
  separate model call); notes render in the notebook tab (list → note detail), the old timeline becomes 작업 기록.
- Packages / owned files:
  - S `gaid-notebook-review--notes-server` (child, general work): `server/src/geo/notes/**`, `server/src/geo/routes/notes.ts`,
    registration lines in `server/src/geo/routes.ts` and `server/src/geo/session.ts`, `RESEARCH_NOTE_RULE` in
    `server/src/geo/instructions.ts`, `server/test/geo-notes.test.ts`, boundaries entries for its files.
  - C `gaid-notebook-review--record-cleanup` (child, general work): R1/language cleanup of the existing notebook
    (entry card execution evidence and result-link ids behind a disclosure, Korean/locale export and print labels,
    session-export heading, methods-draft reply language), `web/src/geo/locales/notebook/*`, upstream notebook files
    with boundaries entries. Must not touch `file-preview-panel.tsx`, `lab-notebook-view.tsx` layout/scope, or `web/src/geo/notes/`.
  - W (top writer): `web/src/geo/notes/**`, `web/src/geo/locales/notes/*`, the notebook-tab branch in
    `web/src/components/file-preview-panel.tsx`, docs (`docs/geo/research-notes.md`, `docs/lab-notebook.md`, AGENTS.md line).
- Integration order: S → C → W (W developed against the contract meanwhile). Boundaries file: append-only entries.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-18-gaid-notebook-review/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

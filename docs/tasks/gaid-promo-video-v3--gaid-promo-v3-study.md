---
format: 1
status: active
updated: 2026-10-23T17:10:07Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"adb2ab89-1fbb-4c78-a0dd-7f7c70629ef4","pid":2303809,"provider":"codex","session":"01a16996-cf85-7350-b292-4c272df13a59","start":"66079249","token":"32267624b2afdfc6f7ebf2d7e8d792357f39de990d56d3aff620847226568c4e"}
branch: task/gaid-promo-video-v3--gaid-promo-v3-study
target: task/gaid-promo-video-v3
parent: gaid-promo-video-v3
---
# gaid-promo-video-v3--gaid-promo-v3-study

## Goal and done criteria
Request from the starter:

# Child unit gaid-promo-v3-study: review-app study and capture-v3

Parent: gaid-promo-video-v3 (Claude writer). You run one real research cycle in the GAID review app and record the raw
takes for the v3 promotional film. The parent does all film work (scenes, tags, timing, render, report).

Contract (read it first, it is the interface): `geo/promo/CONTRACT.md` (v3) in your worktree. Also read
`geo/promo/CAPTURE.md` (how v2's study child worked, its tools `geo/promo/capture*.py`, pitfalls) and the parent task
document `docs/tasks/gaid-promo-video-v3.md` → "Structure draft v3".

Goal: deliver `~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/` (capture.json + shots + stills) for the 16 shots in
the contract's shot list, plus `study.json` and before/after inventories, from a study that shows these improvements in the
final app: PDF side panel in 서재; several authoring sources at once (two library papers, code, data files with summaries);
the evidence viewer beside an authoring question; a 3–5 stage draft; example data per input; register dialog with the version
choice and the shared example files; the start window (소개 with 근거 논문 붙이기 → stage pages with example data → summary);
the chat Workflow card "예제 자료로 실행" with the AI agent working; a GeoTIFF result in the map viewer; the note with page
citations and a decision answered; note "서재에 넣기"; the paper's 내 연구에서 쓰인 곳 and 연결 지도.

Scope and allowed actions:
- Edit only `geo/promo/capture*.py` (new helpers prefixed `capture_`) and `geo/promo/CAPTURE.md`; nothing else in Git.
- In the review app: create and use only the study's own records (contract "Rules"). Hub registration on the institute hub
  server is allowed (user approval). Never change settings/keys, never restart gaid-review or the hub server, never read
  credential files listed in the contract.
- One real analysis run only: coarse/loose, ≤ 10 min compute, method kept whole. `truth/` of the example asset is never
  given to the agent or bundled.
- Model: GPT-6.1 Sol (reasoning high) via the connected subscription, picked per action; if the default model fails, pick
  a connected subscription model per action (no settings change).
- Long-running controllers: `task job run -- ...` (see CAPTURE.md for the v2 controller pattern). Network: KIGAM blocks
  raw.githubusercontent.com.
- Promotional film: choose takes for visual quality; capture-only DOM text substitutions only for wording that reveals
  staging, each recorded in capture.json/CAPTURE.md.

Evidence to return (in your final message and CAPTURE.md): shot table with seconds; all ids; models and usage readings;
cuts and substitutions; verification (frame sizes, beat rects checked on midpoint frames, no page errors, outside records
unchanged); anything you could not show and why. If a feature cannot be shown as the contract says (for example the app
refuses an action), record it, take the closest real state, and continue; ask the parent only if the study would have to
touch records outside its own.

Before you finish, `task save` your capture* files and CAPTURE.md, then `task finish`.

## Current state
(what is done, how it was verified, safe commands to re-verify)
- 2026-10-24: resumed in the printed worktree; read the v3 contract, v2 capture notes, parent structure, writer procedure and applicable app rules. Exact worktree has no codegraph index; bounded source reads are the supported fallback.
- Controller job 1 is running on 127.0.0.1:18339 (receipt below). Own records: library folder lc-0b809e67ade8, authoring draft ap-574620c7-44d. Both source papers are in the new folder; draft has two library PDFs, ESM code and six example input files. First analysis attempt att-81c3b674-cd8 is running on openai-codex/gpt-6.1-sol, high. L1/L2/A1: 420 frames, geometry/timing validation passed and six beat midpoint bounds visually checked. External study.json is the ID/event record; before inventories saved before study mutations.
- Authoring attempt was still running after five minutes, with no reported error. Read-only capture_wait.py will notify on its terminal state while the controller retains the browser. Job 2 runs the declared scripts/check suite independently. Deployment SHA read back as 7650e012ebf3c0bcb20eed9ff115c2fb10c23553. Explicit input file hashes are saved externally in input-files.json; truth/ was not read or uploaded.
- Watcher job 3 succeeded. Attempt att-81c3b674-cd8 was accepted at 16:39:14Z (336 s); usage input 41,164, output 14,015, costUsd 0. It generated 38 findings, one scientific question and the two standard questions. The scientific question has three verified source anchors, shown beside the card with a marked PDF quote. Initial validation/retry findings remain recorded in the attempt; final scientific-question anchors are verified. A2 is captured during the actual answer; its options have no own anchors, so the second PDF reference is selected manually rather than attributing an automatic viewer change to the option.
- All three questions answered through the UI: sample-cells, include, quick-and-full. Trial-scale addition explicitly retains preprocessing, conventional inversion, PGI-full/PGI-none, both ore-boundary criteria and low-sensitivity evaluation within one <=10 min compute cycle; no upscaled rerun. Draft attempt att-8e46fd29-b50 started at 16:42:02Z, same model/high. Four shots (L1/L2/A1/A2) now exist.
- Job 2 scripts/check succeeded (exit 0): backend 209 files/2,300 tests passed, one file/eight tests skipped by suite; frontend 204 files/1,289 tests passed; geo distribution 58 passed, zero failures; environment imports and isolated production start/stop/restart smoke passed. Review app/hub services were not restarted. Draft attempt remains running with no validation errors; job 4 is its existing watcher.
- Watcher job 4 succeeded: draft att-8e46fd29-b50 repaired and accepted (one automatic repair, 854 s; input 117,686/output 40,102, costUsd 0). Four analysis stages; six input roles; six required choices plus two parameters with defaults. Examples attached via real source-picker UI, revisions 2–7. Revision 7 check passed with warnings for run-time simpeg/discretize/ppigrf installation and inferred import dependencies. A3/A4 captured; workflow-stages.png is a genuine step-rail screenshot. A3's format pass is API-verified, not in the step viewport.
- Registered own entry entry-ap-574620c7-44d, version 0.1.0/revision 1, in existing 지구물리 역산 folder; all six example files shared. Created own project proj-af4c46 (포천 자철석 광체 추정), installed this registered version, attached both source papers from the start introduction (R1 captured). All six examples selected. Start conditions are explicit: borehole-derived ROI +300 m, 50×50×25 m mesh/50 m sampling, six outer iterations per variant, CG 20/tol 1e-2, total compute <=600 s, no upscaled rerun, sample-cell-only geological constraints, normalized sensitivity cutoff .05, consistent drill-proximity connected-component selection. These are research assumptions, not truth-derived settings; reference CSV remains evaluation-only.
- Analysis sent ONCE at 17:05:34Z, receipt external analysis-sent.json. Session 01a169b9-9c13-74e2-b9da-57749e4f1203, run run_7b452a64-faa7-4adf-ab82-2507b0a48395, GPT-6.1 Sol subscription/high, <=4 CPU threads. Real skill/code/library/data-inspection tools observed. Eight finished takes/1,065 frames validated; 16 midpoint rectangles visually inspected. R3 has 120 pending frames (composer Workflow card, actual ongoing tools); do not create another R3. Controller globals r3take/r3card/r3working retain it; r3-pending.json records its recovery state. Append the final result segment after the run, then finish this take. An alternative working segment (own notebook tool rejected Japanese, then accepted its Korean correction) is archived externally; selected segment shows actual earlier tools with off-camera scroll, no DOM substitution.
## Next steps
1. Await the existing analysis session through capture_wait.py --session/--project. On notification, read analysis-history.json, analysis-costs.json and study.json; inspect the real result/note in proj-af4c46. Controller 18339 retains the pending r3take (120 frames); append a 60-frame result segment and its cut/beat, then finish R3. Never resend analysis or recreate records.
2. Capture M1/N1/L3/L4/L5, make one small run-derived improvement and register its next version (H1), capture final hub entry H2, collect stills, outside-record inventories and final metadata. Then CAPTURE.md, save and finish.
## Failed approaches
## Notes and decisions
- Sequence and ownership: this child alone owns capture helpers, CAPTURE.md and its task document; external payload root is ~/data/geoaidesk/work/gaid-promo-video-v3/. All app writes stay within the new study records. The parent alone owns film design and integration. No child workers: the record mutations and live captures are tightly coupled.
- The v3 contract requires a new hub entry and a later real improvement/version; its stricter own-record boundary takes precedence over the parent structure's optional existing-entry reuse.
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
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3--gaid-promo-v3-study-20261023T162937.272862Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3--gaid-promo-v3-study-20261023T163640.571245Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3--gaid-promo-v3-study-20261023T163944.187790Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3--gaid-promo-v3-study-20261023T164248.932544Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3--gaid-promo-v3-study-20261023T170953.183878Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

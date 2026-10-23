---
format: 1
status: active
updated: 2026-10-23T16:39:50Z
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
- 2026-10-24: resumed in the printed worktree; read the v3 contract, v2 capture notes, parent structure, writer procedure and applicable app rules. No study records created yet. Exact worktree has no codegraph index; bounded source reads are the supported fallback.
- Controller job 1 is running on 127.0.0.1:18339 (receipt below). Own records: library folder lc-0b809e67ade8, authoring draft ap-574620c7-44d. Both source papers are in the new folder; draft has two library PDFs, ESM code and six example input files. First analysis attempt att-81c3b674-cd8 is running on openai-codex/gpt-6.1-sol, high. L1/L2/A1: 420 frames, geometry/timing validation passed and six beat midpoint bounds visually checked. External study.json is the ID/event record; before inventories saved before study mutations.
- Authoring attempt was still running after five minutes, with no reported error. Read-only capture_wait.py will notify on its terminal state while the controller retains the browser. Job 2 runs the declared scripts/check suite independently. Deployment SHA read back as 7650e012ebf3c0bcb20eed9ff115c2fb10c23553. Explicit input file hashes are saved externally in input-files.json; truth/ was not read or uploaded.
## Next steps
1. On the authoring watcher notification, read external study.json and authoring-current.json. Continue the existing controller on 18339, capture A2 live, answer through the UI and make the draft. Do not repeat record creation, the model request or the controller.
2. Capture the live interview and analysis moments, finish one bounded real run, then revisit stable states for the remaining takes and validate the deliverables.
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

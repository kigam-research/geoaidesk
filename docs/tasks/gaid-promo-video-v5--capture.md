---
format: 1
status: active
updated: 2026-10-24T01:50:41Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"7b6c0c70-dc29-4c26-aee1-6a9e2549e4b2","pid":1222631,"provider":"codex","session":"01a16b9a-30c0-7823-bbfa-e604026a2474","start":"69456843","token":"8d41e205d92dc2e9f2d13e4620748ccd6276cd4ae4f4294f054d0afbb6e2d1fb"}
branch: task/gaid-promo-video-v5--capture
target: task/gaid-promo-video-v5
parent: gaid-promo-video-v5
---
# gaid-promo-video-v5--capture

## Goal and done criteria
Request from the starter:

# Child goal: gaid-promo-video-v5--capture — Yilgarn takes for the GAID promo film v5

You are the capture child of `gaid-promo-video-v5`. Produce seven new real-app takes (Y1–Y7) of the existing Yilgarn nickel
MPM example in the PC74 review app, with highlight rects measured from whole DOM elements.

## Contract (read first, it is binding)
`geo/promo/CONTRACT.md` (v5) in your worktree: ownership, review-app rules, write blocking, capture settings, the take
interface (`capture-v5`, schema `gaid-promo-capture-v2` + `region`/`selector` per beat), the shot list Y1–Y7 and verification.
Background on the earlier study and the v3 capture tooling: `geo/promo/CAPTURE.md`, `geo/promo/capture.py` (pointer,
ripple, `StudyTake`-style recorder, `rect_of`), `geo/promo/capture_v3.py`, `geo/promo/capture_verify.py`,
`geo/promo/capture_beat_checks.py`, `geo/promo/capture_sheet.py`. Reuse them; new helpers go in `geo/promo/capture_v5*.py`.
Parent's direction: `docs/tasks/gaid-promo-video-v5.md` → "Direction v5".

## Why the rect rule matters
The user's feedback on v4 (verbatim): "기능을 소개할때 사각형도 영역을 중간에 어색하게 잘리게 지정하는 경우도 빈번해서 수정이 필요하다."
The parent frames each beat rect and lifts it out as an enlarged detail window, so a rect must be the exact bounds of whole
UI elements (panel, card, section, list, table, figure, legend, popup), fully inside the viewport — never a hand-drawn box.

## Known state (read-only exploration by the parent, 1280×720)
- Hub home `#hub`: 추천 Workflow card "PU-컨포멀 탐사 우선순위 존 분류" with concept picture; sidebar folder
  "광상 부존 가능성(MPM)" (5 entries) shows a table. Entry detail: `#hub/e/entry-ap-a135f290-1c4` (version 0.1.1, seongin).
- Project "Yilgarn 니켈 광상 부존 가능성" (`yilgarn-cd7814`, open with the button "Yilgarn 니켈 광상 부존 가능성 프로젝트 열기"
  on the project list): Workflow panel row "PU-컨포멀 탐사 존 분류 (새 지역)" (등록됨 · version 0.1.1); chat tab
  "Yilgarn 니…" holds the run history; notebook "연구 노트" lists the note "Yilgarn 니켈 탐사 우선순위 구역";
  `outputs/yilgarn_priority_zones.geomap.json` / `.gpkg`; `user_data/Yilgarn_GIS_DB.csv`.
- The project's first chat message carries an older Workflow block (`revision="1"`, "(1판)" inside the text). If any screen
  shows "판" to the researcher, report it and choose another state; do not substitute text.
- The parent already told the hub that the review app is in use; do not message the hub yourself.

## Allowed actions
Navigation, view controls, hovering, opening/closing panels, tabs, dialogs, the start window (never its start action), the
map viewer and its value click, scrolling only off camera between cuts. Everything that would write is blocked in the
browser (contract). No model runs. Long-running work through `task job run` if needed; quick capture scripts may run
directly. Payloads outside Git under `~/data/geoaidesk/work/gaid-promo-video-v5/`.

## Evidence to deliver (in `CAPTURE.md` v5 section and your task document)
Take table (frames, seconds, cuts), each beat's `region`/`selector`, the blocked-request log summary and allowlist,
before/after inventory comparison, `capture_verify.py`-style check result, and that you inspected every drawn beat-check
frame. Commit only `geo/promo/capture_v5*.py` and `geo/promo/CAPTURE.md` (plus your task document), then `task finish`.
If a take cannot show its state cleanly, deliver the others and report that take with the reason.

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

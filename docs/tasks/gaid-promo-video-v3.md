---
format: 1
status: done
updated: 2026-10-23T18:18:28Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"6049dc5d-4e08-4477-91a7-c4f979551d95","pid":2267643,"provider":"claude","session":"005e4fa9-23ac-4415-a900-3b79a1cdfb1a","start":"66051222","token":"c55cfd44431ac013718069a11296a9ea2387fc17354f825cfb49c5ad98458837"}
branch: task/gaid-promo-video-v3
target: main
parent: 
---
# gaid-promo-video-v3

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video-v3 — update the GAID promotional video on the final improved app

## User request (verbatim, 2026-10-23)

> 우선 GAID 홍보 영상을 구글드라이브에 업로드 하자. 그리고 포천 예제가 끝나면 최종 개선된 앱을 바탕으로 홍보영상을 업데이트해야한다. 현재 영상의 구성과 개선된 내용을 파악한 후 체계화하여 홍보영상을 업데이트해야한다.

(The Drive upload of v2 is done by the hub.) Agreed order, now reached: improvement units → review app update → UI audit
(gaid-ui-audit, 26 of 31 deviations fixed) → review app update → this unit.

## Done (user's outcome)

1. Understand the current film: v2 (105 s, silent, internal review) — report `reports/2026-10-23-gaid-promo-video-v2/index.md`, sources
   `geo/promo/`, video `pc74:~/data/geoaidesk/runs/gaid-promo-video-v2-20261023T040221.069950Z/out/gaid-promo-v2.mp4`, registry id
   `gaid-promo-video-v2`. Keep what the user liked (motion graphics; feature-by-feature demo without heavy zoom/scroll; the research cycle
   서재 → Workflow → share → analysis with map/work screen → research note → back to 서재; background on the scattered skill ecosystem,
   K-Dense-AI included; no forced prototype counts; KIGAM second-brain concept scene).
2. Understand what improved since v2 (read each report): 2026-10-23 note-library, workflow-example, authoring-sources, hub-versions,
   library-pdf-panel, authoring-evidence-view, workflow-start-ui, pocheon-trial, workflow-cite-scope, workflow-stages, and
   2026-10-24 ui-audit (plus 2026-10-22 hub-feeds, orcid, hub-server-trial if they fit).
3. Restructure the film systematically (structure first, written in the task document and shown to the user in the writer tab), then
   recapture the real-system parts on the final app and render v3. Show the closed research loop with the improvements (e.g. evidence
   viewer beside authoring questions, multi-source authoring, example data in the stage-based start window, source papers attached, note
   back into 서재 with paper ↔ Workflow ↔ note links, version on the hub).
4. Same delivery terms as before (user decisions): silent, internal review only, 1920×1080 30 fps, about 90–105 s (record if different).
   Report with small PNG key frames, video locator + sha256, registry entry `review` (supersedes v2).

## Notes

- Captures: the review app (PC74, main 7650e012, loopback-only http://127.0.0.1:3000; institute hub server 7703739a, admin seongin) — the
  user allowed recording a real research cycle there for v2. Tell the hub before and after you use it; the hub will not restart it while
  you record. Do not change its settings or the hub server. Reuse the Pocheon example (`geo/examples/pocheon-pgi/`); example analyses:
  coarse/loose, ≤10 min per run, method kept whole (user rule), at most one real run.
- Visible names "AI agent"/"GAID"; K-Dense shown as the upstream source where shown; no proprietary assets/fonts; UI guide v2 holds for any
  UI shown; KIGAM logo internal only (gaid-release-proof#2).
- Tools: `media-craft` (ffmpeg/ImageMagick/sox are not installed), `playwright-cli`. KIGAM network blocks raw.githubusercontent.com.
- Outputs outside Git (`~/data/geoaidesk/...`). Workers via `task start --parent` / `task reader`. Outside check: none.

## Current state
- 2026-10-24: read v2 (report, `geo/promo/`, v2 task doc "Structure draft v2") and the improvement reports. Review app
  (gaid-review, main 7650e012) and hub server are up. Review-app records relevant to v3: library papers `heo2025`
  (li-79b57a297a46, Pocheon PGI paper) and `astic2020` (li-a313027670f8, PGI method paper), note item li-16b92efeb9b4
  (Pocheon note, pre-cite-scope), folders `광상 부존 가능성`, `GAID 수집함`; hub entry `entry-ap-43431e17-f09`
  "항공자력·시추 코어 PGI 광체 추정" (versions 0.1.0, 0.2.0, folder 지구물리 역산, authored before workflow-stages);
  Pocheon projects pgi-2c2f48, pgi-2-ea1e81, pgi-2-0-2-0-84f252 (before cite-scope: notes do not cite via the start window).
- Scenes/render adapted to v3 (commit 99adefc7): motion scenes keep v2 choreography via `timed()` slots (opening 0–4.4,
  background 4.1–17.2, cycle 16.9–24.4), demo from 24.45 for the take lengths, second brain 8.4 s and closing 4.6 s after
  it; cycle plate shows `version 0.1.0 → 0.1.1` (the study's real versions); render.py takes duration and stills from the page, writes
  `gaid-promo-v3.mp4`. Preview with v2 frames as stand-ins: `~/data/geoaidesk/work/gaid-promo-video-v3/preview-01/`
  (94 s with the 12 v2 shots that share ids; with all 16 v3 targets ≈ 100–105 s).
- Final render job `job-geoaidesk-gaid-promo-video-v3-1` succeeded (exit 0): `gaid-promo-v3.mp4` 105.00 s, 3,150 frames,
  1920×1080, 30 fps, H.264, no audio (re-read with imageio-ffmpeg), sha256 1fe73715…72ea5f, source 344c7e44, capture.json
  aab24b2e…. Report `reports/2026-10-24-gaid-promo-video-v3/` (figures from the final MP4), registry `gaid-promo-video-v3`
  (review, supersedes v2), v2 report marked superseded. Hub told the review app is free.
- Child progress (its messages): folder lc-0b809e67ade8 `포천 자철석 PGI`; draft ap-574620c7-44d (9 sources, 4 stages, 6
  example roles, revision 7 check passed); new hub entry entry-ap-574620c7-44d version 0.1.0 in 지구물리 역산; takes
  L1 L2 A1-A4 R1 R2 done; project proj-af4c46, session 01a169b9-9c13-74e2-b9da-57749e4f1203: the one real run started
  17:05Z, finished: 98.3 s compute, all 5 inversions stopped at the 6-iteration cap without reaching the misfit target
  (no convergence or orebody claim), GeoTIFF maps, orebody_3d*.png, note; 6.83 M subscription tokens, USD 0 charged.
  Next: M1, N1, L3-L5 takes; patch 0.1.1 (core/active-cell caveat via example metadata) → H1, H2.
- Structure draft v3 written below and shown to the user (2026-10-24). Hub notified (request a11aeb361b50) that the
  review app is in use. Child `gaid-promo-video-v3--gaid-promo-v3-study` started: Paseo agent adb2ab89 (codex gpt-6.1-sol
  high), worktree `~/worktrees/geoaidesk/gaid-promo-video-v3--gaid-promo-v3-study`, prompt
  `~/data/geoaidesk/work/gaid-promo-video-v3/prompts/study.md`. On its finish: `task complete gaid-promo-video-v3--gaid-promo-v3-study`.

### Structure draft v3 (to show the user)
Kept from v2: logo, background (scattered skill ecosystems incl. K-Dense, no counts, 개념도), cycle ring, demo style
(whole app frame at one scale, cycle strip on top, one blue box + Korean tag per feature, no zoom/scroll), second brain
(개념도), closing. Changed: the demo follows one new study, the Pocheon magnetite PGI paper (Heo et al. 2025, institute
geophysics), done again in the final review app so every improvement appears in its place in the loop; "판" becomes
"version" everywhere (gaid-hub-versions).

| # | s | Part | Content (improvement shown) |
|---|---|---|---|
| 0 | 0–4 | Opening | logo motion |
| 1 | 4–17 | Background (motion, 개념도) | as v2, tightened |
| 2 | 17–24 | Cycle (motion) | ring 내 서재 → Workflow 만들기 → GAID 허브 공유 → 연구 분석 → 연구노트 → 내 서재; version 0.1.0 → 0.2.0 |
| 3a | 24–32 | Demo: 내 서재 | folder with the paper and the PGI method paper; paper detail; PDF opens in the side panel (library-pdf-panel) |
| 3b | 32–46 | Demo: 논문에서 Workflow | several sources at once: two library papers + supplementary code + data files with data summaries (authoring-sources); a question with the evidence viewer beside it, PDF page with the quote marked, recommended option (authoring-evidence-view); draft as 3–5 analysis stages (workflow-stages); example data attached per input (workflow-example) |
| 3c | 46–54 | Demo: GAID 허브 공유 | register dialog: next version (patch/minor/major) and the example data files shared (hub-versions, cite-scope); hub entry with version, author, stars/comments |
| 3d | 54–72 | Demo: 연구 분석 | one start window: 소개 (purpose, inputs, outputs, 근거 논문 2편 붙이기) → stage pages with example data chosen → summary (workflow-start-ui, stages, example, cite-scope); chat: Workflow card "예제 자료로 실행", AI agent working; result in the map viewer (magnetic anomaly / susceptibility slice) and the 3D orebody figure |
| 3e | 72–81 | Demo: 연구노트 | note result first with the figure, citations with page numbers to both papers, a decision answered |
| 3f | 81–90 | Demo: 다시 내 서재로 | 서재에 넣기 → 서재 정리 노트 (note-library); paper → 내 연구에서 쓰인 곳 (Workflow, project, note); 연결 지도 |
| 4 | 90–98 | KIGAM second brain (motion, 개념도) | as v2, version wording |
| 5 | 98–103 | Closing | logo, 내부 검토용 영상 |

Optional (not in the film unless the user picks it): one 자료 소식 beat (hub-feeds) in 3c; ORCID-verified author iD on
the hub entry (orcid) if the hub account already shows one.

Study (one real cycle in the review app, records created only by this study): new authoring draft from `heo2025` with
`astic2020`, the supplementary code and the Pocheon example data as sources (GPT-6.1 Sol, connected subscription picked
per action, no settings change) → registered as the next version of `entry-ap-43431e17-f09` (or a new entry if editing
in place is refused) → new project, start window with example data and both papers attached → one real run, coarse
(≤10 min compute, method kept whole), plus a GeoTIFF map the viewer opens → note with a decision → 서재에 넣기.
## Next steps
<!-- task:closed -->
Closed 2026-10-23T18:18:28Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
## Notes and decisions
- Packages (2026-10-24): (P) parent owns `scene/`, `render.py`, `prepare_data.py`, README, CONTRACT.md, report,
  integration, render; (C) child `gaid-promo-v3-study` ("general work") owns the review-app study, `capture*.py`,
  `CAPTURE.md`, `~/data/geoaidesk/work/gaid-promo-video-v3/` capture-v3 data. Interface: `capture.json` (v2 schema) beats.
  Integration order: scenes with v2 frames as stand-ins → capture-v3 → beats wired → render → report.
- v2 user rules kept: writer does all film work, worker only study/raw takes; promotional film, staging allowed and
  recorded; no area table, no LAS viewer.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-promo-video-v3/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-promo-video-v3-20261023T174817.846561Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: waiting
updated: 2026-10-23T16:22:45Z
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

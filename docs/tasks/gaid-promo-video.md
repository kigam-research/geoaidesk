---
format: 1
status: active
updated: 2026-10-22T15:17:52Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"40606807-71e7-4fa7-a7d3-48f1bbb9cf2c","pid":2972364,"provider":"claude","session":"120e18a1-d9c3-4ad3-b0e8-3ef66952f5e1","start":"56860506","token":"8cb86e941951c14177e4b5acb771aa3d0cbd945ff54669e5475e00c2472b7c76"}
branch: task/gaid-promo-video
target: main
parent: 
---
# gaid-promo-video

## Goal and done criteria
Request from the starter:

# Goal: gaid-promo-video — 90-second GAID promotional motion graphic

## User request (verbatim, 2026-10-22)

> Gaid 시스템에 대해서도 seoul_geomodel 이나 ccs_transport 프로젝트에서 모션그래픽을 생성한것처럼 1분 30초짜리 홍보 모션그래픽을 생성하자. 두 프로젝트에서 어떤관점으로 생성했는지 참조하고 이번 gaid 모션그래픽에서는 소량의 텍스트와 차트들을 적극사용하여 프로젝트의 취지와 gaid 허브와 프로젝트를 만든배경과 독창적인 포인트와 연구자 지원형 플랫폼이 잘드러날수 있게해야한다. 작업은 opus 5.5 high fast로 작업하자. 실제 시스템 모습과 모션그래픽을 적절히 섞어서 마켓팅 프로덕션급으로 생성해야한다.

Done (the user's outcome): a 1 min 30 s promotional video for GAID, marketing-production quality, mixing real
system footage with motion graphics, little text and active use of charts, conveying: the project's purpose,
the GAID hub, why the project was made (background), its original points, and that it is a researcher-support
platform. Plus a report for review and the repo checks that apply.

## References (verified by the hub; read them, do not edit those repos)

- seoul_geomodel (`~/repos/seoul_geomodel`, read-only): reports `reports/2026-10-04-seoul-modeling-motion`,
  `2026-10-06-motion-decisions`, `2026-10-13-intro-video-{20s,30s,v3}`, `2026-10-14-intro-video-v4`,
  `2026-10-21-viewer-v2-video` (latest: 30 s v5, five workflow stages then real operation of the VTK review
  system; real data in every scene except one labelled concept card). Task docs under `docs/tasks/intro-video-*`,
  `motion-decisions.md`, `viewer-v2-video.md`.
- ccs_transport (`~/repos/ccs_transport`, read-only): `reports/2026-10-05-workflow-motion-explainer`,
  `reports/2026-10-22-testbed-motion-video` (40 s silent, 1920×1080 30 fps: 25 s motion design + 15 s real
  visualisation system; motion-design-led rather than text-led for non-specialists; continuous transitions,
  cursor movement, panel highlights taken from seoul_geomodel; the user approved a composition plan before the
  final render). Task docs `docs/tasks/testbed-motion-video*.md`, `workflow-motion-explainer*.md`.
- Use `knowledge-lookup` (seCall) for those sessions' decisions and tooling if the reports leave gaps.

## Facts and constraints for the writer

- Not specified by the user: audio and resolution. Both references were 1920×1080 30 fps; ccs was silent.
  Pick and record, or ask the user if it matters.
- Real system footage: capture GAID with its own instance and sample data under `~/data/geoaidesk/work/<slug>/`
  (KADY_PROJECTS_ROOT / GAID_HOME there); do not disturb the shared review app (PC74, ports 3000/18000) that other
  tasks use. Korean UI, both styles exist (계측 default); follow `docs/design/ui-guide.md` and the brand identity
  (fixed logo, brand blue, Pretendard). No Toss/Apple/Samsung proprietary assets or fonts. Visible names: "AI agent"
  and "GAID" (never Kady/K-Dense/BYOK in copy except the upstream attribution where needed).
- Public release of the institutional brand/logo is still awaiting approval (open item gaid-release-proof#2); state
  in the report that the video uses it and is for internal review until that approval.
- Claims: only what the system actually does (AGENTS.md describes features); no unverified performance, cost or
  support claims; charts must use real or clearly labelled illustrative numbers.
- Tools: `media-craft` skill (ffmpeg/ImageMagick/sox are not installed), `playwright-cli` for captures; KIGAM network
  blocks raw.githubusercontent.com (use `gh api` or codeload).
- Outputs (MP4, frames) go in `~/data/geoaidesk/...`, never in Git (5 MB limit); the report embeds small PNG key
  frames and gives the video locator + sha256; register it in `results/registry.toml` as `review`.
- Outside check: none (not a research goal).
- The 03:00 KST work-hours rule applies to starting new work, not to this unit continuing.

## Current state
- Plan and capture contract written (`geo/promo/CONTRACT.md`); capture child running.
- Parent pipeline works with placeholders: `geo/promo/prepare_data.py` → `~/data/geoaidesk/work/gaid-promo-video/data-v1/data.json`
  (catalogue 0.3.0: 7 기본 Workflow, 17 skills (KIGAM 8, K-Dense 9), 21 data sources; hub entry
  `entry-ap-a135f290-1c4`: 10 steps (2 researcher), 8 start choices, 55 code files, 판 2, 4 installs, 4 stars, 4 comments;
  acceptance citation check 212 units / 1 not on page / 0 contradicted). `geo/promo/render.py --stills-only` renders
  15 stills (preview-01/02 under the work dir); ≈0.16 s per frame without footage.
## Next steps
1. Child `gaid-promo-video--capture` running (writer 64e63574-788e-4fa7-880a-079234fc05e8, Claude Opus 5.5 high, fast_mode; worktree ~/worktrees/geoaidesk/gaid-promo-video--capture). When it finishes: `task complete gaid-promo-video--capture`.
2. Parent: extract real chart numbers (`geo/promo/data/`), build HTML/CSS motion scenes (`geo/promo/scene/`) and
   `geo/promo/render.py` (Playwright Chrome frame stepping → imageio-ffmpeg H.264, reference: ccs_transport
   `scripts/testbed_motion/render.py`). Preview stills, then show the storyboard + stills to the user before the final render.
3. Integrate capture-v1, final render as `task job run`, verify, report, registry entry.
## Failed approaches
## Notes and decisions
- Format: 1920×1080, 30 fps, 2,700 frames, H.264. User decision (2026-10-22, via hub): "무음이고 내부검토용 영상이다."
  → silent (no music, no narration) and an internal review video; no public release intended.
- References read: ccs_transport `reports/2026-10-22-testbed-motion-video` (Chrome/Playwright deterministic frame
  renderer, real UI take with drawn pointer and ripple, user approved the composition before the final render);
  seoul_geomodel `reports/2026-10-21-viewer-v2-video` (workflow stages then real system operation; real data in every
  scene except one labelled concept card).
- User feedback (verbatim, 2026-10-23): "영상에서 카드박스나 글자가 너무작아도 안된다. 시인성을 생각하고 공간여백을 너무
  크게두어서 어색한부분이 생기는것을 조심해야한다." → rules: film text ≥ 24 px at 1080p (headlines 56–64, primary
  labels ≥ 30), cards sized to their content and filling the layout, no large empty areas; footage mostly shown zoomed
  into focus rects (1.3–1.8×); capture viewport changed to 1280×720 @2.25 (child told by message).
- Visual language: GAID 계측 identity (UI guide v2): white faces on aluminium chrome, 45° chamfers, graduated scales,
  orbit = AI agent working, brand blue only as signal, Pretendard, tabular figures; no gradients/glow/AI icons/emoji.
- Real footage from a separate instance with a curated copy of the review app data (`~/.geoaidesk`, read-only); no
  credentials copied, no live model calls; copy-only label clean-ups recorded by the capture child.
- Charts: real numbers only (catalogue counts, hub entry steps/revisions/installs, acceptance-test citation check
  212 units, etc.); any illustrative chart is labelled as such on screen.
- Orchestration: sequential = contract → capture + motion in parallel → integration → final render job.
  Packages: capture child owns `geo/promo/capture*.py`, `geo/promo/CAPTURE.md`, `capture-v1/`; parent owns the rest.
  Integration order: child finish → `task complete` → render.

### Storyboard v2 (90 s; v1 replaced after the user's 2026-10-23 requests on legibility, 서재, latest features, shp viewer)
User (verbatim, 2026-10-23): "그리고 서재기능도 강조되어야한다. 최신기능들이 반영되어있어야한다." · "Gaid시스템에서 shp형식의
맵데이터 뷰어기능들도 소개되어야한다."
| t (s) | Scene | Content |
|---|---|---|
| 0–5 | Opening | Orbit ring + octagonal G, GAID lockup, one line |
| 5–14 | Background | Files scattered per researcher (개념도); real: 55 code files behind one hub Workflow |
| 14–24 | Purpose loop | 서재·자료 → Workflow → AI agent 실행 → 연구노트 → GAID 허브; chart: catalogue 0.3.0 counts |
| 24–41 | GAID hub | Authoring motion (real entry: sources, 8 start choices, 10 steps / 2 researcher); footage H1, H3 (skill shelf); revisions/installs timeline |
| 41–55 | Research run | R1 start settings, R2 Workflow chat, R3 note decisions (Seoul lithology note), R5 LAS |
| 55–64 | Shapefile maps | M1 Seoul 1:250K lithology shp on basemap, M2 attribute/area table; chart: real area by lithology (133 polygons, 2,012.9 km²) |
| 64–78 | 서재 | L1 library folders, R6 page citations + chart (two real checks: 2026-10-21 institute Qwen 34/34, 2026-10-22 acceptance 212 units, 0 wrong page), L2 connection map |
| 78–85 | Eight points | Eight segments around the octagonal G (paper→Workflow, hub, institute hub server, library+citations, notes+decisions, maps/LAS/tables, journal figure check, local model) |
| 85–90 | Closing | Lockup, line, 내부 검토용 |

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

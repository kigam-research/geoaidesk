---
format: 1
status: active
updated: 2026-10-22T14:55:41Z
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
- Plan and capture contract written (`geo/promo/CONTRACT.md`). Capture child to be started.
## Next steps
1. Start child `gaid-promo-video--capture` (Claude Opus 5.5 high, fast mode, per the user's "opus 5.5 high fast").
2. Parent: extract real chart numbers (`geo/promo/data/`), build HTML/CSS motion scenes (`geo/promo/scene/`) and
   `geo/promo/render.py` (Playwright Chrome frame stepping → imageio-ffmpeg H.264, reference: ccs_transport
   `scripts/testbed_motion/render.py`). Preview stills, then show the storyboard + stills to the user before the final render.
3. Integrate capture-v1, final render as `task job run`, verify, report, registry entry.
## Failed approaches
## Notes and decisions
- Format (not specified by the user; recorded): 1920×1080, 30 fps, 2,700 frames, H.264, silent, like both references.
- References read: ccs_transport `reports/2026-10-22-testbed-motion-video` (Chrome/Playwright deterministic frame
  renderer, real UI take with drawn pointer and ripple, user approved the composition before the final render);
  seoul_geomodel `reports/2026-10-21-viewer-v2-video` (workflow stages then real system operation; real data in every
  scene except one labelled concept card).
- Visual language: GAID 계측 identity (UI guide v2): white faces on aluminium chrome, 45° chamfers, graduated scales,
  orbit = AI agent working, brand blue only as signal, Pretendard, tabular figures; no gradients/glow/AI icons/emoji.
- Real footage from a separate instance with a curated copy of the review app data (`~/.geoaidesk`, read-only); no
  credentials copied, no live model calls; copy-only label clean-ups recorded by the capture child.
- Charts: real numbers only (catalogue counts, hub entry steps/revisions/installs, acceptance-test citation check
  212 units, etc.); any illustrative chart is labelled as such on screen.
- Orchestration: sequential = contract → capture + motion in parallel → integration → final render job.
  Packages: capture child owns `geo/promo/capture*.py`, `geo/promo/CAPTURE.md`, `capture-v1/`; parent owns the rest.
  Integration order: child finish → `task complete` → render.

### Storyboard v1 (90 s)
| t (s) | Scene | Content |
|---|---|---|
| 0–6 | Opening | Orbit ring draws around the octagonal G; GAID lockup; one line: 지구과학 연구자를 위한 AI agent 작업 공간 |
| 6–18 | Background | Papers, code, data and notes scattered per researcher; methods stay in papers; general chat leaves no reusable method. Minimal text. |
| 18–30 | Purpose loop | Orbit loop: 자료·논문 → Workflow → AI agent 실행 → 연구노트 → GAID 허브 → next researcher. Chart: real catalogue composition. |
| 30–50 | GAID hub | Motion: paper → questions with recommended options → Workflow steps (real entry) → 판 1 → 판 2; real footage H1, H2; chart: entry readouts (steps, skills, installs, revisions). |
| 50–75 | Researcher support | Real footage R1–R6: start settings, Workflow chat, research-note decisions, map, LAS, page citations; chart: citation check from the 2026-10-22 acceptance test. |
| 75–84 | Original points | Instrument-panel summary of what is GAID-specific (paper→Workflow, institute hub, geo viewers, notes with decisions, observed provenance, local models). |
| 84–90 | Closing | Lockup, one line, hold. |
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

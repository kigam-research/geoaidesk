---
format: 1
status: waiting
updated: 2026-10-16T08:46:03Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"20ad37cf-9bc9-4ad3-962f-7032db897bf4","pid":415644,"provider":"codex","session":"01a143e3-e983-79e0-9525-de41b13ba6d6","start":"2831125","token":"039d25a0e0b86aec275011c693c4488034e3cc00174d4a99f3fab0932b56436b"}
branch: task/gaid-ui-guide--screens
target: task/gaid-ui-guide
parent: gaid-ui-guide
---
# gaid-ui-guide--screens

## Goal and done criteria
Request from the starter:

# Child brief: gaid-ui-guide--screens (geoaidesk)

Goal: show the effect of the new GAID UI guide on three representative existing screens as before/after images, for
the parent's report and for visual review. Parent: gaid-ui-guide (Claude writer). Guide: `docs/design/ui-guide.md`
(read sections 1–10 fully), values `geo/ui/ui-rules.json`, tokens `geo/copy/gaid-app.css`, copy rules
`geo/copy/gaid-writing.md` + `geo/copy/terminology.csv`.

User words (verbatim) the guide carries:
- "사람 이용자들이 읽어야 하는 글자량이 너무 많으며, 스크롤이 한없이 아래로 내려가게 되어 있어 불친절하고 처음 사용자의 유입을
  떨어뜨리게 한다. 그리고 가급적 현재 사용자가 에이전트 작업하는 방식처럼 질문에 대해서는 권장 옵션을 포함한 선택지가 제공되어야
  하고, ... 기타 입력란을 제공하는 방식으로 하고 한번에 한 개의 질문을 하며, 질문은 탭으로 이전/다음으로 이동할 수 있게 ...
  흐름도 및 명료한 설명으로 인지부하를 낮추면서도 의도가 잘 반영될 수 있게"
- Map panels: legend and basic info beside the map without scrolling; attribute tables with column filter/sort; feature
  info as a map popup. Agent-internal details (model names, run logs, raw errors) must not be shown to researchers.

Screens:
1. Workflow start setup dialog (`web/src/geo/workspace/task-setup.tsx`, opened from the Workflows panel row → TaskSetup),
   ideally for a geoscience workflow with several inputs/choices. After: guide Q1–Q6 (stepper, one question per step,
   recommended option first with `권장`, `기타 (직접 입력)`, step tabs + 이전/다음, flow diagram on the first step,
   summary step with the single primary action), D2, B1, W5.
2. Map viewer (`web/src/geo/viewers/map/`) with the vector sample `user_data/samples/vector/seoul_geology_250k/Seoul_Geology_250K_Litho.shp`
   and a feature popup open. After: MAP1–MAP5, P2/P3, W5/W6, R1 (no "whole layer for display; no geometry"-style
   internals), X1–X4 for the attribute table.
3. Method detail dialog (`web/src/geo/methods/methods.tsx`, Workflows → installed method detail with a GAID trial record).
   After: P1/P3, R1–R4 (no model name, chat id, tool-call counts), D2, G1/G2, F5.

Deliverables (owned files):
- `reports/2026-10-16-gaid-ui-guide/figures/` — PNG pairs `01-setup-before.png`, `01-setup-after.png` (for the stepper
  also one `01b-setup-after-summary.png` if useful), `02-map-before.png`, `02-map-after.png`, `03-method-before.png`,
  `03-method-after.png`; 1440×900 viewport, Korean UI, each file under 400 KB (resize/compress if needed; no other tools
  than what is installed — ImageMagick/ffmpeg are not installed; Playwright screenshots with `type: png`/scale are fine).
- `docs/design/mockups/<screen>.html` — the after mockups as self-contained static HTML (inline CSS copied from the
  `gaid-app.css` variables; no external libraries, fonts or network requests; Korean text; font stack from gaid-app.css,
  falling back to locally installed fonts). They are reference implementations for later UI units, so keep them clean
  and show the real content of the before screen rewritten per the guide (do not invent capabilities or numbers; keep
  required limit wording such as 추정/미시험/검토 전 in one line with detail behind `자세히`).
- `docs/design/mockups/README.md` — per screen: before source (live capture SHA or reused figure path), the rule ids each
  after applies, and what was removed/moved (with the destination, e.g. "moved behind 기술 정보").
- In your task document `## Current state`: the list of files and the per-screen rule ids, for the parent's report.

Before images: capture from the current app at this branch's base where practical: run a throwaway instance from your
worktree on free ports (not 3000, 8000, 18000 — 3000/18000 are the user's review instance `gaid-review`; never touch,
restart or write to it or to `~/.geoaidesk`), with `KADY_PROJECTS_ROOT` and any data home under
`~/data/geoaidesk/work/gaid-ui-guide--screens/`. You may COPY the sample files read-only from
`~/.geoaidesk/projects/default/sandbox/user_data/samples/`. Use the `playwright-cli` skill for screenshots. If a
before state needs a paid model run or an installed hub method you cannot set up locally within reason, reuse an
existing figure instead and say so: `reports/2026-10-16-gaid-hub-integration/figures/02-method-detail-after.png`
(method detail, main 0679b17) and `reports/2026-10-12-gaid-map-table-ux/figures/01-map-panel-popup.png` (map) are
acceptable fallbacks; recapture is preferred for the setup dialog and the map.

Constraints: no app code edits (`web/`, `server/`), no paid model runs, no new dependencies. Network note: the KIGAM
network blocks raw.githubusercontent.com; use `gh api` or codeload.github.com if anything must be fetched. Stop the
throwaway instance and remove build caches and app-written files/links in the worktree after the last capture
(`git status` clean except your deliverables). Checks: run `node geo/ui/check-ui.mjs` and
`node --test geo/tests/ui-check.test.mjs` (your files do not touch locales, so they should stay green); full
`scripts/check` is not required for this child. Finish with `task finish`.

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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

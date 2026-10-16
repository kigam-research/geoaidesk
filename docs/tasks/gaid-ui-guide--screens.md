---
format: 1
status: done
updated: 2026-10-16T14:45:03Z
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
Delivered three standalone Korean HTML references in docs/design/mockups/{setup,map,method}.html and source/rule notes in docs/design/mockups/README.md.
Delivered eleven PNGs in reports/2026-10-16-gaid-ui-guide/figures/: seven 1440×900 before/after/summary figures and four 1280×800 after/summary checks, all below 400 KB.
Setup/map before figures are live captures from fed75bc3 (app sources unchanged); method before reuses the permitted gaid-hub-integration figure. No model runs or app code/locale changes.
Rules: setup Q1–Q6 D2 B1 W5 L6 N2; map MAP1–MAP5 X1–X4 P2/P3 W5/W6 R1 B4; method P1/P3 R1–R4 D2 G1/G2 F5 W5 L6.
Verified: both viewport sizes have no page overflow, visible primary actions and 197/262/270 visible UI characters; map panel needs no initial scroll. Step persistence/validation/arrows/summary/Escape, numeric sort, 37/133 lithology filter, 22-field record and retained scientific limits passed browser checks.
Declared checks passed: node geo/ui/check-ui.mjs (0 errors; 96 pre-existing debt entries), node --test geo/tests/ui-check.test.mjs (5 passed). Full scripts/check is not required by the child brief; any additional CLI-enforced finish gate is reported separately. Reverify by opening the references and rerunning those two commands; external browser evidence is in ~/data/geoaidesk/work/gaid-ui-guide--screens/visual-check.log.
Capture job exited 0; ports 3347/18347 released; external snapshot caches and dependency links removed. User review instances and ~/.geoaidesk unchanged.
## Next steps
<!-- task:closed -->
Closed 2026-10-16T14:45:03Z: integrated into gaid-ui-guide; closed with it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- The isolated launcher omitted KADY_FRONTEND_PORT, so browser CORS blocked its non-default port. Playwright bridged requests to the same isolated API without changing responses or source.
- Automation blocks file:// URLs and does not expose require() in run-code. Static HTML was loaded through Playwright route fulfilment from an external replay snippet, with no network requests.
- Label lookup did not match the map's existing combobox; role/name lookup selected the observed control. No source workaround.
## Notes and decisions
Execution plan: sequential source/content verification → before capture → self-contained mockups → visual checks → publication.
Owned files: docs/design/mockups/*, reports/2026-10-16-gaid-ui-guide/figures/* and this task document.
No delegated writers or nested units. Shared interface is the parent's existing guide and token values; integrate images/README after this child finishes.
Runtime isolation: use only ~/data/geoaidesk/work/gaid-ui-guide--screens for app data; never write to user review instances or ~/.geoaidesk.
- Prototype limits: sample-specific recommendations are proposed defaults, not catalogue facts. A production CRS-unknown step must be conditional on inspection. Method start links to the map setup reference only to demonstrate separate navigation. Dark mode/200% zoom are not checked; this is not a release accessibility audit.
- The canonical report belongs to the parent. No separate child report or UI-baseline debt was added. Humanizer file-mode prose pass applied to the README; technical values and source references preserved.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Parent report: reports/2026-10-16-gaid-ui-guide/index.md. Child-owned source/verification notes: docs/design/mockups/README.md.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-ui-guide--screens-20261016T084840.096516Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

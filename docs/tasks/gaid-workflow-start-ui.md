---
format: 1
status: active
updated: 2026-10-23T08:49:58Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"2f9e2449-5478-49ce-bda9-905940bc1376","pid":2215228,"provider":"claude","session":"839f4e31-b041-486a-b080-352989dcf135","start":"62613024","token":"9b47fa3d33263728d39d99edef8dc6760a706164bcbf9056c2b888fb651b313a"}
branch: task/gaid-workflow-start-ui
target: main
parent: 
---
# gaid-workflow-start-ui

## Goal and done criteria
Request from the starter:

# Goal: gaid-workflow-start-ui — one consistent Workflow start window that first explains the Workflow

## User request (verbatim, 2026-10-23)

> GAID 시스템에서 Workflow를 동작하려고 개별 워크플로우를 클릭하면 첨부한 이미지처럼 일관성이 없게 나타난다. 특히 커스텀한 geoscience 워크플로우는 어떤 기능인지에 대한 설명도 없으며 바로 관련자료를 입력 받게 하고 있다. 현재 구조자체는 사용자 친화적이긴하지만 워크플로우가 어떤 기능을 제공하는지에 대한 이해가 없으면 이용자들은 이용하지 않는다. 두번째 첨부한 기존 BYOK 워크플로우의 경우에는 단순하지만 설명은 있다. 하지만 결과적으로 시스템은 일관성이 있어야 하는데 커스텀 하는 것과 기존 워크플로우를 불러오는 창의 모습이 다른것은 ui/ux 측면에서 개선이 필요한 부분이라고 생각한다.

Screenshots the user attached (review app): `~/data/geoaidesk/work/hub-requests/workflow-start-ui/01-custom-geoscience-start.png`
(PU-컨포멀 탐사 존 분류 (새 지역): no description, starts at "격자 표 CSV" file pick; 11-step rail with truncated labels
"격자 …"; file candidates mix `outputs/` and `user_data/prior_results/` results) and `02-byok-start.png` (논문 작성, upstream
BYOK Workflow: one-line description and 출처: K-Dense badge, different layout: sandbox file picker, required field, English
prompt preview, model chip "GPT-6 Astra 연결 안 됨").

The hub confirmed this understanding and three decisions; the user answered (verbatim):

> Opus 5.5 high fast로 진행하고 모두 권장대로 진행하자.

## Done (user's outcome + accepted decisions)

1. Every Workflow — 기본 Workflow (catalogue), hub-installed Workflows and 일반 Workflow (upstream BYOK) — opens the same start
   window. It first shows what the Workflow does (purpose, required data, outputs, main steps, limits, whether example data
   exists), then data and analysis conditions, then a summary and the one start action. Reuse the existing Workflow doc /
   `workflow-view.tsx` content rather than inventing new copy sources; the step rail must stay readable with many steps.
2. Order (decision 1 가): design first — mockups of the unified start window in both styles (계측/도폭) and both themes at
   1440×900 and 1280×800 (UI guide v2 §12), shown to the user for approval via `task review-copy`; implement after the
   user approves AND unit B gaid-workflow-example (example-data selection in the start settings) is on main; rebase onto E
   gaid-hub-versions' version display if it merges first.
3. BYOK prompt (decision 2 가): collapsed by default under "AI agent가 받는 지침", editing kept as today.
4. File candidates (decision 3 가): only files whose format fits the input; raw data (`user_data/`) first; earlier results in
   a separate collapsed "이전 결과" group.
5. Checks: scripts/check; UI guide v2 (read §1, §2, §10 and the components touched; report lists rule ids) and copy rules
   (locales, Korean first). Design as an impeccable + design-taste-frontend + brand-guide expert (user rule, AGENTS.md).

Files today: `web/src/geo/workspace/task-catalogue.tsx`, `task-setup.tsx`, `setup-steps.tsx`, upstream `WorkflowsPanel`
(`extension` prop) and the upstream workflow launch dialog for 일반 Workflow. Running units touching nearby code:
B gaid-workflow-example (start settings: example data), E gaid-hub-versions (version labels), C gaid-authoring-sources,
A gaid-note-library, D gaid-pocheon-trial (uses the review app). Do not restart or change the review app; capture
screens from an own instance under `~/data/geoaidesk/work/<slug>/`. Outside check: none.

## Current state
- Implemented on the branch (design approved 2026-10-23, unit B merged in at 5b724939): one start window for every Workflow
  (`web/src/geo/workspace/start-window.tsx`, 920 px, left `StepList` `web/src/geo/shell/step-list.tsx` + `.gaid-steplist-*` in
  globals.css), Workflow 소개 first (`start-intro.tsx`), file groups 내 자료/이전 결과 + F17 name matching and summary flag
  (`setup-steps.tsx`, `task-setup.tsx`), 일반 Workflow adapter (`upstream-start.tsx`) through `extension.renderLaunch` in
  `web/src/components/workflows-panel.tsx` (boundaries updated). Only researcher-saved start settings (`resume`) skip the intro.
  Docs: AGENTS.md Workflow panel, ui-guide §0/D2/Q4, ui-rules `sheetPx.workflowStart`, glossary (2 terms).
- Verified: web `npx tsc --noEmit` clean; `npx vitest run src/geo src/components/workflows-panel.test.tsx` all pass except the
  map viewer test timing out under load 35 (passes alone, 9/9); copy 0 errors; check-ui 0 errors. Own app instance (ports
  3392/18392, data `~/data/geoaidesk/work/gaid-workflow-start-ui/home/`, unit `gaid-wfsu-app`, stopped) with a Yilgarn project
  copy: 48 screenshots `app-shots/` (both styles, both themes, 1440/1280) and a live 일반 Workflow start (draft + file in a new chat).
- Full scripts/check run 1: `~/data/geoaidesk/work/gaid-workflow-start-ui/check-1.log` (result below when done).
## Next steps
1. Read check-1.log; fix failures; then task finish (report declared below).
## Failed approaches
## Notes and decisions
- F17 (from gaid-pocheon-trial via hub request h-f17, 2026-10-23) accepted into the implementation, inside decision 3
  (file candidates): unit B already starts inputs on example data when the researcher has no own file. Still to do here:
  (a) order each input's candidates by how well the file name matches the role (role id and label tokens, e.g.
  `aeromag-lines` ↔ `aeromag_lines.csv`), best match first; (b) an optional input starts on a fitting project file whose
  name matches the role (exactly one such match), instead of "사용하지 않음"; (c) the summary flags an optional input left
  unused while a fitting project file exists ("맞는 파일이 있지만 쓰지 않음"), so a recipe-default start is not silently a reduced
  method. Column-based matching is not planned (it would read file contents in the browser); name matching only.
- User decision 2026-10-23 (verbatim): "시안 및 선택 모두 권장대로 진행하자." → step rail 나) left list of every step name
  in a 920 px sheet (D2 width exception, reported); 일반 Workflow 가) start draft in a new chat (no model chip in the window,
  model chosen in the composer; button `시작 초안 만들기`); plus F17 as planned above.
- Plan (2026-10-23): sequential. Design → user approval → wait for B on main → implement. Implementation is tightly coupled
  (one shared start window used by TaskSetup and the upstream WorkflowLaunchDialog seam), so the writer does it alone; a
  child writer only if the BYOK adapter turns out large. Owned files: `web/src/geo/workspace/{task-setup,setup-steps}.tsx`,
  new `web/src/geo/workspace/start-intro.tsx` (Workflow 소개 step), `web/src/geo/shell/step-scale.tsx` (grouped scale),
  locales `workspace`, upstream seam `web/src/components/workflows-panel.tsx` (WorkflowLaunchDialog → GAID start window;
  add to `geo/integration-boundaries.json` before editing). Integration order: rebase onto B, then E if E merged.
- Design principles for the mockup: one window for all kinds; step 0 "Workflow 소개" from WorkflowDoc (purpose, inputs +
  example-data state, choices count, outputs, main steps, limits) or, for 일반 Workflow, from its description/placeholders
  (missing sections are omitted, never invented); step scale grouped (소개 · 입력 자료 n · 분석 조건 n · 요약) so 11+ steps
  stay readable; file candidates = fitting formats only, `user_data/` first, others under collapsed 이전 결과; 일반 Workflow
  prompt collapsed under "AI agent가 받는 지침" with editing kept.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-workflow-start-ui/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: waiting
updated: 2026-10-23T06:49:42Z
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

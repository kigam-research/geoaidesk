---
format: 1
status: ready
updated: 2026-10-23T14:53:27Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"08164288-7806-46a6-9e82-956577998a76","pid":790060,"provider":"claude","session":"f9dbf0b8-76e0-462b-b70b-5ced3cf12897","start":"64608299","token":"7a4c953115a20fde3c930ab89ac5a15005cbbdc2c3a944e2bab8d7766326cb7a"}
branch: task/gaid-workflow-stages--gaid-stages-window
target: task/gaid-workflow-stages
parent: gaid-workflow-stages
---
# gaid-workflow-stages--gaid-stages-window

## Goal and done criteria
Request from the starter:

# Child unit gaid-stages-window (parent gaid-workflow-stages)

## Goal
The Workflow start window shows Workflows by analysis-flow stage: rail = 소개 → stage pages → 요약, at most 7 entries.
One stage page takes every input (several files) and every choice that stage uses. Labels readable at 1280×800.

User words (2026-10-23, verbatim): "사용자가 검토했을 때 워크플로우의 단계가 너무 많아서 팝업 창에서도 눈금 단계가 매우좁게 표현되는 것을
확인하였다. ... 하나의 단계에서 여러 자료를 입력 받을 수 있게 하면 단계수도 충분히 줄일 수 있다고 생각한다. 또한, 단계를 무분별하게
나누는 것이 아니라 데이터 분석 흐름 또는 연구 분석 흐름 절차에 맞게 나누어야 한다." Accepted plan items 1 and 3 (display part).

## Settled interface (parent commit 9949b08d, do not change; ask the parent if it must change)
- `web/src/geo/contracts/workflow-stages.ts`: `workflowStages({inputRoles, choices, steps})` → `{kind: "flow"|"grouped",
  stages: [{id, title|null, inputIds, choiceIds, defaultIds}]}`; `MAX_RAIL` = 7. Build the shape from
  `workflow.inputRoles`, `workflow.requiredScientificChoices` and `workflow.doc?.steps ?? []`. `grouped` pages are
  `inputs` (입력 자료) and `choices` (분석 조건); for `grouped` you may sub-head the choices page by the step that names
  them (doc steps' `choiceIds`) so a long page stays readable — your call.
- `WorkflowInputRole.multiple?: boolean`: the input takes several files (e.g. survey lines + base-station record).
  Binding = `string[]`; `WorkflowDocSettings.inputs` is `Record<string, string | string[]>` (`settingPaths` joins).
  `OptionCard` already has a `multiple` (checkbox) mode.
- `WorkflowChoice.default?: string` (option id, or text without options): a parameter. Starts answered with the default
  (a saved recipe value or unresolved state still wins), shown folded on its stage page ("기본값 n개" style) and listed in the
  summary in its own group, editable there (Edit → its stage page with the fold open, or inline — your call).

## Scope
- `web/src/geo/workspace/{setup-steps,task-setup,start-window,start-intro,upstream-start,api}.ts(x)` and their tests,
  `web/src/geo/shell/step-list.tsx` if needed, locale namespace `web/src/geo/locales/workspace/` (Korean first, then
  English with the same meaning). 일반 Workflow (`upstream-start.tsx`) keeps working through the same window.
- Next is blocked on a stage page while a required input on that page has no file; the position text ("입력 자료 1 / 2")
  becomes stage-based. Example data, name matching (F17), uploads and the summary's F17 note keep working per input.
- Do not edit `web/src/geo/contracts/*`, server code or `web/src/geo/hub/*` (child B owns those). A parallel unit
  gaid-workflow-cite-scope also touches start settings; keep your diff focused so the later rebase is easy.

## Checks and evidence
- `cd web && npx tsc --noEmit && npx vitest run src/geo` ; `node geo/ui/check-ui.mjs` ; `node geo/copy/validate-copy.mjs web/src/geo/locales`.
  The full `scripts/check` runs at the parent.
- Tests: Pocheon-like (6 inputs, 15 choices, 10 steps → rail ≤ 7), PU-컨포멀-like (catalogue, legacy steps), a new-form
  Workflow (3-5 stages with inputIds, a multiple input, defaults) — rail length, page contents, multi-file binding in the
  rendered start message, defaults in summary.
- Screenshots (UI guide v2 `docs/design/ui-guide.md` sections 1, 2, 10 + components you touch; section 12 checklist):
  Korean, both styles (계측, 도폭) and both themes at 1440×900 and 1280×800, of the start window for (a) the real Pocheon
  0.2.0 Workflow (`~/data/geoaidesk/work/gaid-pocheon-trial/authoring-pass2-revise.json`, `drafts[-1].workflow`),
  (b) PU-컨포멀 (catalogue), (c) a new-form Workflow — rail and one stage page each; summary for (c). Run your own app instance
  (data under `~/data/geoaidesk/work/gaid-stages-window/`, free ports); do NOT touch the review app
  (PC74 :3000/:18000) or the institute hub server. Put the PNGs you want in the report under
  `reports/2026-10-23-gaid-workflow-stages/figures/` (small PNGs) and write a section text for the parent's report in
  `reports/2026-10-23-gaid-workflow-stages/start-window.md` (Korean, result first; rule ids followed/broken; string ids and
  ko/en before→after for changed copy).
- Tests must not delay the goal and must not lower quality: no real analysis runs are needed for this package.

## Allowed
Edit owned files, run local instances and tests, `task save`, `task finish` of this child unit. KIGAM network blocks
raw.githubusercontent.com (use `gh api` or codeload).

## Current state
- Start window is stage-based (code done, checks pass): `setupSteps` builds 소개 → `StagePage` per `workflowStages` stage → 요약.
  Flow pages titled by the step (rail group "분석 단계", position "분석 단계 n / m"); grouped pages 입력 자료 / 분석 조건
  (position "시작 설정 n / 2"; the conditions page sub-heads by doc step when > 3 conditions). Rail items carry a hint
  ("자료 2개 · 조건 3개 · 기본값 1개"). `multiple` inputs: checkbox cards, `{mode:"files"}` answer, binding `string[]`,
  start message joins paths (`workflowStartMessage` type widened in `web/src/geo/workflow/render.ts`, one line outside the
  listed scope). Defaults: start answered, folded "기본값이 있는 조건 n개" per page, own summary group, "기본값" hint line
  when unchanged; Edit on a default opens its page with the fold open and scrolls to it. Pages with several inputs show a
  chosen file alone ("다른 파일 고르기 n"). 일반 Workflow: 소개 → 자료 → 분석 조건 (all placeholders on one page) → 요약.
- Verified: `cd web && npx tsc --noEmit && npx vitest run src/geo` (354/355; `src/geo/viewers/map/viewer.test.tsx` "inspects before
  paging …" times out at 5 s in the full run (twice), passes alone (9/9); viewers untouched here), `node geo/ui/check-ui.mjs` (0 errors), `node geo/copy/validate-copy.mjs web/src/geo/locales`.
- Own instance: unit `gaid-stages-window-app` (systemd --user), ports 3393/18393, GAID_HOME
  `~/data/geoaidesk/work/gaid-stages-window/home`, project proj-980e47 with methods from `scripts/build_methods.py`.
  Shots `~/data/geoaidesk/work/gaid-stages-window/shots/` (`scripts/appshot.sh`); `/geo/methods` is route-patched with
  `multiple`/`default` because the server summary mapping is package B's (not in 9949b08d).
- Report section: `reports/2026-10-23-gaid-workflow-stages/start-window.md` + `figures/start-*.png`.
## Next steps
<!-- task:closed -->
Closed 2026-10-23T14:53:27Z: ready; the parent gaid-workflow-stages integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

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

---
format: 1
status: waiting
updated: 2026-10-23T12:22:16Z
writer: {"host":"seongin3","reserved":"7a4c953115a20fde3c930ab89ac5a15005cbbdc2c3a944e2bab8d7766326cb7a"}
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

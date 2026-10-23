---
format: 1
status: waiting
updated: 2026-10-23T12:22:30Z
writer: {"host":"seongin3","reserved":"45e701729c20935a809ee5c0dc969917a87d51fda09f45623643a3747ef33df8"}
branch: task/gaid-workflow-stages--gaid-stages-authoring
target: task/gaid-workflow-stages
parent: gaid-workflow-stages
---
# gaid-workflow-stages--gaid-stages-authoring

## Goal and done criteria
Request from the starter:

# Child unit gaid-stages-authoring (parent gaid-workflow-stages)

## Goal
Workflow authoring and checks produce Workflows organised by analysis-flow stage, with a step cap. Accepted plan items 2
and 3 (data/check part).

User words (2026-10-23, verbatim): "워크플로우의 적정 단계로 최대 단계 수를 설정할 필요가 있으며, 하나의 단계에서 여러 자료를 입력 받을 수
있게 하면 단계수도 충분히 줄일 수 있다고 생각한다. 또한, 단계를 무분별하게 나누는 것이 아니라 데이터 분석 흐름 또는 연구 분석 흐름 절차에
맞게 나누어야 한다. 항목별로 나누면 워크플로우라기보다는 절차서가 되어버리고 더더욱 특정 과업에만 맞춘 워크플로우가 되버릴 수 있다."
Plan 2: stages follow the research/data-analysis flow (e.g. 자료 준비 → 처리·모델링 → 평가 → 해석·결과), never one per item;
`workflow.steps` 3-5; each step records the input roles it uses (`inputIds`) and its choices; an input role may take several
files (`multiple`); at most 6 required scientific choices — other parameters get a `default` (shown and editable in the start
summary). The package/registration check warns on more steps/choices or item-by-item splitting. Plan 3: stored data is never
rewritten; editing/re-registering upgrades to the new form (version bump chosen by the registrant, existing gaid-hub-versions).

## Settled interface (parent commit 9949b08d, do not change; ask the parent if it must change)
- `web/src/geo/contracts/workflow-stages.ts`: `stageWarnings(shape)` codes `stage-count|required-choices|item-split|
  unmapped-input|unknown-input`, limits `MIN_STAGES`/`MAX_STAGES` 3/5, `MAX_REQUIRED_CHOICES` 6, `hasDefault`.
- `GaidWorkflowStep.inputIds?`, `WorkflowInputRole.multiple?`, `WorkflowChoice.default?` (option id, or text when there
  are no options), same in `LocalWorkflow` (contracts/authoring.ts). Server `workflowDocFor` already passes `inputIds`/`multiple`.

## Scope
1. `server/src/geo/authoring/prompts.ts` (bump both prompt versions): stage rule and examples, `inputIds`, `multiple`,
   ≤ 6 choices without default, `default` for the rest (a researcher decision or the paper's value written as such may
   be a default; never hide a choice that changes the scientific result behind a default without saying so in `why`),
   3-5 steps; keep the existing rules (whole method kept, run-scale, headings = step titles, etc.).
2. `agent.ts` / `workflow.ts`: keep `inputIds`, `multiple`, `default` through normalisation; validate refs; for fresh model
   output treat `stageWarnings` as repair errors (one repair round as today); `workflowProblems` keeps accepting older drafts
   so they can still be packaged. `procedureFor` may carry inputs into Atlas nodes if useful.
3. Package/registration check (`package.ts`, receipt): a warning item (e.g. `workflow-stages`) listing the stage warnings in
   researcher words; registration preview shows it. Hub draft/entry screen (`web/src/geo/hub/*`, namespace `hub*`): show the
   warning and offer one action that revises the draft into analysis-flow stages (existing revise path with fixed feedback;
   the researcher reviews the result as with any revise). This is the upgrade path for older entries when edited.
4. `server/src/geo/methods/method-file.ts`: validate `steps[].inputIds` (must name inputRoles), `inputRoles[].multiple`
   (boolean), `requiredScientificChoices[].default` (string; one of options when options exist). Map `multiple`/`default` into
   `GeoWorkflowSummary` (`server/src/geo/workspace/workflows.ts` and wherever installed methods are summarised) and keep
   recipes/suggestions consistent (a defaulted choice is not "still to decide").
5. Evidence: regenerate the Pocheon draft with the new prompt from the stored analysis
   (`~/data/geoaidesk/work/gaid-pocheon-trial/authoring-pass2-analyzed.json` and the pass-2 decisions; the 0.2.0 Workflow is
   `authoring-pass2-revise.json` `drafts[-1]`), GPT-6.1 Sol high as in gaid-pocheon-trial, through your own GAID instance
   (data under `~/data/geoaidesk/work/gaid-stages-authoring/`). Do NOT touch the review app (PC74 :3000/:18000) or
   the institute hub server. Do not read or copy credential files (auth.json, .env); if no model login is usable from your
   instance, stop that step and report the one needed user action to the parent. Show: steps 3-5 by analysis flow,
   ≤ 6 required choices, inputIds covering every input, the method still whole (all processing steps, both PGI variants, both
   boundaries, sensitivity screen, reference comparison), package check result. Save the draft JSON next to your data and
   summarise in `reports/2026-10-23-gaid-workflow-stages/authoring.md` (Korean, result first; string ids and ko/en before→after
   for changed copy). No real analysis run is needed; at most one, coarse (≤ 10 min), only if the draft check leaves doubt.

## Checks
`cd server && npm run typecheck && npx vitest run test/geo*` (focused), `cd web && npx tsc --noEmit && npx vitest run src/geo/hub`,
`node geo/copy/validate-copy.mjs web/src/geo/locales`, `node geo/ui/check-ui.mjs`. Full `scripts/check` runs at the parent.
Do not edit `web/src/geo/contracts/*` or `web/src/geo/workspace/*` (child A owns the start window).

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

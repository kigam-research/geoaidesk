---
format: 1
status: waiting
updated: 2026-10-23T12:14:47Z
writer: {"host":"seongin3","reserved":"799e471fc41f44a2c90af702d37a6ff5c16d31130fa1f1267804187c01e43247"}
branch: task/gaid-workflow-stages
target: main
parent: 
---
# gaid-workflow-stages

## Goal and done criteria
Request from the starter:

# Goal: gaid-workflow-stages — Workflows organised by analysis-flow stages, with a step cap, in authoring and the start window

## User feedback and decisions (verbatim, 2026-10-23)

> gaid-pocheon-trial와 관련해서는 권장으로 진행한다. 그런데 사용자가 검토했을 때 워크플로우의 단계가 너무 많아서 팝업 창에서도 눈금 단계가 매우좁게 표현되는 것을 확인하였다. 이것은 워크플로우 생성 기능과도 관련있다고 생각한다. 워크플로우의 적정 단계로 최대 단계 수를 설정할 필요가 있으며, 하나의 단계에서 여러 자료를 입력 받을 수 있게 하면 단계수도 충분히 줄일 수 있다고 생각한다. 또한, 단계를 무분별하게 나누는 것이 아니라 데이터 분석 흐름 또는 연구 분석 흐름 절차에 맞게 나누어야 한다. 항목별로 나누면 워크플로우라기보다는 절차서가 되어버리고 더더욱 특정 과업에만 맞춘 워크플로우가 되버릴 수 있다. 사용자의 피드백을 확인한 후 어떻게 개선하도록 작업할지 보고먼저 하자. 작업은 opus 5.5 high fast writer들로 작업해야한다.

The hub reported the cause and plan; the user answered:

> 권장으로 진행하자. 그리고 예제 테스트를 할 때에는 테스트가 주요 작업 목표의 달성을 지연시키지 않으면서도 품질은 떨어지지 않는 범위에서 수행해야함을 유의하자. 이미 예제 테스트를 수행하는 방식을 기억하고 있을 것으로 안다.

## Verified cause (hub)

The start window rail is built as intro + one step per input role + one step per required scientific choice + summary
(`web/src/geo/workspace/setup-steps.tsx` lines ~23-33), so the Pocheon Workflow ("항공자력·시추 코어 PGI 광체 추정", 6-8 inputs, ~10
choices) shows ~20 ticks and PU-컨포멀 11. Authoring only limits `workflow.steps` to 3-12 (`server/src/geo/authoring/prompts.ts`
~153/177); nothing limits inputs/choices, and steps link to choices (`choiceIds`) but not to inputs.

## Done (accepted plan, decisions 1-3 = 가)

1. Start window by analysis-flow stage: rail = 소개 → analysis stages → 요약, at most 7 ticks (3-5 stages). One stage page takes all
   inputs (several files) and choices that stage uses. Labels readable at 1280×800.
2. Authoring: stages follow the research/data-analysis flow (e.g. 자료 준비 → 처리·모델링 → 평가 → 해석·결과), never one per item;
   `workflow.steps` 3-5; each step records the input roles it uses (new field, e.g. `inputIds`) and its choices; an input role may
   take several files (e.g. lines + base station); at most 6 required scientific choices — other parameters become defaults shown and
   editable in the summary. The package/registration check warns on more steps/choices or item-by-item splitting.
3. Existing Workflows: stored data never rewritten; the start window groups them by display only (with `choiceIds`/new input mapping
   when present, else two pages "입력 자료" and "분석 조건"); editing/re-registering upgrades to the new form (version bump chosen
   by the registrant, per gaid-hub-versions).
4. One unit; split into child units (task start --parent) only if the work is large.
5. Checks: scripts/check; UI guide v2 (sections 1, 2, 10 + components touched; Korean screenshots both styles/themes at 1440×900
   and 1280×800) and copy rules ("version", not 판).

## Example tests (user rule above)

Tests must not delay the main goal and must not lower quality. As in gaid-pocheon-trial: coarse resolution and loose tolerances,
each analysis run within 10 minutes, the method kept whole. Prefer checking the start window grouping and a regenerated draft without
re-running the full analysis; at most one real analysis run per Workflow you re-author (Pocheon example data are in
`geo/examples/pocheon-pgi/`, asset `pocheon_pgi_example`). Verify: Pocheon (~20 ticks) and PU-컨포멀 (11) fit in ≤7.

## Coordination

Running: gaid-workflow-cite-scope (F23 attach source papers on install/start settings, F21 registration preview shows bundled
examples) — it touches the start settings and the registration preview; whoever merges second rebases. Do not touch the review app
(PC74, loopback-only) or the institute hub server (7703739a); the hub deploys after integration (say if a hub-server change is needed).
Outside check: none.

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

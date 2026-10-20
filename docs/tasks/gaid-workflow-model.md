---
format: 1
status: active
updated: 2026-10-20T12:18:03Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"dd7d1f93-03d6-4dca-953b-00e41c858900","pid":965617,"provider":"claude","session":"1a56399d-d1de-433f-a555-be30e08751b3","start":"38658235","token":"bb278cf12f9fe20443735ce69e3424ce3a001e5efa08c85b523ada62206e2191"}
branch: task/gaid-workflow-model
target: main
parent: 
---
# gaid-workflow-model

## Goal and done criteria
Request from the starter:

# Request: gaid-workflow-model

User request (verbatim, 2026-10-20, to the geoaidesk hub):
"현재 gaid 허브에서는 워크플로우를 방법이라고 표현하고 있다. 그리고 Gaid 시스템에는 스킬과 워크플로우가 별도의 기능으로 제공되고 있다. 또한, BYOK에서 제공하는 워크플로우는 지침의 형태로 구성되어 있는데 반해 GAID 허브에서 방법(워크플로우)는 어떻게 구성되어 있는지 허브에서도 보이지 않고 GAID 시스템에서도 보이지 않는다. 현재 스킬, 워크플로우, 방법이 혼용되고 있는 것도 이용자들은 혼선이 올 수 밖에 없다. 오히려 스킬은 github를 비롯한 곳에서 유용한 스킬을 가져올 수 있게하고, 워크플로우에 집중하는 것도 하나의 방법이라고 생각한다. 이와 관련하여 현황을 진단하고 어떻게 체계적으로 정리하고 개선할지 논의하고 개선하는 작업을 진행하자."

Scope (same pattern as gaid-notebook-review):
- Phase 1 (diagnosis and proposal, no code changes): diagnose how skills, Workflows (upstream BYOK Workflows are instruction
  prompts), hub "방법" (gaid-method/v1 packages with Workflows, 레시피, skills), 레시피 and catalogue items are named, stored,
  shown and related across the GAID hub and the GAID system (workspace Workflow panel, start settings, Settings → Skills, hub
  screens, locales/terminology in geo/copy/terminology.csv). Show where the composition of a hub method/Workflow is invisible.
  Produce a proposal with options and a recommendation; the user's own idea to evaluate: skills are imported from GitHub and
  similar sources, and GAID focuses on Workflows (hub entries = Workflows). Include a terminology table and the effect on
  existing data/packages (gaid-method/v1, installed methods, recipes) and the skill_hub producer contract.
- Discuss with the user in the writer tab; implement in phase 2 only the agreed scope. A policy/architecture decision with real
  alternatives goes in docs/adr/.
- Current context: review app on PC74 (~/deploy/geoaidesk, data ~/.geoaidesk, hub entries imported from test data on
  2026-10-20); do not modify ~/.geoaidesk; use your own GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model/.
Outside check: no outside check (product/IA work).

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

---
format: 1
status: active
updated: 2026-10-20T14:23:32Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"7bf8b4c2-896d-4828-b900-b59150cf411d","pid":2653212,"provider":"codex","session":"01a159a9-e310-73e2-bbba-edf004cd26d4","start":"39360728","token":"f286d62a1decc68fd25437f6fb6e4181f19bbb4b3f1d98bb2a8e554497f80ee7"}
branch: task/gaid-workflow-model--authoring
target: task/gaid-workflow-model
parent: gaid-workflow-model
---
# gaid-workflow-model--authoring

## Goal and done criteria
Request from the starter:

# Child task: gaid-workflow-model--authoring (hub authoring writes gaid-workflow/v1)

Parent: gaid-workflow-model (geoaidesk). Read first: ADR docs/adr/2026-10-20-workflow-runtime-form.md (accepted),
report reports/2026-10-20-gaid-workflow-model/index.md §3.5, §3.12–3.15, the shared contract
web/src/geo/contracts/workflow-doc.ts and server/src/geo/workflow-doc.ts, and the gaid-workflow/v1 validation the parent
added in server/src/geo/methods/method-file.ts (gaidWorkflowParts). skill_hub is legacy: no skill_hub work.

## Goal
New and edited hub drafts carry a gaid-workflow/v1 Workflow whose `steps[]` are the single written procedure:
1. Authoring model output (server/src/geo/authoring/prompts.ts, agent.ts): the Workflow gets `skills[]` (the bundled
   skill as `bundled`/`primary`; catalogue skills it relies on as `catalogue`) and `steps[]` (`id, title, does, skill,
   read, checks, choiceIds, outputs`), with every requiredScientificChoice attached to the step that needs it and every
   expected artifact to the step that writes it. `prompt` becomes the author's additional instructions only (no
   restated procedure). Keep the decision/answer questions flow.
2. One source: derive the atlas profile `procedure.nodes` (hub flow) from `steps[]` (labels, summaries, checks,
   decisionIds = choiceIds) instead of asking the model twice; SKILL.md "처리 절차" sections use the step titles as
   headings so a step's `read` points to them; add a check (receipt item `workflow`, warning) when SKILL.md headings and
   steps disagree.
3. package.ts writes the Workflow with `schemaVersion: "gaid-workflow/v1"`; parseMethodFile accepts it (already); the
   recipe ("저장한 시작 설정") stays as today.
4. Hub editing (server/src/geo/hub-shared/edit.ts) of an entry registered in the older form: the seeded draft starts
   from derived steps (workflowDocFor on the old Workflow + atlas procedure) so re-registering writes the new form.
5. Existing stored drafts/entries are never rewritten; older packages keep installing and running (legacy doc).
Verify with a real authoring run in an isolated GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model--authoring/
(copy ~/data/geoaidesk/work/gaid-workflow-model/home; never ~/.geoaidesk) using the institute model route already
configured for authoring trials in earlier units (see docs/tasks of gaid-hub / gaid-qwen-authoring-trial for how they
ran; do not read credential files — use the app's configured routes). One draft from the sample paper/code is enough;
record the produced gaid-method.json Workflow and the rendered 지침 (renderWorkflowDocument target chat).

## Ownership
You own server/src/geo/authoring/** (prompts, agent validation, package, profile-lint), server/src/geo/hub-shared/edit.ts,
and authoring tests. The parent owns the shared contract files; ask the parent (Paseo message) for contract changes.
Screens are the views child's; do not change web screens except a test fixture.

## Rules and checks
AGENTS.md rules; scripts/check; remove build caches before finishing. Evidence (draft JSON excerpt, rendered 지침,
checks, tests) in your task document's Current state, first and self-contained.

## Current state
Implementation implemented, focused checks in progress. Typecheck passed; 60/61 focused tests passed, the remaining new legacy test had an incorrect fixture expectation (fixed by explicitly using legacy nodes without choice links). No stored drafts or live home changed.

Isolated home copied from the parent trial home, excluding config.env/auth.json/key material. Real trial will use the configured kigam-qwen/qwen3.8-flash-next runtime route and the copied sample paper/findings/decisions in ap-b232edf4-30a; it creates a fresh project, calls the actual draft model, builds a package and renders target=chat. No shared registration/install.

Sequential decisions: use workflow.steps as the only procedure for new model output; derive atlas nodes at validation and packaging; upgrade legacy drafts in cloned edit/package views only. Shared authoring contract changes requested from parent.

Owned files: server/src/geo/authoring/**, server/src/geo/hub-shared/edit.ts, server/test/geo-authoring*.test.ts and fixture, hub edit tests. No web screen changes. Work is tightly coupled; no readers needed. Integration order: model format/validation, package checks, legacy edit path, focused tests, isolated real run, scripts/check, remove build caches, task finish.
## Next steps
1. Implement structured authoring and legacy draft upgrade; validate with focused tests then the real institute-model run.
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
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--authoring-20261020T142305.092598Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

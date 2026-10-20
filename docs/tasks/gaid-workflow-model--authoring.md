---
format: 1
status: active
updated: 2026-10-20T14:45:15Z
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
Implemented the requested gaid-workflow/v1 authoring path. New model drafts write skills[] + steps[] as the only procedure; Atlas labels/summaries/checks/decisionIds come from steps, every scientific choice and expected artifact must be attached, and prompt is additional author instructions only (may be empty). Bundled SKILL.md section mismatch is a workflow warning carried in the package receipt. New edit revisions, cloned registered-entry seeds and re-registration snapshots upgrade legacy Workflow drafts without rewriting original stored drafts/entries. Saved start settings keep their existing format and decision-backed defaults.

Verified:
- Backend typecheck and focused authoring/package/shared-hub tests: 62/62 pass.
- A real institute-model run succeeded (job-geoaidesk-gaid-workflow-model--authoring-1, exit 0; code 535965091e68). It used the copied sample paper and its 46 previously verified findings/recorded decisions to create fresh project ap-8b3be0c7-b02, not a scripted model response. Model: configured kigam-qwen/qwen3.8-flash-next route, medium reasoning; prompt gaid-draft/2026-10-20.2. First response accepted (8,951 input / 14,587 output tokens). No live ~/.geoaidesk writes, no shared registration/install.
- Produced Workflow baggingpu-conformal-prospecting: 9 steps, 3 choices, 7 artifacts; all choices/artifacts attached; all bundled step title/read headings align. prompt={"ko":""}; bundled primary skill only. Schema/atlas/taxonomy/portability/claims receipts pass; workflow warns only about explicit optuna/scikit-gstat installation (no errors, no heading mismatch).
- Current parseMethodFile accepts the actual manifest with issues=[]. Direct artifact assertions verify 9 exact Atlas projections (ids, labels, summaries, checks, choiceIds), 3/3 choices and 7/7 artifacts covered, and 9/9 heading/title/read matches.
- Deterministic target=chat document rendered as structured, 3,404 characters; shows unresolved choices before their dependent steps, read sections, checks, outputs and limits. This verifies authoring/package/document structure, not scientific results or execution of the resulting analysis.
- Full scripts/check retry completed successfully: backend 1,967 passed / 8 skipped; frontend 1,120 passed; GAID distribution, copy/UI, catalogue environments, launchers and production start/stop/restart checks passed. The task wrapper invalidated the check because this task document was edited during it, then began an automatic re-run. I stopped that redundant re-run and am checkpointing all metadata before a clean final task finish; no source edits were involved.
- The earlier full run had 1,966 passed / 8 skipped / one unrelated provenance failure (expected created, observed modified). Isolated provenance.test.ts rerun passed 39/39 and the full retry passed 1,967. Read-only diagnosis: the recorder's asynchronous baseline can include the file created immediately by that test. No provenance source edits.
- Build-cache cleanup is required after the final check as well, because production smoke regenerates caches. No deployment is part of this child; parent integration is still pending.

Evidence directory: /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--authoring-20261020T142305.092598Z/out/
- gaid-method.json: sha256 1ab232ad1394209225e13c73008c9e3b07c35b0f39f7051c1c0a53eef1223c31
- workflow-chat.md: sha256 750304c9c3cfacbca65db959c2232f5d4f0731a1ef337133d5807d9c49e5270e
- draft.json: sha256 0771b98a2b428da888a49941b43151f9d24933f7dd0d1493ba62b2679bc97c1e
- checks.json: sha256 8978edba102e340d1d841c5cd20beddda5157ce44c12983946473f683cf77566
- Original sample my-paper.pdf: sha256 de611db0be9cda7caa5851b5f7e1593593c389c51a3ce02cd3cf249637ba5ff0 (named input authoring_preview_paper).

Workflow excerpt (from the actual manifest):
```json
{"schemaVersion":"gaid-workflow/v1","id":"baggingpu-conformal-prospecting","skills":[{"name":"baggingpu-conformal-prospecting","source":"bundled","role":"primary","purpose":{"ko":"PU 학습·부트스트랩·conformal·구역 배정 전 과정을 지시하는 분석 절차"}}],"prompt":{"ko":""}}
```
Step excerpt:
```json
{"id":"variogram-block","title":{"ko":"공간 블록 크기 산정"},"does":{"ko":"입력 격자에서 empirical variogram을 계산하고 유효 범위 기반 권고 블록 크기를 연구자에게 보고합니다."},"skill":"baggingpu-conformal-prospecting","read":{"ko":"공간 블록 크기 산정"},"checks":[{"ko":"variogram 그림과 nugget/sill/유효 범위를 보고"},{"ko":"권고 블록 크기로 5개 폴 분할이 균형인지 확인"},{"ko":"연구자 확정 전 후속 단계 진행 금지"}],"choiceIds":["block-size"],"outputs":["variogram-figure"]}
```
Rendered chat excerpt:
```markdown
2. 공간 블록 크기 산정 [연구자 결정: 공간 블록 CV 크기 결정 방식]: 입력 격자에서 empirical variogram을 계산하고 유효 범위 기반 권고 블록 크기를 연구자에게 보고합니다.
   스킬: baggingpu-conformal-prospecting (먼저 읽을 곳: 공간 블록 크기 산정)
   확인할 것: variogram 그림과 nugget/sill/유효 범위를 보고 / 권고 블록 크기로 5개 폴 분할이 균형인지 확인 / 연구자 확정 전 후속 단계 진행 금지
   만드는 결과: Variogram 및 블록 크기
```

Sequential decisions: use workflow.steps as the sole procedure for new model output; derive Atlas at validation/packaging; upgrade cloned edit/package views only. Legacy choices without usable old node links are conservatively asked before the first step; expected artifacts belong to the last writing step. Model revisions write precise step associations.

Owned files: authoring/**, hub-shared/edit.ts, authoring/shared-hub tests/fixture/manual trial runner. Parent additionally authorized the registration-only normalization in hub-shared/routes.ts (normalize snapshot before packaging; bypass cached legacy package). Shared authoring contract and empty-prompt importer came from parent (aadb532, b349ff0). No web screen, locale catalogue, vendored hub schema or pinned catalogue changes. No child writers/readers were needed. Remaining sequence: checkpoint all task metadata → clean task finish (no edits while checks run) → remove generated ignored build caches → parent integration.

## Next steps
1. Run task finish from the clean checkpoint and leave tracked files untouched during checks. After readiness, remove generated ignored build caches and let the parent run task complete. Do not repeat the completed model job.
## Failed approaches
- Initial task resume briefly encountered other task transactions; retried without changing workflow state.
- First task sync typecheck found optional stored-step arrays; fixed with defaults. Second typecheck found cached package manifest typed unknown; fixed the local cast and reran typecheck successfully.
- Full check initially failed only provenance created/modified assertion; isolated and full rechecks passed. No speculative provenance edits.
- I edited only the task document during the second full check. backbone task/integration.py invalidates ANY dirty tracked state and retries once; task/check_logs.py deletes the log on successful subprocess exit. Thus the disappearing log was successful completion, not an environment fault. I stopped the automatically repeated check after confirming this premise and will checkpoint metadata before final task finish without further concurrent edits.
## Notes and decisions
- Parent confirmed (2026-10-20): do not also derive Atlas userDecisions from scientific choices. Structured views use steps[].choiceIds, keeping one decision source; Atlas nodes carry the same choice ids.
- Parent confirmed the renderer deliberately omits a research-note closing line: GEO_INSTRUCTIONS covers GAID chat notes; exported CLI instructions do not have a notes system. Parent will correct the report example.
- Trial rendering intentionally used empty input/choice settings maps, so unresolved choices appear in the document; saved start settings and their decision-backed defaults remain unchanged.
- Parent is holding publication of its branch through this child finish to avoid repeating checks for moving integration targets.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
No separate child report. The parent owns reports/2026-10-20-gaid-workflow-model/index.md; implementation and real-run evidence are recorded above for its result section.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--authoring-20261020T142305.092598Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

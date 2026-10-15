---
format: 1
status: active
updated: 2026-10-15T14:40:47Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"889fbc92-549f-4f63-9865-358efbab2bba","pid":793523,"provider":"codex","session":"01a13ffb-bfc7-7dd1-9fac-66f3bf150afc","start":"54082579","token":"c5f1a782a11515da3361495e6b345bc949fcea86976aaa8443c13bf3060b46d2"}
branch: task/gaid-hub-integration--methods-ui
target: task/gaid-hub-integration
parent: gaid-hub-integration
---
# gaid-hub-integration--methods-ui

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-hub-integration--methods-ui` (geoaidesk) — LocalMethod screens

Parent: gaid-hub-integration (Claude orchestrator). Read AGENTS.md, the parent task document docs/tasks/gaid-hub-integration.md
(Goal, Orchestration) and docs/design/hub-method-package.md first. You own package P3 (UI only); the server is done.

## User words (verbatim, Korean, 2026-10-15)
"skill_hub에서 작성하고 GAID는 설치·실행·시험만 합니다. ... 연구자는 skill_hub에서 논문이나 자료를 첨부하고 에이전트와 질문·답을 주고받아 스킬이나
워크플로를 만듭니다. GAID는 그것을 받아 설치하고 시험합니다. ... Q1의 로컬 워크플로 보관은 \"skill_hub에서 받은 워크플로를 설치하는 곳\"으로 바뀝니다."
"GAID허브에서 생성한 스킬 또는 워크플로우 레시피가 GAID 시스템에서 불러와서 테스트되어야한다."
Terminology (user): "용어로서 워크플로우가 표준용어이고 가급적 영어로 Workflow로 사용하길 원한다." → write "Workflow" in Korean copy too;
"워크플로우" only where Korean spelling is unavoidable; never "워크플로". "레시피" = saved start setting.

## Settled interfaces (do not change; ask the parent if one is missing)
- Contract types: web/src/geo/contracts/methods.ts (LocalMethodSummary, LocalMethodWorkflow extends GeoWorkflowSummary with
  `exposure`, MethodRecipe, MethodTrial, ...).
- Routes: GET /geo/methods; GET /geo/methods/trials?skill=<runtimeName>; GET /geo/methods/trials/:sessionId;
  PUT /geo/methods/trials/:sessionId/assessment {outcome: useful|needs-revision|failed, note}; GET /geo/skill-hub/methods
  → {hubs: [{siteId, url, state ok|error, detail?, methods: [descriptor + descriptorUrl]}]} (descriptor fields:
  methodId, revision, version, lifecycle, implementation, title, sha256, size, pageUrl, createdAt).
  Installation stays the existing gate: POST /geo/skill-hub/preview {url: descriptorUrl} → SkillsPanel acknowledgement/install.
  The preview response's `skillHub.draft` = {methodId, revision, lifecycle, url} for hub drafts.
- Starting a Workflow: the existing TaskSetup (web/src/geo/workspace/task-setup.tsx). Add an optional `exposure?: string` prop
  (default `workflow:${workflow.id}`) passed as `geoExposure` to startGeoTask; for a method Workflow pass `workflow.exposure`
  (`method:<name>:<workflowId>`). The server then records a trial for that chat when its session is created (first send).
  A method 레시피 opens TaskSetup with initialSetup = {workflowId, choices (stringified), unresolvedChoices, skillIds, exampleId: null}.

## Deliverable
1. web/src/geo/methods/: a hook/component that turns GET /geo/methods into Workflow panel rows and dialogs, to be wired by the
   parent into web/src/geo/workspace/task-catalogue.tsx (owned by another running unit — do NOT edit it; export something the
   parent can add in a few lines, e.g. `useMethodRows(projectId)` returning {category, rows, dialogs, reload}, and document it).
   - A leading category for methods received from skill_hub (pick wording per the copy guide; it is the place where Workflows
     received from skill_hub are installed), rows for each method Workflow and each method 레시피, with badges: readiness
     (reuse WorkflowBadges logic or its strings), lifecycle (초안/제출됨/공개됨 as GAID shows it — `lifecycle`, never the claim),
     "설명만"/"코드 포함" (implementation), "GAID에서 수정됨" when editedLocally. A method without Workflows still gets one row that
     opens its detail.
   - Method detail dialog: title, summary, origin (skill_hub 초안 / 파일 업로드, link to pageUrl when present, version/revision),
     hub checks (items + warnings count), open questions from the hub (authoring.openQuestions) labelled as unresolved in the
     hub, sources (DOI as https://doi.org/<doi> link), Workflows with readiness and "시작 설정 열기", 레시피, issues of an invalid
     file, and the trial list for that method.
   - Trial list: started time, Workflow, revision, method changed since trial, observed tool calls / failed calls / models,
     outputs, expected artifacts found vs missing (required ones visible), and the researcher's assessment form (outcome + note,
     PUT). State plainly that observations come from the chat's recorded tool steps and that this is not a scientific review.
     Link to the chat only if an existing mechanism to focus a chat by sessionId exists; otherwise show the session id briefly.
2. Settings → Skills hub pane (web/src/geo/skill-hub/skill-hub.tsx, GAID-owned): list GET /geo/skill-hub/methods per hub
   (title, version, lifecycle, implementation, created time, "미리보기"), calling the existing preview with the descriptorUrl;
   show hub errors. SkillHubPreviewNotes shows `skillHub.draft` (method id, revision, lifecycle) for drafts.
3. Locales: new namespace `methods` (web/src/geo/locales/methods/{ko,en}.json + two lines in index.ts); additions to `skillHub`.
   Follow AGENTS.md "UI copy and locales", geo/copy/gaid-writing.md and terminology.csv. Korean first, English same meaning.
4. Tests: web vitest for rows, detail, trial assessment, hub list; `npx tsc --noEmit` in web; copy validator
   `node geo/copy/validate-copy.mjs web/src/geo/locales`.

## Constraints
- Do not edit: task-catalogue.tsx, workflows-panel.tsx, skills-panel.tsx, server/src/geo/context.ts, instructions.ts, locales
  app/workspace/workflows/settings/work (another unit owns them until it merges). task-setup.tsx is yours for the prop only.
- The sibling child gaid-hub-integration--handoff adds the `hubHandoff` namespace line in web/src/geo/locales/index.ts; expect a
  trivial merge there.
- No server changes; if the API lacks something, message the parent (Paseo agent of gaid-hub-integration) with the exact need.
- Report under ## Current state of your task document: components/exports, how to wire them, string ids with ko/en text, test
  results. Then `task finish`.

## Current state
- Implemented standalone UI exports in `web/src/geo/methods/methods.tsx`: `useMethodRows(projectId, availableFiles)`, `methodRows`, `MethodDetail`, `MethodTrials`, `TrialCard`, and `MethodBadges`. Workflows and method recipes open TaskSetup; methods without Workflows open detail. Readiness uses existing workspace badge strings; lifecycle is effective server lifecycle, never lifecycleClaimed.
- Parent wiring (not done here, restricted file): import `useMethodRows` into TaskCatalogue and call it unconditionally after the project props. Prepend `methods.category` to `leadingCategories`, prepend `methods.rows` to extension rows, include `methods.notice` in extension.notice, and render `methods.dialogs` beside existing TaskSetup dialogs. Keep the existing projectId key. The notice provides detail buttons and refresh. Workflows pass method exposure; recipe choices are stringified and unresolved choices are blank/editable.
- Settings hub pane now lists per-hub descriptors (including individual hub errors). All preview actions still use SkillHubInstall and the existing acknowledgement/install gate. Preview notes display draft identity/revision/effective lifecycle.
- Trial cards show observation counts, models, outputs, required/missing expected artifacts, changed method warning, incomplete file attribution and verbatim researcher assessment. An existing private page callback can open session history, but no public session-focus interface is available to these components; show the full chat ID instead of a non-working link.
- Verification pending: dependencies are being installed by recorded job; then scoped web vitest, TypeScript and copy validation. Initial copy validation: 0 errors, 56 pre-existing warnings; no methods/skillHub warnings.

### Copy changes (new ids; before = absent in both locales)

| String id | Korean after | English after |
|---|---|---|
| methods.category | 허브에서 설치한 Workflow | Workflows installed from the hub |
| methods.loading | 설치된 Workflow를 읽는 중입니다. | Reading installed Workflows. |
| methods.empty | 허브에서 설치한 Workflow가 없습니다. Settings의 스킬에서 패키지를 미리보고 설치하세요. | No Workflows are installed from the hub. Preview and install a package in Settings → Skills. |
| methods.error | 설치된 Workflow를 읽지 못했습니다: {detail} | Could not read installed Workflows: {detail} |
| methods.reload | 목록 새로고침 | Refresh list |
| methods.close | 상세 닫기 | Close details |
| methods.setup | 시작 설정 열기 | Open start settings |
| methods.detail | 방법 상세 보기 | View method details |
| methods.recipe | 레시피 | Recipe |
| methods.workflows | Workflows | Workflows |
| methods.recipes | 레시피 | Recipes |
| methods.sources | 출처 | Sources |
| methods.issues | 패키지 문제 | Package issues |
| methods.checks | 허브 검사 기록 | Hub check receipt |
| methods.checkSummary | 검사 도구: {checker} · {at} · 경고 {count}개 | Checker: {checker} · {at} · {count} warnings |
| methods.questions | 허브에서 미해결인 질문 | Questions unresolved in the hub |
| methods.revision | 버전 {version} · revision {revision} | Version {version} · revision {revision} |
| methods.unknown | 기록 없음 | Not recorded |
| methods.edited | GAID에서 수정됨 | Edited in GAID |
| methods.origin | 설치 출처: {origin} | Installed from: {origin} |
| methods.page | 허브 페이지 보기 | View hub page |
| methods.origin.hub | skill_hub 초안·패키지 | skill_hub draft/package |
| methods.origin.upload | 파일 업로드 | File upload |
| methods.origin.other | 기타 설치 경로 | Other installation route |
| methods.lifecycle.draft | 초안 | Draft |
| methods.lifecycle.submitted | 제출됨 | Submitted |
| methods.lifecycle.published | 공개됨 | Published |
| methods.implementation.descriptive | 설명만 | Instructions only |
| methods.implementation.implemented | 코드 포함 | Includes code |
| methods.check.pass | 통과 | Passed |
| methods.check.warn | 경고 | Warning |
| methods.trials.title | GAID 시험 기록 | GAID trial records |
| methods.trials.limit | 관찰값은 채팅에 기록된 도구 실행 단계에서 가져옵니다. 과학적 검토 결과가 아닙니다. | Observations come from tool steps recorded in the chat. They are not a scientific review. |
| methods.trials.loading | 시험 기록을 읽는 중입니다. | Reading trial records. |
| methods.trials.empty | GAID 시험 기록이 없습니다. | No GAID trial records. |
| methods.trials.error | 시험 기록을 읽지 못했습니다: {detail} | Could not read trial records: {detail} |
| methods.trials.started | 시험 시작: {at} | Trial started: {at} |
| methods.trials.workflow | Workflow: {id} · revision {revision} | Workflow: {id} · revision {revision} |
| methods.trials.changed | 시험 이후 방법 파일이 바뀌었습니다. 현재 파일은 해당 시험에 포함되지 않습니다. | Method files changed after this trial. The current files are not covered by that trial. |
| methods.trials.calls | 도구 호출 {calls}회 · 실패 {failed}회 | {calls} tool calls · {failed} failed |
| methods.trials.models | 모델: {models} | Models: {models} |
| methods.trials.degraded | 파일 연결이 불완전한 단계: {count}개 | Steps with incomplete file attribution: {count} |
| methods.trials.session | 채팅 ID: {id} | Chat ID: {id} |
| methods.trials.outputs | 관찰된 결과 파일 | Observed output files |
| methods.trials.expected | 예상 결과 파일 | Expected output files |
| methods.trials.required | 필수 | Required |
| methods.trials.optional | 선택 | Optional |
| methods.trials.found | 발견됨: {files} | Found: {files} |
| methods.trials.missing | 파일 일치 없음: {files} | No matching files: {files} |
| methods.trials.none | 없음 | None |
| methods.assessment.title | 연구자 평가 | Researcher assessment |
| methods.assessment.outcome | 시험 평가 | Trial assessment |
| methods.assessment.choose | 평가 선택 | Select assessment |
| methods.assessment.useful | 유용함 | Useful |
| methods.assessment.needs-revision | 수정 필요 | Needs revision |
| methods.assessment.failed | 실패 | Failed |
| methods.assessment.note | 평가 메모 | Assessment note |
| methods.assessment.save | 평가 저장 | Save assessment |
| methods.assessment.saving | 평가 저장 중 | Saving assessment |
| methods.assessment.saved | 평가를 저장했습니다. | Assessment saved. |
| methods.assessment.error | 평가를 저장하지 못했습니다: {detail} | Could not save assessment: {detail} |
| skillHub.methods | 허브 패키지 목록 | Hub packages |
| skillHub.methodsLoading | 허브 패키지 목록을 읽는 중입니다. | Reading hub packages. |
| skillHub.methodsEmpty | 허브에 가져올 패키지가 없습니다. | No packages are available from the hub. |
| skillHub.methodsError | 허브 패키지 목록을 읽지 못했습니다: {detail} | Could not read hub packages: {detail} |
| skillHub.methodPreview | 패키지 미리보기 | Preview package |
| skillHub.methodCreated | 생성 시각: {at} | Created: {at} |
| skillHub.methodDraft | 허브 방법: {id} · revision {revision} · {lifecycle} | Hub method: {id} · revision {revision} · {lifecycle} |

## Next steps
1. Implement standalone method rows/detail/trials and hub listing, then run the declared UI checks.
## Failed approaches
## Notes and decisions
### UI orchestration
Sequential: TaskSetup exposure seam → method UI → hub preview listing → tests → parent handoff.
Owned: web/src/geo/methods/, skill-hub/, methods and skillHub locales, locale index, TaskSetup exposure prop.
No independent writer packages: the hook/dialog/setup state is tightly coupled; this child cannot create nested units.
Parent owns task-catalogue integration and final full-app checks/report.

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
- /home/seongin3/data/geoaidesk/runs/gaid-hub-integration--methods-ui-20261015T143901.271166Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

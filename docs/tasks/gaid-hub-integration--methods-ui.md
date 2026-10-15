---
format: 1
status: active
updated: 2026-10-15T14:38:49Z
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
Implementation in progress. Contract and copy guides read; no server edits or restricted sibling files.
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

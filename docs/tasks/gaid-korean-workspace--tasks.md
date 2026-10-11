---
format: 1
status: active
updated: 2026-10-11T07:05:40Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"9de57122-4815-4e8d-8db4-f7872cf53c25","pid":447397,"provider":"codex","session":"01a129b9-c31e-7393-9a91-1bf9bdacb66f","start":"16740288","token":"0ad6da35675d2000f5c07717317e785564506d6fc8b8286f4dc84b6231054c5a"}
branch: task/gaid-korean-workspace--tasks
target: task/gaid-korean-workspace
parent: gaid-korean-workspace
---
# gaid-korean-workspace--tasks

## Goal and done criteria
Request from the starter:

# Child writer brief: `gaid-korean-workspace--tasks` (geoaidesk, WP07 task UI)

You are a child writer of top-level unit `gaid-korean-workspace` (WP07 of the GeoAIDesk plan). Run `task resume` for
your slug first, read the returned worktree's AGENTS.md, and work only there. Base: parent branch at ba1a71b (the
shared foundation below is already in it).

## Goal (from the package text; do not add required items)
WP07 done criteria you serve: "researcher opens data, sees relevant actions, launches the correct pack, and opens
outputs. Missing skills/environments are not shown as ready. New chat/pack transitions preserve drafts." You build the
task UI components; the parent builds the server routes, the upstream mount points and the actual-screen checks.

## Already settled by the parent (read these files first; do not change their signatures)
- Contract types: `web/src/geo/contracts/workspace.ts` (GET /geo/workflows, POST /geo/suggestions {path},
  POST /geo/recipes/check {recipe}, start-task hand-off, geo-result reference). The parent implements the server
  routes in parallel in `server/src/geo/workspace/`; develop and test against mocked `apiFetch` (`@/lib/projects`
  pattern used by existing tests). If you need a contract change, write it under "Notes and decisions" in your task
  document with the reason and continue with the current contract; do not edit the contract file.
- Hand-off: `startGeoTask(detail)` in `web/src/geo/workspace/events.ts` returns `"opened" | "tab-limit" |
  "no-workspace"`; app/page.tsx opens a NEW tab whose composer holds `detail.text` (never sent automatically), with
  `attachedFiles`, pinned `skills` and `geoExposure: "workflow:<id>"` (the session is created with that skill exposure
  on the first send). The source tab keeps its own draft.
- Mount points that already render your components (placeholders now; replace their bodies, keep names/props):
  - `web/src/geo/workspace/task-catalogue.tsx` `GeoTaskCatalogue({projectId, availableFiles, children})`: the
    workflows view; `children` is the upstream K-Dense workflow list.
  - `web/src/geo/workspace/file-actions.tsx` `GeoFileActions({path, projectId})`: above the file viewer in view mode.
  - `web/src/geo/workspace/chat-actions.tsx` `GeoChatActions({projectId, sessionId, isStreaming})`: chat composer
    toolbar next to the prompt-budget chip.
  - `web/src/geo/workspace/result-card.tsx` `GeoResultBody({card, projectId, onOpenFile})`: body of the
    scientific_result card kind `geo-result` (basic version exists).
- Strings: `t("workspace.<key>", values)` from `@/geo/i18n`; catalogue `web/src/geo/locales/workspace/{ko,en}.json`
  (ICU subset; existing keys `result.label`, `result.open`). Catalogue text such as workflow titles comes as `{ko, en?}`
  from the server: pick `en` when `geoLocale()==="en"` and it exists, else `ko`.

## Owned files
`web/src/geo/workspace/**` (except `events.ts` and `tab-state.ts`, which you use but do not change),
`web/src/geo/locales/workspace/{ko,en}.json`, tests next to them. Do not edit upstream files, other locale namespaces,
contracts, server code or `geo/integration-boundaries.json`. If a mount point is missing something, record it in your
task document; the parent changes the seam.

## What to build
1. **Task catalogue** (`GeoTaskCatalogue`). When `GET /geo/workflows` reports `catalogue.state === "ready"`: list the
   catalogue workflows (7 in 0.2.0) as compact cards: title, one-line description, accepted input formats, expected
   outputs, the boundary (what the result does not claim), a readiness badge and, when `readiness.runRecord ===
   "none"`, a separate 미시험 badge ("GAID 실행 기록 없음"). Readiness wording is exact: only `ready` may read as ready;
   `missing-skills` names the missing skills; `needs-environment` names the environment and offers an explicit
   "환경 준비" action (`POST /geo/environments/<id>/prepare` with `{target: "project"}`, progress and error output shown,
   then re-fetch); `unavailable` says why. Never merge run record, environment and skill state into one "verified"
   badge. Actions per card: open the task setup; import a recipe (below). Keep the upstream list reachable through a
   secondary control (render `children` on demand). When the catalogue is not ready, render `children` with a one-line
   status of the geo catalogue above it.
2. **Task setup dialog** (shadcn Dialog). For one workflow: each input role with a file picker over `availableFiles`
   filtered by the role's `extensions` (the file the user came from preselected for the matching role); each required
   scientific choice as a select (when `options`) or a text field, with its `why`; a choice may be left for the agent to
   ask ("작업 중 결정"), recorded as unresolved; expected outputs and boundary shown. Primary button creates the task
   draft: compose the draft text from the workflow `prompt` (locale) plus input bindings, answered choices and
   unresolved choices, using catalogue message templates (complete messages, no fragment concatenation); pin the
   workflow's primary skill when `/skills` lists its runtime name as enabled; call `startGeoTask` with title = workflow
   title. The button is enabled only for `ready`; for `needs-environment` show the prepare action instead; handle
   `"tab-limit"` with a clear message. Form state survives closing and reopening the dialog for the same workflow in
   the same page session (draft preservation), and is cleared after a successful start.
3. **Recipe import** (`.geo-start.json`, schema `geo-start/v1`). From the catalogue (file input) and from
   `GeoFileActions` when the open file ends with `.geo-start.json` (read it via the existing sandbox read API used by
   the file preview). Send `{recipe}` to `POST /geo/recipes/check`; show `issues` (code + message) when not ok; when
   ok, open the task setup prefilled with `setup.choices` / `setup.unresolvedChoices`. Importing never starts or
   sends anything.
4. **File actions** (`GeoFileActions`). `POST /geo/suggestions {path}`; render at most three suggestions as a compact
   strip: title, why it matches (input role label + format), choices still needed, readiness badge, and a button that
   opens the task setup with this file bound to the matching role. Render nothing when there are no suggestions or the
   catalogue is off; never auto-run.
5. **geo-result card** (`GeoResultBody`): result kind label, manifest path, optional thumbnail (reuse how the plot
   card in `web/src/components/scientific-result-card.tsx` builds image URLs, including `withApiToken`), one button
   that names its object (지도 열기 / Depth track 열기 / 검증 곡선 열기) calling `onOpenFile(manifestPath)`.
6. **Make reusable skill** (`GeoChatActions`): button "재사용 스킬 만들기" enabled when `sessionId` is set and not
   streaming. Dialog: skill name (Pi rule: lowercase letters, digits, hyphens, ≤ 64) and one sentence describing the
   task. On confirm: `createSkill({name, description, scope: "project"})` from `@/lib/capabilities` (POST
   /skills/create, template), then `prefillChat(text)` (`@/lib/chat-prefill`) with an instruction to fill
   `.pi/skills/<name>/SKILL.md` from the completed work in this chat: inputs, steps, scripts copied into the skill
   folder, limits, and no validation claim. Show creation errors (e.g. name exists). Nothing is sent automatically.

## Copy, accessibility, layout
- Every visible string in `locales/workspace/{ko,en}.json`; read `geo/copy/gaid-writing.md` and
  `geo/copy/terminology.csv` first and follow the agent prompt block in AGENTS.md ("UI copy and locales"). Korean
  first; buttons = object + action (`작업 설정 열기`, `환경 준비`, `레시피 가져오기`); no question titles, hype words or
  emoji; limits (미시험, 검토 전, boundary text) are never removed.
- Keyboard: every action is a button/input reachable by Tab with a visible focus ring; dialogs trap focus and close
  on Esc; badges carry words, never colour alone.
- Narrow layout: cards and the suggestion strip wrap at 375 px without horizontal scrolling.

## Checks (yours)
`cd web && npx tsc --noEmit && npx vitest run src/geo && npx eslint src/geo/workspace && node ../geo/copy/validate-copy.mjs src/geo/locales`
Component tests with mocked `apiFetch` for each component, including: readiness states never shown as ready unless
`ready`; the start button disabled for missing skills; `startGeoTask` called with the expected detail (text, files,
skills, exposure); the dialog keeps its form after close/reopen; recipe issues displayed; at most three suggestions.
The parent runs the full `scripts/check` and the browser checks. No paid model runs. The KIGAM network blocks
raw.githubusercontent.com; use `gh api ... -H "Accept: application/vnd.github.v3.raw"` if you need GitHub files.

## Finish
Keep your task document current. In it, list the string ids you added with Korean and English text. `task save`
reviewed files, then `task finish`.

## Current state
- Resumed in the printed worktree; read AGENTS.md, the fixed workspace contracts, copy guide and glossary.
- Implementation owns only workspace components/helpers/tests and the workspace locale namespace. Parent owns routes, contracts, mount seams and full-app/browser checks.
- Implemented catalogue cards and upstream fallback, independent readiness/run-record labels, explicit project environment preparation with progress and output, persistent setup dialogs, draft hand-off, recipe import/check/prefill, capped file suggestions, result references with authenticated thumbnails, and project reusable-skill creation with unsent instructions.
- Verified: frontend `npx tsc --noEmit`; `npx vitest run src/geo` (11 files, 61 tests; 21 workspace cases); `npx eslint src/geo/workspace`; copy validator (8 catalogues, zero errors/warnings); `git diff --check`.
- Tests mock the fixed server contracts; no paid model requests and no application data were created. Full-app browser checks remain owned by the parent. CLI finish runs the declared repository suite.
- Local frontend checks used the parent's existing dependency tree through an ignored node_modules symlink (read-only tool use). Removed the symlink after checks so the CLI's npm ci cannot mutate the parent's dependencies.
## Next steps
1. Review and save exactly the owned component/helper/test/locale files plus this task document.
2. Run `task finish` and follow the CLI's next step. After a failed finish, fix in place and rerun without resume.
3. Parent integrates this unit with `task complete gaid-korean-workspace--tasks`, performs real-screen checks and includes these results in its canonical report.
## Failed approaches
- Initial resume calls met another task command's transient transaction lock; retry after the active command completed succeeded. No manual task/Git state changes.
- `task job run -- npm --prefix web ci` refused the dirty source before launching a job. No install/job started. Bounded frontend checks then used the already installed parent dependencies.
- First test-file write used a redundant `web/` prefix from the web directory and wrote nothing; corrected the workdir and created the file in the owned workspace folder.
- First typecheck after adding tests caught a missing scientific-result schemaVersion in the result-card fixture; set it to the existing upstream constant value (1), then the typecheck passed.
## Notes and decisions
- Sequential decisions: preserve the fixed contract; use shadcn dialogs and native labelled selects; keep setup state in mounted components across dialog close/reopen; clear only after a successful hand-off. No independent writer packages (this is a nested child unit).
- Integration order: shared helpers -> task setup -> catalogue/file suggestions -> chat/result actions -> tests/copy evidence. All runtime requests use explicit project scoping where the existing API supports it.
- No contract changes or upstream seam changes were needed. `/skills` returns the merged enabled list as an array; the primary runtime name is pinned only when that list and the workflow skill state agree. Existing `createSkill` uses the active project (as required by the brief); all new direct API calls pass projectId.
- Each workflow keeps form state while its setup dialog is closed. A successful new-tab hand-off clears it; tab-limit/no-workspace errors keep it. A recipe import intentionally replaces the selected workflow's setup without starting anything.
- `requiredWhen`, expected outputs, choice rationale and workflow boundary remain visible. Blank scientific choices are written as unresolved in a complete localized draft template; required file bindings block creation until selected.
- Full-screen accessibility/375 px layout checks belong to the parent. Dialogs use Radix focus trapping/Escape and localized close controls; native labelled fields and wrapping/min-width-zero layout are implemented.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Copy changes

All rows are additions; existing `workspace.result.label` and `workspace.result.open` remain unchanged. Before = `(new)`.

| String id | Korean before | Korean after | English before | English after |
|---|---|---|---|---|
| workspace.result.kind | (new) | {kind, select, map-layer {지도 레이어} depth-track {Depth track} validation-curve {검증 곡선} other {Geo 결과}} | (new) | {kind, select, map-layer {Map layer} depth-track {Depth track} validation-curve {Validation curve} other {Geo result}} |
| workspace.result.thumbnail | (new) | {title} 미리보기 | (new) | Preview of {title} |
| workspace.error.status | (new) | 서버 요청에 실패했습니다(HTTP {status}). | (new) | The server request failed (HTTP {status}). |
| workspace.catalogue.title | (new) | Geoscience 작업 | (new) | Geoscience tasks |
| workspace.catalogue.loading | (new) | Geo 작업 목록을 읽는 중입니다. | (new) | Reading the Geo task catalogue. |
| workspace.catalogue.error | (new) | Geo 작업 목록을 읽지 못했습니다. {detail} | (new) | Could not read the Geo task catalogue. {detail} |
| workspace.catalogue.status | (new) | Geo 카탈로그 상태: {state}. {detail} | (new) | Geo catalogue state: {state}. {detail} |
| workspace.catalogue.noDetail | (new) | K-Dense workflow 목록을 표시합니다. | (new) | Showing the K-Dense workflow list. |
| workspace.catalogue.inputs | (new) | 입력 형식: {formats} | (new) | Input formats: {formats} |
| workspace.catalogue.outputs | (new) | 예상 결과 파일: {outputs} | (new) | Expected output files: {outputs} |
| workspace.catalogue.boundary | (new) | 해석 한계: {boundary} | (new) | Interpretation limits: {boundary} |
| workspace.catalogue.empty | (new) | 등록된 Geo 작업이 없습니다. | (new) | No Geo tasks are registered. |
| workspace.catalogue.showUpstream | (new) | K-Dense workflow 목록 보기 | (new) | Show K-Dense workflows |
| workspace.catalogue.hideUpstream | (new) | K-Dense workflow 목록 접기 | (new) | Hide K-Dense workflows |
| workspace.readiness.ready | (new) | 준비됨 | (new) | Ready |
| workspace.readiness.skills | (new) | 필요한 스킬: {names} | (new) | Skills needed: {names} |
| workspace.readiness.environment | (new) | 환경 준비 필요: {name} | (new) | Environment preparation needed: {name} |
| workspace.readiness.unavailable | (new) | 사용 불가: {reason} | (new) | Unavailable: {reason} |
| workspace.readiness.unknown | (new) | 준비 상태를 확인하지 못했습니다. | (new) | Could not determine readiness. |
| workspace.readiness.untested | (new) | 미시험 · GAID 실행 기록 없음 | (new) | Untested · No GAID run record |
| workspace.environment.prepare | (new) | 환경 준비 | (new) | Prepare environment |
| workspace.environment.preparing | (new) | 환경 준비 중 | (new) | Preparing environment |
| workspace.environment.progress | (new) | 프로젝트 환경의 패키지를 준비하고 import를 확인하는 중입니다. | (new) | Preparing project environment packages and checking imports. |
| workspace.environment.done | (new) | 환경 패키지의 import를 확인했습니다. 작업 준비 상태를 다시 읽었습니다. | (new) | Environment package imports were checked. Task readiness was refreshed. |
| workspace.environment.incomplete | (new) | 환경 준비 후에도 필요한 항목이 남아 있습니다. {detail} | (new) | Required items are still missing after preparation. {detail} |
| workspace.environment.error | (new) | 환경을 준비하지 못했습니다. {detail} | (new) | Could not prepare the environment. {detail} |
| workspace.setup.open | (new) | 작업 설정 열기 | (new) | Open task setup |
| workspace.setup.title | (new) | {title} 작업 설정 | (new) | {title} task setup |
| workspace.setup.description | (new) | 입력 파일과 분석 조건을 선택하세요. 새 채팅에 초안을 만들며 메시지를 전송하지 않습니다. | (new) | Choose input files and analysis settings. A draft opens in a new chat; no message is sent. |
| workspace.setup.role | (new) | {label} ({required}) | (new) | {label} ({required}) |
| workspace.setup.required | (new) | 필수 | (new) | required |
| workspace.setup.optional | (new) | 선택 | (new) | optional |
| workspace.setup.selectFile | (new) | 입력 파일 선택 | (new) | Choose an input file |
| workspace.setup.decideLater | (new) | 작업 중 결정 | (new) | Decide during the task |
| workspace.setup.create | (new) | 작업 초안 만들기 | (new) | Create task draft |
| workspace.setup.creating | (new) | 작업 초안 만드는 중 | (new) | Creating task draft |
| workspace.setup.close | (new) | 설정 닫기 | (new) | Close setup |
| workspace.setup.tabLimit | (new) | 채팅 탭이 가득 찼습니다. 다른 탭을 닫은 뒤 작업 초안을 다시 만드세요. 입력값은 유지합니다. | (new) | All chat tabs are in use. Close another tab and create the task draft again. Your inputs are kept. |
| workspace.setup.noWorkspace | (new) | 작업 공간을 찾지 못했습니다. 프로젝트 작업 공간에서 다시 시도하세요. 입력값은 유지합니다. | (new) | Could not find the workspace. Try again in the project workspace. Your inputs are kept. |
| workspace.setup.error | (new) | 작업 초안을 만들지 못했습니다. {detail} | (new) | Could not create the task draft. {detail} |
| workspace.setup.none | (new) | 없음 | (new) | None |
| workspace.setup.noBoundary | (new) | 카탈로그에 해석 한계가 기록되지 않았습니다. | (new) | The catalogue does not record interpretation limits. |
| workspace.setup.inputLine | (new) | {role}: {path} | (new) | {role}: {path} |
| workspace.setup.choiceLine | (new) | {choice}: {answer} | (new) | {choice}: {answer} |
| workspace.setup.draft | (new) | {prompt}<br><br>입력 파일:<br>{inputs}<br><br>선택한 분석 조건:<br>{choices}<br><br>작업 중 결정할 조건: {unresolved}<br>미결정 조건은 분석 전에 질문하세요.<br><br>해석 한계: {boundary}<br>결과는 검토 전입니다. 실행 완료를 검토 완료로 표시하지 마세요. | (new) | {prompt}<br><br>Input files:<br>{inputs}<br><br>Selected analysis settings:<br>{choices}<br><br>Settings to decide during the task: {unresolved}<br>Ask about unresolved settings before analysis.<br><br>Interpretation limits: {boundary}<br>The results have not been reviewed. Do not label run completion as review completion. |
| workspace.recipe.import | (new) | 레시피 가져오기 | (new) | Import recipe |
| workspace.recipe.file | (new) | Geo 작업 레시피 파일 | (new) | Geo task recipe file |
| workspace.recipe.checking | (new) | 레시피 확인 중 | (new) | Checking recipe |
| workspace.recipe.error | (new) | 레시피를 읽거나 확인하지 못했습니다. {detail} | (new) | Could not read or check the recipe. {detail} |
| workspace.recipe.issue | (new) | {code}: {message} | (new) | {code}: {message} |
| workspace.recipe.noWorkflow | (new) | 레시피의 작업을 현재 카탈로그에서 찾지 못했습니다. | (new) | Could not find the recipe's task in the current catalogue. |
| workspace.files.match | (new) | 일치한 입력: {role} · 형식: {format} | (new) | Matched input: {role} · Format: {format} |
| workspace.files.needs | (new) | 결정할 분석 조건: {choices} | (new) | Analysis settings to decide: {choices} |
| workspace.files.error | (new) | 입력 파일 목록을 읽지 못했습니다. {detail} | (new) | Could not read the input file list. {detail} |
| workspace.skill.open | (new) | 재사용 스킬 만들기 | (new) | Make reusable skill |
| workspace.skill.title | (new) | 재사용 스킬 만들기 | (new) | Make reusable skill |
| workspace.skill.description | (new) | 프로젝트에 스킬 템플릿을 만들고 현재 채팅에 작성 지시를 넣습니다. 메시지는 전송하지 않습니다. | (new) | Create a project skill template and add writing instructions to this chat. No message is sent. |
| workspace.skill.name | (new) | 스킬 이름 | (new) | Skill name |
| workspace.skill.nameRule | (new) | 소문자 영문, 숫자, 하이픈으로 최대 64자를 쓰세요. 처음과 끝에 하이픈을 쓰거나 연속해서 쓰지 마세요. | (new) | Use up to 64 lowercase letters, digits and hyphens. Do not use leading, trailing or consecutive hyphens. |
| workspace.skill.task | (new) | 재사용할 작업 설명 (한 문장) | (new) | Reusable task description (one sentence) |
| workspace.skill.create | (new) | 스킬 템플릿 만들기 | (new) | Create skill template |
| workspace.skill.creating | (new) | 스킬 템플릿 만드는 중 | (new) | Creating skill template |
| workspace.skill.error | (new) | 스킬 템플릿을 만들지 못했습니다. {detail} | (new) | Could not create the skill template. {detail} |
| workspace.skill.draft | (new) | 현재 채팅에서 완료한 작업을 바탕으로 `.pi/skills/{name}/SKILL.md`를 작성하세요. 재사용할 작업: {description}<br>입력 자료, 실행 단계와 한계를 기록하세요. 필요한 스크립트를 `.pi/skills/{name}/` 폴더에 복사하고 스킬에서 참조하세요. 실행한 내용과 미시험 항목을 구분하고 검증을 주장하지 마세요. | (new) | Write `.pi/skills/{name}/SKILL.md` from the completed work in this chat. Reusable task: {description}<br>Record inputs, execution steps and limits. Copy required scripts into `.pi/skills/{name}/` and reference them from the skill. Distinguish executed work from untested items; do not claim validation. |

## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Parent report destination: reports/2026-10-11-gaid-korean-workspace/index.md. No separate child report. Parent should include the implemented behaviours and bounded frontend evidence above; do not infer actual-screen verification from jsdom tests.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

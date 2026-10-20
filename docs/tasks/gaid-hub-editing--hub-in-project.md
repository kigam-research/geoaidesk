---
format: 1
status: active
updated: 2026-10-20T08:55:50Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"c359215c-e879-4d90-a057-edcee1bddc36","pid":2584475,"provider":"codex","session":"01a15877-cef2-7143-9188-68e06ebafa16","start":"37354718","token":"8691512afe8ffc731b44bed2379aa7dd89fc4e8eded71cb9167c4bdbd3dfa27d"}
branch: task/gaid-hub-editing--hub-in-project
target: task/gaid-hub-editing
parent: gaid-hub-editing
---
# gaid-hub-editing--hub-in-project

## Goal and done criteria
Request from the starter:

# Child unit hub-in-project (parent gaid-hub-editing, geoaidesk)

Goal (user request items 1 and 2, verbatim parts): "레시피 가져오기에서 GAID 허브가 연동되어 이용자들이 GAID 허브에서 레시피를
가져올 수 있게 연동되어야 한다. skill 추가 시에도 skill_hub는 legacy이며 GAID 허브에서 스킬을 찾을 수 있게 연동되어야 한다."
Confirmed scope: (1) the Workflow panel's "레시피 가져오기" can find and import recipes from the GAID hub; (2) Settings →
Skills finds skills in the GAID hub; skill_hub becomes legacy and stays only as an "이전 skill_hub" link (user accepted this
option), not the primary path.

Current behaviour (parent's step 0, screenshots in pc74:~/data/geoaidesk/work/gaid-hub-editing/before/05-skill-add.png and
07-recipe-import.png): the recipe dialog (`web/src/geo/workspace/recipe-add.tsx`, RecipeAdd) only takes a `.geo-start.json`;
Settings → Skills → 스킬 추가 shows the "skill_hub 스킬 추가" card first (`web/src/geo/skill-hub/skill-hub.tsx`,
SkillHubInstall inside `web/src/components/skills-panel.tsx`).

Settled interfaces (do not change them; ask the parent if you need to):
- GAID hub listing: `GET /geo/hub/entries?q=` → `{ entries: HubEntry[] }` (`web/src/geo/contracts/hub-shared.ts`; client
  `sharedHub` in `web/src/geo/hub/shared-api.ts`, import it, do not edit it). `HubEntry.recipe` (new, parent commit 77d08ce)
  is true when the latest revision carries a Workflow with 레시피 defaults. All 5 entries in the trial data have it.
- Install into a project: `POST /geo/hub/entries/:id/install` `{ projectId, acknowledged: true, revision }` → InstallResult
  (`install.methodKey`, `workflowId`, `recipeId`). Installed methods appear in the Workflow panel through `useMethodRows`
  (`web/src/geo/methods/`); `openMethodSetup` (`web/src/geo/hub/handoff.ts`) opens their start settings.
- Do not edit `web/src/geo/hub/*`, `server/src/geo/hub-shared/*`, `server/src/geo/authoring/*` (parent and sibling own them).

Design to implement:
1. A small reusable hub picker (new folder `web/src/geo/hub-picker/`): search box + result list of hub entries (title,
   tagline one line, author, ★ count, 판 n, at most three badges), loading/empty/error states, an optional filter (recipes
   only). Locale namespace `hubPicker` (new `web/src/geo/locales/hubPicker/{ko,en}.json`, collected by
   `web/src/geo/locales/index.ts`).
2. Recipe import: RecipeAdd dialog offers "GAID 허브에서 찾기" first and "파일에서 가져오기" second (existing file flow
   unchanged). Choosing a hub entry shows what will happen (installs the method into the current project and opens its
   start settings with the 레시피 defaults), the same install acknowledgement as the hub's "내 프로젝트에서 시험"
   (`hub` text `trial.consent` wording; put your own string in your namespace), then installs (pinned to the shown revision),
   refreshes the method rows and opens the start settings. Show an already-installed state if the method is already in
   the project (the methods list tells you).
3. Settings → Skills: the first card becomes "GAID 허브에서 스킬 찾기" with the picker; "미리보기" sends the entry to the
   existing preview → acknowledgement → install gate of SkillsPanel (unchanged gate). Server: extend
   `POST /geo/skill-hub/preview` (`server/src/geo/routes/skill-hub.ts`, `previewSkillHub` in `server/src/geo/skill-hub.ts`)
   with `{ hubEntry: { id, revision }, scope }`: read the package bytes from the shared hub store on this server
   (`SharedHubStore` in `server/src/geo/hub-shared/store.ts`, file `packages/<revision>.tar.gz`; import, do not edit) and run
   the same staging/verification as an upload; origin kind `gaid-hub` with entry id and revision. The old site link, page URL
   and `.tar.gz` inputs move behind one "이전 skill_hub" disclosure/link (collapsed by default).
4. Update AGENTS.md lines for skill_hub install / Workflow panel to describe the new primary path (keep it short).

Rules: read AGENTS.md (UI guide `docs/design/ui-guide.md` sections 1, 9 and the components you touch; copy rules
`geo/copy/gaid-writing.md`, `terminology.csv`; all visible strings in locale catalogues, Korean first). Tests: add focused
vitest tests for the picker filter/states, the RecipeAdd hub path and the server preview by hub entry (follow existing
`skill-hub.test.tsx`, `server/test/*skill-hub*`). Run `cd server && npm run typecheck && npx vitest run <your tests>`,
`cd web && npx tsc --noEmit && npx vitest run <your tests>`, `node geo/copy/validate-copy.mjs web/src/geo/locales`,
`node geo/ui/check-ui.mjs`. The full `scripts/check` runs at the parent.
Screenshots: Korean 1440x900 and 1280x800 of the recipe dialog (hub list + selected entry) and the Skills card, on your own
trial app (systemd-run --user, own ports e.g. 3381/18381, GAID_HOME a copy of
pc74:~/data/geoaidesk/work/gaid-hub-editing/home under ~/data/geoaidesk/work/gaid-hub-editing--hub-in-project/; never
~/.geoaidesk, never inside the repo; playwright-cli skill; set localStorage `gaid:hub-user` and `gaid:locale`=ko). Network:
raw.githubusercontent.com is blocked. Deliver: commits via `task save`, then `task finish`; in your task document's
Current state list the string ids added/changed (ko/en), the UI rule ids followed or broken, screenshot paths (small PNGs
also copied to reports/2026-10-20-gaid-hub-editing/figures/ with names p1-*.png) and a short Korean section text for the
parent's report.

## Current state
Implemented both requested entry points. RecipeAdd defaults to a searchable GAID hub recipe list; selection pins the shown revision, asks for the existing code-execution acknowledgement, installs into the current project and invokes the existing method setup handoff (which reloads method rows). Already installed methods open their saved recipe without reinstalling; disabled or recipe-less copies open their method details instead. The file check/save/open-once route remains the second option.

Settings → Skills previews registered GAID hub entries through the unchanged SkillsPanel trust/staging-token/install gate. Previous site/URL/archive inputs mount only when "이전 skill_hub" is expanded. The server reads the selected immutable shared revision, checks archive SHA/size and method identity/revision/digest, and stages it with origin kind `gaid-hub` plus entry id/revision. Existing package limits and tree checks remain. No edits to parent-owned hub/authoring/shared service code or settled interfaces.

Verification (2026-10-20):
- `cd server && npm run typecheck` passed.
- `cd server && npx vitest run test/geo-skill-hub.test.ts test/geo-methods.test.ts`: 27 passed.
- `cd web && npx tsc --noEmit` passed.
- `cd web && npx vitest run src/geo/hub-picker/hub-picker.test.tsx src/geo/skill-hub/skill-hub.test.tsx src/geo/workspace/workspace.test.tsx src/geo/methods/methods.test.tsx src/components/skills-panel.test.tsx`: 69 passed.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 0 errors; 61 existing warnings, none in hubPicker.
- `node geo/ui/check-ui.mjs`: 0 errors; 89 existing accepted debt, unchanged.
- `git diff --check` passed.
- Isolated trial UI/API on 3381/18381 used `~/data/geoaidesk/work/gaid-hub-editing--hub-in-project/home`; copied projects, catalogue cache and hub records from the parent's trial (no credentials/config copied). Real browser: installed entry `entry-ap-a135f290-1c4` revision 2 into copied `review-note-style`, saw the method rows refresh and its setup open, and previewed the same entry in SkillsPanel with trust and install still required. No chat/model call or environment preparation was started. Browser console: 0 errors.
- Screenshots (Korean): `reports/2026-10-20-gaid-hub-editing/figures/p1-recipe-list-{1440,1280}.png`, `p1-recipe-selected-{1440,1280}.png`, `p1-skills-{1440,1280}.png`. Originals: `~/data/geoaidesk/work/gaid-hub-editing--hub-in-project/playwright/` (same names). Each is under 180 KB. Visually checked at 1440×900 and 1280×800; selected actions fit without scrolling, lists scroll internally, no horizontal page overflow. UI guide: P1–P4, P6, L6, T1, S1/S3/S5, B1/B2, D2/D3, G1–G3, F1/F3/F4, A1–A3/A5, W1–W6, R1/R2. No new accepted debt. Keyboard focus remains visible; controls have accessible names; source selection uses aria-pressed and a border, not colour alone.

Report-ready Korean prose (polished in file mode with humanizer Korean rules; scope and verification preserved):

### 프로젝트에서 GAID 허브의 레시피와 스킬 가져오기

레시피 가져오기를 열면 GAID 허브의 레시피 목록이 먼저 표시됩니다. 분석 방법을 선택하고 코드 실행에 동의하면 현재 프로젝트에 선택한 판을 설치한 뒤 레시피의 시작 설정을 엽니다. 이미 설치된 방법은 다시 설치하지 않고 프로젝트에 저장된 레시피를 엽니다. 비활성화됐거나 레시피가 없는 방법은 상세 화면에서 상태를 확인합니다. 저장한 파일을 가져오는 기존 경로도 유지했습니다.

설정의 스킬 추가에서도 GAID 허브를 먼저 검색합니다. 선택한 판의 패키지를 미리 확인한 뒤 기존 소스 신뢰 확인과 설치 절차를 따릅니다. 이전 사이트와 URL·파일 입력은 접힌 “이전 skill_hub”에서 열 수 있습니다. 서버는 등록한 판의 패키지 해시와 파일 목록을 확인합니다.

관련 프런트엔드 시험 69개와 백엔드 시험 27개, 양쪽 형식 검사, 문자열 검사와 UI 검사가 통과했습니다. 별도 시험용 앱에서도 레시피 설치 후 시작 설정 열기와 스킬 미리보기를 확인했습니다. 한국어 화면은 1440×900과 1280×800에서 확인했습니다. 실제 분석이나 모델 호출은 실행하지 않았습니다. 전체 검사와 배포는 상위 작업에서 진행합니다.

## Next steps
1. Save the reviewed files and finish this child; parent integrates with `task complete gaid-hub-editing--hub-in-project`, runs full `scripts/check`, and adds the prose/screenshots to its canonical report.
## Failed approaches
- First resume met another task transaction; a retry succeeded in the same printed worktree.
- Dependencies were absent (`tsc: not found`); ran `npm ci` in server/web, with no lockfile changes.
- First frontend run had one obsolete legacy test mock returning a preview object for the new listing route; corrected the fixture and retained the legacy gate test. All later focused checks passed.
- Codegraph exists but this exact worktree has no index; followed its fallback to direct local reads, with no indexing.
- One screenshot attempt timed out after development HMR closed the dialog; inspected the UI state, reopened Settings and recaptured both Skills screenshots. The final six PNGs were inspected.

The isolated browser and both trial services were stopped after verification. Data/logs remain outside Git for reproduction; no deployment was changed.
## Notes and decisions
This child owns hub-picker, RecipeAdd, skill-hub preview UI/server, their tests, locale namespace registration and concise AGENTS documentation. The parent owns hub screens and shared-hub service. Work is tightly coupled and done by this writer; no further child units. Integration order: preview contract → picker → entry points → tests and screenshots.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)

### String catalogue delta

All ids below are new; before = absent in ko/en. Existing workspace and skillHub strings are unchanged and reused. The hub recipe description is selected only on the new hub route; the previous description remains on file import.

| Id | Korean after | English after |
|---|---|---|
| `hubPicker.search.label` | GAID 허브 검색 | Search GAID hub |
| `hubPicker.search.placeholder` | 이름이나 분석 주제 검색 | Search by name or research topic |
| `hubPicker.loading` | 허브 목록을 읽는 중입니다. | Reading hub entries. |
| `hubPicker.error` | 허브 목록을 읽지 못했습니다. 다시 읽으세요. | Could not read hub entries. Reload the list. |
| `hubPicker.retry.button` | 목록 다시 읽기 | Reload list |
| `hubPicker.empty` | 조건에 맞는 항목이 없습니다. 검색어를 바꾸세요. | No entries match. Change the search term. |
| `hubPicker.emptyRecipes` | 조건에 맞는 레시피가 없습니다. 검색어를 바꾸거나 파일에서 가져오세요. | No recipes match. Change the search term or import a file. |
| `hubPicker.results` | 허브 검색 결과 | Hub search results |
| `hubPicker.stars` | ★ {count} | ★ {count} |
| `hubPicker.revision` | 판 {count} | Revision {count} |
| `hubPicker.kind.skill` | 스킬 | Skill |
| `hubPicker.kind.workflow` | Workflow | Workflow |
| `hubPicker.kindTip` | 허브에 등록된 분석 방법의 유형입니다. | The type of research method registered in the hub. |
| `hubPicker.recipe` | 레시피 | Recipe |
| `hubPicker.recipeTip` | Workflow에 저장된 시작 설정이 있습니다. | The Workflow has saved start settings. |
| `hubPicker.browse.button` | GAID 허브에서 찾기 | Find in GAID hub |
| `hubPicker.file.button` | 파일에서 가져오기 | Import from file |
| `hubPicker.description` | GAID 허브의 레시피를 찾거나 저장한 파일을 가져옵니다. | Find recipes in GAID hub or import a saved file. |
| `hubPicker.back.button` | 목록으로 돌아가기 | Back to list |
| `hubPicker.installHelp` | 현재 프로젝트에 분석 방법을 설치하고 레시피의 시작 설정을 엽니다. | Install the research method into the current project and open the recipe's start settings. |
| `hubPicker.consent` | 설치할 방법이 프로젝트에서 코드를 실행할 수 있음을 확인했습니다. | I understand that the method to install can run code in the project. |
| `hubPicker.install.button` | 설치 후 시작 설정 열기 | Install and open start settings |
| `hubPicker.installing` | 분석 방법을 설치하는 중입니다. | Installing the research method. |
| `hubPicker.installError` | 분석 방법을 설치하지 못했습니다. 허브에서 선택한 판을 확인한 뒤 다시 시도하세요. | Could not install the research method. Check the selected revision in the hub and try again. |
| `hubPicker.installed` | 프로젝트에서 이미 사용할 수 있습니다. 저장된 시작 설정을 엽니다. | Already available in the project. Open its saved start settings. |
| `hubPicker.installedNeedsCheck` | 이미 설치된 분석 방법입니다. 분석 방법을 열어 사용 상태와 레시피를 확인하세요. | This method is already installed. Open it to check its availability and recipes. |
| `hubPicker.method.button` | 분석 방법 열기 | Open research method |
| `hubPicker.open.button` | 시작 설정 열기 | Open start settings |
| `hubPicker.methodsError` | 설치된 분석 방법을 읽지 못했습니다. 대화창을 닫고 다시 여세요. | Could not read installed methods. Close and reopen the dialog. |
| `hubPicker.skillTitle` | GAID 허브에서 스킬 찾기 | Find skills in GAID hub |
| `hubPicker.skillHelp` | 스킬을 선택한 뒤 포함 파일을 미리 확인합니다. | Select a skill, then preview its included files. |
| `hubPicker.preview.button` | 패키지 미리보기 | Preview package |
| `hubPicker.legacy` | 이전 skill_hub | Previous skill_hub |
| `hubPicker.previewSource` | GAID 허브 · {title} · 판 {count} | GAID hub · {title} · revision {count} |

## Open items
None.
## Report
Child unit contributes the report-ready prose and tracked `p1-*.png` figures above to the parent's canonical report `reports/2026-10-20-gaid-hub-editing/index.md`; no separate child report.

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

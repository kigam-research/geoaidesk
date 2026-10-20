---
format: 1
status: ready
updated: 2026-10-20T14:04:16Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"6937d947-6bbc-4ef2-a026-3c4433c4937e","pid":1723062,"provider":"codex","session":"01a1597a-323e-7433-b81f-ae6c86fe977e","start":"39048145","token":"3b0452194c456f2ac2c267aeba20dc29fceeb7207688aedc9fc6cedbbaf8a7e1"}
branch: task/gaid-workflow-model--terms
target: task/gaid-workflow-model
parent: gaid-workflow-model
---
# gaid-workflow-model--terms

## Goal and done criteria
Request from the starter:

# Child task: gaid-workflow-model--terms

Parent: gaid-workflow-model (geoaidesk). Read the parent's phase-1 report first:
reports/2026-10-20-gaid-workflow-model/index.md (sections 3.2, 3.6, 3.8, 3.10) and the parent task document's
"Notes and decisions". The user accepted all recommendations on 2026-10-20 (quote in the parent task document).
skill_hub is legacy: do not touch skill_hub, its contract, or the collapsed "이전 skill_hub" section beyond wording.

## Goal
Make every GAID screen use the agreed terms and link the skills screens to Workflows, and fix three defects.
No package/format change (gaid-method/v1 stays), no change to stored data.

## Agreed terms (report 3.8)
- Hub unit and Workflow panel row: "Workflow" (Latin script in Korean copy too). Replace 방법 / 분석 방법 / 허브 방법 /
  방법 흐름 / 방법 소개 / 내 방법 wherever they mean the hub unit (hub, hubPicker, hubHandoff, methods, skillHub,
  workspace, previewMethod, authoringPreview, app namespaces). Keep ordinary uses of 방법/방식 (설치 방법, 산정 방식 ...).
  "방법 흐름" → "Workflow 단계"; "방법 상세 보기" → "Workflow 상세 보기"; "복사해서 고치기" hint "내 Workflow로 복사해 고칩니다…".
- Catalogue Workflows: "기본 Workflow" (category/badge on hub recommended cards and Workflow panel; keep the 지구과학
  discipline as the panel group name only if it reads better — report which you chose).
- Upstream BYOK Workflows: "일반 Workflow" group (keeps "출처: K-Dense" badge).
- 레시피 / 시작 설정 / 저장한 레시피 → "저장한 시작 설정" ("레시피 가져오기" → "시작 설정 가져오기" or "허브에서 Workflow
  가져오기" when it searches the hub — pick by what the button does). Leave the research namespace's unrelated 레시피.
- Revision: "판" only ("1판"); do not show "revision" or the semver next to it in researcher views.
- Never show internal names: 패키지/허브 패키지/gaid-method in researcher copy.
- Hub glossary (hub/ko.json "허브에서 쓰는 말"): Workflow = "연구 작업 하나를 AI agent에게 맡기는 절차입니다. 입력 자료,
  연구자가 정할 조건, 단계, AI agent 지시문, 사용하는 스킬, 결과와 해석 한계로 이루어집니다."; 스킬 = "Workflow가 쓰는
  지침과 도구 꾸러미입니다. 기본 제공 스킬, GitHub 등에서 가져온 스킬, Workflow에 딸린 스킬이 있습니다."; 저장한 시작 설정 =
  "Workflow의 입력과 조건 값을 미리 정해 둔 것입니다."; remove the 방법 entry. English with the same meaning.
- geo/copy/terminology.csv: update `workflow` definition to the glossary text; add rows 저장한 시작 설정 (saved start
  settings; forbidden_ko 레시피 in GAID UI copy except the research namespace — check validator support, otherwise put it
  in the note column) and 기본 Workflow / 일반 Workflow; add 방법 as forbidden for the hub unit only if the validator can
  scope it, else a note.
- Authoring prompt (server/src/geo/authoring/prompts.ts): new drafts must not title a Workflow "…레시피"; the
  saved-start-settings title is "<Workflow title> 기본 설정". Existing stored titles stay.

## Decision 2 (hub registers Workflows only, for now)
Authoring: hide/remove the "skill only" target for new drafts; registration refuses a draft without a Workflow with a
clear message and the fix. Existing entries are all Workflows. Skills will be managed in the GAID hub later (not now).

## Skills screens linkage (report 3.10 item 3)
- Settings → Skills: a skill installed from the GAID hub shows "「<Workflow title>」 Workflow에 딸린 스킬" (+ 판)
  instead of the internal storage path; no absolute paths in that row.
- Add a read-only "지침 보기" (SKILL.md and the skill's file list) for every skill row; editing stays behind the pencil.
- "스킬 추가": put "GitHub 등에서 가져오기" (owner/repo, Git URL, local path; existing upstream flow) first; remove the GAID
  hub search from Settings → Skills (hub Workflows are installed from the hub or the Workflow panel). Keep the collapsed
  legacy skill_hub section as is.

## Defects
1. Registration dialog copy "공유: 스킬·Workflow 파일, 방법 흐름, 검사 기록, 시험 평가" over-promises: state what is
   actually shared (check hub-shared routes) .
2. Installing another researcher's registered entry labels it "GAID 허브에서 만든 초안"/초안: show 등록됨 + 판 for a
   registered entry install, 초안 only for a draft (server/src/geo/authoring/install.ts origin + methods locale).
3. Install from the hub (shared entry "내 프로젝트에서 시험", hub picker, draft trial) shows no preview: show the existing
   preview (skill name, files, code present, what will run) before the consent checkbox.

## Out of scope (parent owns)
The Workflow composition view, the Workflow runtime form in chat, hub flow decision-count fix, any new locale namespace
for those, format changes.

## Rules and checks
- Follow AGENTS.md UI copy rules (geo/copy/gaid-writing.md, terminology.csv; Korean first; string ids before/after
  in your report) and docs/design/ui-guide.md (sections 1, 9 and touched components); add upstream files you edit to
  geo/integration-boundaries.json with owner gaid-workflow-model.
- Verify in a running app with an isolated GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model--terms/ (copy of
  ~/data/geoaidesk/work/gaid-workflow-model/home is fine; never ~/.geoaidesk); Korean screenshots at 1440×900 and
  1280×800 of: hub entry, hub home, Workflow panel, Workflow detail, Settings → Skills row + 지침 보기, install preview.
- Run scripts/check (needs catalogue asset; report any step that cannot run). Remove build caches before finishing.
- Report: add a section to the parent's report is the parent's job; put your change list (string ids ko/en before →
  after, rule ids, screenshots under ~/data/... with sha256, check results) in your task document's Current state,
  first and self-contained, and small PNGs only if the parent asks.

## Current state
Child-scoped implementation and checks are complete; final integrated submission validation is being retried. Workflow terminology, skill-screen linkage, Workflow-only registration and all three install previews are implemented and pushed. Existing stored titles/data and gaid-method/v1 remain unchanged. All declared scripts/check stages passed across job 5's backend/frontend/launcher prefix and job 7's distribution-to-production suffix (exit 0). Backend: 1,953 passed, 8 skipped; frontend: 1,111 passed; GAID tests: 48 passed, 1 skipped. Copy/UI validators passed, both environment targets imported all required modules, and clean-start/stop/restart production smoke passed. Eighteen Korean screenshots at both required sizes and 171 exact bilingual copy changes are recorded below. Browser review and temporary app cleanup are complete; no deployment was performed. The parent owns the canonical report, composition-screen integration and final product completion.

### Delivered result

- Normalized hub units and Workflow rows to Workflow; catalogue group/card label is 기본 Workflow, upstream folded group is 일반 Workflow with K-Dense attribution retained. Saved presets are 저장한 시작 설정; revisions render as `1판` without a semver. Ordinary scientific-method wording and the unrelated research namespace are preserved.
- Updated the hub glossary and geo/copy/terminology.csv; created docs/glossary.md. The validator cannot scope forbidden words by concept/namespace, so scoped exclusions for 방법/레시피 are glossary notes rather than global bans.
- New authoring UI targets Workflow, hides auto/skill-only choices, and prompts forbid Workflow titles ending 레시피. Newly built saved settings use `<Workflow title> 기본 설정`; existing titles are untouched. Shared registration rejects workflow-less drafts with a recovery instruction.
- Settings → Skills now starts with GitHub/local-source import. Shared-hub search is removed there; the collapsed previous skill_hub route keeps its existing behavior. Each row offers read-only SKILL.md and a bounded file listing; the pencil remains the editor. GAID-hub skills show the Workflow title and registered revision instead of the source storage path.
- All three install routes (shared entry, hub picker, draft trial) use one preview before consent: skill name, included files, executable-code state and the start request. Missing/failed preview keeps consent and installation disabled; moving to a new draft revision clears the earlier consent. Draft preview checks the exact built archive and does not install it.
- Registered-entry installation records its shared entry/revision in the origin sidecar; researcher badges show 등록됨 + 판, while unregistered drafts keep 초안. This is runtime origin metadata, not a gaid-method/v1 format change.
- Registration copy distinguishes the shared file-check summary from private project execution records/trial assessments. The actual archive includes the file-check summary, so it is explicitly listed as shared.
- Import labels now distinguish the actions: hub search uses `workspace.recipe.import` (허브에서 Workflow 가져오기); direct `.geo-start.json` imports use `workspace.recipe.importFile` (시작 설정 가져오기).

### Verification and integration notes

- Backend typecheck and frontend TypeScript check passed locally. Focused shared-hub integration: 12/12 passed, including rejection of skill-only registration, a non-installing exact-byte draft preview and preservation of registered origin identity.
- Full scripts/check evidence is split at the metadata-only owner-registry fix: job 5 (`f9e8125e94af`) passed backend typecheck, 1,953 backend tests (8 skipped), 1,111 frontend tests and the development launcher check. The only later source change was the explicit distribution owner registry/seam metadata. Job 7 (`0b09c95fc8fa`) reran the failed distribution stage and every remaining original stage: 48 GAID tests passed (1 skipped), copy/UI checks passed, all 13 required modules imported in both helper and fresh-project environments, GAID launcher check passed, and clean start/stop/restart production smoke passed (exit 0). Job-7 receipt: `/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T135230.391770Z/receipt.json`. Full logs retain earlier failed attempts and their superseding dispositions. No passed backend/frontend suite was replayed for the registry-only fix.
- Focused checks additionally passed: portability + shared-hub integration 32/32 and the final local-file import-label workspace suite 26/26.
- Copy validator: 0 errors, 61 warnings. UI guide checker: 0 errors, 89 pre-existing accepted debt entries. No UI debt was added. `git diff --check` passed.
- Production UI built successfully in the isolated app job at 55a3b22c479c. Browser review used GAID_HOME under this unit's external work directory (a sanitized parent review-data copy), not ~/.geoaidesk. A newly created test project installed another researcher's registered Workflow through preview → consent → install. Confirmed `등록됨 · 1판`, title-based skill provenance, read-only instructions and GitHub-first import. No model/research execution was started. Browser console: 0 errors; 2 existing Radix missing-description warnings on dialogs. All observed task-path API requests succeeded.
- UI rules followed: P1/P3/P4/P6 (one task, disclosures, contextual read-only view, researcher terms), B2/B3 (named row action), D3 (inline read-only instructions inside the existing settings dialog), S5 (preview readiness gates), G1/G2, W5, R1. Checked section 10 at 1440×900 and 1280×800: no page horizontal overflow or clipped primary action in the changed default states; file/prompt details stay folded initially. Legacy method-detail density is unchanged and the parent-owned composition screen supersedes it.
- 18 Korean screenshots cover hub home, hub entry, installation preview, skill row, read-only instructions, GitHub-first skill import, Workflow panel/detail and general Workflow attribution at both required sizes. Full paths and hashes are below. App source predates only final sharing-copy precision and local-file import wording; the photographed changes are otherwise final.
- Isolated app/browser stopped after review. Current worktree build caches (`web/.next`, tsbuildinfo, Vite caches) removed. Obsolete check jobs 1 and 3 were stopped and disposed as superseded by job 4; the app job 2 was disposed as intentionally cancelled after successful review. Its later `lost` notice is expected: systemd intentionally stopped the foreground app, so there is no natural exit receipt; the log confirms successful production start and browser/API use through review completion. Do not restart that app job. Logs/receipts remain intact.
- Parent owns the single canonical report and composition UI. Update the project AGENTS.md summary during parent integration: Skills no longer searches the shared hub, new drafts target Workflow, and registration requires a Workflow. Do not change skill_hub or its contract.

### Remaining-check execution

- Suffix script: `/home/seongin3/data/geoaidesk/work/gaid-workflow-model--terms/remaining-checks.sh`, SHA-256 `6d46a3b0df55d0e2430438c1fd339bed555364225bf0eb07514954dbba32d793`. It installs both lockfiles and the frozen scientific-helper environment in the fresh source snapshot, then executes the original step() helper plus the unmodified scripts/check suffix from `GAID: distribution checks` to its end. No passed backend/frontend test stage is replayed for the registry-only fix.

### Screenshot evidence

External directory: `/home/seongin3/data/geoaidesk/work/gaid-workflow-model--terms/playwright/`.

| Screenshot | Dimensions | SHA-256 |
|---|---|---|
| general-workflows-1280.png | 1280×800 | `738fbe119f9ccabeefb90ebad3e826fff71c6d4e60d6df8c8081a023719107eb` |
| general-workflows-1440.png | 1440×900 | `7447d8164a46bec251d7b87e1e9bee7e04b6174f546948b267f976569cd863b3` |
| hub-entry-1280.png | 1280×800 | `68a2ec31cd333346cb7e4495d5ee4607ab0da7702e934ef78e80cb80a70efa53` |
| hub-entry-1440.png | 1440×900 | `a1c08d7d4a202c33c6c950252e7728d6cab31101ca835e90b95f7c09426f45ea` |
| hub-home-1280.png | 1280×800 | `d3b184a7440f6bd616f6269ad3ea4099a0e49e3815b1a899609c1d20a1286d7a` |
| hub-home-1440.png | 1440×900 | `0573dec1e51f0157045999de01ed8d718496280ef279cf6c50bd51321e2d6149` |
| install-preview-1280.png | 1280×800 | `d8285b7c62c4e5b74430f157ff15224fd88819c292d803a5b18e7ad7c3e10613` |
| install-preview-1440.png | 1440×900 | `fdebb250849d1e8b271db42ca5265e3285bcc81d18656ba2c803fef8ffbd1ce0` |
| skill-instructions-1280.png | 1280×800 | `a03d29f2f971537cc4bcf8e384c5ce4539719eba0256d48644452d494a34026a` |
| skill-instructions-1440.png | 1440×900 | `99966a46e8d93ba21951da86bd82496f7bdce1d613a38f1431c2cab5a44e2987` |
| skills-add-1280.png | 1280×800 | `2ea672a67f1bb11fc1af7d11eed29c0ae93d98652a6305f974b92b57c614422f` |
| skills-add-1440.png | 1440×900 | `01f62636dccc10fa805c804492abd455d1e449fdf16e7b446eaf82e898afc162` |
| skills-row-1280.png | 1280×800 | `2c447a704028267b7b83de91494895062e7a93d90047a9d69e0f867d43f07786` |
| skills-row-1440.png | 1440×900 | `90f18989abc1784e9e5d1afc6315c4fe472868faa50f73468341196fd064f1ae` |
| workflow-detail-1280.png | 1280×800 | `2fdbd0ee2b0c1745aeb244a2536b1616f69fc55fa6d598d0580ae2cc4f8e2ff5` |
| workflow-detail-1440.png | 1440×900 | `fd00ed9cadcff950ce266db08f5304264670b7195adc13f7ddcf254c8c68c547` |
| workflow-panel-1280.png | 1280×800 | `4ad9fb30714a2075c378eb33a28de469372354c157a061b221ff21eabcbc0be2` |
| workflow-panel-1440.png | 1440×900 | `c3323e7db0aff4b5939e405bcba48133deb471e24436dd3886b238b2b96f05d3` |

### Exact UI copy changes

Baseline: child activation 05fd2f9. Complete ko/en before → after values (including added/removed ids); kept in this task document for the parent's change report. User-authored stored content is not rewritten.

<details><summary>String catalogue changes</summary>

| String id | Korean before → after | English before → after |
|---|---|---|
| `app.projects.each_project_keeps_its_files_chats_notebook` | 프로젝트마다 파일, 대화, 연구 노트, 연구 설정을 따로 보관합니다. GAID 허브의 분석 방법을 가져와 내 자료로 연구합니다. → 프로젝트마다 파일, 대화, 연구 노트, 연구 설정을 따로 보관합니다. GAID 허브의 Workflow를 가져와 내 자료로 연구합니다. | Each project keeps its files, chats, notebook and research settings. Bring analysis methods from the GAID hub and research with your data. → Each project keeps its files, chats, notebook and research settings. Bring analysis Workflows from the GAID hub and research with your data. |
| `authoringPreview.breadcrumb` | 연구 공간 / 새 연구 방법 → 연구 공간 / 새 Workflow | Research workspace / New research method → Research workspace / New research Workflow |
| `authoringPreview.draft.summary` | 희소한 양성 기록과 unlabeled 셀로 후보 지역을 평가하는 방법 초안입니다. 새 자료에 맞는 spatial block, 평가 기준과 불확실성 해석을 시험 전에 결정합니다. → 희소한 양성 기록과 unlabeled 셀로 후보 지역을 평가하는 Workflow 초안입니다. 새 자료에 맞는 spatial block, 평가 기준과 불확실성 해석을 시험 전에 결정합니다. | A draft method for assessing candidate areas from sparse positive records and unlabeled cells. Decide spatial blocks, evaluation criteria, and uncertainty interpretation for the new data before testing. → A draft Workflow for assessing candidate areas from sparse positive records and unlabeled cells. Decide spatial blocks, evaluation criteria, and uncertainty interpretation for the new data before testing. |
| `authoringPreview.nav.method` | 연구 방법 만들기 → Workflow 만들기 | Create a research method → Create a research Workflow |
| `authoringPreview.nav.scope` | 자료에서 방법을 정리하는 화면 시안입니다. → 자료에서 Workflow를 정리하는 화면 시안입니다. | A screen prototype for shaping methods from source material. → A screen prototype for shaping Workflows from source material. |
| `authoringPreview.steps.label` | 연구 방법 작성 단계 → Workflow 작성 단계 | Method authoring stages → Workflow authoring stages |
| `authoringPreview.steps.method` | 방법 다듬기 → Workflow 다듬기 | Refine method → Refine Workflow |
| `authoringPreview.title` | 논문에서 연구 방법 만들기 → 논문에서 Workflow 만들기 | Create a method from a paper → Create a Workflow from a paper |
| `hub.draft.flow` | 방법 흐름 → Workflow 단계 | Method flow → Workflow steps |
| `hub.editing.copy` | {author}의 「{title}」 {revision}판을 복사한 내 방법입니다. 등록하면 원본을 밝힌 별도 방법이 됩니다. → {author}의 「{title}」 {revision}판을 복사한 내 Workflow입니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. | Your copy of revision {revision} of “{title}” by {author}. Registered, it becomes a separate method that names the original. → Your copy of revision {revision} of “{title}” by {author}. Registered, it becomes a separate Workflow that names the original. |
| `hub.editing.edit` | 등록한 방법의 {revision}판을 고치고 있습니다. 허브에 등록하면 {next}판이 됩니다. → 등록한 Workflow의 {revision}판을 고치고 있습니다. 허브에 등록하면 {next}판이 됩니다. | You are editing revision {revision} of your registered method. Registering it in the hub makes revision {next}. → You are editing revision {revision} of your registered Workflow. Registering it in the hub makes revision {next}. |
| `hub.entry.body` | 연구자들이 등록한 분석 방법을 내 자료로 쓰거나, 내 논문·코드로 새 방법을 만듭니다. → 연구자들이 등록한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. | Use analysis methods other researchers registered with your own data, or make a new method from your paper or code. → Use analysis Workflows other researchers registered with your own data, or make a new Workflow from your paper or code. |
| `hub.home.body` | 연구자들이 등록한 분석 방법을 내 자료로 쓰거나, 내 논문·코드로 새 방법을 만듭니다. → 연구자들이 등록한 Workflow를 내 자료로 쓰거나, 내 논문·코드로 새 Workflow를 만듭니다. | Use analysis methods other researchers registered with your own data, or make a new method from your paper or code. → Use analysis Workflows other researchers registered with your own data, or make a new Workflow from your paper or code. |
| `hub.home.browse.count` | 방법 {count}개 → Workflow {count}개 | {count} methods → {count} Workflows |
| `hub.home.browse.empty` | 등록된 방법이 없습니다. 추천 분석 방법을 살펴보세요. → 등록된 Workflow가 없습니다. 추천 Workflow를 살펴보세요. | No methods are registered. Browse the recommended analysis methods. → No Workflows are registered. Browse the recommended analysis Workflows. |
| `hub.home.browse.error` | 등록 방법을 읽지 못했습니다. 목록을 다시 읽으세요. → 등록 Workflow를 읽지 못했습니다. 목록을 다시 읽으세요. | Could not read registered methods. Reload the list. → Could not read registered Workflows. Reload the list. |
| `hub.home.browse.folders` | 등록 방법 주제 폴더 → 등록 Workflow 주제 폴더 | Registered method topic folders → Registered Workflow topic folders |
| `hub.home.browse.loading` | 등록 방법을 읽는 중입니다. → 등록 Workflow를 읽는 중입니다. | Reading registered methods. → Reading registered Workflows. |
| `hub.home.browse.noResults` | 조건에 맞는 방법이 없습니다. 검색어나 폴더를 바꾸세요. → 조건에 맞는 Workflow가 없습니다. 검색어나 폴더를 바꾸세요. | No methods match. Change the search term or folder. → No Workflows match. Change the search term or folder. |
| `hub.home.browse.recommended.action` | 추천 분석 방법 보기 → 추천 Workflow 보기 | View recommended methods → View recommended Workflows |
| `hub.home.browse.reset.button` | 전체 방법 보기 → 전체 Workflow 보기 | View all methods → View all Workflows |
| `hub.home.browse.search.hint` | 원소 기호(Ni)나 방법 이름(PU)으로도 찾을 수 있습니다. → 원소 기호(Ni)나 Workflow 이름(PU)으로도 찾을 수 있습니다. | You can also search by element symbol (Ni) or method name (PU). → You can also search by element symbol (Ni) or Workflow name (PU). |
| `hub.home.browse.search.label` | 등록 방법 검색 → 등록 Workflow 검색 | Search registered methods → Search registered Workflows |
| `hub.home.browse.tabs` | 방법 목록 → Workflow 목록 | Method lists → Workflow lists |
| `hub.home.browse.title` | 허브에 등록된 방법 → 허브에 등록된 Workflow | Methods registered in the hub → Workflows registered in the hub |
| `hub.home.catalogue` | 카탈로그 → 기본 Workflow | Catalogue → Built-in Workflow |
| `hub.home.empty` | 만든 방법이 없습니다. 논문 PDF나 코드를 올려 시작하세요. → 만든 Workflow가 없습니다. 논문 PDF나 코드를 올려 시작하세요. | No methods yet. Upload a paper PDF or code to start. → No Workflows yet. Upload a paper PDF or code to start. |
| `hub.home.glossary.draft.text` | 아직 허브에 등록하지 않은 방법입니다. 다른 연구자의 허브 목록에는 나오지 않습니다. → 아직 허브에 등록하지 않은 Workflow입니다. 다른 연구자의 허브 목록에는 나오지 않습니다. | A method not yet registered in the hub. It does not appear in other researchers' hub lists. → A Workflow not yet registered in the hub. It does not appear in other researchers' hub lists. |
| `hub.home.glossary.method.term` | 방법 → (absent) | Method → (absent) |
| `hub.home.glossary.method.text` | 허브에 올라오는 분석 단위입니다. 스킬 하나와, 있으면 Workflow 하나로 이루어집니다. → (absent) | The unit of analysis in the hub: one skill and, when present, one Workflow. → (absent) |
| `hub.home.glossary.recipe.term` | 시작 설정 → 저장한 시작 설정 | Start settings → Saved start settings |
| `hub.home.glossary.recipe.text` | Workflow를 시작할 때 미리 골라 둔 값입니다. 레시피라고도 부릅니다. → Workflow의 입력과 조건 값을 미리 정해 둔 것입니다. | Values chosen in advance for starting a Workflow, also called a recipe. → Preset input and condition values for a Workflow. |
| `hub.home.glossary.revision.text` | 등록한 방법을 고쳐 다시 등록할 때마다 올라가는 번호입니다. 의견은 판마다 남습니다. → 등록한 Workflow를 고쳐 다시 등록할 때마다 올라가는 번호입니다. 의견은 판마다 남습니다. | The number that goes up each time a registered method is revised and registered again. Comments stay with their revision. → The number that goes up each time a registered Workflow is revised and registered again. Comments stay with their revision. |
| `hub.home.glossary.skill.text` | AI agent가 따르는 분석 지침입니다. 실행 코드가 함께 들어 있는 스킬도 있습니다. → Workflow가 쓰는 지침과 도구 꾸러미입니다. 기본 제공 스킬, GitHub 등에서 가져온 스킬, Workflow에 딸린 스킬이 있습니다. | Analysis instructions the AI agent follows. Some skills also include run code. → Instructions and tools used by a Workflow: built-in skills, skills imported from GitHub or other sources, and skills included with a Workflow. |
| `hub.home.glossary.trial.text` | 내 프로젝트에서 방법을 실제로 실행해 본 기록입니다. 검토 결과는 아닙니다. → 내 프로젝트에서 Workflow를 실제로 실행해 본 기록입니다. 검토 결과는 아닙니다. | A record of running the method in your project. It is not a review result. → A record of running the Workflow in your project. It is not a review result. |
| `hub.home.glossary.workflow.text` | 스킬을 내 자료로 시작하는 순서입니다. 입력 파일과 미리 정할 값을 묻습니다. → 연구 작업 하나를 AI agent에게 맡기는 절차입니다. 입력 자료, 연구자가 정할 조건, 단계, AI agent 지시문, 사용하는 스킬, 결과와 해석 한계로 이루어집니다. | The steps to start a skill with your data. It asks for input files and values to set first. → A procedure for assigning one research task to an AI agent. It includes input data, researcher choices, steps, agent instructions, skills, outputs and interpretation limits. |
| `hub.home.mine` | 내가 만든 방법 (초안과 등록한 것) → 내가 만든 Workflow (초안과 등록한 것) | Methods I made (drafts and registered) → Workflows I made (drafts and registered) |
| `hub.home.new` | 방법 만들기 → Workflow 만들기 | Make a method → Make a Workflow |
| `hub.home.recommended` | 추천 분석 방법 → 추천 Workflow | Recommended analysis methods → Recommended analysis Workflows |
| `hub.home.route.make.body` | 논문이나 코드를 올리고 질문에 답하면 방법 초안이 만들어집니다. → 논문이나 코드를 올리고 질문에 답하면 Workflow 초안이 만들어집니다. | Upload a paper or code and answer the questions to get a method draft. → Upload a paper or code and answer the questions to get a Workflow draft. |
| `hub.home.route.make.title` | 내 논문으로 방법 만들기 → 내 논문으로 Workflow 만들기 | Make a method from your paper → Make a Workflow from your paper |
| `hub.home.route.use.body` | 방법을 골라 내 프로젝트에 설치하고 내 자료로 시작합니다. → Workflow를 골라 내 프로젝트에 설치하고 내 자료로 시작합니다. | Pick a method, install it in your project and start it with your data. → Pick a Workflow, install it in your project and start it with your data. |
| `hub.home.route.use.button` | 방법 둘러보기 → Workflow 둘러보기 | Browse methods → Browse Workflows |
| `hub.home.route.use.title` | 등록된 방법 쓰기 → 등록된 Workflow 쓰기 | Use a registered method → Use a registered Workflow |
| `hub.overview.about` | 방법 소개 → Workflow 소개 | About this method → About this Workflow |
| `hub.overview.aboutLess` | 방법 소개 접기 → Workflow 소개 접기 | Show less → Show less |
| `hub.overview.aboutMore` | 방법 소개 더 보기 → Workflow 소개 더 보기 | Show more about the method → Show more about the Workflow |
| `hub.overview.jumpFlow` | 방법 흐름 → Workflow 단계 | Method steps → Workflow steps |
| `hub.overview.process` | 방법 → 단계 | Method → Steps |
| `hub.prep.extraPackages` | 준비된 환경 밖의 패키지: {packages}. 분석할 때 AI agent가 스킬 안내에 따라 설치합니다. 설치가 막힌 PC에서는 해당 단계가 멈춥니다. → 준비된 환경 밖의 Python 라이브러리: {packages}. 분석할 때 AI agent가 스킬 안내에 따라 설치합니다. 설치가 막힌 PC에서는 해당 단계가 멈춥니다. | Packages outside the prepared environment: {packages}. The AI agent installs them during the analysis as the skill describes. On a PC that blocks installation, those steps stop. → Python libraries outside the prepared environment: {packages}. The AI agent installs them during analysis following the skill instructions. If installation is blocked, that step stops. |
| `hub.prep.loading` | 설치한 방법을 확인하는 중입니다. → 설치한 Workflow를 확인하는 중입니다. | Checking the installed method. → Checking the installed Workflow. |
| `hub.prep.noWorkflow` | 설치한 방법에 Workflow가 없습니다. 프로젝트의 Workflow 패널에서 방법을 여세요. → 설치한 Workflow에 Workflow가 없습니다. 프로젝트의 Workflow 패널에서 Workflow를 여세요. | The installed method has no Workflow. Open the method from the project's Workflow panel. → The installed Workflow has no Workflow. Open the Workflow from the project's Workflow panel. |
| `hub.questions.link` | 방법과의 연결 → Workflow와의 연결 | Where it goes → Where it goes |
| `hub.reading.analysis` | 방법과 빠진 결정 찾는 중 → Workflow와 빠진 결정 찾는 중 | Finding the method and missing decisions → Finding the Workflow and missing decisions |
| `hub.reading.note` | 화면을 닫아도 계속 읽습니다. 허브 첫 화면의 '내가 만든 방법'에서 다시 열 수 있습니다. 논문이 길면 몇 분 넘게 걸립니다. → 화면을 닫아도 계속 읽습니다. 허브 첫 화면의 '내가 만든 Workflow'에서 다시 열 수 있습니다. 논문이 길면 몇 분 넘게 걸립니다. | Reading continues if you close this screen. Reopen it from 'Methods I made' on the hub home. A long paper takes several minutes or more. → Reading continues if you close this screen. Reopen it from 'Workflows I made' on the hub home. A long paper takes several minutes or more. |
| `hub.register.line` | 허브에 등록하면 다른 연구자가 보고 star와 의견을 남길 수 있습니다. 등록 전 모습을 먼저 확인하세요. → 허브에 등록하면 다른 연구자가 보고 star와 의견을 남길 수 있습니다. 등록 전 모습을 먼저 확인하세요. | Registered methods can be viewed, starred and discussed by other researchers. Check how it will look first. → Registered Workflows can be viewed, starred and discussed by other researchers. Check how it will look first. |
| `hub.register.notShared` | 공유하지 않음: 올린 원문 PDF와 압축 파일 원본, 연구 자료. 패키지에 넣은 코드는 공유됩니다. → 공유하지 않음: 올린 원문 PDF와 압축 파일 원본, 연구 자료, 프로젝트 실행 기록과 시험 평가 | Not shared: the uploaded PDF and archive files, research data. Code placed in the package is shared. → Not shared: original uploaded PDFs and archives, research data, project run records and trial assessments |
| `hub.register.shared` | 공유: 스킬·Workflow 파일, 방법 흐름, 검사 기록, 시험 평가 → 공유: Workflow 설명·단계·파일, 포함 코드·개념 그림, 파일 검사 요약 | Shared: skill and Workflow files, method flow, check record, trial assessments → Shared: Workflow description, steps and files, included code and concept pictures, file check summary |
| `hub.shared.basedOn` | {author}의 「{title}」 {revision}판을 복사해 고친 방법입니다. → {author}의 「{title}」 {revision}판을 복사해 고친 Workflow입니다. | Copied and edited from revision {revision} of “{title}” by {author}. → Copied and edited from revision {revision} of “{title}” by {author}. |
| `hub.shared.copy.hint` | 내 방법으로 복사해 고칩니다. 등록하면 원본을 밝힌 별도 방법이 됩니다. → 내 Workflow로 복사해 고칩니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. | Copies the method into your own methods. Registered, it becomes a separate method that names the original. → Copies the Workflow into your own Workflows. Registered, it becomes a separate Workflow that names the original. |
| `hub.shared.edit.button` | 방법 고치기 → Workflow 고치기 | Edit method → Edit Workflow |
| `hub.sources.goalPlaceholder` | 예: 다른 지역 격자 자료에 쓸 탐사 방법 → 예: 다른 지역 격자 자료에 쓸 탐사 Workflow | e.g. an exploration method for grid data from another region → e.g. an exploration Workflow for grid data from another region |
| `hub.sources.readDone` | 자료를 다 읽었습니다. 다음은 방법을 정하는 질문에 답할 차례입니다. → 자료를 다 읽었습니다. 다음은 Workflow를 정하는 질문에 답할 차례입니다. | The sources have been read. Next, answer the questions that decide the method. → The sources have been read. Next, answer the questions that decide the Workflow. |
| `hub.trial.consent` | 설치할 방법이 프로젝트에서 코드를 실행할 수 있음을 확인했습니다. → 설치할 Workflow가 프로젝트에서 코드를 실행할 수 있음을 확인했습니다. | I understand that the method to install can run code in the project. → I understand that the Workflow to install can run code in the project. |
| `hub.user.body` | 만든 방법, 등록, star, 의견에 표시할 이름입니다. 브라우저에 저장합니다. → 만든 Workflow, 등록, star, 의견에 표시할 이름입니다. 브라우저에 저장합니다. | The name shown on methods you make, registrations, stars and comments. It is saved in this browser. → The name shown on Workflows you make, registrations, stars and comments. It is saved in this browser. |
| `hub.visuals.explanation` | 방법을 설명하는 그림입니다. 분석 자료나 결과가 아니며, 초안과 hub 등록 화면에 표시됩니다. → Workflow를 설명하는 그림입니다. 분석 자료나 결과가 아니며, 초안과 hub 등록 화면에 표시됩니다. | Illustrations of the method, not analysis data or results. They appear in the draft and hub registration. → Illustrations of the Workflow, not analysis data or results. They appear in the draft and hub registration. |
| `hub.visuals.how` | 생성 방식 보기 → 생성 방식 보기 | View generation method → View generation Workflow |
| `hubHandoff.description` | 요청과 마지막 답변, 선택한 파일을 묶어 GAID 허브의 새 방법 초안 자료로 보냅니다. → 요청과 마지막 답변, 선택한 파일을 묶어 GAID 허브의 새 Workflow 초안 자료로 보냅니다. | Bundle the request, final answer and selected files and send them to the GAID hub as material for a new method draft. → Bundle the request, final answer and selected files and send them to the GAID hub as material for a new Workflow draft. |
| `hubHandoff.methodTrial` | 방법 시험 → Workflow 시험 | Method trial → Workflow trial |
| `hubHandoff.methodTrialLine` | 방법 {method} · 버전 {revision} · Workflow {workflow} → Workflow {method} · {revision}판 · {workflow} | Method {method} · version {revision} · Workflow {workflow} → Workflow {method} · revision {revision} · {workflow} |
| `hubHandoff.noAssessment` | 연구자 평가가 아직 없습니다. 방법 상세의 시험 기록에서 평가를 저장하면 함께 보냅니다. → 연구자 평가가 아직 없습니다. Workflow 상세의 시험 기록에서 평가를 저장하면 함께 보냅니다. | No researcher assessment yet. Save one in the method's trial record to send it along. → No researcher assessment yet. Save one in the Workflow's trial record to send it along. |
| `hubHandoff.note` | 만들 방법에 대한 메모 (선택, 최대 4,000자) → 만들 Workflow에 대한 메모 (선택, 최대 4,000자) | Note about the method to build (optional, up to 4,000 characters) → Note about the Workflow to build (optional, up to 4,000 characters) |
| `hubPicker.consent` | 설치할 방법이 프로젝트에서 코드를 실행할 수 있음을 확인했습니다. → 설치할 Workflow가 프로젝트에서 코드를 실행할 수 있음을 확인했습니다. | I understand that the method to install can run code in the project. → I understand that the Workflow to install can run code in the project. |
| `hubPicker.description` | GAID 허브의 레시피를 찾거나 저장한 파일을 가져옵니다. → GAID 허브에서 Workflow를 찾거나 저장한 시작 설정 파일을 가져옵니다. | Find recipes in GAID hub or import a saved file. → Find a Workflow in the GAID hub or import a saved start settings file. |
| `hubPicker.emptyRecipes` | 조건에 맞는 레시피가 없습니다. 검색어를 바꾸거나 파일에서 가져오세요. → 저장한 시작 설정이 있는 Workflow가 없습니다. 검색어를 바꾸거나 파일에서 가져오세요. | No recipes match. Change the search term or import a file. → No Workflows with saved start settings match. Change the search term or import a file. |
| `hubPicker.installError` | 분석 방법을 설치하지 못했습니다. 허브에서 선택한 판을 확인한 뒤 다시 시도하세요. → Workflow를 설치하지 못했습니다. 허브에서 선택한 판을 확인한 뒤 다시 시도하세요. | Could not install the research method. Check the selected revision in the hub and try again. → Could not install the Workflow. Check the selected revision in the hub and try again. |
| `hubPicker.installHelp` | 현재 프로젝트에 분석 방법을 설치하고 레시피의 시작 설정을 엽니다. → 현재 프로젝트에 Workflow를 설치하고 저장한 시작 설정을 엽니다. | Install the research method into the current project and open the recipe's start settings. → Install the Workflow into the current project and open its saved start settings. |
| `hubPicker.installedNeedsCheck` | 이미 설치된 분석 방법입니다. 분석 방법을 열어 사용 상태와 레시피를 확인하세요. → 이미 설치된 Workflow입니다. Workflow를 열어 사용 상태와 저장한 시작 설정을 확인하세요. | This method is already installed. Open it to check its availability and recipes. → This Workflow is already installed. Open it to check its availability and saved start settings. |
| `hubPicker.installing` | 분석 방법을 설치하는 중입니다. → Workflow를 설치하는 중입니다. | Installing the research method. → Installing the Workflow. |
| `hubPicker.kindTip` | 허브에 등록된 분석 방법의 유형입니다. → 허브에 등록된 Workflow의 유형입니다. | The type of research method registered in the hub. → The type of Workflow registered in the hub. |
| `hubPicker.method.button` | 분석 방법 열기 → Workflow 열기 | Open research method → Open Workflow |
| `hubPicker.methodsError` | 설치된 분석 방법을 읽지 못했습니다. 대화창을 닫고 다시 여세요. → 설치된 Workflow를 읽지 못했습니다. 대화창을 닫고 다시 여세요. | Could not read installed methods. Close and reopen the dialog. → Could not read installed Workflows. Close and reopen the dialog. |
| `hubPicker.preview.button` | 패키지 미리보기 → 파일 묶음 미리보기 | Preview package → Preview archive |
| `hubPicker.previewSource` | GAID 허브 · {title} · 판 {count} → GAID 허브 · {title} · {count}판 | GAID hub · {title} · revision {count} → GAID hub · {title} · revision {count} |
| `hubPicker.recipe` | 레시피 → 저장한 시작 설정 | Recipe → saved start settings |
| `hubPicker.recipeTip` | Workflow에 저장된 시작 설정이 있습니다. → Workflow에 저장한 시작 설정이 있습니다. | The Workflow has saved start settings. → The Workflow has saved start settings. |
| `hubPicker.revision` | 판 {count} → {count}판 | Revision {count} → Revision {count} |
| `methods.badge.codeTip` | 방법 패키지에 실행 코드가 들어 있는지 나타냅니다. → Workflow 파일 묶음에 실행 코드가 들어 있는지 나타냅니다. | Whether the method package contains executable code. → Whether the Workflow contains executable code. |
| `methods.badge.stageTip` | 허브에 기록된 방법 패키지의 단계입니다. 현재 프로젝트의 준비·시험 상태와 별개입니다. → 허브에 기록된 Workflow 파일 묶음의 단계입니다. 현재 프로젝트의 준비·시험 상태와 별개입니다. | The stage the hub records for this method package. Separate from this project's preparation and trials. → The stage the hub records for this Workflow. Separate from this project's preparation and trials. |
| `methods.detail` | 방법 상세 보기 → Workflow 상세 보기 | View method details → View Workflow details |
| `methods.empty` | 허브에서 설치한 Workflow가 없습니다. 설정 → 스킬에서 패키지를 미리 보고 설치하세요. → 허브에서 설치한 Workflow가 없습니다. GAID 허브에서 Workflow를 골라 설치하세요. | No Workflows are installed from the hub. Preview and install a package in Settings → Skills. → No hub Workflows installed. Choose and install a Workflow from the GAID hub. |
| `methods.issues` | 패키지 문제 → 파일 묶음 문제 | Package issues → Workflow file issues |
| `methods.origin.gaid-hub` | GAID 허브에서 만든 초안 → GAID 허브 | Draft made in the GAID hub → GAID hub |
| `methods.origin.hub` | skill_hub 초안·패키지 → skill_hub 초안·파일 묶음 | skill_hub draft/package → skill_hub |
| `methods.recipe` | 레시피 → 저장한 시작 설정 | Recipe → saved start settings |
| `methods.recipes` | 레시피 → 저장한 시작 설정 | Recipes → saved start settings |
| `methods.registered` | (absent) → 등록됨 · {revision}판 | (absent) → Registered · revision {revision} |
| `methods.revision` | 버전 {version} · revision {revision} → {revision}판 | Version {version} · revision {revision} → Revision {revision} |
| `methods.trials.changed` | 시험 이후 방법 파일이 바뀌었습니다. 현재 파일은 해당 시험에 포함되지 않습니다. → 시험 이후 Workflow 파일이 바뀌었습니다. 현재 파일은 해당 시험에 포함되지 않습니다. | Method files changed after this trial. The current files are not covered by that trial. → Workflow files changed after this trial. The current files are not covered by that trial. |
| `methods.trials.notDeclared` | 패키지가 결과 파일 이름을 정하지 않아 결과 파일과 대조하지 않았습니다. → 파일 묶음가 결과 파일 이름을 정하지 않아 결과 파일과 대조하지 않았습니다. | The package names no result files, so GAID did not match outputs against them. → The Workflow names no output files, so GAID did not match outputs against them. |
| `methods.trials.workflow` | Workflow: {id} · revision {revision} → Workflow: {id} · {revision}판 | Workflow: {id} · revision {revision} → Workflow: {id} · revision {revision} |
| `previewMethod.choice.attach-code.note` | 코드 내용 확인과 실행은 연결되지 않았습니다. 첨부만으로 방법 구현이나 검토가 끝나지는 않습니다. → 코드 내용 확인과 실행은 연결되지 않았습니다. 첨부만으로 Workflow 구현이나 검토가 끝나지는 않습니다. | Code inspection and execution are not connected. Attaching a file does not complete implementation or review. → Code inspection and execution are not connected. Attaching a file does not complete implementation or review. |
| `previewMethod.contents.workflow.body` | 자료와 설정을 받아 방법을 시작할 요청 내용을 담습니다. → 자료와 설정을 받아 Workflow를 시작할 요청 내용을 담습니다. | A request to begin the method with data and settings. → A request to begin the Workflow with data and settings. |
| `previewMethod.draft.summaryLabel` | 방법 설명 → Workflow 설명 | Method description → Workflow description |
| `previewMethod.draft.titleLabel` | 방법 이름 → Workflow 이름 | Method name → Workflow name |
| `previewMethod.files.illustration` | 방법 이름과 설명은 편집한 초안을 따릅니다. → Workflow 이름과 설명은 편집한 초안을 따릅니다. | The method name and description reflect the edited draft. → The Workflow name and description reflect the edited draft. |
| `previewMethod.files.workflowRequest` | 선택한 방법 초안을 사용해 자료 확인부터 결과 해석까지 준비하는 요청입니다. → 선택한 Workflow 초안을 사용해 자료 확인부터 결과 해석까지 준비하는 요청입니다. | A request to prepare the selected method draft, from data inspection through interpretation. → A request to prepare the selected Workflow draft, from data inspection through interpretation. |
| `previewMethod.method.description` | 선택한 예시 원고의 방법을 새 자료에 적용할 초안으로 살펴봅니다. → 선택한 예시 원고의 Workflow를 새 자료에 적용할 초안으로 살펴봅니다. | Explore a draft for applying the selected sample manuscript's method to new data. → Explore a draft for applying the selected sample manuscript's Workflow to new data. |
| `previewMethod.method.sampleOnly` | 준비된 방법 예시는 예시 원고를 선택한 경우에만 표시합니다. → 준비된 Workflow 예시는 예시 원고를 선택한 경우에만 표시합니다. | The prepared method example is shown only for the sample manuscript. → The prepared Workflow example is shown only for the sample manuscript. |
| `previewMethod.method.title` | 근거에서 정리한 방법 → 근거에서 정리한 Workflow | Method from the sources → Workflow from the sources |
| `previewMethod.plan.title` | 계획한 방법 절차 → 계획한 Workflow 절차 | Planned method steps → Planned Workflow steps |
| `previewMethod.sharing.method` | 방법 이름, 설명과 적용 범위 → Workflow 이름, 설명과 적용 범위 | Method name, description and scope → Workflow name, description and scope |
| `settings.skills.add_skills_from_a_source` | 소스에서 스킬 추가 → GitHub 등에서 가져오기 | Add skills from a source → Import from GitHub or another source |
| `skillHub.backSkills` | (absent) → 스킬 목록으로 돌아가기 | (absent) → Back to skills |
| `skillHub.chooseFile` | 패키지 파일 선택 → 파일 묶음 파일 선택 | Choose package file → Choose archive |
| `skillHub.errors.archive` | 패키지를 읽지 못했습니다. SKILL.md가 있는 스킬 폴더 하나를 담은 .tar.gz 파일을 선택하세요. 링크와 상위 경로는 허용하지 않습니다. → 파일 묶음를 읽지 못했습니다. SKILL.md가 있는 스킬 폴더 하나를 담은 .tar.gz 파일을 선택하세요. 링크와 상위 경로는 허용하지 않습니다. | Could not read the package. Choose a .tar.gz containing one skill folder with SKILL.md. Links and parent paths are not allowed. → Could not read the archive. Choose a .tar.gz containing one skill folder with SKILL.md. Links and parent paths are not allowed. |
| `skillHub.errors.download` | 스킬 패키지를 다운로드하지 못했습니다. 사이트 연결을 확인하거나 다운로드한 파일을 선택하세요. → 스킬 파일 묶음를 다운로드하지 못했습니다. 사이트 연결을 확인하거나 다운로드한 파일을 선택하세요. | Could not download the skill package. Check the site connection or choose a downloaded file. → Could not download the skill archive. Check the site connection or choose a downloaded file. |
| `skillHub.errors.size` | 패키지가 크기 또는 항목 수 제한을 넘었습니다. 더 작은 패키지를 선택하세요. → 파일 묶음가 크기 또는 항목 수 제한을 넘었습니다. 더 작은 파일 묶음를 선택하세요. | The package exceeds the size or entry limit. Choose a smaller package. → The archive exceeds the size or entry limit. Choose a smaller archive. |
| `skillHub.file` | 스킬 패키지 파일 (.tar.gz) → 스킬 파일 묶음 파일 (.tar.gz) | Skill package file (.tar.gz) → Skill archive (.tar.gz) |
| `skillHub.fileList` | (absent) → 포함 파일 {count}개 | (absent) → Included files ({count}) |
| `skillHub.filesTruncated` | (absent) → 파일 목록은 1,000개와 폴더 깊이 12단계까지만 표시합니다. | (absent) → The file list is limited to 1,000 files and 12 folder levels. |
| `skillHub.installPreview` | (absent) → 설치 내용 미리보기 | (absent) → Installation preview |
| `skillHub.loading` | 스킬 패키지를 읽는 중입니다. → 스킬 파일 묶음를 읽는 중입니다. | Reading the skill package. → Reading the skill archive. |
| `skillHub.methodDraft` | 허브 방법: {id} · revision {revision} · {lifecycle} → Workflow: {id} · {revision}판 · {lifecycle} | Hub method: {id} · revision {revision} · {lifecycle} → Workflow: {id} · revision {revision} · {lifecycle} |
| `skillHub.methodPreview` | 패키지 미리보기 → 파일 묶음 미리보기 | Preview package → Preview archive |
| `skillHub.methods` | 허브 패키지 목록 → Workflow 목록 | Hub packages → Workflows |
| `skillHub.methodsEmpty` | 허브에 가져올 패키지가 없습니다. → 허브에 가져올 파일 묶음가 없습니다. | No packages are available from the hub. → No archives are available from the hub. |
| `skillHub.methodsError` | 허브 패키지 목록을 읽지 못했습니다: {detail} → Workflow 목록을 읽지 못했습니다: {detail} | Could not read hub packages: {detail} → Could not read Workflows: {detail} |
| `skillHub.methodsLoading` | 허브 패키지 목록을 읽는 중입니다. → Workflow 목록을 읽는 중입니다. | Reading hub packages. → Reading Workflows. |
| `skillHub.previewCode` | (absent) → {code, select, yes {실행 코드 포함} other {분석 지침만 포함}} | (absent) → {code, select, yes {Execution code included} other {Instructions only}} |
| `skillHub.previewError` | (absent) → 설치할 내용을 읽지 못했습니다. 미리보기를 다시 여세요. | (absent) → Could not read installation contents. Reopen the preview. |
| `skillHub.previewLoading` | (absent) → 설치할 내용을 읽는 중입니다. | (absent) → Reading installation contents. |
| `skillHub.previewPrompt` | (absent) → 시작할 때 보낼 지시문 | (absent) → Request sent when starting |
| `skillHub.previewRetry` | (absent) → 미리보기 다시 읽기 | (absent) → Reload preview |
| `skillHub.previewRun` | (absent) → 설치만으로 실행하지 않습니다. 입력과 조건을 정하고 시작하면 AI agent가 아래 지시문과 스킬 지침을 따라 분석합니다. | (absent) → Installation does not run code. After you set inputs and conditions and start, the AI agent follows the request below and the skill instructions. |
| `skillHub.previewSkill` | (absent) → 스킬: {name} · 파일 {count}개 | (absent) → Skill: {name} · {count} files |
| `skillHub.read` | (absent) → 지침 보기 | (absent) → Read instructions |
| `skillHub.readError` | (absent) → 지침을 읽지 못했습니다. 스킬 목록에서 다시 여세요. | (absent) → Could not read instructions. Reopen them from the skill list. |
| `skillHub.readLoading` | (absent) → 지침을 읽는 중입니다. | (absent) → Reading instructions. |
| `skillHub.readSkill` | (absent) → {name} 지침 보기 | (absent) → Read {name} instructions |
| `skillHub.sizeHelp` | 파일 크기는 압축 상태 20 MiB, 압축 해제 후 64 MiB, 항목 10,000개로 제한합니다. → 파일 크기는 압축 상태 20 MiB, 압축 해제 후 64 MiB, 항목 10,000개로 제한합니다. | Packages are limited to 20 MiB compressed, 64 MiB expanded and 10,000 entries. → Archives are limited to 20 MiB compressed, 64 MiB expanded and 10,000 entries. |
| `skillHub.snapshot` | 패키지 SHA-256: {digest}. 설치 후 사이트 변경 사항을 자동으로 가져오지 않습니다. → 파일 묶음 SHA-256: {digest}. 설치 후 사이트 변경 사항을 자동으로 가져오지 않습니다. | Package SHA-256: {digest}. Changes on the site are not fetched automatically after installation. → Archive SHA-256: {digest}. Changes on the site are not fetched automatically after installation. |
| `skillHub.source` | skill_hub 패키지 {digest} → skill_hub 파일 묶음 {digest} | skill_hub package {digest} → skill_hub archive {digest} |
| `skillHub.upload` | 패키지 미리보기 → 파일 묶음 미리보기 | Preview package → Preview archive |
| `skillHub.workflowSkill` | (absent) → 「{title}」 Workflow에 딸린 스킬 · {revision}판 | (absent) → Skill included with “{title}” Workflow · revision {revision} |
| `workspace.badge.recipe` | 저장한 레시피 → 저장한 시작 설정 | Saved recipe → Saved saved start settings |
| `workspace.catalogue.category` | 지구과학 → 기본 Workflow | Geoscience → Built-in Workflows |
| `workspace.catalogue.hideOther` | 다른 분야 Workflow 접기 → 일반 Workflow 접기 | Hide workflows from other fields → Hide general Workflows |
| `workspace.catalogue.showOther` | 다른 분야 Workflow 보기 ({count}개) → 일반 Workflow {count}개 보기 | Show workflows from other fields ({count}) → Show {count} general Workflows |
| `workspace.catalogue.title` | 지구과학 Workflow → 기본 Workflow | Geoscience tasks → Built-in Workflows |
| `workspace.environment.done` | 환경을 준비했습니다. 패키지를 불러올 수 있습니다. → 환경을 준비했습니다. Python 라이브러리를 불러올 수 있습니다. | Environment prepared. Its packages can be imported. → Environment prepared. Its Python libraries can be imported. |
| `workspace.environment.incomplete` | 환경 준비 후에도 불러오지 못한 패키지가 있습니다. → 환경 준비 후에도 불러오지 못한 Python 라이브러리가 있습니다. | Some packages still cannot be imported after preparation. → Some Python libraries still cannot be imported after preparation. |
| `workspace.environment.progress` | 프로젝트 환경의 패키지를 준비하고 import를 확인하는 중입니다. → 프로젝트 환경의 Python 라이브러리를 준비하고 import를 확인하는 중입니다. | Preparing project environment packages and checking imports. → Preparing project Python libraries and checking imports. |
| `workspace.recipe.checking` | 레시피 확인 중 → 저장한 시작 설정 확인 중 | Checking recipe → Checking saved start settings |
| `workspace.recipe.choose` | 레시피 파일 선택 → 저장한 시작 설정 파일 선택 | Choose recipe file → Choose saved start settings file |
| `workspace.recipe.description` | geo-start/v1 레시피 파일(.geo-start.json)을 확인한 뒤, 정한 제목과 카테고리로 현재 프로젝트의 Workflow 목록에 저장합니다. 레시피는 작업을 실행하지 않습니다. → 저장한 시작 설정 파일(.geo-start.json)을 확인한 뒤 정한 제목과 카테고리로 프로젝트에 저장합니다. 저장한 시작 설정은 작업을 실행하지 않습니다. | Checks a geo-start/v1 recipe file (.geo-start.json), then saves it to this project's workflow list under the title and category you choose. A recipe does not run a task. → Check a saved start settings file (.geo-start.json), then save it to the project with a title and category. Saved start settings do not run a task. |
| `workspace.recipe.error` | 레시피를 읽거나 확인하지 못했습니다. {detail} → 저장한 시작 설정을 읽거나 확인하지 못했습니다. {detail} | Could not read or check the recipe. {detail} → Could not read or check the saved start settings. {detail} |
| `workspace.recipe.file` | Geo 작업 레시피 파일 → Geo 작업 저장한 시작 설정 파일 | Geo task recipe file → Geo task saved start settings file |
| `workspace.recipe.import` | 레시피 가져오기 → 허브에서 Workflow 가져오기 | Import recipe → Import Workflow from hub |
| `workspace.recipe.importFile` | (absent) → 시작 설정 가져오기 | (absent) → Import start settings |
| `workspace.recipe.issue` | {code, select, schema {레시피 형식이 geo-start/v1과 맞지 않습니다: {subject}} catalogue-off {Geo 카탈로그가 꺼져 있습니다.} catalogue-version {다른 카탈로그 판의 레시피입니다: {subject}} unknown-workflow {현재 카탈로그에 없는 Workflow입니다: {subject}} workflow-skill {Workflow에 필요한 스킬이 빠졌습니다: {subject}} unknown-choice {Workflow에 없는 분석 조건입니다: {subject}} unknown-skill {카탈로그에 없는 스킬입니다: {subject}} unknown-example {선택한 스킬의 사례가 아닙니다: {subject}} choice-state {답한 조건이 미결정으로도 남아 있습니다: {subject}} other {레시피를 확인하지 못했습니다: {subject}}} → {code, select, schema {저장한 시작 설정 형식이 geo-start/v1과 맞지 않습니다: {subject}} catalogue-off {Geo 카탈로그가 꺼져 있습니다.} catalogue-version {다른 카탈로그 판의 저장한 시작 설정입니다: {subject}} unknown-workflow {현재 카탈로그에 없는 Workflow입니다: {subject}} workflow-skill {Workflow에 필요한 스킬이 빠졌습니다: {subject}} unknown-choice {Workflow에 없는 분석 조건입니다: {subject}} unknown-skill {카탈로그에 없는 스킬입니다: {subject}} unknown-example {선택한 스킬의 사례가 아닙니다: {subject}} choice-state {답한 조건이 미결정으로도 남아 있습니다: {subject}} other {저장한 시작 설정을 확인하지 못했습니다: {subject}}} | {code, select, schema {The recipe does not match geo-start/v1: {subject}} catalogue-off {The Geo catalogue is off.} catalogue-version {The recipe is for another catalogue version: {subject}} unknown-workflow {Workflow not in the current catalogue: {subject}} workflow-skill {A skill the workflow needs is missing: {subject}} unknown-choice {Analysis setting not in the workflow: {subject}} unknown-skill {Skill not in the catalogue: {subject}} unknown-example {Example does not belong to the selected skills: {subject}} choice-state {A setting is both answered and left undecided: {subject}} other {Could not check the recipe: {subject}}} → {code, select, schema {The saved start settings do not match geo-start/v1: {subject}} catalogue-off {The Geo catalogue is off.} catalogue-version {The saved start settings are for another catalogue version: {subject}} unknown-workflow {Workflow not in the current catalogue: {subject}} workflow-skill {A skill the workflow needs is missing: {subject}} unknown-choice {Analysis setting not in the workflow: {subject}} unknown-skill {Skill not in the catalogue: {subject}} unknown-example {Example does not belong to the selected skills: {subject}} choice-state {A setting is both answered and left undecided: {subject}} other {Could not check the saved start settings: {subject}}} |
| `workspace.recipe.noWorkflow` | 레시피의 작업을 현재 카탈로그에서 찾지 못했습니다. → 저장한 시작 설정의 작업을 현재 카탈로그에서 찾지 못했습니다. | Could not find the recipe's task in the current catalogue. → Could not find the Workflow for these saved start settings in the current catalogue. |
| `workspace.recipe.save` | 레시피 저장 → 저장한 시작 설정 저장 | Save recipe → Save saved start settings |
| `workspace.recipe.saving` | 레시피 저장 중 → 저장한 시작 설정 저장 중 | Saving recipe → Saving saved start settings |
| `workspace.recipe.title` | 레시피 제목 → 저장한 시작 설정 제목 | Recipe title → saved start settings title |
| `workspace.saved.cannotOpen` | 현재 카탈로그로는 열 수 없는 레시피입니다. → 현재 카탈로그로는 열 수 없는 저장한 시작 설정입니다. | This recipe cannot be opened with the current catalogue. → This saved start settings cannot be opened with the current catalogue. |
| `workspace.saved.confirmDelete` | 레시피 삭제 확인 → 저장한 시작 설정 삭제 확인 | Confirm deletion → Confirm deletion |
| `workspace.saved.delete` | 레시피 삭제 → 저장한 시작 설정 삭제 | Delete recipe → Delete saved start settings |
| `workspace.saved.deleteError` | 레시피를 삭제하지 못했습니다. {detail} → 저장한 시작 설정을 삭제하지 못했습니다. {detail} | Could not delete the recipe. {detail} → Could not delete the saved start settings. {detail} |
| `workspace.saved.error` | 레시피를 저장하지 못했습니다. {detail} → 저장한 시작 설정을 저장하지 못했습니다. {detail} | Could not save the recipe. {detail} → Could not save the saved start settings. {detail} |
| `workspace.setup.choice.recipe` | 레시피 값 → 저장한 시작 설정 값 | Recipe value → saved start settings value |

</details>
## Next steps
<!-- task:closed -->
Closed 2026-10-20T14:04:16Z: ready; the parent gaid-workflow-model integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- First task-finish check merged parent target 9114c8e (integrated snapshot 1c533b4a), passed backend, then reported one existing file-preview-panel draft-retention test failure (a.tex: expected unsaved draft, observed initial text); 1,119 frontend tests passed. Source and test are unchanged versus passing f9e8125. Isolated file-preview-panel recheck passed 7/7 (`file-preview-recheck.log`); no product/test edit was made without reproduction. Retrying task finish in place, without task save/resume.
- Job 6 continuation wrapper installed dependencies but omitted scripts/check's local step() output helper, so it exited 127 before the first remaining stage. Added extraction of that original function alongside the original suffix; product code was unchanged.
- Job 5 passed backend/frontend but stopped at the distribution owner registry: integration-boundaries owner additions also require a corresponding allowed-owner entry in geo/tests/distribution.test.mjs. Added the requested owner rather than weakening the check.
- Delayed job-1 exit notice was reread after the job-5 launch: job 1 had the same now-fixed portability failure (1,950 passed, 8 skipped). Its existing superseded disposition remains valid; do not restart it or replay the obsolete source.
- Job 4 exposed the wire-format portability contract: even a slash-normalized local path.relative call is disallowed. Reused apiRelative instead; no test exemption or rule change.
- Initial global replacement in test sources also changed identifiers; restored original tests and updated only displayed-copy assertions. Follow-up failures were stale partial strings. Confirmed actual locale values directly before the third focused run.
- First job invocation refused a dirty source before starting; saved the checkpoint and launched the first recorded check job. No stopped-before-start receipt existed.
## Notes and decisions
- Ownership: this child owns existing locale namespaces, skill panel/API, authoring target/install and shared-registration gate; parent owns composition UI and flow counts. These tightly coupled changes are implemented by this writer. Integration order: copy → backend metadata/gates → skill/install UI → checks.
- Catalogue group chosen: 기본 Workflow; upstream folded group: 일반 Workflow.
- The copy validator cannot scope glossary forbidden variants by concept/namespace; exclusions for 방법 and 레시피 are documented as notes, not global warnings.
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
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T132855.119601Z/receipt.json
  - disposition: {"evidence":[],"reason":"Stopped obsolete source checks after final copy expectations were saved; job 4 checks the final source.","recorded":"2026-10-20T13:38:27Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T133449.058175Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T133315.995747Z/receipt.json
  - disposition: {"evidence":[],"reason":"Isolated production app was intentionally stopped after completing Korean screenshot and install-flow review; no research run or model call was started.","recorded":"2026-10-20T13:40:17Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T133324.634891Z/receipt.json
  - disposition: {"evidence":[],"reason":"Stopped superseded source check to leave one complete current-source check running.","recorded":"2026-10-20T13:38:28Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T133449.058175Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T133449.058175Z/receipt.json
  - disposition: {"evidence":[],"reason":"Fixed the observed API-path portability violation and reran the current source with revision-bound draft consent.","recorded":"2026-10-20T13:43:06Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T134251.972313Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T134251.972313Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T134251.972313Z/log"],"reason":"Backend/frontend prefix passed; owner registry metadata is fixed and job 6 reruns the failed distribution stage plus every remaining scripts/check stage.","recorded":"2026-10-20T13:51:37Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T135119.189133Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T135119.189133Z/receipt.json
  - disposition: {"evidence":[],"reason":"Corrected the continuation wrapper to include the original scripts/check step() helper; no product-code change.","recorded":"2026-10-20T13:52:50Z","replacement":"/home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T135230.391770Z/receipt.json","state":"superseded"}
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-model--terms-20261020T135230.391770Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

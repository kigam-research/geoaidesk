---
format: 1
status: active
updated: 2026-10-20T13:32:57Z
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
Implementation in progress. No stored data or package contracts will change.
## Next steps
1. Normalize locale catalogues and glossary.
2. Add skill provenance/read-only instructions, constrain authoring registration, expose install preview.
3. Run declared checks and isolated browser review; finish this child for parent integration.
## Failed approaches
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
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

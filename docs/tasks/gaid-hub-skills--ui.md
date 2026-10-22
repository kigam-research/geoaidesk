---
format: 1
status: active
updated: 2026-10-22T06:59:59Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"af5e8cdb-d43f-4b44-8ee5-e1ceba4aa188","pid":177398,"provider":"codex","session":"01a16234-e5b9-72e1-ad05-708c154db748","start":"53693527","token":"b43fd525741ba4dfc4306e8a53ecc93b452a07e41bd222c5e954043676b60fc0"}
branch: task/gaid-hub-skills--ui
target: task/gaid-hub-skills
parent: gaid-hub-skills
---
# gaid-hub-skills--ui

## Goal and done criteria
Request from the starter:

Child unit `ui` of gaid-hub-skills (geoaidesk). Goal: researcher-facing screens for hub-managed skills, phase 1.

Read first (in your worktree): AGENTS.md (especially "UI copy and locales", "UI guide v2", "Names in visible copy");
docs/design/ui-guide.md sections 1, 2, 10 and those for components you touch; geo/copy/gaid-writing.md and
geo/copy/terminology.csv (new term 허브 스킬); docs/adr/2026-10-22-hub-managed-skills.md; web/src/geo/contracts/hub-skills.ts
(settled contract and HTTP API; the server is being built in parallel by sibling child `store` — code against the contract
with mocked fetch in tests; after the parent integrates `store`, run `task sync` and check against the real server);
reports/2026-10-22-gaid-hub-skills/index.md §3.6 "화면 위치". Design every screen as an impeccable + design-taste-frontend +
brand-guide expert (user rule; skills in skill_hub `.claude/skills/`, read them with gh api if not local).

Scope (you own these; other files: ask the parent first):
- New `web/src/geo/hub-skills/**` and locale namespace `web/src/geo/locales/hubSkills/{ko,en}.json` (Korean first).
- Hub: a "스킬" group in the hub sidebar below the Workflow groups (`hub-sidebar.tsx`), routes `#hub/skills` (shelf list,
  search, topic folder filter) and `#hub/s/<id>` (detail) in `location.ts`/`hub-screen.tsx`/`hub-shell.tsx` (seams, keep
  narrow). Detail uses the Workflow detail's frame: SKILL.md (read-only, rendered), file list with read-only text view,
  origin (own / taken from Workflow «title» n판 / GitHub source·ref·commit·fetched date), licence state, findings grouped
  by kind (worded as "볼 곳", never as safe/unsafe), revision history with review state per revision and reviewer name
  marked "이름 확인 안 됨", "쓰는 Workflow" list linking to `#hub/e/<entry>`, stars and comments like Workflows,
  "프로젝트에 설치" through the existing project picker + install preview + acknowledgement pattern (see
  `web/src/geo/skill-hub/install-preview.tsx`), review actions (확인함 / 더 쓰지 않음 + 대신 쓸 스킬 / 사용 중지) with a
  note, hidden for the registrant's own `checked`.
- Register flow ("스킬 올리기"): choose source (내 프로젝트의 스킬 / 허브 Workflow에서 꺼내기 / GitHub 등에서), preview
  (files, licence, findings, existing name → 다음 판 or refused, blocked reason), note + folder (+ optional tags/formats),
  then register. Author-only visibility explained when the licence is not shareable. From the hub Workflow detail of an
  entry you may add an entry point "스킬만 올리기" only if it fits the layout; otherwise skip and note it.
- Settings → Skills (`web/src/components/skills-panel.tsx` seam, add yourself to geo/integration-boundaries.json for it with
  owner gaid-hub-skills--ui): in "스킬 추가", a "GAID 허브에서" source next to GitHub that searches the shelf and installs
  through the same preview/consent; rows of installed hub skills show "허브 스킬 · n판", a newer-revision notice with an
  explicit "n판으로 바꾸기" action (install of that revision), "고친 내용 있음" when edited, and the suspended warning.
  Rows come from `GET /skills` with the new `hubSkill` field (`InstalledHubSkill`).
- No hard-coded colours or text in JSX; tokens and `t()` only; `node geo/ui/check-ui.mjs` and
  `node geo/copy/validate-copy.mjs web/src/geo/locales` must pass with no new baseline entries.
- Tests: vitest for the shelf list, detail (findings wording, unverified reviewer), register preview states, Settings row
  states. Screenshots (Korean, both styles 계측/도폭 and both themes at 1440×900 and 1280×800) of shelf, detail, register
  preview and Settings rows, saved under ~/data/geoaidesk/work/gaid-hub-skills--ui/shots/ with a few chosen small PNGs
  copied into reports/2026-10-22-gaid-hub-skills/figures/ (≤ 1600 px wide). Run the app with your own GAID_HOME/
  KADY_PROJECTS_ROOT under ~/data/geoaidesk/work/gaid-hub-skills--ui/; never touch ~/.geoaidesk.

Out of scope: server code (sibling `store`), Workflow readiness/install/authoring (parent). List the string ids with ko/en
text and the UI guide rule ids followed or broken in a section for the parent report in your task document; no report of
your own. Checks before finish: `cd web && npx tsc --noEmit && npx vitest run src/geo/hub-skills src/components/skills-panel.test.tsx`,
the two node checks above. Finish with `task finish`.

## Current state
Delivered shelf/detail/three-source registration screens, reusable pinned-revision installer and Settings row/source seams. Parent store integrated (ba8d70d37c3d); the only merge conflict was append-only boundaries and both entries are retained under gaid-hub-skills. No parent/store code mismatch found.

Real isolated API/browser checks passed: project-skill registration; SKILL.md/text-file reads; star/comment; other-name checked review with unverified-name text; consent-gated revision 1 install; newer-revision notice and explicit revision 2 update; edited-file install refused with unchanged SHA-256; suspended revision refused and Settings warning rendered. No model calls or existing user data used. Catalogue was active. Evidence/scripts/logs: /home/seongin3/data/geoaidesk/work/gaid-hub-skills--ui/. Real backend fixtures are not research results.

Integrated focused checks passed: TypeScript, 32 UI tests, distribution 7 tests, UI/copy 0 errors. Earlier broader UI/hub run: 48 pass; scoped ESLint passes. Required 32 style/theme/viewport screenshots plus 4 chosen report PNGs are saved. Full workflow check runs during task finish.
## Next steps
1. Run task finish and fix only relevant failures in place. Parent completes and integrates this child.
2. Isolated services and browser have been stopped; no further rollout belongs to this child.
## Failed approaches
- task sync had an append-only boundaries conflict. Kept both entries and parent owner gaid-hub-skills. A path-restricted task save rejected merge-staged files; unrestricted task save completed the merge and verified its push.
- Real-browser custom-port CORS initially blocked requests. Set KADY_FRONTEND_PORT=3117 in the isolated service; no source edit.
- Initial npx tsc ran before npm dependencies existed. Installed the locked web dependencies with npm ci, then TypeScript passed. No source workaround or dependency edits.
- Initial Next browser build caught a type import before the existing use-client directive; moved the import below the directive and browser build succeeded.
- Browser fixture Settings startup initially lacked the unrelated local-model response; corrected only the external mock fixture, not product code.
## Notes and decisions
Implementation order: shared API/presentation primitives → reusable install gate → shelf/detail/register → hub and Settings seams → tests/visual QA → real-store integration. All UI files have one writer (this unit); server/store and Workflow readiness remain sibling/parent-owned. No independent writer packages exist within this tightly coupled UI child.
Parent approved additional narrow seams in app/page.tsx, lib/capabilities.ts, locales/index.ts and skills-panel.test.tsx. Parent requested a reusable HubSkillInstall for its readiness screen.
The precisely specified extension inherits UI guide v2; no new visual-world or taste decision is needed. Impeccable context and craft floor were read. design-taste-frontend explicitly excludes multi-step product UI; its landing-page rules are not applied.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-hub-skills/index.md
No separate child report. Parent owns the canonical report; the following is its implementation handoff.

### UI handoff for parent report

Implemented: #hub/skills and #hub/s/<id>; the Skills sidebar group follows all Workflow groups. Detail reads SKILL.md as Markdown, lists/reads text files, separates origin/licence/findings/revision/review records and links pinned consuming Workflows. Review names say 이름 확인 안 됨; checked is unavailable to the revision registrant. Stars/comments reuse shared display names. Installation is project selection (including existing NewProject creation), exact-revision preview, optional instruction/text-file inspection and explicit acknowledgement. Settings rows show installed revision, edited content, suspended state and a newer-revision action. Generic upstream update/check actions are hidden for hub rows.

Registration: project skill / hub Workflow revision / external source. External multi-skill sources are previewed again with a chosen name. The preview shows licence, author-only visibility when restricted/unknown, grouped places to read, files, next revision, taken name, same-tree and blocked states. Metadata is entered only after a registerable preview; treeHash is sent on registration. No Workflow detail extra action was added: that optional entry point was skipped to preserve its existing three-action header.

Reusable export: web/src/geo/hub-skills/install.tsx HubSkillInstall({ skillId, revision, projectId, onInstalled? }). The gate resets consent immediately on project/id/revision change and blocks edited/conflict/suspended. No display-name gate: parent confirmed preview/install allow anonymous access to hub-visible revisions, with the known name header sent for author-only visibility.

UI guide rules followed: P2 P3 P4 P5 P7 P9; I3 I5 I7–I15; L1 L3–L9; T1; S1–S5; B1–B6; N2 N5 N6; D2; Q1 Q4–Q6; G1 G3 G4 G6; F2 F4–F7; A1–A3 A5 A6; W1–W6; R1–R4; V1–V9. No new rule exception or baseline entry. Existing Settings frame/row styling is preserved outside the narrow seam. Impeccable detect returned [] for changed targets. Registration uses the established StepScale; no new visual-world decision was introduced.

Figures (synthetic UI fixtures, not research results): figures/skills-shelf-instrument-light.png, figures/skills-detail-mapsheet-dark.png, figures/skills-register-instrument-light.png, figures/skills-settings-instrument-light.png. Each is ≤1440 px wide. The full matrix is external; hashes in visual-evidence.json. The report prose below was reviewed in humanizer file mode with its Korean reference; status/data/locale strings were preserved.

Report-ready prose:

허브 왼쪽 목록의 Workflow 묶음 아래에 스킬 묶음을 추가했습니다. 스킬은 검색하거나 주제 폴더로 좁혀 찾습니다. 상세에서는 지침과 파일을 읽고, 출처와 이용 조건, 자동 검사가 짚은 볼 곳, 각 판의 검토 기록을 확인합니다. 검토자 표시 이름에는 “이름 확인 안 됨”을 함께 표시합니다.

스킬은 프로젝트, 등록된 Workflow 또는 GitHub 등에서 올립니다. 등록 전에 파일과 이용 조건을 확인하며, 공유 가능한 조건을 확인하지 못한 판은 올린 사람에게만 보입니다. 이미 있는 이름은 다음 판으로 올릴지, 이름이 다른 사람의 것인지 구분해 표시합니다.

프로젝트에 설치할 때는 판을 지정하고 미리보기와 동의를 거칩니다. 새 판은 자동으로 적용하지 않습니다. 설정에는 설치한 판, 새 판, 프로젝트에서 고친 상태와 사용 중지를 표시합니다. 프로젝트에서 고친 파일이나 같은 이름의 다른 스킬은 덮어쓰지 않습니다.

### Real-server evidence for parent report

All server/user-data locations are isolated under /home/seongin3/data/geoaidesk/work/gaid-hub-skills--ui/: home, projects, shared, home/pi-agent and home/skills-cache. The pinned named catalogue asset is active. API :8117 and Next :3117; KADY_FRONTEND_PORT=3117 lets the real browser reach the API without mocks. No provider/model calls occurred.

Browser scripts real-browser.cjs, real-review.cjs and real-settings.cjs exercised registration → detail/file → stars/comments → project picker → preview/consent → install, other-name review and explicit newer-revision update. Results: registered/fileRead/starred/commented true; consentRequired true; installed revision 1 then 2; unverified review names shown; Settings remained one dialog. API evidence real-api-evidence.json records edited preview, 409 refusal, unchanged file SHA-256, suspended preview/state and 409 refusal. Final /skills/all annotation: revision 2, latestRevision 2, state suspended, edited true. Browser rendered both edited and suspended row states. External real-settings screenshot uses 1440×900.

The local real-API path used a project source. External GitHub network fetching and Workflow extraction were not manually repeated; mocked UI source-selection tests and the integrated parent/store tests cover their contracts. No additional user decision is needed.

보고서용 추가 문장 (humanizer 한국어 규칙으로 검토함):

격리된 시험 서버에서 프로젝트 스킬을 올리고 파일을 읽은 뒤, 동의와 함께 설치하는 경로를 확인했습니다. 새 판을 올리자 설정에 알림이 나타났으며, 연구자가 선택한 뒤에만 설치한 판이 바뀌었습니다. 프로젝트에서 고친 파일은 설치를 거절한 뒤에도 해시가 같았습니다. 사용 중지한 판도 설치를 거절했고 설정에 경고를 표시했습니다.

### String changes (new ids; previous ko/en value: absent)

| New id | Korean | English |
|---|---|---|
| hubSkills.title | 허브 스킬 | Hub skills |
| hubSkills.nav | 스킬 | Skills |
| hubSkills.all | 전체 스킬 | All skills |
| hubSkills.search | 허브 스킬 검색 | Search hub skills |
| hubSkills.folder | 주제 폴더 | Topic folder |
| hubSkills.allFolders | 전체 폴더 | All folders |
| hubSkills.sort | 정렬 | Sort |
| hubSkills.recent | 최근 수정순 | Recently updated |
| hubSkills.popular | 별표 많은 순 | Most starred |
| hubSkills.register | 스킬 올리기 | Register skill |
| hubSkills.back | 스킬 목록 보기 | View skill shelf |
| hubSkills.cancel | 취소 | Cancel |
| hubSkills.retry | 다시 읽기 | Read again |
| hubSkills.loading | 스킬을 읽는 중입니다. | Reading skills. |
| hubSkills.empty | 조건에 맞는 스킬이 없습니다. 검색어나 폴더를 바꾸세요. | No skills match. Change the search term or folder. |
| hubSkills.count | 스킬 {count}개 | {count} skills |
| hubSkills.revision | {revision}판 | Revision {revision} |
| hubSkills.state.unreviewed | 검토 전 | Unreviewed |
| hubSkills.state.checked | 확인함 | Checked |
| hubSkills.state.deprecated | 더 쓰지 않음 | Deprecated |
| hubSkills.state.suspended | 사용 중지 | Suspended |
| hubSkills.error | 내용을 읽거나 저장하지 못했습니다. 다시 시도하세요. | Could not read or save the content. Try again. |
| hubSkills.installed | {name} {revision}판을 설치했습니다. | Installed {name} revision {revision}. |
| hubSkills.install | 프로젝트에 설치 | Install in project |
| hubSkills.project | 설치할 프로젝트 | Project to install in |
| hubSkills.chooseProject | 프로젝트 선택 | Select project |
| hubSkills.preview | 설치 내용 미리보기 | Installation preview |
| hubSkills.consent | 지침과 파일을 읽었으며 프로젝트에 설치하는 데 동의합니다. | I have read the instructions and files and agree to install them in the project. |
| hubSkills.code | 실행 코드: {code, select, yes {있음} other {없음}} | Executable code: {code, select, yes {present} other {none}} |
| hubSkills.runNotice | 설치 후 AI agent가 지침에 따라 파일과 코드를 사용할 수 있습니다. | After installation the AI agent can use the files and code according to the instructions. |
| hubSkills.installState.installed | 같은 판이 이미 설치되어 있습니다. 파일을 바꾸지 않습니다. | The same revision is already installed. No files will change. |
| hubSkills.installState.missing | 프로젝트에 스킬을 새로 설치합니다. | Installs a new skill in the project. |
| hubSkills.installState.other-revision | 프로젝트의 기존 판을 선택한 판으로 바꿉니다. | Replaces the project’s existing revision with the selected revision. |
| hubSkills.installState.edited | 프로젝트에서 고친 스킬은 덮어쓰지 않습니다. 고친 내용을 따로 보관한 뒤 다시 시도하세요. | Edited project skills are not overwritten. Keep your changes separately and try again. |
| hubSkills.installState.conflict | 같은 이름의 다른 스킬이 있습니다. 프로젝트의 스킬 이름을 바꾼 뒤 다시 시도하세요. | Another skill has the same name. Rename the project skill and try again. |
| hubSkills.installState.suspended | 사용 중지된 판은 설치할 수 없습니다. 다른 판을 확인하세요. | Suspended revisions cannot be installed. Check another revision. |
| hubSkills.instructions | 지침 | Instructions |
| hubSkills.files | 파일 {count}개 | {count} files |
| hubSkills.file | 파일 내용 | File content |
| hubSkills.sourceTitle | 출처와 이용 조건 | Origin and licence |
| hubSkills.origin.own | 직접 작성 | Written by researcher |
| hubSkills.origin.workflow | Workflow에서 꺼냄: {title} {revision}판 | Taken from Workflow: {title}, revision {revision} |
| hubSkills.origin.github | 외부에서 가져옴: {source} | Fetched from external source: {source} |
| hubSkills.sourceRecord | 출처 기록 보기 | View origin record |
| hubSkills.ref | 가져온 기준 | Requested ref |
| hubSkills.commit | 가져온 버전 기록 | Resolved commit |
| hubSkills.fetched | 가져온 날짜 | Fetched date |
| hubSkills.licence.institute | 기관 내부 작성 | Written within the institute |
| hubSkills.licence.declared | 명시된 라이선스: {name} | Declared licence: {name} |
| hubSkills.licence.restricted | 재배포 제한 문구 있음 | Redistribution restrictions found |
| hubSkills.licence.unknown | 라이선스 확인 안 됨 | Licence not identified |
| hubSkills.authorOnly | 다른 연구자에게 공유할 수 있는 이용 조건을 확인하지 못해 올린 사람에게만 보입니다. | Only the registrant can see this because shareable licence terms have not been identified. |
| hubSkills.findings | 볼 곳 | Places to read |
| hubSkills.findingsNone | 자동 검사에서 짚은 곳이 없습니다. 사람의 검토를 대신하지 않습니다. | No places were flagged automatically. This does not replace a person’s review. |
| hubSkills.findingsHint | 자동 검사가 짚은 문구입니다. 파일의 앞뒤 내용을 함께 읽으세요. | Automatically flagged text. Read it in the surrounding file context. |
| hubSkills.finding.format | 지침 형식 | Instruction format |
| hubSkills.finding.hidden-text | 숨은 문구 | Hidden text |
| hubSkills.finding.network | 외부 접속 | Network access |
| hubSkills.finding.shell | 명령 실행 | Command execution |
| hubSkills.finding.package-install | 프로그램 설치 | Package installation |
| hubSkills.finding.credentials | 인증 정보 경로 | Credential paths |
| hubSkills.finding.outside-write | 작업 폴더 밖에 쓰기 | Writes outside the working folder |
| hubSkills.line | {file} {line}행 | {file}, line {line} |
| hubSkills.history | 판 기록과 검토 | Revisions and reviews |
| hubSkills.unverified | 이름 확인 안 됨 | Name not verified |
| hubSkills.review | 검토 기록 남기기 | Record review |
| hubSkills.note | 살펴본 내용 또는 바뀐 점 | What was read or changed |
| hubSkills.replacement | 대신 쓸 스킬 (선택) | Replacement skill (optional) |
| hubSkills.saveReview | 검토 기록 저장 | Save review |
| hubSkills.reviewSaved | 검토 기록을 저장했습니다. | Review recorded. |
| hubSkills.usedBy | 쓰는 Workflow | Used by Workflows |
| hubSkills.unused | 등록된 Workflow에서 아직 쓰지 않습니다. | No registered Workflow uses this yet. |
| hubSkills.star | 별표 {count}개 | {count} stars |
| hubSkills.starAction | 별표 표시 바꾸기 | Toggle star |
| hubSkills.comments | 댓글 | Comments |
| hubSkills.comment | 댓글 내용 | Comment text |
| hubSkills.postComment | 댓글 올리기 | Post comment |
| hubSkills.noComments | 댓글이 없습니다. | No comments yet. |
| hubSkills.steps.source | 가져올 곳 | Source |
| hubSkills.steps.select | 스킬 선택 | Select skill |
| hubSkills.steps.preview | 내용 확인 | Preview |
| hubSkills.steps.register | 등록 내용 | Registration |
| hubSkills.stepsLabel | 스킬 등록 단계 | Skill registration steps |
| hubSkills.previous | 이전 단계 | Previous step |
| hubSkills.next | 다음 단계 | Next step |
| hubSkills.source.project | 내 프로젝트의 스킬 | Skill from my project |
| hubSkills.source.workflow | 허브 Workflow에서 꺼내기 | Take from a hub Workflow |
| hubSkills.source.source | GitHub 등에서 | From GitHub or similar |
| hubSkills.recommended | 권장 | Recommended |
| hubSkills.projectReason | 프로젝트에서 쓰던 파일을 그대로 확인합니다. | Inspect the exact files used in your project. |
| hubSkills.sourceInput | GitHub 저장소 또는 Git URL | GitHub repository or Git URL |
| hubSkills.skillName | 스킬 이름 | Skill name |
| hubSkills.workflow | 허브 Workflow | Hub Workflow |
| hubSkills.previewAction | 가져올 내용 확인 | Preview source content |
| hubSkills.registerPreview | 올릴 내용 미리보기 | Registration preview |
| hubSkills.nextRevision | 같은 이름이 있어 {revision}판으로 올립니다. | This name exists; adds revision {revision}. |
| hubSkills.taken | 다른 사람이 올린 이름입니다. 프로젝트에서 이름을 바꾼 뒤 올리세요. | Another registrant owns this name. Rename it in your project before registering. |
| hubSkills.sameTree | 최신 판과 내용이 같아 새 판으로 올릴 수 없습니다. | The content matches the latest revision, so a new revision cannot be registered. |
| hubSkills.blocked | 올릴 수 없는 내용입니다. 원본 지침과 이름을 확인하세요. | This content cannot be registered. Check the source instructions and name. |
| hubSkills.tags | 태그 (쉼표로 구분, 선택) | Tags (comma-separated, optional) |
| hubSkills.formats | 파일 형식 (쉼표로 구분, 선택) | File formats (comma-separated, optional) |
| hubSkills.registerNote | 올리는 이유나 바뀐 점을 한 줄로 적으세요. | Describe why you are registering or what changed in one line. |
| hubSkills.noSourceSkills | 올릴 수 있는 스킬이 없습니다. 다른 곳을 선택하세요. | No skills are available here. Choose another source. |
| hubSkills.registered | 스킬을 올렸습니다. | Skill registered. |
| hubSkills.settingsSource | GAID 허브에서 | From GAID hub |
| hubSkills.githubSource | GitHub 등에서 | From GitHub or similar |
| hubSkills.installedRevision | 허브 스킬 · {revision}판 | Hub skill · revision {revision} |
| hubSkills.edited | 고친 내용 있음 | Locally edited |
| hubSkills.newRevision | 새 판: {revision}판 | New revision: {revision} |
| hubSkills.update | {revision}판으로 바꾸기 | Switch to revision {revision} |
| hubSkills.suspended | 사용 중지된 판입니다. 새 설치와 Workflow 사용이 막힙니다. | This revision is suspended. New installs and Workflow use are blocked. |
| hubSkills.settingsBack | 설치한 스킬 보기 | View installed skills |
| hubSkills.projectOnly | 허브 스킬은 프로젝트에 설치합니다. 적용 범위를 프로젝트로 바꾸세요. | Hub skills install into a project. Change the scope to project. |
| hubSkills.unchanged | {name} {revision}판이 이미 설치되어 있어 파일을 바꾸지 않았습니다. | {name} revision {revision} is already installed. No files were changed. |

## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

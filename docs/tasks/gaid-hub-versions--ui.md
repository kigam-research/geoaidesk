---
format: 1
status: ready
updated: 2026-10-23T07:19:41Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"85dddf2d-e5cf-4fd4-9e09-1bd517612fc9","pid":2306567,"provider":"codex","session":"01a1678c-afff-7a90-bcc6-4c8ff80df8f6","start":"62657466","token":"439122785c0ef2741fb6290719f33f7d911ae7984a2150a314072fcd11f03a42"}
branch: task/gaid-hub-versions--ui
target: task/gaid-hub-versions
parent: gaid-hub-versions
---
# gaid-hub-versions--ui

## Goal and done criteria
Request from the starter:

# Goal: ui — screens and copy for hub Workflow removal and versions

Parent unit: gaid-hub-versions (GeoAIDesk). The parent writer already changed contracts and the server (commit 756004dd on
task/gaid-hub-versions). You own the web screens and the researcher-facing copy. Read AGENTS.md (sections "Workflow model",
"GAID hub", "Institute hub server", "UI copy and locales", "UI guide v2") and the parent task document
docs/tasks/gaid-hub-versions.md (Goal, decisions 1-6, Current state) first.

User decisions (verbatim request and answers are in the parent task document):
- 2. Removal: the registrant and administrators can remove a registered Workflow; it disappears from hub lists; an
  administrator can restore it; copies already installed in projects stay.
- 3. Term: use the English word "version" on Korean screens too (not 버전, not 판); English screens "version". This replaces
  the 2026-10-20 term 판.
- 4. Existing revisions 1, 2, 3 … read 0.1.0, 0.1.1, 0.1.2 … (the server already fills `revisions[].version` in every HubEntry).
- 5. The registrant chooses the version when registering an update: patch (0.1.x → 0.1.x+1), minor (0.x → 0.x+1.0), major
  (main release 1.0.0, later 2.0.0 …).
- 6. Drafts carry no version and show 초안.

Contract (do not change the server or contracts; ask the parent via your task document if something is missing):
- `web/src/geo/contracts/hub-version.ts`: `HubVersionBump`, `HUB_VERSION_BUMPS`, `FIRST_HUB_VERSION`, `nextHubVersions(current)`,
  `hubVersionOf(entry, revision?)`, `hubRefVersion(ref)` (install origins / draft links without a version), `legacyHubVersion`.
  Import it directly (hub-shared.ts does not re-export it).
- `web/src/geo/contracts/hub-shared.ts`: `HubEntryRevision.version`, `HubEntry.removed` (`HubRemoval {at, by, byId?, reason}`,
  only in the removed list), `HubMe.admin`, `RegisterBody.bump`, `RemoveEntryBody { reason? ≤500 }`, routes
  `POST /geo/hub/entries/:id/remove` (204; 403 not allowed; 409 already removed), `GET /geo/hub/removed` → `{ entries }` (what
  the caller may restore: hub server admin all; local store without a hub server: the registrant their own; others []),
  `POST /geo/hub/entries/:id/restore` → HubEntry.
- `MethodOrigin.hubEntry.version?`, `LocalMethodSummary.hubVersion` (null → show 초안), `HubEntryLink.version?` (use
  `hubRefVersion(link)`), skill rows `SkillInfo.workflow.version` (already wired in skills-panel.tsx), `WorkflowDoc.version`
  (workflow-doc.ts, workflow-card.tsx and the `workflowDoc` locale namespace are already done by the parent — leave them).

Do:
1. Hub entry page (`web/src/geo/hub/shared-entry.tsx` and its dialogs): for `entry.mine || me.admin`, an action to remove the
   Workflow from the hub, behind a confirm dialog that names it and states: it disappears from the hub lists, copies already
   installed in projects stay, an administrator can restore it (without a hub server: the registrant restores it from the
   removed list). Optional reason (≤500 chars). On success go back to the hub list and refresh lists/sidebar counts.
2. A removed list in the hub (a hub place such as `#hub/removed` in `web/src/geo/hub/location.ts`, an item in
   `hub-sidebar.tsx` shown when `me.admin` or the list is non-empty): rows with title, version, author, removed by/when/reason
   and a restore action → refresh.
3. Registration (`register` dialog / registration preview bar): first registration states version 0.1.0; an update offers
   patch / minor / major with the resulting version shown (from `nextHubVersions(current)`), default patch, and explains
   major as the main release when the current major is 0 (1.0.0). Send `bump` in RegisterBody.
4. Every place a hub Workflow revision is shown as "{n}판" shows "version x.y.z" instead: hub browse cards, entry page,
   revision history rows, comments' revision if shown, picker (`web/src/geo/hub-picker/`), install preview
   (`web/src/geo/skill-hub/install-preview.tsx`), methods/Workflow detail (`web/src/geo/methods/`), start settings, handoff,
   draft step ("registered"/"update" lines: use the entry's version; the "edit"/"copy" draft banners: `hubRefVersion(link)`;
   say the next version is chosen at registration). Drafts and non-hub packages show 초안, never a draft/package number as 판.
5. Hub skills (namespaces `hubSkills`, `skillHub`, `workspace` hub-skill lines, `workflowView.hubRevision`/`other-revision`):
   term change only, "{revision}판" → "version {revision}" (hub skill revisions stay integers; semver for hub skills is out of
   scope). `hubFeeds.release` ("{tag} 판"): choose wording under the copy rules without 판.
6. Glossary/terminology: `geo/copy/terminology.csv` gets a `version` row (definition: registered Workflow version, starts at
   0.1.0, registrant picks patch/minor/major, 1.0.0 = main release; note gaid-hub-versions 2026-10-23) with 판 forbidden if the
   validator allows it without breaking unrelated strings (check `버전`/`판` elsewhere; report what you chose). Update the
   hub glossary entry in `hub/ko.json`/`en.json` (`term: "판"`) and the hub skill terminology row wording (판 → version).
7. Copy rules: read geo/copy/gaid-writing.md and terminology.csv first; Korean first, English with the same meaning; buttons
   name the next action; list string ids with ko/en before→after in your task document.
8. UI guide v2 (docs/design/ui-guide.md sections 1, 2, 10 and the components you touch): tokens only, destructive action
   styling per the guide. Korean screenshots of the changed screens (entry page with remove action + confirm dialog, removed
   list, registration version choice) in both styles (계측 default, 도폭 via `data-style="mapsheet"`) and both themes at
   1440×900 and 1280×800, saved outside Git under ~/data/geoaidesk/work/gaid-hub-versions/screenshots/; put a few small
   decision-relevant PNGs (≤ 300 KB each) in reports/2026-10-23-gaid-hub-versions/figures/ and list rule ids followed/broken
   in your task document. Run the app with `KADY_PROJECTS_ROOT=~/data/geoaidesk/work/gaid-hub-versions/projects`,
   `GAID_HUB_SHARED_DIR=~/data/geoaidesk/work/gaid-hub-versions/hub-shared` and a free port pair; never touch the review
   app (ports 3000/18000) or deployed services. Login-free checks: playwright-cli skill.
9. Tests: update/add web vitest tests for the remove/restore flow and version choice; `cd web && npx tsc --noEmit && npm test`
   must pass; `node geo/copy/validate-copy.mjs web/src/geo/locales` and `node geo/ui/check-ui.mjs` must pass.

Do not edit: server/**, web/src/geo/contracts/**, web/src/geo/workflow/workflow-card.tsx, locales/workflowDoc, AGENTS.md (the
parent updates AGENTS.md and writes the report index.md). Network: raw.githubusercontent.com is blocked on the KIGAM network.
Evidence to return in your task document: changed files, string ids before→after, test/check commands with results,
screenshot paths, open questions. Finish with `task finish`.

## Current state
UI delivered; final integration/checks pending. Changes include:
- Registrant/admin remove action with named confirmation, optional bounded reason, retained installed copies, local/admin restoration explanation, inline recoverable failure.
- `#hub/removed`, account-dependent sidebar visibility, title/version/author/removal metadata, restore and list/count refresh, explicit loading/failure/empty states.
- Registration: first 0.1.0; update patch/minor/major, resulting versions, default patch, main release explanation, bump in request. Reads the current registered entry even when the original authoring draft has no edit link. Delayed entry/folder reads preserve the original folder and the researcher's note.
- All owned Workflow surfaces show registered semantic versions through hubVersionOf/hubRefVersion; unregistered packages/drafts show 초안. Trial headings omit package numbers. Hub skill versions remain integers; their Workflow origin/use references show semantic versions.
- Copy: version glossary, Korean/English copy, skill/release terminology; no prohibited revision terminology remains in owned Korean namespaces.

Checks completed:
- `cd web && npx tsc --noEmit`: passed (before parent c75207ee; compatible UI refs use optional helper fields).
- Focused web suite, 7 files: 51 tests passed. After updating stale copy expectations: 5 files / 75 tests passed. After the delayed-folder regression test: 2 files / 12 tests passed.
- First complete web suite: 187 files passed / 5 failed, 1234 tests passed / 11 failed. Ten failures were stale expected strings (fixed, targeted suites pass); the remaining chat-label parser regression was fixed by parent c75207ee. Final full suite will run on integration.
- `node geo/copy/validate-copy.mjs web/src/geo/locales`: 0 errors, 100 warnings (existing copy warnings, not strict mode).
- `node geo/ui/check-ui.mjs`: 0 errors, 78 accepted debt entries; no baseline changes.
- Actual isolated browser: removal returned to the hub list, registered count became 0 and removed count 1, restoration returned registered count to 1. No project install/write or model call was made. Entry/draft content is an illustrative fixture, not a scientific result.
- Captured 32 Korean screenshots: four screens × two styles × two themes × two viewports (1440×900, 1280×800). Registration action is within the viewport in every variant. Reviewed representative images for wrapping, density, contrast, action placement and hierarchy.

Evidence:
- Screenshots and capture scripts: `/home/seongin3/data/geoaidesk/work/gaid-hub-versions/screenshots/`, filenames `{entry,remove,removed,register}-{instrument,mapsheet}-{light,dark}-{1440x900,1280x800}.png`.
- Four report figures: `reports/2026-10-23-gaid-hub-versions/figures/{hub-entry,remove-confirm,removed-list,register-version}.png`, each under 300 KB. Parent writes the one canonical report index; no separate child report.
- Isolated frontend/backend :3137/:8137. Projects `~/data/geoaidesk/work/gaid-hub-versions/projects`, shared store `~/data/geoaidesk/work/gaid-hub-versions/hub-shared`, authoring and agent data also isolated there. Review/deployed apps :3000/:18000 untouched.
- Codegraph unavailable for this exact worktree (unindexed); relevant files read natively. No delegated workers.

Sequential decisions and integration: retain numeric revisions only for transport; use stored registered versions for UI; parent owns all server/contracts changes. Parent 8cd0ba6d is merged; final finish must include parent c75207ee (chat-label parser, server expectations and Workflow references in hub skills). No manual Git publication.

## Next steps
<!-- task:closed -->
Closed 2026-10-23T07:19:41Z: ready; the parent gaid-hub-versions integrates it. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Failed approaches
- `task sync` merged parent commit 8cd0ba6d, then ran the full scripts/check. Its server suite reported the pre-existing parent-owned workflow-doc expected-version failure. Stopped that duplicate full check with SIGINT (exit 130) after reporting it to parent; no integration was claimed. Parent owns the server fix and final full check.
- First full web suite found ten stale wording expectations and one parent-owned chat-label parser failure. Copy expectations were updated, relevant suites passed; parent c75207ee fixes the parser.
- Isolated backend initially omitted KADY_FRONTEND_PORT, so the request guard correctly refused the :3137 origin. Restarted with KADY_FRONTEND_PORT=3137; actual removal/restoration then passed.
- The keyboard radio assertion passed. A synchronous Escape DOM-count assertion ran before the close animation completed and is not recorded as a pass. Visible cancel/close actions were used for the screenshots.

## Notes and decisions
- `판` is not a globally forbidden glossary substring: unrelated strings use 판단, 판정, 출판. `버전` is a forbidden variant; the version contexts owned here use version.
- Parent supplied HubEntry.basedOn.version, HubSkillUse.version and HubSkillOrigin.workflow.version. Trial headings omit package numbers because MethodTrial has no registered version.
- No new UI guide deviations or baseline entries. Removal/registration sheets use the guide's 480/640 px widths.
- UI guide rules: P2/P3/P5/P9, I5/I7/I8/I9, B1/B3, D1/D2, A1/A2/A5, F5/F7, R1/R2, V1. New controls use existing tokens and dialog/button components.


## Open items
None. Parent contract follow-ups have been supplied.
## Copy inventory (ko/en before → after)

| String id | Korean | English |
|---|---|---|
| `hub.draft.revision` | {n}판 → 초안 | Revision {n} → Draft |
| `hub.editing.copy` | {author}의 「{title}」 {revision}판을 복사한 내 Workflow입니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. → {author}의 「{title}」 version {version}을 복사한 내 Workflow입니다. 등록하면 원본을 밝힌 별도 Workflow가 됩니다. | Your copy of revision {revision} of “{title}” by {author}. Registered, it becomes a separate Workflow that names the original. → Your copy of version {version} of “{title}” by {author}. Registered, it becomes a separate Workflow that names the original. |
| `hub.editing.edit` | 등록한 Workflow의 {revision}판을 고치고 있습니다. 허브에 등록하면 {next}판이 됩니다. → 등록한 Workflow의 version {version}을 고치고 있습니다. 다음 version은 등록할 때 고릅니다. | You are editing revision {revision} of your registered Workflow. Registering it in the hub makes revision {next}. → You are editing version {version} of your registered Workflow. Choose its next version when registering. |
| `hub.home.glossary.revision.term` | 판 → version | Revision → version |
| `hub.home.glossary.revision.text` | 등록한 Workflow를 고쳐 다시 등록할 때마다 올라가는 번호입니다. 의견은 판마다 남습니다. → 등록한 Workflow의 version입니다. 0.1.0으로 시작하며, 갱신할 때 등록자가 patch·minor·major를 고릅니다. 1.0.0은 메인 배포입니다. | The number that goes up each time a registered Workflow is revised and registered again. Comments stay with their revision. → A registered Workflow starts at version 0.1.0. For updates, its registrant chooses patch, minor or major. Version 1.0.0 is the main release. |
| `hub.home.list.revision` | 판 → version | Rev. → version |
| `hub.home.registered` | 허브 등록 {n}판 → 허브 등록 version {version} | In hub · rev {n} → Hub registration version {version} |
| `hub.register.bump.major` | (new) → 주요 배포: version {version} | (new) → Major release: version {version} |
| `hub.register.bump.minor` | (new) → 기능 추가: version {version} | (new) → New functionality: version {version} |
| `hub.register.bump.patch` | (new) → 작은 수정: version {version} (권장) | (new) → Small changes: version {version} (recommended) |
| `hub.register.firstVersion` | (new) → 처음 등록하면 version {version}이 됩니다. | (new) → The first registration will be version {version}. |
| `hub.register.mainRelease` | (new) → 작은 수정은 patch, 기능 추가는 minor입니다. 주요 배포를 고르면 메인 배포인 1.0.0이 됩니다. | (new) → Small changes use patch; new functionality uses minor. Choosing a major release declares the main release, 1.0.0. |
| `hub.register.registeredLine` | {n}판이 허브에 등록되어 있습니다. → version {version}이 허브에 등록되어 있습니다. | Revision {n} is registered in the hub. → Version {version} is registered in the hub. |
| `hub.register.update` | 허브 등록 갱신 ({n}판) → 허브 등록 갱신 | Update hub entry (revision {n}) → Update hub entry |
| `hub.register.versionChoice` | (new) → 다음 version (현재 {version}) | (new) → Next version (current {version}) |
| `hub.register.versionFailed` | (new) → 현재 version을 읽지 못했습니다. 등록창을 닫고 다시 여세요. | (new) → Could not read the current version. Close and reopen the registration dialog. |
| `hub.register.versionHint` | (new) → 수정 범위에 맞게 고르세요. 주요 배포는 첫 숫자를 올립니다. | (new) → Choose according to the scope of changes. A major release increases the first number. |
| `hub.register.versionLoading` | (new) → 현재 version을 읽는 중입니다. | (new) → Reading the current version. |
| `hub.remove.action` | (new) → 허브에서 제거 | (new) → Remove from hub |
| `hub.remove.body` | (new) → 「{title}」을 허브 목록에서 제거합니다. 프로젝트에 이미 설치한 사본은 유지됩니다. | (new) → “{title}” will disappear from hub lists. Copies already installed in projects will stay. |
| `hub.remove.busy` | (new) → 제거 중 | (new) → Removing |
| `hub.remove.cancel` | (new) → 취소 | (new) → Cancel |
| `hub.remove.failed` | (new) → Workflow를 제거하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도하세요. | (new) → Could not remove the Workflow. Check your permissions and connection, then try again. |
| `hub.remove.reason` | (new) → 제거 사유 (선택, 500자 이내) | (new) → Reason (optional, up to 500 characters) |
| `hub.remove.restoreAdmin` | (new) → 관리자가 제거된 Workflow 목록에서 복원할 수 있습니다. | (new) → An administrator can restore it from the removed Workflows list. |
| `hub.remove.restoreLocal` | (new) → 기관 허브 서버를 쓰지 않는 경우, 등록자가 제거된 Workflow 목록에서 복원할 수 있습니다. | (new) → Without an institute hub server, the registrant can restore it from the removed Workflows list. |
| `hub.remove.title` | (new) → Workflow 제거 | (new) → Remove Workflow |
| `hub.removed.body` | (new) → 복원하면 허브 목록에 다시 표시됩니다. 프로젝트의 설치본은 바뀌지 않습니다. | (new) → Restoring returns a Workflow to hub lists. Copies installed in projects do not change. |
| `hub.removed.busy` | (new) → 복원 중 | (new) → Restoring |
| `hub.removed.by` | (new) → {author} 님이 {when} 제거 | (new) → Removed by {author} at {when} |
| `hub.removed.empty` | (new) → 복원할 Workflow가 없습니다. 허브 목록에서 Workflow를 살펴보세요. | (new) → No Workflows to restore. Browse the hub list. |
| `hub.removed.failed` | (new) → Workflow를 복원하지 못했습니다. 권한과 연결 상태를 확인한 뒤 다시 시도하세요. | (new) → Could not restore the Workflow. Check your permissions and connection, then try again. |
| `hub.removed.meta` | (new) → version {version} · {author} | (new) → version {version} · {author} |
| `hub.removed.reason` | (new) → 제거 사유: {reason} | (new) → Reason: {reason} |
| `hub.removed.restore` | (new) → Workflow 복원 | (new) → Restore Workflow |
| `hub.removed.restored` | (new) → 「{title}」을 허브 목록에 복원했습니다. | (new) → “{title}” is back in hub lists. |
| `hub.removed.title` | (new) → 제거된 Workflow | (new) → Removed Workflows |
| `hub.shared.basedOn` | {author}의 「{title}」 {revision}판을 복사해 고친 Workflow입니다. → {author}의 「{title}」 version {version}을 복사해 고친 Workflow입니다. | Copied and edited from revision {revision} of “{title}” by {author}. → Copied and edited from version {version} of “{title}” by {author}. |
| `hub.shared.edit.hint` | 고친 내용은 새 판으로 등록합니다. 이전 판도 계속 설치할 수 있습니다. → 다음 version은 등록할 때 고릅니다. 이전 version도 계속 설치할 수 있습니다. | Your changes are registered as a new revision. Earlier revisions stay installable. → Choose the next version when registering. Earlier versions stay installable. |
| `hub.shared.revisions.row` | {revision}판 · {when} · {author} → version {version} · {when} · {author} | Revision {revision} · {when} · {author} → version {version} · {when} · {author} |
| `hub.shared.revisions.title` | 판 기록 {count}개 → version 기록 {count}개 | Revision history ({count}) → Version history ({count}) |
| `hub.shared.trials` | 등록한 판으로 시작한 시험 {count}회 (검토 결과 아님) → 등록된 version으로 시작한 시험 {count}회 (검토 결과 아님) | {count, plural, one {# trial started with registered revisions} other {# trials started with registered revisions}} (not a review) → {count, plural, one {# trial started with registered versions} other {# trials started with registered versions}} (not a review) |
| `hub.shared.version` | (new) → version {version} | (new) → version {version} |
| `hub.trial.newer` | {n}판 초안이 새로 있습니다. 시험한 판은 {installed}판입니다. → 시험한 뒤 수정한 초안이 있습니다. 다시 시험할 수 있습니다. | Revision {n} of the draft is new. The tried revision is {installed}. → The draft has changed since the trial. You can try it again. |
| `hubPicker.installError` | Workflow를 설치하지 못했습니다. 허브에서 선택한 판을 확인한 뒤 다시 시도하세요. → Workflow를 설치하지 못했습니다. 허브에서 선택한 version을 확인한 뒤 다시 시도하세요. | Could not install the Workflow. Check the selected revision in the hub and try again. → Could not install the Workflow. Check the selected version in the hub and try again. |
| `hubPicker.previewSource` | GAID 허브 · {title} · {count}판 → GAID 허브 · {title} · version {version} | GAID hub · {title} · revision {count} → GAID hub · {title} · version {version} |
| `hubPicker.revision` | {count}판 → version {version} | Revision {count} → version {version} |
| `methods.draft` | (new) → 초안 | (new) → Draft |
| `methods.registered` | 등록됨 · {revision}판 → 등록됨 · version {version} | Registered · revision {revision} → Registered · version {version} |
| `methods.revision` | {revision}판 → version {version} | Revision {revision} → version {version} |
| `methods.trials.heading` | {at} 시험 · {revision}판 → {at} 시험 | Trial {at} · revision {revision} → Trial {at} |
| `methods.trials.record.workflow` | Workflow ID: {id} · {revision}판 → Workflow ID: {id} · 초안 번호 {revision} | Workflow ID: {id} · revision {revision} → Workflow ID: {id} · draft number {revision} |
| `skillHub.methodDraft` | Workflow: {id} · {revision}판 · {lifecycle} → Workflow: {id} · 초안 | Workflow: {id} · revision {revision} · {lifecycle} → Workflow: {id} · Draft |
| `skillHub.previewHubSkill` | {name} {revision}판 → {name} version {revision} | {name} revision {revision} → {name} version {revision} |
| `workspace.recipe.issue` | {code, select, schema {저장한 시작 설정 형식이 geo-start/v1과 맞지 않습니다: {subject}} catalogue-off {Geo 카탈로그가 꺼져 있습니다.} catalogue-version {다른 카탈로그 판의 저장한 시작 설정입니다: {subject}} unknown-workflow {현재 카탈로그에 없는 Workflow입니다: {subject}} workflow-skill {Workflow에 필요한 스킬이 빠졌습니다: {subject}} unknown-choice {Workflow에 없는 분석 조건입니다: {subject}} unknown-skill {카탈로그에 없는 스킬입니다: {subject}} unknown-example {선택한 스킬의 사례가 아닙니다: {subject}} choice-state {답한 조건이 미결정으로도 남아 있습니다: {subject}} other {저장한 시작 설정을 확인하지 못했습니다: {subject}}} → {code, select, schema {저장한 시작 설정 형식이 geo-start/v1과 맞지 않습니다: {subject}} catalogue-off {Geo 카탈로그가 꺼져 있습니다.} catalogue-version {다른 카탈로그 version의 저장한 시작 설정입니다: {subject}} unknown-workflow {현재 카탈로그에 없는 Workflow입니다: {subject}} workflow-skill {Workflow에 필요한 스킬이 빠졌습니다: {subject}} unknown-choice {Workflow에 없는 분석 조건입니다: {subject}} unknown-skill {카탈로그에 없는 스킬입니다: {subject}} unknown-example {선택한 스킬의 사례가 아닙니다: {subject}} choice-state {답한 조건이 미결정으로도 남아 있습니다: {subject}} other {저장한 시작 설정을 확인하지 못했습니다: {subject}}} | {code, select, schema {The saved start settings do not match geo-start/v1: {subject}} catalogue-off {The Geo catalogue is off.} catalogue-version {The saved start settings are for another catalogue version: {subject}} unknown-workflow {Workflow not in the current catalogue: {subject}} workflow-skill {A skill the workflow needs is missing: {subject}} unknown-choice {Analysis setting not in the workflow: {subject}} unknown-skill {Skill not in the catalogue: {subject}} unknown-example {Example does not belong to the selected skills: {subject}} choice-state {A setting is both answered and left undecided: {subject}} other {Could not check the saved start settings: {subject}}} → {code, select, schema {The saved start settings do not match geo-start/v1: {subject}} catalogue-off {The Geo catalogue is off.} catalogue-version {The saved start settings are for another catalogue version: {subject}} unknown-workflow {Workflow not in the current catalogue: {subject}} workflow-skill {A skill the workflow needs is missing: {subject}} unknown-choice {Analysis setting not in the workflow: {subject}} unknown-skill {Skill not in the catalogue: {subject}} unknown-example {Example does not belong to the selected skills: {subject}} choice-state {A setting is both answered and left undecided: {subject}} other {Could not check the saved start settings: {subject}}} |
| `workspace.skills.hub` | 허브 스킬 {name} ({revision}판): → 허브 스킬 {name} (version {revision}): | Hub skill {name} (revision {revision}): → Hub skill {name} (version {revision}): |
| `workspace.skills.hubInstall` | 허브에서 {revision}판 설치하기 → 허브에서 version {revision} 설치하기 | Install revision {revision} from the hub → Install version {revision} from the hub |
| `workflowView.hubRevision` | {revision}판 → version {revision} | revision {revision} → version {revision} |
| `workflowView.hubState.other-revision` | 다른 판이 설치되어 있습니다. Workflow는 고정한 판을 씁니다. → 다른 version이 설치되어 있습니다. Workflow는 고정한 version을 씁니다. | Another revision is installed. This Workflow uses its pinned revision. → Another version is installed. This Workflow uses its pinned version. |
| `workflowView.hubState.suspended` | 허브에서 사용 중지한 판입니다. Workflow 작성자에게 알려 주세요. → 허브에서 사용 중지한 version입니다. Workflow 작성자에게 알려 주세요. | This revision is suspended in the hub. Tell the Workflow author. → This version is suspended in the hub. Tell the Workflow author. |
| `hubSkills.commit` | 가져온 버전 기록 → 가져온 변경 기록 | Resolved commit → Resolved commit |
| `hubSkills.history` | 판 기록과 검토 → version 기록과 검토 | Revisions and reviews → Versions and reviews |
| `hubSkills.installState.installed` | 같은 판이 이미 설치되어 있습니다. 파일을 바꾸지 않습니다. → 같은 version이 이미 설치되어 있습니다. 파일을 바꾸지 않습니다. | The same revision is already installed. No files will change. → The same version is already installed. No files will change. |
| `hubSkills.installState.other-revision` | 프로젝트의 기존 판을 선택한 판으로 바꿉니다. → 프로젝트의 기존 version을 선택한 version으로 바꿉니다. | Replaces the project’s existing revision with the selected revision. → Replaces the project’s existing version with the selected version. |
| `hubSkills.installState.suspended` | 사용 중지된 판은 설치할 수 없습니다. 다른 판을 확인하세요. → 사용 중지된 version은 설치할 수 없습니다. 다른 version을 확인하세요. | Suspended revisions cannot be installed. Check another revision. → Suspended versions cannot be installed. Check another version. |
| `hubSkills.installed` | {name} {revision}판을 설치했습니다. → {name} version {revision}을 설치했습니다. | Installed {name} revision {revision}. → Installed {name} version {revision}. |
| `hubSkills.installedRevision` | 허브 스킬 · {revision}판 → 허브 스킬 · version {revision} | Hub skill · revision {revision} → Hub skill · version {revision} |
| `hubSkills.newRevision` | 새 판: {revision}판 → 새 version: version {revision} | New revision: {revision} → New version: {revision} |
| `hubSkills.nextRevision` | 같은 이름이 있어 {revision}판으로 올립니다. → 같은 이름이 있어 version {revision}으로 올립니다. | This name exists; adds revision {revision}. → This name exists; adds version {revision}. |
| `hubSkills.origin.workflow` | Workflow에서 꺼냄: {title} {revision}판 → Workflow에서 꺼냄: {title} version {version} | Taken from Workflow: {title}, revision {revision} → Taken from Workflow: {title}, version {version} |
| `hubSkills.revision` | {revision}판 → version {revision} | Revision {revision} → Version {revision} |
| `hubSkills.sameTree` | 최신 판과 내용이 같아 새 판으로 올릴 수 없습니다. → 최신 version과 내용이 같아 새 version으로 올릴 수 없습니다. | The content matches the latest revision, so a new revision cannot be registered. → The content matches the latest version, so a new version cannot be registered. |
| `hubSkills.suspended` | 사용 중지된 판입니다. 새 설치와 Workflow 사용이 막힙니다. → 사용 중지된 version입니다. 새 설치와 Workflow 사용이 막힙니다. | This revision is suspended. New installs and Workflow use are blocked. → This version is suspended. New installs and Workflow use are blocked. |
| `hubSkills.unchanged` | {name} {revision}판이 이미 설치되어 있어 파일을 바꾸지 않았습니다. → {name} version {revision}이 이미 설치되어 있어 파일을 바꾸지 않았습니다. | {name} revision {revision} is already installed. No files were changed. → {name} version {revision} is already installed. No files were changed. |
| `hubSkills.update` | {revision}판으로 바꾸기 → version {revision}으로 바꾸기 | Switch to revision {revision} → Switch to version {revision} |
| `hubSkills.workflowVersion` | (new) → version {version} | (new) → version {version} |
| `hubFeeds.release` | {tag} 판 → 릴리스 {tag} | Release {tag} → Release {tag} |
| `hubHandoff.methodTrialLine` | Workflow {method} · {revision}판 · {workflow} → Workflow {method} · {workflow} | Workflow {method} · revision {revision} · {workflow} → Workflow {method} · {workflow} |

## Report
Parent owns the canonical `reports/2026-10-23-gaid-hub-versions/index.md`. This child supplies the four figures, screenshot locators and the copy inventory above. No separate child report.
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-hub-versions--ui-20261023T071019.838626Z/receipt.json
  - disposition: {"evidence":[],"reason":"Isolated UI test backend restarted with KADY_FRONTEND_PORT=3137 to permit the test origin.","recorded":"2026-10-23T07:11:29Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-hub-versions--ui-20261023T071038.935980Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-hub-versions/screenshots"],"reason":"Temporary isolated frontend stopped after the 32-screen visual and keyboard check.","recorded":"2026-10-23T07:18:12Z","state":"cancelled"}
- /home/seongin3/data/geoaidesk/runs/gaid-hub-versions--ui-20261023T071152.718892Z/receipt.json
  - disposition: {"evidence":["/home/seongin3/data/geoaidesk/work/gaid-hub-versions/screenshots"],"reason":"Temporary isolated backend stopped after removal/restoration and screenshot checks; fixture records retained as evidence.","recorded":"2026-10-23T07:18:24Z","state":"cancelled"}
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

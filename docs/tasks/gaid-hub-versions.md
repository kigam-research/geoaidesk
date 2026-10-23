---
format: 1
status: active
updated: 2026-10-23T08:00:28Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"e1c6a78f-11ec-46f9-83ba-acc24d237672","pid":2123332,"provider":"claude","session":"328f1569-b8ae-42a5-b1df-4474b7414b05","start":"62565307","token":"531aa2e1e3ef35b52322f15aaf618da80fc168d4620d8ba20079dacaadf3241b"}
branch: task/gaid-hub-versions
target: main
parent: 
---
# gaid-hub-versions

## Goal and done criteria
Request from the starter:

# Goal: gaid-hub-versions (unit E) — remove registered hub Workflows and manage versions

Done: (1) removal with restore as decided, in all three hub record stores (local SharedHubStore, RemoteHubStore, the server's SQLite store + migration), audited, installed copies untouched; (2) semantic versions replace 판 everywhere researchers see them (hub entry, picker, install preview, Workflow detail, start settings, CLI export, method package/descriptor fields), first registration 0.1.0, the registrant picks patch/minor/major (1.0.0 main release) on each update, existing revisions mapped in order, version shown as e.g. 'version 0.1.2'; drafts show 초안. Checks: scripts/check (incl. copy and UI checks); UI guide v2 and copy rules (decision 3 overrides the old term). Outside check: none.

## User request (verbatim, 2026-10-23)

> 추가 작업 요청이다. 허브에 등록된 workflow를 제거하는 기능이 없다. 제거하는 기능을 추가해야한다. 그리고 워크플로우를 생성하는 기능에서 질문을 할 때 해당 질문과 관련된 논문의 해당부분이나 관련 자료들이 질문의 사이드쪽 뷰어에서 보여야 워크플로우 생성을 위한 질문이 어떤 것을 의미하고 사용자들이 어떻게 지시하고 선택할지 정하기 수월하다. 또한, 서재에서도 pdf 보기를 하면 크롬 브라우저 새로운 탭이 열리는데 이런 방식보다는 사이트 패널에 pdf뷰어가 보이는 것이 더 적절하다. 그리고 판이라는 용어보다는 version이라는 용어를 사용하고 정식 출판하기 전에는 0.1.0에서 시작하고 사용자가 버전을 0.1.1로 할지 0.2.0으로 할지 정할 수 있게 하고 메인 배포를 1.0.0으로 할지도 추후 관리할 수 있게 하여야 한다. 현재는 수정할 때마다 버전만 올라가고 있는 형태이다. 버전 관리 기능이 부재한 상태이다.

The hub proposed units E (hub Workflow removal + version management, now), F (side viewer of the related paper
passage/source next to each authoring question, after C gaid-authoring-sources and D gaid-pocheon-trial's authoring fixes
merge) and G (서재 PDF in a side panel instead of a new tab, after A gaid-note-library merges), and six decisions. The user
answered (verbatim):

> 3번,5번은 나로 하고 나머지는 권장으로 진행하자. opus 5.5 high fast로 진행하자.

Decisions:
1. Order: E now; F after C and D's authoring fixes are on main; G after A is on main.
2. Removal: the registrant and administrators can remove a registered Workflow; it disappears from hub lists but an
   administrator can restore it; copies already installed in projects stay.
3. (나) Term: use the English word "version" on Korean screens too (not 버전, not 판); English screens "version". This replaces
   the 2026-10-20 term 판 — update geo/copy/terminology.csv, locale strings and the AGENTS.md "Workflow model" wording.
4. Existing revisions 1, 2, 3 … map in order to 0.1.0, 0.1.1, 0.1.2 …; all history kept.
5. (나) The registrant chooses the version when registering an update: patch (0.1.x → 0.1.x+1), minor (0.x → 0.x+1.0), and
   the registrant may also declare the main release 1.0.0 (and later majors). Not admin-only.
6. Drafts carry no version and show 초안; a version is assigned at registration.

Verified facts (hub): no removal route exists for hub entries in `server/src/geo/hub-shared/` or the institute hub server
(`server/src/geo/hub-server/`, `/hub/v1`); 판 appears in 76 Korean locale strings; authoring questions carry `Anchor` evidence
(`web/src/geo/contracts/authoring.ts`); the 서재 PDF opens with `target="_blank"` (`web/src/geo/library/library-screen.tsx:389`).
The institute hub server (PC74 :8700, 982389c5, held by user decision gaid-orcid#1) and the review app are not deployed by
this unit; the hub handles rollout after integration (a hub-server protocol change needs the server redeployed — record
it). Running units: A gaid-note-library, B gaid-workflow-example (also touches gaid-method.json / Workflow fields),
C gaid-authoring-sources, D gaid-pocheon-trial (authoring prompts/agent model). Keep edits away from their lines or rebase
onto them when they merge first.

## Current state
Orchestration (2026-10-23):
- Sequential decisions settled by the writer: contracts first. `web/src/geo/contracts/hub-version.ts` (semver helpers:
  `bumpHubVersion`, `hubRevisionVersions` (missing version = previous patch step, first 0.1.0), `hubVersionOf`,
  `hubRefVersion`, `allowedHubVersion`); `hub-shared.ts`: `HubEntryRevision.version?`, `HubEntry.removed?`/`HubRemoval`,
  `HubMe.admin?`, `RegisterBody.bump?`, `RemoveEntryBody`, routes `POST /geo/hub/entries/:id/remove`, `GET /geo/hub/removed`,
  `POST /geo/hub/entries/:id/restore`; `WorkflowDoc.revision` → `version: string | null` (block attr `version="x.y.z"`, old
  `revision="n"` blocks parse as 0.1.(n-1)); `MethodOrigin.hubEntry.version?`, `LocalMethodSummary.hubVersion`,
  `HubEntryLink.version?`; skill rows `workflow: { title, version | null }`.
- Removal rules: registrant or hub server admin removes; removed entries 404 on every read and leave all lists; files,
  comments, stars, installs kept; registration/file upload to a removed entry 409. Restore: hub server admin only
  (`/hub/v1/admin/entries/removed`, `/hub/v1/admin/entries/:id/restore`); the local store has no administrators, so there
  the registrant restores their own (`removed.json` marker + `removals.jsonl` history per entry). Server: migration 5
  `hub_entry_removals`, audit `entry.remove`/`entry.restore`.
- Versions: GAID route assigns 0.1.0 first, else `bumpHubVersion(current, bump ?? "patch")`; the hub server validates a new
  revision's version (absent from an older GAID → patch step). Stored older revisions are never rewritten (views fill
  versions). Package-internal `gaid-method.json` version (0.N.0 per package build) is unchanged and not shown; installs
  record the hub version in the package origin.
- Packages: (1) backend + contracts + workflow-doc/card (writer, done: server+web typecheck, hub server/e2e/CLI export tests
  pass); (2) UI + copy sweep (child writer `gaid-hub-versions--ui`, owns web/src/geo/{hub,hub-picker,skill-hub,methods,
  hub-skills,workflow/workflow-view.tsx} and locales except workflowDoc, terminology.csv). Integration: child completes into
  this branch, then writer runs scripts/check and writes the report.
## Next steps
1. Done: GAID-side tests (local removal/restore, register bump, older records), e2e remote removal, server version/removal/import tests. Child `gaid-hub-versions--ui` (writer 85dddf2d) runs the UI package.
2. Done since: basedOn.version, HubSkillUse.version/HubSkillOrigin.workflow.version (child requests), chat label parser
   (`web/src/lib/command-blocks.ts`) accepts version, migration-5 fixtures, glossary `version` row, AGENTS.md and
   docs/geo/hub-server.md. Full server vitest: only helper-venv/geopandas/office environment failures remain locally
   (scripts/check prepares the helper venv).
3. Done: child completed and closed (f534c8da); scripts/check passed on the integrated branch (server 2260/8 skipped, web 1246,
   copy/UI checks, production smoke). Report written and humanized. Next: review-copy, task finish. Rollout after merge
   (hub): restart the institute hub server (PC74 :8700) on this code for migration 5; review app update.
   Previously: `task complete`, integrate, scripts/check, AGENTS.md wording (판 → version), report.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-hub-versions/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

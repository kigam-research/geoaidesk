---
format: 1
status: done
updated: 2026-10-22T07:14:50Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"1feaee6d-25a2-4f86-8c96-6168fa426401","pid":3729624,"provider":"claude","session":"72093558-35de-4f81-99ef-1a6be8c11c3a","start":"53183203","token":"0f77e2794014ac0980c71fe32598208e9e17d14839428a13a9aca7f1f070e2fc"}
branch: task/gaid-hub-skills
target: main
parent: 
---
# gaid-hub-skills

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-skills

User decision (verbatim, 2026-10-22): "우선 첫표 두항목은 권장안대로 하자." — answers gaid-workflow-model#1 with option 가) design
it as a separate unit. The item: skill management in the GAID hub (user, 2026-10-20: "GAID 허브에서 스킬도 추후에 관리해야한다").
Context: gaid-workflow-model (ADR docs/adr/2026-10-20-workflow-runtime-form.md) made the hub Workflow-only; skills are parts a
Workflow uses (built-in catalogue, imported from GitHub and similar, bundled with a Workflow; "hub-managed skills later");
Settings → Skills imports from GitHub first. gaid-backend (active) is designing the shared backend (accounts, storage) for the hub.
Order: diagnose and propose first (no product code): what researchers need from hub-managed skills (find, share, version, review,
reuse in Workflows, import from GitHub into the hub), how it fits the Workflow model and the backend options; options with a
recommendation; discuss with the user in the writer tab (task review-copy); ADR; implement only the agreed scope. Coordinate with
gaid-backend through the hub for storage/auth assumptions. UI follows docs/design/ui-guide.md v2. Own GAID_HOME under
~/data/geoaidesk/work/gaid-hub-skills/; do not modify ~/.geoaidesk. Outside check: no outside check.

## Current state
Phase 1 of hub-managed skills is implemented on task/gaid-hub-skills (user chose all recommended options 2026-10-22).
- Result: hub skill shelf (#hub/skills, #hub/s/<id>), three ways in (project skill, hub Workflow's bundled skill, GitHub
  or other skills CLI source staged only), immutable revisions with tree hash/files/origin/licence/findings/review
  history, licence gate (restricted/unknown → registrant only), unverified display-name reviews, install with preview +
  consent (no GitHub), Settings → Skills "GAID 허브에서" + installed revision/new revision/edited/suspended rows.
  Workflows pin hub skill revisions (gaid-workflow/v1 `source: "hub"`): installed with the Workflow, checked at
  registration, readiness states with in-place install, chat exposure, 지침 text, CLI export from the hub store,
  authoring question `hub-skills` binding chosen skills. Phase 2 (reviewer/admin roles, reports, upstream candidates)
  waits for gaid-backend accounts (open item).
- Children integrated and closed: store (c073a2a2), ui (95a70b6f).
- Verification: server full suite 184 files/2082 tests pass (store job receipt
  ~/data/geoaidesk/runs/gaid-hub-skills--store-20261022T061750.108769Z/receipt.json); ui child's finish ran scripts/check
  on its tree; after integration server geo 54 files/477 and web geo 45 files/239 pass, web workspace tests pass,
  UI and copy checks 0 errors. Real isolated app path checked by ui child (evidence ~/data/geoaidesk/work/gaid-hub-skills--ui/).
  Not run: live GitHub fetch registration, Workflow extraction and Workflow-with-pin install in the browser (tests only),
  model-driven authoring with the hub-skills answer.
- Re-verify: `cd server && npx vitest run test/geo-hub-skills.test.ts test/geo-hub-pins.test.ts test/geo-hub-skill-workflows.test.ts`;
  `cd web && npx vitest run src/geo/hub-skills src/geo/workspace`; `scripts/check`.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T07:14:50Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-hub-skills.md.

## Failed approaches
## Notes and decisions
- User decisions 2026-10-22 (verbatim "모두 권장안으로 진행하자."): 1 가) hub skill shelf, revisions pinned by Workflows;
  2 가) GitHub imports visible at once as "검토 전"; 3 가) implement all of phase 1 now, phase 2 after gaid-backend accounts.
- Work packages (phase 1). Shared interface settled first (above). Integration order: A → C2 → B sync → checks.
  - A `hub-skill-store` (child, general work): owns new `server/src/geo/hub-skills/**`, route registration in
    `server/src/geo/routes/hub-shared.ts`, `GET /skills` row field `hubSkill` (`server/src/api/skills.ts`, boundaries entry),
    `server/src/geo/skill-details.ts` hub-skill rows, tests `server/test/geo-hub-skills*.test.ts`. Exports for C2:
    store class, `installHubSkillRevision`, revision reader, `listHubSkills` (search) usable by authoring.
  - B `hub-skill-ui` (child, general work): owns new `web/src/geo/hub-skills/**`, locale namespace `hubSkills`, seams in
    `web/src/geo/hub/{hub-sidebar,hub-screen,location,hub-shell}.tsx`, Settings → Skills "GAID 허브에서" + installed
    revision/new-revision notice (`web/src/components/skills-panel.tsx` seam), screenshots per UI guide v2 §12.
  - C (writer): Workflow side. C1 now: `local-methods.ts` exposure, `cli-export.ts`, `workflow-view.tsx`,
    `readiness.tsx`, `workspace/workflows.ts`. C2 after A: `authoring/install.ts` (pinned hub skills with a Workflow),
    `hub-shared/routes.ts` registration checks, authoring (`authoring/{agent,package,prompts}.ts` + question step).
- Plan (sequential): diagnose → research → proposal → user decision → ADR → implement. Implementation packages are decided
  after the user picks the scope; shared contract (skill entry schema, Workflow `skills[].source: hub` ref) first.
- Inputs read: ADR docs/adr/2026-10-20-workflow-runtime-form.md; reports/2026-10-20-gaid-workflow-model §3.6, §3.13;
  reports/2026-10-15-gaid-researcher-ecosystem (user goal: researchers make skills/Workflows from their papers and share;
  non-coders; institute "second brain"); gaid-backend diagnosis notes (hub-shared store is one process, X-GAID-User unchecked).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-workflow-model#1
## Open items
- [대기 gaid-hub-skills#1] 허브 스킬 2단계(검토자 역할 구분, 관리자 사용 중지 권한, 문제 신고, GitHub 원본이 바뀌었을 때 새 판 후보와 비교) — 가) gaid-backend 계정이 생긴 뒤 별도 작업으로 시작 — 나) 지금 표시 이름으로 시작 — 권장: 가) 검토 표시는 검토자를 확인할 수 있어야 믿을 수 있음 (사용자 2026-10-22 결정 3 가) — 막힌 일: 2단계 전체 — 조건: gaid-backend 계정 도입 — 근거: reports/2026-10-22-gaid-hub-skills#5-한계
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-hub-skills/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

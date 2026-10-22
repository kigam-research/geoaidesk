---
format: 1
status: active
updated: 2026-10-22T06:02:02Z
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
Phase 2 (implementation) started 2026-10-22 after the user chose all recommended options.
- Shared interface done by the writer (typechecks clean, method-file/workflow-doc tests pass):
  `web/src/geo/contracts/hub-skills.ts` (records, states, HTTP API), gaid-workflow/v1 `skills[].source: "hub"` with
  `hub {skillId, revision, treeHash}` (method-file validation, server/web 지침 renderer, locale `workflowDoc.source.hub`,
  `skill.hubRevision`), `WorkflowSkillState.hub`, package origin kind `gaid-hub-skill` + `hubSkill`
  (`server/src/geo/methods/package-origin.ts`, `MethodOrigin`), pure pin state `server/src/geo/methods/hub-pins.ts`.
- ADR docs/adr/2026-10-22-hub-managed-skills.md; glossary/terminology "허브 스킬".
- Children: see Notes and decisions (work packages); IDs recorded there once started.
## Next steps
1. Start children A (hub-skill-store) and B (hub-skill-ui); while they run, do C1 (Workflow runtime pieces that need only
   the shared interface: exposure, CLI export, workflow-view, readiness rendering of hub states).
2. After A completes: C2 myself (Workflow install pulls pinned hub skills, readiness uses A's store for `suspended`,
   registration validates hub refs, authoring suggestions), then sync B, real-app check, scripts/check, report §3.9+.
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
## Open items
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

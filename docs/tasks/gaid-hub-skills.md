---
format: 1
status: active
updated: 2026-10-22T04:38:34Z
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
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

---
format: 1
status: waiting
updated: 2026-10-22T01:54:23Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"12220668-2f56-4301-9ceb-1da6022ea8f7","pid":2196945,"provider":"claude","session":"f484fa94-7306-4cbf-a4a9-9e4e13cb3b0b","start":"52201100","token":"e6aadc1b7993109484dd94e6a03a7519df103e802549703adee2f16a87cdcd3c"}
branch: task/gaid-ui-v2-debts
target: main
parent: 
---
# gaid-ui-v2-debts

## Goal and done criteria
Request from the starter:

# Request: gaid-ui-v2-debts

User decision (verbatim, 2026-10-22, to the geoaidesk hub): "부채 모두 처리하자. 확인 --fresh#4와 관련해서 chrome에서는 모서리 깎기가 적용되었는데 firefox에서는 적용되지 않았다."
Items recorded as answered with this unit as follow-up (texts in docs/open-items/gaid-design-identity*.md on main):
1. gaid-design-identity#1 → 나) now: replace SOURCE_TONE / COVERAGE_TONE hue utilities in web/src/geo/library/library-screen.tsx
   with role tokens and remove their entries from geo/ui/ui-baseline.json.
2. gaid-design-identity--fresh#1 → 가) rebuild the map screen (WP05 viewer, web/src/geo/viewers/map/) to guide v2 MAP1–MAP6
   (short copy instead of long paragraphs, no checkerboard background, legend and basic info visible without scrolling).
3. gaid-design-identity--fresh#2 → 가) implement L1 (1024–1279 px: right panel becomes an overlay sheet), L2 (keyboard resize of
   panel borders), N2 and N6 (sidebar hide, search shortcut) from guide v2 §3.
4. gaid-design-identity--fresh#3 → 가) after sending decision answers, keep the chosen option on the decision card in a "보냄" state
   (RN3).
Pending in the hub (not in this unit until routed): --fresh#4 (bevel corners: user confirmed Chrome shows them, Firefox does not)
and --fresh#5 (research-notes list in the left sidebar).
Rules: docs/design/ui-guide.md v2 (identity I1–I15, components, V bans, review checklist), role tokens only, shared parts in
web/src/geo/shell/, review every change in 2 styles (계측, 도폭) × 2 themes, original pixels for figures/maps/PDFs,
`node geo/ui/check-ui.mjs` passes; Korean screenshots 1440x900 and 1280x800 (plus 1024–1279 px for L1). Design stance:
"디자인은 항상 impeccable과 taste와 브랜딩 가이드 전문가 입장에서 디자인해야한다."
Coordination: gaid-research-visuals, gaid-library-next and gaid-concept-pictures are active; gaid-library-next does not rework the
library screen. Avoid editing their owned files; coordinate through the hub if a shared file must change.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-ui-v2-debts/; do not modify ~/.geoaidesk. Outside check: no outside check.

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

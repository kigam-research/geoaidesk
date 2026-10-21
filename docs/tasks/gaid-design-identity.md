---
format: 1
status: active
updated: 2026-10-21T12:59:35Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"558fe5e2-cb7e-422f-9ad6-cb76328ebdac","pid":2568444,"provider":"claude","session":"1639b691-a088-419c-8bbc-66a4d53f73b4","start":"47547554","token":"d521c3ca9d43df5991d2cadb1375287877325a1ec3980f2ea347174bb29303cb"}
branch: task/gaid-design-identity
target: main
parent: 
---
# gaid-design-identity

## Goal and done criteria
Request from the starter:

# Request: gaid-design-identity

User request (verbatim, 2026-10-21, to the geoaidesk hub):
"GAID 허브와 GAID 시스템에서 디자인 가이드와 관련하여 ONEUI 가이드를 기반으로 작성된 것으로 이해하고 있다. 추가 디자인 가이드로 https://tossmini-docs.toss.im/tds-mobile/ 가 있으며, 현재 GAID 허브와 GAID 시스템의 디자인에서 AISlop을 피하면서 독자적인 브랜딩으로 ui/ux시스템이 인식 될 수 있게 디자인을 개선하고 싶다."
After the hub's proposal: "gaid-design-identity 는 진행하자."

Scope confirmed with the user (hub proposal):
1. Diagnose the current UI guide (docs/design/ui-guide.md, One UI based; geo/ui/ui-rules.json; geo/ui/check-ui.mjs) and the
   real GAID hub and GAID system screens; list "AI slop" signs with evidence (generic purple/blue gradients, unmodified
   component-library cards/badges, ubiquitous icons and fonts, decoration without meaning, etc.).
2. Benchmark TDS Mobile (https://tossmini-docs.toss.im/tds-mobile/): principles, colour/type/spacing tokens, components,
   writing rules. GAID is a desktop research tool: adopt only what fits; decide how it merges with the One UI guide.
3. Brand system proposal: colour, typography, iconography, logo usage (angular orbital G, geo/brand), concept-picture style,
   motion. Show 2–3 distinct visual directions as real screen mockups; the user chooses.
4. Implement the chosen direction: tokens + UI guide update, applied to hub and system screens; add anti-slop rules to the
   UI check in scripts/check.
Constraints: do not take Toss-proprietary assets (Toss Product Sans, icons, images); fonts with open licences only.
Logo changes are asked separately in the proposal (relates to open item gaid-release-proof#2, brand approval).
Coordination: gaid-research-visuals (running) and gaid-library-folders (starting now) build UI later; once a direction is
chosen, tell the hub so their UI follows the new tokens. Phase 1 here changes no product code.
Use task review-copy for the proposal and mockups. Own GAID_HOME under ~/data/geoaidesk/work/gaid-design-identity/;
do not modify ~/.geoaidesk. Outside check: no outside check (design work).

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

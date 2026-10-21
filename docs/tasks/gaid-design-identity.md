---
format: 1
status: active
updated: 2026-10-21T13:14:36Z
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
Phase 1 (proposal, no product code) in progress, 2026-10-21.
- Own app instance from this worktree: systemd unit `gaid-design-identity-app` (ports UI 3310 / API 18310),
  GAID_HOME `~/data/geoaidesk/work/gaid-design-identity/home` = copy of ~/.geoaidesk without credentials
  (config.env, auth.json, models*.json, web-search*, mcp-auth excluded; absolute paths rewritten). Log: `launcher.log` there.
- Current-screen shots (1440×900): `~/data/geoaidesk/work/gaid-design-identity/shots/0[1-6]-*.png`.
- Mockups: `~/data/geoaidesk/work/gaid-design-identity/mockups/` (`screens.html?d=a|b|c&s=hub|work`, `base.css`,
  `dir-{a,b,c}.css`, rendered `png/`, `shoot.sh`; served by transient unit `gdi-mock-http` on :3399).
- Reader 8021eb25 (task reader, general work) delivered the TDS Mobile digest `.../gaid-design-identity/tds-notes.md` (+ `tds-pages/`).
- Proposal report written (diagnosis 10 signs, TDS adopt/skip table, three directions, 2 decisions), humanizer applied.
## Next steps
1. Wait for the user's choice (report §6: direction 가/나/다/섞기; logo keep or revise). Proposal sent with
   task review-copy on 2026-10-21 (report + mockups/compare.md).
2. After the choice: tell the hub (gaid-research-visuals, gaid-library-folders follow new tokens); phase 2 implements.
## Failed approaches
- playwright-cli cannot render `file://` mockups (blank page); serve them over http.
## Notes and decisions
- Diagnosis facts (evidence in shots/ and code): Pretendard and D2Coding are declared but never loaded (no @font-face,
  no package; Linux renders Noto Sans CJK JP, Windows would render Malgun Gothic); Sparkles icon is the GAID hub symbol
  (top-nav, home banner, hub entry); shadcn zinc neutrals and 10 px radius unmodified; upstream Tailwind hues
  (401 `text-<hue>-<n>` uses, 66 in web/src/geo; violet pill in app/page.tsx; avatar palette sky/emerald/violet/amber/
  rose/teal in shared-method.tsx); peach category cards for 기본 Workflow; brand blue is the only identity colour and
  also tints concept pictures; icon before nearly every label; `text-[11px]` header chips.
- Directions drafted: 가) 도면 (map-sheet: warm paper chrome, ink neatlines, legend swatches, IBM Plex Mono numerals),
  나) 지층 (strata: family colour bands, workflow-size strata bar, NanumSquare headings), 다) 차분한 목록 (TDS-adapted:
  grey ground, borderless islands, big type, orbit marker). Logo unchanged in all three.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-21-gaid-design-identity/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: active
updated: 2026-10-21T13:57:59Z
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
- Proposal report written and revised after the user's feedback: diagnosis, TDS table, directions 가 3판/라(Codex)/나/다
  with light+dark, dark-theme surface contract, logo candidates (writer v2 + Codex), 3 decisions.
- Codex 고급검토 readers done: e90b5a1e (`codex/review.md`: prefers its own 라) 연구 등록부, A best of the original
  three; blockers fixed in 가 3판: no image filters/inversion) and efc66f40 (`codex-logo/review.md`: keep current logo;
  if colour, teal orbit #087E8B / #46C5C8 on the existing lower-left orbit contour).
## Next steps
Phase 2 (implementation of direction 라, light + dark). Orchestration:
- Sequential, done by the writer first (shared interface): tokens in `web/src/app/globals.css` (light `:root`, `.dark`,
  `--gaid-*` surface/role variables + Tailwind `*-gaid-*` colours), self-hosted Pretendard (`web/public/fonts/`), UI guide v2
  (sections 4, 4a, G4/G5, F6/F7, Q7, B6, S6–S8, V1–V10, checklist 11–12), `geo/ui/ui-rules.json`, boundaries entries.
- Independent packages (child writers, "general work"), file ownership:
  - `hub`: `web/src/geo/hub/**`, `web/src/geo/hub-picker/**`, `web/src/geo/workflow/**`, hub locales only if a string must
    change (no copy changes planned).
  - `system`: `web/src/app/page.tsx` (header/workspace chrome), `web/src/components/project-view.tsx`,
    `web/src/components/workflows-panel.tsx`, `web/src/geo/workspace/**`, `web/src/geo/notes/**`, `web/src/components/ui/{button,badge,card,tabs,input}.tsx`.
  - writer: `geo/ui/check-ui.mjs` slop checks + `ui-rules.json` slop block + `ui-baseline.json`, guide, tokens, report,
    final screenshots (light/dark, 1440×900 + 1280×800).
  - Integration order: writer tokens/guide (saved) → children in parallel → `task complete` each → slop baseline → checks.
- Exploration (reader, non-blocking): further logo refinement / new logo design per the user's 3(다) remark.
1. Next action: save the shared interface, start children `hub` and `system`, implement slop checks meanwhile.

## Failed approaches
- Logo candidates v1 with raw KIGAM hexes (`logo/v1/`): blue G + green/yellow/red orbit reads as Google's palette; a
  short tricolour band reads as flag stripes at 16–32 px; the user found raw colours awkward (2026-10-21).
- playwright-cli cannot render `file://` mockups (blank page); serve them over http.
## Notes and decisions
- USER DECISIONS 2026-10-21 (verbatim): "1번 라로 하거나 현재 방식 유지다. 새로 제안한 디자인이 적절한 것이 없다. 2번 (가) 3번 (가)로
  하고 (다)로 더 다듬거나 새롭게 디자인하는 것도 고려하자. 디자인은 항상 impeccable과 taste와 브랜딩 가이드 전문가 입장에서
  디자인해야한다." Interpreted (told the user, correction invited): direction = 라) 연구 등록부 (Codex `codex/dir-d.css`),
  not the 섞기 option that shared the label; dark theme in phase 2; logo kept, with further refinement/new logo design as
  an exploration. Design lens rule → UI guide (repo) + memory. Hub notified (request fded6f8b87d6, kind route).
- User 2026-10-21 after the first proposal (verbatim): "가 도면은 권장하는데 여전히 흰색 배경이 작동하는 부분들이 있지 않나? 그리고
  다크테마는 어떻게 할 것인지도 고민해야한다. impeccable 스킬과 taste 스킬로 검토해볼 필요가 있다. codex 고급검토에게 검토도 받고 codex가
  시각방향을 제안하게도 해보아야 한다. 로고의 경우 그대로 두어도 된다. 그런데 후보군으로 KIGAM로고의 G에 위치한 3가지 색상을 로고에
  반영하거나 유사한 방식의 디자인적으로 어색하지 않은 방식으로 반영할 수 있다면 후보군으로 다듬어서 제시하는 것도 필요하다." Then:
  "로고 디자인도 생성되면 고급 codex에게 검토 받고 해당 codex가 시안을 생성할 수 있게 해보자." and "현재 제안한 후보 로고는 색상을
  그대로 사용해서인지 어색한 감이 있다. 그리고 GAID허브와 GAID시스템의 색상과도 일관성이 있어야 하며, 꼭 KIGAM 로고의 3개 색상을 다
  사용할 필요도 없으며, 디지털 형식으로 반영해도 된다." → Logo: keeping the current logo is acceptable; candidates are extra.
  The user explicitly asked for Codex 고급검토 here (overrides the 2026-10-16 default of not using that profile).
- impeccable/taste review (writer): 가) v1 warm paper #F4F2EC sits in taste's banned "warm paper/cream" default family;
  eyebrow labels, coloured left borders > 1 px (가 todo, 나 bands) and four equal cards are impeccable craft-floor bans.
  Changes: shared hub = one featured Workflow + compact list; eyebrow removed; 가) v2 = cool grey-green frame #ECEEEB,
  white sheet #FCFCFB with 1 px ink neatline only for researcher content (concept figure, notes, documents, map canvas),
  lists on the frame with hairlines, no left borders; dark theme for all three (`&t=dark`). 나) keeps its colour bands
  as its defining device (flagged). v1 kept as `mockups/screens-v1.html`, `dir-a-v1.css`.
- Logo v2 candidates (`logo/`, `make_logos2.py`, `sheet.png`): one KIGAM-derived green tuned to GAID (#0B9A6A, 3.6:1 on
  white; #35C08A on dark) with brand blue: A two-colour orbit, B stepped digital orbit, C pixel orbit end.
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

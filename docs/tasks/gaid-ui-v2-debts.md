---
format: 1
status: active
updated: 2026-10-22T02:56:14Z
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
Plan (2026-10-22):
- Packages: (A) map screen MAP1–MAP6 → child `gaid-ui-v2-debts--map` (writer 4874820d, "general work"; prompt
  ~/data/geoaidesk/work/gaid-ui-v2-debts/child-map-prompt.md; owns web/src/geo/viewers/map/**, locales/map/**, one map
  block in globals.css, map baseline entries). (B) workspace layout L1/L2/N2/N6 in web/src/app/page.tsx (+ shell) — parent.
  (C) library hue utilities → role tokens, library baseline entries removed — parent. (D) RN3 '보냄' state on decision
  cards in web/src/geo/notes/ — parent.
- Integration order: C, D, B on this branch; then `task sync`/merge of the map child; then screenshots (2 styles × 2 themes ×
  1440/1280, 1024–1279 for L1), scripts/check, report.
- Data home: ~/data/geoaidesk/work/gaid-ui-v2-debts/home (copy of gaid-design-identity--fresh home); parent dev app ports
  18370/3370, child 18360/3360.
- Done on this branch (2026-10-22, pushed 932190d7): C library badges → role tokens (source neutral, read coverage
  success/warning tint, recent-list side stripe removed; 23 baseline entries removed, slop list empty); D RN3 delivered
  answers (`web/src/geo/notes/decision-answers.ts` load/saveDelivered in localStorage `gaid:note-answers:<project>:<note>`,
  keyed by question text; plates 보냄 / 입력창에 넣음 / 바꾼 답, 보내기 전; only new or changed answers are sent again);
  B layout: chat pane overlay sheet below 1280 px, separators keyboard-resizable (16/64 px, Home/End) within L2 ranges
  (tree 220–360, chat 360–640, saved widths clamped), Ctrl/⌘ \ file list toggle, Ctrl/⌘ K search (new file-name filter in
  the file tree; project list and hub search fields marked `data-gaid-search`), shared `web/src/geo/shell/shortcuts.ts`.
- Checks so far: web vitest 177 files / 1148 tests passed before the RN3 copy tweak (notes 11/11 after); tsc clean;
  check-ui 0 errors; copy validator 0 errors; distribution test passes with the new seam owner.
- Real-app check (dev app ports 18370/3370, data home above + library fixture copied from gaid-library-folders home):
  Ctrl K focus/filter/Escape, Ctrl \ hide then Ctrl K reopen+focus, chat separator 440→456→520, End 640, Home 360.
  Screenshots ~/data/geoaidesk/work/gaid-ui-v2-debts/shots/ (lib, dec, ws × 2 styles × 2 themes × 1440/1280/1180),
  contact sheets in .../sheets/; script .../shot.sh.
## Next steps
1. `task finish` (report declared; dev app unit `gaid-ui-debts-app` stopped before finish).
- 2026-10-22: map child gaid-ui-v2-debts--map completed and closed (ready commit 2d81e83d, integrated 4546bc27; build caches
  removed from its worktree before `task close`). After integration: layer-row padding, adaptive default table height
  (≤ 40% of map body, 184–240 px until resized; 1280×800 map 181→237 px). scripts/check on 2ec9e8e2: all passed
  (backend 2067 + 8 skipped, web 1151, distribution, copy 0 errors, UI 0 errors, production smoke), log
  ~/data/geoaidesk/work/gaid-ui-v2-debts/logs/check.log. Final map screenshots shots/map-final-*.png (8).
## Failed approaches
- After merging the map child, the running dev server kept the old globals.css (map body rendered as block, panel below
  the map); restarting the dev app fixed it. Not a code issue.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
Closes: gaid-design-identity#1
Closes: gaid-design-identity--fresh#1
Closes: gaid-design-identity--fresh#2
Closes: gaid-design-identity--fresh#3
## Open items
- [결정] 지도·표처럼 높이가 필요한 파일을 열었을 때 위의 'Workflow 제안' 칸(약 155 px)을 접을지 — 가) 한 줄 요약과 펼치기로 접고 펼치면 지금처럼 보임 — 나) 지금처럼 모든 파일에서 펼쳐 둠 — 권장: 가) 1280×800에서 지도가 약 120 px 커지고 Workflow 시작은 한 번 더 누르면 됨 — 막힌 일: 없음 — 근거: reports/2026-10-22-gaid-ui-v2-debts#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-22-gaid-ui-v2-debts/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

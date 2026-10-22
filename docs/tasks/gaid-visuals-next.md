---
format: 1
status: active
updated: 2026-10-22T09:05:54Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"8bae3bd9-1847-436d-918d-15c77aff84a1","pid":1865557,"provider":"claude","session":"04b52e98-aed3-4749-b725-5863794d4095","start":"54718151","token":"c1146656906ed1e52af0dcf6a76b7d8f0f6adc197b1e4b98254b697d47eb5959"}
branch: task/gaid-visuals-next
target: main
parent: 
---
# gaid-visuals-next

## Goal and done criteria
Request from the starter:

# Request: gaid-visuals-next

User words (verbatim, 2026-10-22, to the geoaidesk hub): "남은 항목 중 정해야 하는 항목은 권장 방식으로 진행하자. 사용자가 직접 확인해야하는 부분과 관련해서는 유료 구독 모델 시험의 경우 3000번 시험용 앱을 사용하여라. 그리고 PU빠른 시험은 제외해도 된다. gaid-release proof#2를 제외하고는 직접 테스트 에이전트(GPT 6.1 sol high 워커)를 GAID 허브와 시스템을 모르는 이용자라고 간주한 뒤 테스트를 진행하게 하면 된다. gaid-zotero-web-fix는 인증서 문제를 이미 해결한 것으로 이해하고 있다. 웹 서재에도 논문을 추가해두었다."

Items answered with this unit as follow-up (docs/open-items/gaid-research-visuals.md; report reports/2026-10-21-gaid-research-visuals/index.md):
1. gaid-research-visuals#2 가): open the official AGU and 자원환경지질 (Economic and Environmental Geology) author pages in a real browser
   and fill their figure requirements (width, font size, resolution, AI image policy) in the journals data (journals.json of the gaid-figures
   skill), with source URLs and access dates. Use the playwright-cli skill; if a site needs the user's login or blocks headless access, use
   the aside skill (PC71) or ask the user. Do not guess values; leave "확인 안 됨" for anything not read from an official page.
2. gaid-research-visuals#3 가): an entry from a library paper to the connection map: pick the project where the paper is used (the library
   spans projects; the map is per project) and open its map centred on that paper. UI per docs/design/ui-guide.md v2 (2 styles × 2 themes).
Coordination: gaid-user-acceptance is testing in the review app (PC74 :3000) — never touch it; own GAID_HOME under
~/data/geoaidesk/work/gaid-visuals-next/. Releasing a new catalogue version for the skill data follows the gaid-library-next pattern
(catalogue built in this repo, user approves publication). scripts/check passes; brief report. Outside check: no outside check.

## Current state
Plan (2026-10-22):
- Package A (child writer `gaid-visuals-next--journals`, "general work"): AGU and EEG profiles in
  geo/skills/gaid-figures/assets/journals.json from official pages opened in a real browser (playwright-cli; aside on
  PC71 if login/headless block; PC71 MCP currently times out). Owns journals.json (agu, eeg only) and the matching
  test expectations in geo/tests/figures-helper.test.mjs if any. No catalogue release: gaid-figures is a shipped skill
  (server/src/geo/shipped-skills.ts, hash-followed for unedited copies), so the edit reaches projects without one.
- Package B (this writer): library paper → connection map entry. Library item detail (web/src/geo/library/
  library-screen.tsx ItemDetail) gets "연결 지도 열기"; projects come from the item's existing `uses` (note + project
  kinds). One project → opens directly; several → pick the project first; none → no entry, short reason. The map pane is
  the existing ConnectionMapPane with projectId=<chosen>, focus=`paper:<itemId>`. Owns web/src/geo/library/*,
  web/src/geo/connections/* (button/project picker), locales library/connections.
- Integration order: B on this branch; A merged via `task complete`; then scripts/check, screenshots (2 styles × 2
  themes, 1440×900 and 1280×800) with own GAID_HOME under ~/data/geoaidesk/work/gaid-visuals-next/, brief report.
Package B done (commits up to ddd00b23): web/src/geo/library/paper-map-entry.tsx (+test), ConnectionMapDialog
(controlled) in web/src/geo/connections/connection-map-button.tsx, pane props projectName/onOpenProject, locales
library.map.* and connections.hintProject / connections.open.project.button. Checks: web vitest library/connections/notes
(23), web tsc, check-ui 0 errors, copy validator 0 errors. Real app: user unit gaid-visuals-next-app (ports 3320/18320,
GAID_HOME ~/data/geoaidesk/work/gaid-visuals-next/home copied from gaid-research-visuals; seeded 2 GAID papers kim2024 and
park2021 cited in the Default note, kim2024 attached to project 화강암 풍화대 조사); 17 screenshots in
~/data/geoaidesk/work/gaid-visuals-next/playwright/matrix/ (2 styles × 2 themes × 1440/1280 × picker/map, plus
opened-project); console errors 0. Found and fixed in the real app: the map stayed open over the workspace after
"프로젝트 열기".
Child A: gaid-visuals-next--journals (writer 296db605), running; reported AGU/EEG pages readable with a normal Chrome UA.
## Next steps
1. When child A finishes: `task complete gaid-visuals-next--journals`, fill report section on journals, scripts/check,
   stop unit gaid-visuals-next-app, task finish.
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

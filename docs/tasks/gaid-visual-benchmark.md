---
format: 1
status: active
updated: 2026-10-23T12:37:11Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"26afde7c-3d1a-468d-95dd-0bc61144c3fa","pid":970986,"provider":"codex","session":"01a168c1-c2ab-78f2-9ae9-dc1c2eaad85e","start":"64682980","token":"90a3e40fb9066b5b5c4954bc054f67e529051d61a73d19c80eafa019af455bb8"}
branch: task/gaid-visual-benchmark
target: main
parent: 
---
# gaid-visual-benchmark

## Goal and done criteria
Request from the starter:

# Goal: gaid-visual-benchmark — benchmark geoscience sites' UI/UX, generate image assets and apply them to GAID

## User request (verbatim, 2026-10-23)

> 다음 요청으로 GAID허브와 GAID 시스템과 관련하여 UI/UX와 GUI적인 측면이 부족하다고 생각한다. https://cesium.com/, https://www.esri.com/en-us/home, https://data.kigam.re.kr/, https://www.kigam.re.kr/board.es?mid=a10703040000&bid=0025 홈페이지들과 함께 geoscience 관련 사이트 중 UI/UX가 우리 GAID 시스템과 관련하여 벤치마킹할만한 요소들이 있는지 조사하고 앱 페이지들의 UI/UX 디자인적 개선을 위한 필요한 에셋들을 이미지로 생성하여 적용할 필요가 있다. 작업은 writer로 gpt astra max fast가 직접 이미지도 생성하고 디자인적으로 적용했으면 한다. 사용자의 요청을 이해하였는지 먼저 확인 받자.

The hub confirmed its understanding (1 benchmark research of the four sites and other geoscience sites for elements GAID hub/system
can learn from — landing composition, map/3D scenes, data discovery and search, cards/lists, hero imagery; 2 the writer generates the
image assets itself, e.g. hub/landing hero images, empty-state illustrations, per-field cover images, map/geology texture
backgrounds; 3 the same writer applies them; 4 writer GPT-6-Astra, reasoning max, Fast) and three decisions. User (verbatim):

> 모두 권장대로 진행하자.

## Decisions

1. Work within UI guide v2 (`docs/design/ui-guide.md`, values `geo/ui/ui-rules.json`; banned: gradients, glass, image filters, AI-ish
   icons, decorative emoji, Toss/Apple/Samsung or other proprietary assets/fonts; identity from the fixed logo, brand blue,
   Pretendard; 계측 default and 도폭 style; colours only through tokens). Propose a new guide section "where image assets are used and
   their rules"; it is final only after the user approves it.
2. Order: research and asset mockups start now (no code); show them to the user for approval (`task review-copy`, give the vault
   path). Apply to code only after the user approves AND the running units gaid-workflow-cite-scope and gaid-workflow-stages are on
   main (the hub tells you; rebase/merge main first). Afterwards the hub runs a UI-guide audit (gaid-ui-audit) and then promo video v3.
3. Scope: GAID hub (landing, recommended, lists, 자료 소식) and the app's start/empty screens (project list, 서재, the Workflow start
   window's intro). No decorative images in analysis screens or the map viewer (original pixels rule).

## Done

- Research report (result first): what each site does well that fits GAID, with screenshots kept outside Git
  (`~/data/geoaidesk/work/gaid-visual-benchmark/`) and small PNG excerpts only where licence-safe; never copy their assets, layouts
  verbatim, logos or fonts — learn patterns.
- Generated assets: original images (you generate them), each in light and dark variants where needed, sized for the screens,
  optimized (each tracked file < 5 MB; prefer modern formats), with a manifest (prompt, model, date, intended use, licence = GAID
  generated). Concept-picture rule of this repo: a dark variant is an edit of the light one, not a filtered copy.
- Applied design in the scoped screens, both styles and both themes; Korean screenshots at 1440×900 and 1280×800 checked against
  guide §12; report lists rule ids followed/broken. Copy in locales (Korean first). Checks: scripts/check (incl. check-ui).
- Design stance (user rule in AGENTS.md): impeccable + design-taste-frontend + brand-guide expert.

## Notes

- KIGAM network blocks raw.githubusercontent.com (use `gh api` or codeload). For web research use the `oracle-search` skill if
  available (Extra High by default); browse sites with `playwright-cli` for screenshots.
- Public release of the KIGAM brand/logo still awaits approval (open item gaid-release-proof#2); internal use only.
- Do not touch the review app (PC74, loopback-only) or the institute hub server; the hub deploys after integration.
- Workers: create child writers only with `task start --parent`, readers with `task reader`. Outside check: none.

## Current state
- Resumed on PC74 in the printed worktree on 2026-10-23. No app implementation or service changes.
- Read the task request, PROJECT.md, UI guide v2 and writer procedures. Exact-worktree codegraph has no index;
  use bounded native reads, never another branch's index.
- Phase 1 is research and approval-ready image mockups only. Code changes and adoption of image rules remain gated
  on the user's approval AND the hub's confirmation that gaid-workflow-cite-scope and gaid-workflow-stages reached main.
## Next steps
1. Research the four named sites and additional relevant geoscience services; capture public-page evidence outside Git.
2. Generate original light assets, edit them into dark variants, and prepare 2–3 named layout/asset directions for review.
3. Write the canonical report and proposed image-use rules (draft, not adopted), humanize file prose, copy to the vault,
   and request the user's visual choice/approval on concrete mockups.
4. After both gates pass, integrate fresh main, apply the selected design, verify both styles/themes and declared checks,
   then finish through the task CLI. Do not deploy the review app or hub server.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- Orchestration, phase 1: sequential decisions are evidence → image roles → two visual directions → user approval.
  The main writer owns all design decisions, image generation, mockups, report and eventual UI implementation.
  Native read-only worker `/root/screen_inventory` maps existing component seams and fixtures; no child writer is needed
  before shared image roles and scope are approved. Oracle is a research source only, not the designer or implementer.
  Integration order after approval: image rules and manifest → shared image presentation → hub → start/empty screens → QA.
- Owned phase-1 repo files: this task document, the canonical report and its small original figures, and review registry
  records. Research screenshots, full-size generations and disposable mockups stay in
  `~/data/geoaidesk/work/gaid-visual-benchmark/`. Do not edit the adopted guide or app code during this phase.
- Design read: an Operate-mode research desk for geoscience researchers, preserving GAID's instrument/mapsheet identity.
  Taste dials for landing composition only: variance 3, motion 1, density 4. Existing tokens and Pretendard govern;
  generated imagery must be content-relevant, original and spatially bounded, not a background for text or controls.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-visual-benchmark/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

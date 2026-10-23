---
format: 1
status: active
updated: 2026-10-23T13:04:01Z
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
- User rejected the displayed mockups on 2026-10-23 before implementation. The generic terrain/folio images and
  the altered home composition are NOT approved and must not be applied. Keep them outside Git as rejected exploration.
- Research covers the four requested sites plus NASA Earthdata, BGS GeoIndex, EarthScope and USGS ScienceBase documentation.
  Public browser captures verified the requested KIGAM board is a press-release list. ScienceBase live catalog is 403.
  Oracle session `research-contract-for-gaid-visual` completed; its saved note is recorded below.
## Next steps
1. Preserve current layout, spacing, buttons, lists and density. Generate neutral, quiet surface assets for existing
   whitespace/backgrounds, without introducing a new hero, frame, card or content block.
2. Compare no asset versus one in-place application on a real incumbent screenshot. Verify that pixels outside the
   nominated empty area stay unchanged. Check both themes without CSS filtering or image tinting.
3. Write the research findings and revised image-use rules in the canonical report; distinguish direct observations,
   inferred design ideas, rejected mockups and the user's actual direction. Humanize and review-copy for approval.
4. After both gates pass, integrate fresh main, apply the selected design, verify both styles/themes and declared checks,
   then finish through the task CLI. Do not deploy the review app or hub server.
## Failed approaches
- First visual exploration: two new header-image sizes and generic terrain/folio illustrations. The user rejected the
  displayed UI as worse than no imagery. Failure premise: assuming added geoscience imagery justified altering a working
  Operate interface. Do not iterate on the rejected layout or merely reduce its image sizes.
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- Orchestration, revised phase 1: evidence → actual unused areas → quiet surface assets → same-frame comparison → approval.
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
- User correction (verbatim, 2026-10-23): "현재 보이는 화면은 UI로서 엉망이다. 오히려 없는 것이 훨씬 낫다. 현재 시스템의 디자인을 훼손하지 않는 방식이 있을 것이다."
  This supersedes the initial two-layout exploration. The existing system is the visual authority, not an illustrative
  approximation. No extra approval is needed to discard the rejected mockups; implementation still needs approval.
- Further user clarification (verbatim, 2026-10-23): "무리해서 ASSET을 추가하기 보다는 빈 여백이나 배경에 현재 시스템 디자인과 어울리는 형태의 ASSETS을 만들고 적용하는 것이 관건이다. 조사해보라고 한 사이트를 무조건적으로 벤치마킹하라는 의미가 아니다."
  This corrects the writer's over-narrow response of excluding all decorative imagery. Revised phase-1 target: original,
  low-contrast, neutral assets for existing whitespace/backgrounds, matching current Instrument/Mapsheet design; never
  add a new hero, frame, card, text block or layout to make room. Benchmark sites are optional evidence, not templates.
  Compare no asset versus in-place application on the exact incumbent screen. Do not obscure text/controls or touch
  data/figure/map/PDF pixels. The first terrain and folio set remains rejected.
- Reader `/root/screen_inventory` finished without edits. Main overlap: cite-scope and stages both touch start-intro,
  task-setup and related locales; cite-scope also touches library-screen. Preserve room for source-paper consent and the
  new analysis-stage rail. Existing original method pictures must take precedence over new generic artwork.
- Oracle source: `웹 조사/geoaidesk/2026-10-23-research-contract-for-gaid-visual--d9de228934.md`, researched 2026-10-23.
  Use direct PC74 browser evidence where it resolves Oracle access limitations. Its recommendations are inferences,
  not measured usability gains. No live catalog claim from the blocked ScienceBase page.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-visual-benchmark/index.md
## Running jobs
<!-- task:jobs -->
- /home/seongin3/data/geoaidesk/runs/gaid-visual-benchmark-20261023T123744.058515Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-visual-benchmark-20261023T124829.075923Z/receipt.json
- /home/seongin3/data/geoaidesk/runs/gaid-visual-benchmark-20261023T125803.731898Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: active
updated: 2026-10-22T02:44:58Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"dd317c8f-ab1d-4414-aede-87515135d35e","pid":1749537,"provider":"claude","session":"d6996044-f57f-4278-9026-e0c4ac7a513a","start":"51919497","token":"14d69b3c7eed337fb37e61430d3c92ac27abbc46325a901f3d075f6110313cc6"}
branch: task/gaid-concept-pictures
target: main
parent: 
---
# gaid-concept-pictures

## Goal and done criteria
Request from the starter:

# Request: gaid-concept-pictures

User request (verbatim, 2026-10-22, to the geoaidesk hub):
"gaid-design-identity--fresh 세션에서 시스템의 UI/UX디자인 개선 작업 진행중이다. 그런데 워크플로우와 관련해서 개념 그림 생성하기 기능은 바탕화면이 흰색 배경으로 개념도가 생성되는데 이 부분이 현재 gaid-design-identity--fresh에서 디자인 개선하고 있는 회색 배경과 서로 맞지 않아서 개념도 이미지가 어색한 상태이다. 또한 다크 모드로 했을 때에도 흰색 배경으로 생성되어 어색해진다. 개념 이미지 생성 기능과 관련하여 어떻게 설계하면 좋을지 관련 자료를 먼저 조사하고 사용자와 목업으로 논의하면서 진행하는 별도 작업을 진행하자."

Order: research → mockups discussed with the user → implement only the agreed design.
1. Research first (oracle-search, Extra High default, Pro if needed; KIGAM network blocks raw.githubusercontent.com):
   how products present generated illustrations/diagrams on grey or dark UI surfaces and in light/dark themes; image-model
   options (e.g. transparent background output, theme-specific variants, style/palette prompts, editing an existing picture);
   vector/diagram alternatives (SVG or diagram code instead of raster) and their trade-offs for scientific concept pictures;
   framing (picture placed on its own paper/card surface vs blended); accessibility/contrast in dark mode; costs.
2. Current GAID: hub concept pictures (server/src/geo/authoring/visuals.ts, authoring/codex-images.ts, gpt-image-2 on the
   ChatGPT Codex backend via the OpenAI Codex (legacy) login only, explicit action, ledgered as gaid-hub-visuals; redo one
   picture, revise by instruction with the previous picture as input), where pictures appear (hub entry, draft, Workflow view,
   cards), stored files.
3. Mockups (light and dark, on the new design): show 2–3 options to the user with task review-copy; get an explicit choice;
   ask back on ambiguity.
Coordination: gaid-design-identity--fresh (Opus 5.5 max, child of gaid-design-identity) is redesigning the UI guide and tokens
(grey surfaces, dark mode). Use its guide/tokens as they land (read-only; do not edit its files or steer its design); build the
mockups against them, and against current main tokens if they are not ready, saying so. Existing user rules: tokens only, no CSS
colour filters/inversion on images (original pixels), design stance "디자인은 항상 impeccable과 taste와 브랜딩 가이드 전문가 입장에서
디자인해야한다." If the chosen design needs a change to that image rule, bring it to the user explicitly.
Own GAID_HOME under ~/data/geoaidesk/work/gaid-concept-pictures/; do not modify ~/.geoaidesk. Real image generation needs the
user's OpenAI Codex (legacy) login: ask before spending it. Outside check: no outside check (design/app work).

## Current state
- 2026-10-22: implemented and integrated with main (sync d87a86f2, scripts/check passed). Real app from this worktree
  (start-gaid.sh, GAID_HOME ~/data/geoaidesk/work/gaid-concept-pictures/home, ports 3361/18361) captured in
  `.../app-shots/` (hub, entry, draft × 계측/도폭 × light/dark × 1440/1280). Registry-list thumbnails (shared-browse.tsx, new in
  guide v2) also use ConceptPicture.
- 2026-10-22: research sent to Oracle (xhigh; prompt `~/data/geoaidesk/work/gaid-concept-pictures/oracle-prompt.md`, log
  `oracle-1.log`). Current code read: prompt fixes `white background` (`server/src/geo/authoring/visuals.ts:113`), request
  1536x1024 medium (`codex-images.ts:95-98`); pictures render in `hub-home.tsx` (featured card), `method-flow.tsx` (step/output),
  `draft-step.tsx` (cover), `io-examples.tsx`. gaid-design-identity--fresh guide v2 draft rule I6 puts white-background pictures on a
  light mat in dark mode (`--pic-mat`/`--img-mat`, dark `#eef0f3`); its hub dark mockup shows the bright block the user dislikes.
## Next steps
1. `task finish` (report written; review copy made). After the hub reports integration: stop units `gaid-cp-app`
   (app on 3361/18361 from this worktree) and `gaid-cp-static` (mockups on 3352); web/.next and other build caches in the
   worktree may block close (remove them, rerun close).
## Failed approaches
## Notes and decisions
- Research (Oracle xhigh, 2026-10-22): vault `웹 조사/geoaidesk/2026-10-22-geoaidesk-gaid-ai-gaid-hub--dc8af4523f.md`.
  gpt-image-2 documents `background: "transparent"` (preview, png/webp); not verified on the ChatGPT Codex backend
  (openai/codex #40572 reports fake checkerboards); transparent fixes only the background, dark lines/labels vanish on dark;
  GitHub/Apple HIG use separate light/dark assets; public API price ~$0.041 per 1536x1024 medium picture. Oracle recommended mat
  default + optional transparent + diagrams for step pictures; this writer recommends the theme pair because the user rejected the
  mat look in dark mode.
- User decision (verbatim, 2026-10-22, this tab): "1은 나로 하고 2는 가로 하자." → 나) theme pair; 가) check with real
  generations first.
- Real trial 2026-10-22 (4 image calls on the user's OpenAI Codex (legacy) login, token read-only from
  ~/.geoaidesk/pi-agent/auth.json, no refresh/write): cover + zone map, light then dark edit; outputs
  `~/data/geoaidesk/work/gaid-concept-pictures/trial/`. Dark edits kept composition/objects/arrows; border band median light
  #f2f3f6 (asked #f5f6f8), dark #1a1d23/#1a1d24 (asked #1a1d23), p95 deviation ≤1. The zone map came out in rainbow colours
  despite "one blue accent" (pre-existing prompt behaviour, out of scope). PICTURE_WELL light set to #f2f3f6 accordingly.
- Implementation: server `visuals.ts` (PICTURE_WELL, light prompt on the well, DARK_VARIANT_PROMPT edit, ADAPT_PROMPT for older
  pictures via `adapt`), `?theme=dark` on picture routes, `dark` carried through hub registration/edit; web `ConceptPicture`
  frames + theme file choice at all picture sites; tokens `--gaid-pic-well`/`--gaid-pic-mat`; guide v2 I6 extended.
- Plan: sequential (research → mockups → user choice → implementation); no child writers before the choice. Implementation is
  small and coupled (visuals.ts/codex-images.ts + picture render sites), so this writer does it.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-concept-pictures/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

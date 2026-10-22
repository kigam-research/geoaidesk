---
format: 1
status: done
updated: 2026-10-22T04:42:40Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"2cceca91-be2c-417d-91fa-2a00abf81f69","pid":1932750,"provider":"claude","session":"e8de1a21-2787-4813-95a5-2b6a9c27ca47","start":"47273338","token":"501f86af919f32bb08716719b3c938d6acf50b8cfd0b76739f71dbd3db63e5b0"}
branch: task/gaid-research-visuals
target: main
parent: 
---
# gaid-research-visuals

## Goal and done criteria
Request from the starter:

# Request: gaid-research-visuals

User words (verbatim, 2026-10-21, to the geoaidesk hub):
- Question: "gaid 허브 개선을 위해 oracle로 chatgpt와 claude 조사결과가 4개나 모였다. 해당 관점에서 GAID 허브 시스템 뿐만 아니라 사용자의 연구 방식과 관련하여 연구 정리 및 아이디어 시각화나 논문 그림 생성, 인용의 입장에서도 더 개선할 수 있는 부분은 없었나?"
- Decision on the hub's proposal (item 2 = this unit): "1~3번 모두 진행하자. 2번의 경우에는 이미 4개의 보고서에서 도입하거나 벤치마크하거나 스킬로 활용할 도구들도 많이 조사되어 있다고 생각한다."

Goal: paper figure generation and idea visualization for GAID researchers, research → design proposal → discuss with the user
→ implement the agreed scope (same pattern as gaid-research-hub).

Start from the existing research, as the user asked:
- Four inputs (read first; reuse their tools for adoption, benchmarking or as skills):
  ~/data/geoaidesk/work/gaid-research-hub/oracle/q1.harvest.md, oracle/q2.answer.md,
  ~/data/geoaidesk/work/gaid-research-hub/inputs/claude-web-survey.txt (PDF beside it), inputs/claude-research-2-notes.md.
  Hub extraction (verified facts, 2026-10-21): visualization tools they cover include Connected Papers (closed backend,
  clients MIT), Litmaps/ResearchRabbit (commercial), Inciteful (AGPL), Semantic Scholar Recommendations / Research Feeds,
  Scholar Inbox, ORKG comparisons (MIT backend), Gemini Notebook concept maps, Consensus gap matrix, evidence-based idea
  cards and idea/novelty tools (STORM, AI-Researcher, CodeScientist …). For figure generation the hub's extraction found no
  concrete tool in the four inputs (only figure-level evidence anchors, Docling figure extraction, figures linked to
  reviewer comments in phase 2). Re-check that yourself; do new web research (oracle-search skill, Extra High default,
  Pro when needed; KIGAM network blocks raw.githubusercontent.com) only for what the four inputs do not cover.
- GAID inventory: hub concept pictures (gpt-image-2 via the OpenAI Codex (legacy) login), map/depth/table viewers,
  upstream K-Dense scientific skills and Workflows (check which visualization/figure/writing ones exist and whether they are
  available in geo mode), research notes, the agent's own plotting via Python.
- Plan of the sibling unit gaid-research-hub (read-only): reports/2026-10-21-gaid-research-hub/index.md and
  docs/adr/2026-10-21-research-hub-library.md in ~/worktrees/geoaidesk/gaid-research-hub (or main once merged). Its
  library/paper→claim→note→Workflow links are the data an idea/connection graph view would show; do not edit its owned
  files (server/src/geo/library/**, web/src/geo/library/**, contracts/library.ts); coordinate through the hub if needed.

Scope to cover in the proposal: (a) paper figures — plots from analysis results, schematics/graphical abstracts,
publication-ready styling and journal requirements, reproducibility (figure ↔ script ↔ data provenance, GAID already records
provenance), figure QA; (b) idea visualization — an internal graph view of papers/claims/notes/Workflows/manuscripts,
literature maps (link out vs integrate), idea boards. Researcher value first: say why a researcher would use it in GAID
rather than the tool they use now; name things to integrate rather than build.
Discuss in the writer tab (task review-copy the proposal); implement only the agreed scope; ADR for architecture choices.
Use your own GAID_HOME under ~/data/geoaidesk/work/gaid-research-visuals/; do not modify ~/.geoaidesk.
Outside check: no outside check (product design and app work).

## Current state
Done 2026-10-22 (phase 1+2 implemented and integrated on task/gaid-research-visuals; awaiting task finish checks):
- Children A skill, B records, C map: each passed full scripts/check on its branch, `task complete`d and closed.
- Writer integration: NoteFigures (figure records) at the end of the note detail and ConnectionMapButton in the note header
  and per figure (web/src/geo/notes/research-notes-panel.tsx); figure section hidden when a note has no figures; check
  items carry language-neutral `notes` codes (contract FIGURE_CHECK_NOTES, locale figures.checkNote.*) instead of English
  text; result column no-wrap; map edges bezier + dagre label room + fit minZoom 0.75; new edge kind `copied` (identical
  image copy) and no chat→figure "drew" edge on copies; "drew" label 그림을 그림; centre button 선택한 항목 중심으로 보기;
  English disclosure draft from the recorded step; copy source dropped from figure inputs.
- Checks run after integration: server geo-figures (10) + geo-connections (7) + shipped-skills; web figures/connections/notes
  (18); node --test geo/tests/figures-helper.test.mjs; server and web tsc; check-ui (0 errors); copy validator (0 errors).
  Full scripts/check runs in task finish.
- Real app: task GAID_HOME ~/data/geoaidesk/work/gaid-research-visuals/home, user unit gaid-visuals-app (ports 3310/18310,
  start-gaid.sh, log .../app/launcher.log), synthetic analysis from .../seed/seed.ts; 24 screenshots (2 styles × 2 themes ×
  1440×900/1280×800 × check/ai/map) in .../playwright/matrix/; report figures 01–03 copied from there.
- Report rewritten as design + implementation (reports/2026-10-21-gaid-research-visuals/index.md), glossary and
  terminology.csv gained 그림 기록, 그림 점검, 연결 지도.
Not done (by scope): idea board (JSON Canvas, phase 3), analysis flowchart, publication map export; library-item entry to
the connection map; real-model chat check.
## Next steps
<!-- task:closed -->
Closed 2026-10-22T04:42:40Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: open items carried to docs/open-items/gaid-research-visuals.md.

## Failed approaches
## Notes and decisions
- User decision 2026-10-22 (verbatim, writer tab): "gaid-research-visuals 설계안 5건 권장 방안으로 진행하자." = report §6
  1 가) phases 1+2 (figure records and journal figures + connection map), 2 가) keep AI pictures, mark kind + target
  journal policy + disclosure draft, 3 가) Elsevier, Copernicus, AGU, Springer (incl. Geosciences Journal), GSA,
  대한지질학회지, 자원환경지질, 4 가) idea board as JSON Canvas file (phase 3, format only), 5 가) GAID shipped skill,
  generalised for the literature skills too. Recorded in ADR 2026-10-22-figure-records-and-connection-map.
- UI constraint from gaid-design-identity (routed request design-dir-gaid-research-visuals, 2026-10-21; until its tokens
  land on main). CORRECTED by routed request design-note-gaid-research-visuals: direction 라) "연구 등록부" was NOT confirmed;
  the user decided "새로운 디자인을 oneui가이드에 따라 생성하자." gaid-design-identity will propose a new One UI-based design;
  use no 라)-specific palette or tokens. The general rules below still apply. Any UI or mockup in
  this unit: no hard-coded colours, no Tailwind hue utilities (violet/purple/sky/emerald/...), no gradients, glass/blur,
  Sparkles/Wand/Bot icons, eyebrow labels above headings, coloured left borders > 1 px or equal icon+heading card grids;
  use the CSS role variables only (--background, --foreground, --muted, --muted-foreground, --primary, --border,
  --gaid-warning ...). Figures, maps, images and PDFs show original pixels (no CSS colour
  filters or inversion in either theme) — applies directly to figure records, connection map and idea board. Design work
  follows the impeccable and design-taste-frontend skills (skill_hub .claude/skills) and geo/brand/README.md; the UI guide
  update lands with gaid-design-identity, which will notify again.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
- Design direction CONFIRMED (routed request design-ok-gaid-research-visuals, 2026-10-22; user words in gaid-design-identity:
  "계측을 기본으로 하고 도폭을 사용자 설정 테마에서 설정할 수 있게 할 수 있나?" then "가로 진행하자."): GAID UI/UX guide v2
  (One UI + Apple HIG). Default identity 계측 (Instrument); 도폭 (Map sheet) is a per-browser style (`gaid:style`,
  `<html data-style="mapsheet">`) independent of light/dark/system; logo unchanged. task/gaid-design-identity is NOT on main
  yet: read its docs/design/ui-guide.md v2 and web/src/app/globals.css tokens read-only from origin/task/gaid-design-identity
  for planning/mockups; do not copy its files; build production UI only after it merges (hub will notify; then `task sync`).
  Then: read ui-guide v2 §0–2 (I1–I15), components, V bans, review checklist; use `--gaid-*` role tokens / Tailwind `gaid-*`
  utilities and web/src/geo/shell/ parts (GaidAppBar, SidebarGroup/SidebarItem, StepScale); never branch on style in
  component code; review every UI change in 2 styles × 2 themes; figures/maps/PDFs keep original pixels;
  `node geo/ui/check-ui.mjs` (incl. slop checks) must pass. Supersedes the 라) and "One UI new design pending" notes above.
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
- [확인 gaid-research-visuals#1] 실제 모델 채팅에서 AI agent가 그림 스킬(gaid-figures)을 읽고 목표 저널의 최종 폭·글자 크기로 그린 뒤 점검을 돌리는지 — 가) 모델이 연결된 GAID에서 그림 하나를 그리게 해 확인 — 나) 시험 연구자 사용 때 확인 — 권장: 가) 스킬과 지시문의 효과는 실제 모델로만 알 수 있음 — 막힌 일: 그림 스킬의 완료 판단 — 근거: reports/2026-10-21-gaid-research-visuals#5
- [확인 gaid-research-visuals#2] AGU와 자원환경지질의 그림 요건(폭, 글자, 해상도, AI 그림 정책) — 가) 실제 브라우저로 공식 페이지를 열어 journals.json을 채움 — 나) 연구자가 투고할 때까지 "확인 안 됨"으로 둠 — 권장: 가) 두 곳 모두 지구과학 연구자의 주요 투고처임 — 막힌 일: 두 저널의 그림 점검 — 근거: reports/2026-10-21-gaid-research-visuals#3.1
- [확인 gaid-research-visuals#3] 서재 논문에서 연결 지도를 여는 입구(서재는 모든 프로젝트에 걸치고 지도는 프로젝트 하나 안의 연결) — 가) 논문이 쓰인 프로젝트를 골라 여는 입구를 서재 다음 작업에서 만듦 — 나) 정리 노트와 그림에서만 엶 — 권장: 가) 논문에서 출발하는 질문("이 논문을 근거로 쓴 노트·그림")이 연결 지도의 주된 쓰임임 — 막힌 일: 서재 쪽 입구 — 근거: reports/2026-10-21-gaid-research-visuals#5
## Report
Report: reports/2026-10-21-gaid-research-visuals/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

---
format: 1
status: active
updated: 2026-10-22T02:17:14Z
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
Phase 1 (research → proposal), 2026-10-21.
- Read the four inputs. Confirmed: none names a figure-generation tool (only Docling figure extraction, figure-level
  evidence anchors, figures linked to review items). Visualization tools covered: citation maps (Connected Papers,
  Litmaps/ResearchRabbit, Inciteful), ORKG comparison tables, Logseq/Obsidian graphs; all three surveys say "do not build
  a citation-graph UI; link out; build the paper–claim–experiment–note–manuscript–Workflow graph inside".
- Sibling gaid-research-hub (read-only, ADR 2026-10-21-research-hub-library) already plans: idea candidates (⑧, phase 3,
  stored as research notes), citation-map link-out and "highly cited papers missing from my library" (phase 3),
  "내 연구에서 쓰인 곳" per library item (phase 1), review items linked to figures (phase 2). This unit must not duplicate
  those; it adds figures and a connection view over that data.
- Web research for figures/journal/AI-image policy/diagram tools/QA/graph UI components: Oracle xhigh run, prompt
  `~/data/geoaidesk/work/gaid-research-visuals/oracle/q1-figures.md`, output `oracle/q1.out` (running).
- Oracle q2 (session ai-geoaidesk-gaid-python-markdown-2) stalled after 2 h mid-E-1; partial answer kept at
  oracle/q2.harvest.md (A, D, E-1); research-save refused (status error). E-2/E-3/F not covered; F licences checked via gh api.
- Oracle q1 (vault 웹 조사/geoaidesk/2026-10-21-ai-geoaidesk-gaid-python-markdown--aa555d9439.md) covered C (AI image
  policy) and B (journal figure specs), then stopped mid-A. Verified directly: Elsevier GenAI policy (explanatory images
  allowed with caption disclosure; data visualizations only when derived from data reproducibly; "General-purpose
  generative AI image tools must not be used to create graphical abstracts"); Copernicus AI policy (illustrations and
  schematics permitted when the tool is cited) and figure guideline (CVD check, Scientific colour maps 7.0 recommended,
  300 dpi, panels in one file). gh api: Cytoscape.js MIT 3.34.4, xyflow MIT (@xyflow/react 12.12.0), sigma MIT 4.0.3,
  Excalidraw MIT 0.18.1, tldraw custom licence needing a licence key in production (exclude), JSON Canvas MIT spec,
  SciencePlots MIT 2.2.2, PyGMT BSD-3 0.19.0, UltraPlot MIT 2.7.2, showyourwork MIT 0.4.3 (2023), Mermaid MIT,
  draw.io Apache-2.0, DeTikZify Apache-2.0 0.3.0.
- GAID inventory (Explore, 2026-10-21): geo catalogue 0.2.1 has 13 skills, no general plotting/writing/citation/diagram
  skill; upstream K-Dense skills are fully replaced in geo mode. Upstream `scientific-visualization` (MIT, v1.4,
  2026-10-01) has publisher profiles (nature, science, cell, plos, elsevier, ieee, bmc, acs — no AGU/Copernicus/GSA/KR),
  export_plan/figure_export/palette_audit/image_metadata scripts; `scientific-schematics` uses Nano Banana via OpenRouter.
  Upstream visual Workflows (graphical-abstract, publication-figure, poster, schematic, …) are prompt-only, shown folded
  under 일반 Workflow. `generate_image` is available in geo mode (OpenRouter). Hub concept pictures = gpt-image-2, labelled
  "개념 그림 (분석 자료가 아닙니다)". Provenance walkLineage already walks figure → script → data; UI is an indented list
  (provenance-panel.tsx LineageTree). Web has no graph library (only @streamdown/mermaid); hub flow diagram is hand-built.
  Geo env has matplotlib; no cmcrameri/pygmt/cartopy/seaborn. Notes copy figures into figures/ (RESEARCH_NOTE_RULE).
## Next steps
Phase 2 (implementation), started 2026-10-22 after the user's decision. Sequential decisions done: ADR
docs/adr/2026-10-22-figure-records-and-connection-map.md; contracts web/src/geo/contracts/figures.ts and connections.ts.
Work packages (child writers, "general work"), owned files:
- A `gaid-research-visuals--skill`: geo/skills/gaid-figures/** (adapted K-Dense scientific-visualization, MIT; journals.json
  per JournalProfile with official sources + checkedAt; scripts/check_figure.py writing FigureCheck JSON), shipped-skill
  generalisation server/src/geo/shipped-skills.ts (+ note-style.ts, provision.ts, session.ts, context.ts seams),
  FIGURE_RULE in server/src/geo/instructions.ts, cmcrameri (+ SciencePlots) in seeded project pyproject / helper venv
  (dependency-lock owner for server/src/helpers/pyproject.toml + uv.lock), THIRD_PARTY_NOTICES entries.
- B `gaid-research-visuals--records`: server/src/geo/figures/** (derive records from notes + provenance, copy resolution by
  edge then sha256, kind derivation, overrides, target, POST check via helper python running A's script), routes in
  server/src/geo/routes/figures.ts registered in geo/routes.ts; web/src/geo/figures/** (note figure list + record pane,
  journal target picker, actions as chat prefills), locales web/src/geo/locales/figures/; NO edit of research-notes-panel.tsx
  (exports a component; the writer wires it).
- C `gaid-research-visuals--map`: server/src/geo/connections/** + route; web/src/geo/connections/** (React Flow
  @xyflow/react + @dagrejs/dagre; web/package.json + lock owner), locales web/src/geo/locales/connections/; exports
  ConnectionMapButton/ConnectionMapPane; no edits outside its dirs except the route registration line and deps.
Integration order: A (check script + journals.json) → B uses them (B can stub until A lands); C independent. Writer wires
seams (research-notes-panel.tsx note detail: figures + map entry; figure record → map; library detail entry via the hub /
gaid-library-next owner), then check-ui, scripts/check, screenshots (2 styles × 2 themes, 1440×900 + 1280×800, Korean),
report update (design + implementation), task finish.
1. Wait for task sync (scripts/check running) to finish, save ADR + contracts, start children A, B, C.
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

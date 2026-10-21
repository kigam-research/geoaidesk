---
format: 1
status: active
updated: 2026-10-21T12:15:46Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"3bc30c7e-b450-462c-8c00-b17877a5c133","pid":2981735,"provider":"claude","session":"cdfedfaa-588d-43b6-9770-bdd6b9d70a65","start":"45246184","token":"61f95d84aad4187c55e866862d9c3219f3e0125a0467796adb84c101b79dfcce"}
branch: task/gaid-research-hub
target: main
parent: 
---
# gaid-research-hub

## Goal and done criteria
Request from the starter:

# Request: gaid-research-hub

User request (verbatim, 2026-10-21, to the geoaidesk hub):
"GAID 허브를 크게 개선하고 싶다. 현재는 워크플로우를 생성하고 공유하는 용도로 구축되어 있다. 일반적으로 연구자는 본인의 연구 산출물을 관리하고 논문을 수집하고 서지 관리하고, 수집한 논문에서 인사이트와 새로운 연구 아이디어를 얻고 싶어한다. 또한, 본인이 게재한 논문, 투고한 논문, 투고할 논문들을 관리해야한다. 이러한 기능은 zotero를 포함하여 현재 AI연계 도구들이 있다고 생각한다. 또한, BYOK내에 K-dense 워크플로우와 스킬에서도 문헌연구, 연구비 계획과 같은 카테고리에 관련 워크플로우를 제공하고 있다. 사용자는 GAID허브에 해당 기능을 구현하여 연구자가 논문작성 및 연구에 도움이 될 수 있는 시스템을 만들어서 유인하고 이를 GAID 허브의 워크플로우 생성 기능과 연계하고 나아가 GAID 시스템에서 에이전트 기반 작업과 연구노트를 생성하고 다시 이를 연계하는 시스템을 만들고 싶다. 이를 위해서는 관련 정보들과 현재 최신 오픈소스 도구들도 조사하여야 하며, 어떻게 시스템을 설계할 것인지도 벤치마킹하고, 현 시스템에 맞춰서 커스터마이징 하고 설계할 필요가 있다. 시스템을 구현하는 것은 에이전트나 기계가 볼 때 유의미한 것이 아니라 이용자(사람)가 해당 도구를 사용할 가치가 있어야 한다. 더 편한 도구가 있거나 유인이 없다면 상품성의 측면에서 설계가 잘못되었다고 볼 수 있다. 이를 위해서 별도의 작업 트리를 열어서 관련한 내용들을 조사하고 논의하여 구현하는 작업을 시작하자."

Scope (research → discuss → implement; same pattern as gaid-notebook-review / gaid-workflow-model):
- Phase 1, research and design proposal (no product code yet):
  - Survey current tools a researcher would otherwise use: reference managers (Zotero and its API/plugins, others), AI
    literature tools (open-source and commercial: discovery, reading/QA over papers, citation graphs, idea generation),
    publication/submission tracking, research-output management. Prefer current open-source projects that GAID could
    integrate with instead of rebuilding. Use the oracle-search skill for web research (Extra High by default, Pro when
    needed); KIGAM network blocks raw.githubusercontent.com (use gh api / codeload).
  - Inventory what GAID already has: GAID hub (Workflow authoring/sharing from papers and code), research notes, chat
    agent, Paperclip literature MCP connector, upstream K-Dense Workflows and skills in literature review, grant planning
    and similar categories.
  - Researcher value first: for each proposed feature, say why a researcher would use it in GAID instead of (or together
    with) the tool they already use, and what would make them come back. Name features that should not be built because a
    better tool exists (integrate instead).
  - Proposal with options and a recommendation: information architecture (library / my papers and submissions /
    insights and ideas), data model and storage, links to hub Workflow authoring, to agent work in the GAID system and to
    research notes (both directions), and a phased plan.
- Discuss the proposal with the user in the writer tab (task review-copy the proposal); implement in later phases only the
  agreed scope. Architecture decisions with real alternatives go in docs/adr/.
- Use your own GAID_HOME under ~/data/geoaidesk/work/gaid-research-hub/; do not modify the review app data (~/.geoaidesk).
Outside check: no outside check (product design and app work; researcher-value judgement is discussed with the user).

## Current state
Phase 1 (research and design proposal) in progress since 2026-10-21. No product code changed.
- Web research running through oracle-search: q1 researcher tools survey (Pro), q2 IA/data-model benchmark (xhigh).
  Prompts and raw outputs: ~/data/geoaidesk/work/gaid-research-hub/oracle/{q1-tools.md,q2-design.md,q1.out,q2.out}.
- GAID inventory (upstream K-Dense literature/grant Workflows and skills, Paperclip, hub, notes) by a native read-only
  sub-agent.
- Operator context (qmd, cmds-main vault): the vault convention reserves `80. References/Zotero` and the llm-wiki
  paper-analysis rule recovers page locators from Zotero PDFs, but PC74 has no Zotero data dir and only
  `80. References/81. Attachment` exists; PC71 (Windows desktop, RMA) unreachable. Actual Zotero use by the user and
  colleagues is unconfirmed: ask in the proposal.
- User-supplied input (2026-10-21): Claude web survey "GAID 연구 허브 도구 현황 조사 (2026-10)", 16 pp, copy at
  ~/data/geoaidesk/work/gaid-research-hub/inputs/claude-web-survey.pdf (sha256 50e99f45…21758, text extracted beside it).
  It agrees with oracle q1 on: Zotero 10 as the only realistic library target (Local API read+write locally, Web API v3
  per-user key on a server), no headless Zotero, PaperQA2 / GROBID+Docling as integration candidates, build the
  own-papers pipeline and library-grounded QA saved to notes, ideas only as evidence-backed candidates. Conflicts:
  OpenAlex key requirement resolved 2026-10-21 (official auth page + keyless request HTTP 200: basic queries keyless,
  key = 10x daily budget and needed for cursor paging); Crossref limit dates (2025-12-01 vs 2026-07-21) unchecked.
- q2 done (vault `웹 조사/geoaidesk/2026-10-21-benchmark-design-question-please-cite--45e2be4f0d.md`): adds A/B/C
  architecture range (Zotero sidecar → project-centric hub → institute platform), citekey as alias (link by Zotero
  item key), ReviewRound/SubmissionEvent with status source, PDFs referenced not copied, novelty "not found" ≠ novel.
  Folded into the report. Spot checks: 6 candidate repos' latest release/license re-queried via gh api (match);
  Zotero local API write (Zotero 10+) confirmed on the official page.
- GAID inventory (2026-10-21): no reference library, bibliography or literature entry exists anywhere (notebook entry
  types hypothesis/method/observation/decision/note; research notes have no citation field; hub sources carry a
  free-text DOI). Upstream Workflows: paper(15), literature(11), grants(12) in web/src/data/workflows.json (prompts only,
  no skill field). GAID catalogue 0.2.1 has 13 geo skills and none for literature; upstream literature skills
  (paper-lookup, citation-management, literature-review, pyzotero [default-disabled], paperzilla, open-notebook,
  hypothesis-generation, scientific-brainstorming, research-grants [US agencies + Taiwan NSTC only], peer-review,
  scientific-writing, venue-templates, markitdown) are absent in geo mode. Paperclip = remote MCP (key or OAuth).
  Subagent roster has literature-researcher, citation-checker, hypothesis-generator, manuscript-editor.
- Phase-1 parent work done 2026-10-21 (pushed): server/src/geo/library/{store,uses,reader,tools}.ts,
  server/src/geo/routes/library.ts (registered in geo/routes.ts), library tools + note citation check wired in
  geo/session.ts; web/src/geo/library/{api,library-screen,add-paper-dialog,research-tabs}.tsx, locales library/,
  project-view.tsx seam (tabs 프로젝트/서재, `#library`). Checks: server `npx vitest run test/geo-library.test.ts`
  4 passed; geo-notes/markdown-images/context/tools/read-hints/authoring 58 passed; web project-view + contracts 17 passed;
  both tsc clean; copy validator 0 errors (no library warnings); check-ui 0 errors.
- Isolated app: systemd user unit `gaid-research-hub-app` (start-gaid.sh, GAID_HOME ~/data/geoaidesk/work/gaid-research-hub/home,
  ports 3320/18320, log ~/data/geoaidesk/work/gaid-research-hub/app.log); seeded by bin/seed.mjs (example items only).
  Browser check: library first screen, detail pane (uses incl. note locator p. 9), Workflow 만들기 opens hub authoring
  with the PDF preloaded, add-paper dialog. Screens in ~/data/geoaidesk/work/gaid-research-hub/playwright/lib-*.png.
  Restart the unit after code changes (production build).
## Next steps
1. Phase-1 implementation (agreed scope). Orchestration:
   - Sequential: contract web/src/geo/contracts/library.ts (draft done) -> store + routes (parent) -> UI (parent, after
     routes) -> integration check (scripts/check) -> report §3/§4 update with 1440x900 + 1280x800 screenshots.
   - Child writers (Codex "general work"), owned files only:
     - gaid-research-hub--zotero: server/src/geo/library/zotero/**, server/test/geo-library-zotero.test.ts (+ fixture);
       prompt ~/data/geoaidesk/work/gaid-research-hub/prompts/zotero.md
     - gaid-research-hub--metadata: server/src/geo/library/metadata/**, formats/**, tests geo-library-{metadata,formats};
       prompt ~/data/geoaidesk/work/gaid-research-hub/prompts/metadata.md
   - Parent (tightly coupled): server/src/geo/library/{store,routes,reader,tools,citations}.ts, project literature
     (.kady/geo/literature.json), agent tools library_search/library_read (lead only), note citation hook + note
     references, hub authoring from a library item, web/src/geo/library/** screens (서재 = 다안 first screen + 나안
     table + 가안 detail pane; 내 연구 tabs 프로젝트/서재), locales.
   - Started 2026-10-21: gaid-research-hub--metadata (Paseo agent 3af53966, worktree ~/worktrees/geoaidesk/gaid-research-hub--metadata),
     gaid-research-hub--zotero (Paseo agent e61bf52d, worktree ~/worktrees/geoaidesk/gaid-research-hub--zotero).
   - Integration order: metadata/formats -> zotero -> parent wiring; `task complete <child>` each before own finish.
   - Shared files with one owner: geo/integration-boundaries.json (children append only their test entries),
     web/src/geo/contracts/library.ts (children add optional fields only).
   - Later decision: full CSL style formatting (citeproc-js is CPAL/AGPL); phase 1 uses one APA-like formatter.
Blocked: child units gaid-research-hub--metadata and --zotero are in `task finish` (their scripts/check runs); integrate with `task complete` after their finish notices.
2. Phase 1-2 (accounts) and phase 2 (내 논문) come after the phase-1 pilot; not in this unit unless the user extends it.
## Failed approaches
- oracle q1 (Pro) timed out after 40 min of stale UI; `oracle session i-am-designing-a-research --harvest` recovered the
  completed answer (~/data/geoaidesk/work/gaid-research-hub/oracle/q1.harvest.md). `task research-save` reports
  skipped:1 for this session (also with --since); vault copy not made, local harvest + ChatGPT URL cited instead.
## Notes and decisions
- User decisions 2026-10-21 (this tab, verbatim start: "모두 권장으로 하고 싶다. 그런데 중요한 점은 zotero와 gaid의 연동이
  원활해야한다는 것이고, zotero를 사용하지 않고 GAID 기관 허브에 서지를 관리하고 싶은 이용자들도 이용할 수 있게 하는
  하이브리드형 시스템이 구축되어야 한다."): report §6 1-가 (personal under 내 연구, hub = shared + 논문으로 찾기),
  2-가 (PC GAID first, institute server after accounts), 3-가 (phase 1 = library + grounded answers + note citations +
  paper→Workflow), 4-가 amended to a hybrid library: Zotero-linked items (Zotero is source, smooth sync, narrow
  write-back) + GAID-managed items for non-Zotero users (web search + PDF only). ADR docs/adr/2026-10-21-research-hub-library.md.
  The user also pasted a second Claude survey; key points in ~/data/geoaidesk/work/gaid-research-hub/inputs/claude-research-2-notes.md.
- User decisions 2026-10-21 (verbatim): "1번은 다안의 첫화면에 가안의 상세칸에 나안의 표형식으로 하자. 2,3번은 권장으로
  하자." → library screen = 다안 first screen + 가안 detail pane + 나안 table list; institute accounts right after the
  phase-1 pilot, before 내 논문; default model for unpublished manuscripts/reviews/ideas = institute-internal model.
  ADR updated (decisions 5–8). No open decisions; four fact checks remain (report §6).
- PC74 has Zotero desktop (`zotero`) and `oat-zotero` (zotero skill) installed; Zotero not running, no ~/Zotero data
  dir (2026-10-21). Usable for Local API integration tests with a separate profile; do not open it on the user's screen.
- (superseded) Open after these: (a) when to build institute accounts (rec. right after the phase-1 pilot, before 내 논문, because
  web-only non-Zotero users get a library only with accounts); (b) default model for unpublished manuscripts/reviews/ideas
  (rec. institute-internal model by default). Report §6.
- API reachability from PC74 2026-10-21: Zotero Web API, Crossref, OpenAlex, KCI, ORCID OK; Semantic Scholar keyless 429;
  arXiv export API timed out (arxiv.org web OK).
- Orchestration (phase 1): sequential — research → proposal → user discussion. Independent packages now: web
  research (oracle), GAID inventory (read-only). No child writers until the user agrees on scope and the shared
  interfaces (library/publication data model, contracts under web/src/geo/contracts/) are settled.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [선택] 노트↔논문 관계 종류를 몇 가지로 고정할지 — 가) 지지함·반박함·조건을 붙임 3가지 — 나) 시험 연구자와 5가지 이하로 정함 — 권장: 가) ORKG처럼 자유 속성이 중복되는 문제를 피하고 화면이 단순함 — 막힌 일: 관계 표시 기능(나중 단계) — 근거: reports/2026-10-21-gaid-research-hub#3.12
- [확인] RISS·DBpia를 국내 자료원으로 추가할 수 있는지(기관 이용 조건, API) — 가) 이용 조건 확인 후 추가 — 나) KCI·ScienceON·NTIS만 유지 — 권장: 가) 국내 문헌이 상용 도구의 빈 곳이지만 DBpia는 조사 근거가 없음 — 막힌 일: 국내 자료원 확대(3단계) — 근거: reports/2026-10-21-gaid-research-hub#3.12
- [대기] Better BibTeX에 기대는 기능(원고 인용으로 Zotero 컬렉션 만들기, 인용 키 고정) — 가) Zotero 10 호환이 명시되고 #3602·#3626이 닫힌 뒤 검토 — 나) 지금 시험 — 권장: 가) 현재 열린 문제가 있음 — 막힌 일: 해당 기능 — 조건: BBT가 Zotero 10 호환을 명시 — 근거: reports/2026-10-21-gaid-research-hub#4
## Report
Report: reports/2026-10-21-gaid-research-hub/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

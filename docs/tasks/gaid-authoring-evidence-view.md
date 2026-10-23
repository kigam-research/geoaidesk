---
format: 1
status: active
updated: 2026-10-23T07:45:42Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"18d7f503-0e2f-44c7-a932-c7055bd2c385","pid":2512963,"provider":"claude","session":"44724507-b03c-4f81-8a86-8ba8fb6c63a4","start":"62748122","token":"95149b68f88f25b2cc88125567a9d482dea12e9e0e8824d13a7f22052038e299"}
branch: task/gaid-authoring-evidence-view
target: main
parent: 
---
# gaid-authoring-evidence-view

## Goal and done criteria
Request from the starter:

# Goal: gaid-authoring-evidence-view (unit F) — side viewer of the related paper passage and sources next to each authoring question

Done: in the GAID hub Workflow authoring, each question shows in a side viewer the passages of the paper and the other sources it is based on (the question's Anchor evidence: PDF page/region or text span, code lines, data-file summary, web/library note excerpt), so the researcher understands what the question means and how to choose or instruct. Clicking an option or evidence item moves the viewer to the passage; PDF pages render with original pixels (pdf.js, no filters); missing/unverifiable anchors are shown as such, never invented. Keeps D's question-card fixes (option + added words, F11) and C's multi-source intake. Checks: scripts/check; UI guide v2 (sections 1, 2, 10 + components touched; Korean screenshots in both styles/themes at 1440×900 and 1280×800) and copy rules. Started now because C (gaid-authoring-sources) completed and D's authoring fixes are on main (b74950e7). Running nearby: E gaid-hub-versions, H gaid-workflow-start-ui (design phase), A gaid-note-library, B gaid-workflow-example, D gaid-pocheon-trial (uses the review app — do not touch it; use an own instance). Outside check: none.

## User request (verbatim, 2026-10-23)

> 추가 작업 요청이다. 허브에 등록된 workflow를 제거하는 기능이 없다. 제거하는 기능을 추가해야한다. 그리고 워크플로우를 생성하는 기능에서 질문을 할 때 해당 질문과 관련된 논문의 해당부분이나 관련 자료들이 질문의 사이드쪽 뷰어에서 보여야 워크플로우 생성을 위한 질문이 어떤 것을 의미하고 사용자들이 어떻게 지시하고 선택할지 정하기 수월하다. 또한, 서재에서도 pdf 보기를 하면 크롬 브라우저 새로운 탭이 열리는데 이런 방식보다는 사이트 패널에 pdf뷰어가 보이는 것이 더 적절하다. 그리고 판이라는 용어보다는 version이라는 용어를 사용하고 정식 출판하기 전에는 0.1.0에서 시작하고 사용자가 버전을 0.1.1로 할지 0.2.0으로 할지 정할 수 있게 하고 메인 배포를 1.0.0으로 할지도 추후 관리할 수 있게 하여야 한다. 현재는 수정할 때마다 버전만 올라가고 있는 형태이다. 버전 관리 기능이 부재한 상태이다.

The hub proposed units E (hub Workflow removal + version management, now), F (side viewer of the related paper
passage/source next to each authoring question, after C gaid-authoring-sources and D gaid-pocheon-trial's authoring fixes
merge) and G (서재 PDF in a side panel instead of a new tab, after A gaid-note-library merges), and six decisions. The user
answered (verbatim):

> 3번,5번은 나로 하고 나머지는 권장으로 진행하자. opus 5.5 high fast로 진행하자.

Decisions:
1. Order: E now; F after C and D's authoring fixes are on main; G after A is on main.
2. Removal: the registrant and administrators can remove a registered Workflow; it disappears from hub lists but an
   administrator can restore it; copies already installed in projects stay.
3. (나) Term: use the English word "version" on Korean screens too (not 버전, not 판); English screens "version". This replaces
   the 2026-10-20 term 판 — update geo/copy/terminology.csv, locale strings and the AGENTS.md "Workflow model" wording.
4. Existing revisions 1, 2, 3 … map in order to 0.1.0, 0.1.1, 0.1.2 …; all history kept.
5. (나) The registrant chooses the version when registering an update: patch (0.1.x → 0.1.x+1), minor (0.x → 0.x+1.0), and
   the registrant may also declare the main release 1.0.0 (and later majors). Not admin-only.
6. Drafts carry no version and show 초안; a version is assigned at registration.

Verified facts (hub): no removal route exists for hub entries in `server/src/geo/hub-shared/` or the institute hub server
(`server/src/geo/hub-server/`, `/hub/v1`); 판 appears in 76 Korean locale strings; authoring questions carry `Anchor` evidence
(`web/src/geo/contracts/authoring.ts`); the 서재 PDF opens with `target="_blank"` (`web/src/geo/library/library-screen.tsx:389`).
The institute hub server (PC74 :8700, 982389c5, held by user decision gaid-orcid#1) and the review app are not deployed by
this unit; the hub handles rollout after integration (a hub-server protocol change needs the server redeployed — record
it). Running units: A gaid-note-library, B gaid-workflow-example (also touches gaid-method.json / Workflow fields),
C gaid-authoring-sources, D gaid-pocheon-trial (authoring prompts/agent model). Keep edits away from their lines or rebase
onto them when they merge first.

## Current state
Implemented (2026-10-23), by this writer alone (no child units):
- Contract `QuestionOption.evidence?: Anchor[]`; question/option anchors keep `verified: false` when the server does not
  find the quote (server `citeAnchor` in `server/src/geo/authoring/agent.ts`, prompt asks for option evidence).
- Side viewer `web/src/geo/hub/evidence/` wired into `question-step.tsx` / `hub-screen.tsx`: PDF page via pdf.js with
  quote boxes from text-item coordinates (merged per line), web page text, file lines, data summary (table preview),
  honest states; option choice moves the viewer; "PDF 전체 보기" opens the existing SourcePageDialog.
- Locale `hub.evidence.*` (ko/en), `questions.evidence` removed. AGENTS.md (GAID hub bullet) and boundaries updated
  (`pdf-viewer.tsx` exports `loadPdfjs`).
- Verified: server geo-authoring tests (17), web hub tests (99), copy + UI checks clean; screenshots 48 (2 styles x 2 themes x
  2 sizes x 6 scenes) from an own instance (ports 18131/3131, units gaev-api/gaev-web, stopped), seed and shots in
  ~/data/geoaidesk/work/gaid-authoring-evidence-view/. scripts/check: running at last update (log there, logs/check.log).
## Next steps
1. Confirm scripts/check passes; task save; review-copy the report; task finish.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-authoring-evidence-view/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

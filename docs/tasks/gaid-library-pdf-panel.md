---
format: 1
status: active
updated: 2026-10-23T08:02:03Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"f75e7f74-2f75-4d5d-b96b-137e0a14db9e","pid":2754815,"provider":"claude","session":"93327dd7-0b61-40a2-83ee-249e0e597909","start":"62895788","token":"58f1a24e303320d9c3e5923b48745944bb113f45060027b125d1f22014065274"}
branch: task/gaid-library-pdf-panel
target: main
parent: 
---
# gaid-library-pdf-panel

## Goal and done criteria
Request from the starter:

# Goal: gaid-library-pdf-panel (unit G) — 서재 PDF in a side panel instead of a new browser tab

Done: in 서재, "PDF 보기" (web/src/geo/library/library-screen.tsx, today an <a target="_blank"> to libraryPdfUrl) opens the paper's PDF in a side panel viewer inside GAID (original pixels via the existing pdf.js viewer, no CSS filters; page navigation and zoom; close returns to the list/detail); research-note items (unit A, now on main) keep opening as notes. Keep a way to open in a new tab as a secondary action if the viewer cannot render. Checks: scripts/check; UI guide v2 (sections 1, 2, 10 + components touched; Korean screenshots both styles/themes at 1440×900 and 1280×800) and copy rules. Started now because A gaid-note-library is on main (8ad90e3c). Running nearby: E gaid-hub-versions, F gaid-authoring-evidence-view (also a PDF side viewer in authoring — share the viewer component if F lands one first; coordinate via the hub), H gaid-workflow-start-ui, D gaid-pocheon-trial (uses the review app — do not touch it). Outside check: none.

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
Implemented (2026-10-23, single writer, no child units: small and tightly coupled):
- Shared part `web/src/geo/pdf/pdf-pane.tsx` (`PdfPane`, test `pdf-pane.test.tsx`): pane header (title, close, Escape closes,
  focus moves to close) on the chrome layer with `--gaid-frame` edges, the upstream `PdfViewer` in view-only `sourceUrl` mode
  below. Strings `viewers.pdfPane.*`. F (gaid-authoring-evidence-view) may reuse it; hub told.
- Upstream seam: `PdfViewer` optional `renderError` (boundaries entry of pdf-viewer.tsx updated).
- Library summary `storedPdf` (server `store.ts`, contract, server test): `hasPdf` also counts Zotero-only attachments,
  which `/geo/library/items/:id/pdf` cannot serve.
- 서재 (`library-screen.tsx`): "PDF 열기" opens reading mode: list 38 : PDF pane 62, list keeps paper + year; another row with
  `storedPdf` switches the PDF, any other row returns to its detail; detail stays mounted (hidden) and gets focus back on its
  PDF button after close; pane is sticky at viewport height.
- Verified: web vitest (pdf, library, pdf-viewer: 20 passed), server geo-library test, copy validator (0 errors, no new
  warnings), check-ui (0 errors), distribution test; isolated app (start-gaid.sh, GAID_HOME
  ~/data/geoaidesk/work/gaid-library-pdf-panel/home, ports 3720/18720, unit gaid-pdfpanel-app, stopped) in a real browser:
  open, switch rows, Zotero-only row → detail, Escape focus return, sticky pane, error fallback; 8 screenshots both
  styles/themes/sizes.
- scripts/check: passed 2026-10-23 (exit 0; server vitest 2284 passed/8 skipped, web vitest 1250 passed, geo node tests 58
  passed; log ~/data/geoaidesk/work/gaid-library-pdf-panel/logs/check.log). Review copy made.
- F (gaid-authoring-evidence-view) answered: it does not reuse PdfPane (needs quote-highlight seam); both units edit
  pdf-viewer.tsx on different lines (F exports loadPdfjs, G adds renderError), textual merge only.
## Next steps
1. task finish.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-library-pdf-panel/index.md

(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

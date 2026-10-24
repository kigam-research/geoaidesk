# ADR 2026-10-24: GAID = GAID Connect + GAID Workspace; 서재 is the researcher's personal literature space

Status: accepted 2026-10-24 (gaid-ia-connect-workspace). User decision (verbatim): "모두 권장대로 하자."
The user approved the mockup structure, short app-bar names `Workspace | Connect`, visible institute-server name
"기관 Connect 서버", and sharing copy "공유된 Workflow", "Connect에 공유", "공유됨" (version wording unchanged). It replaces
decision 1 ("Information architecture") of ADR 2026-10-21 research-hub-library where that ADR puts the library under "내 연구".

## Context

User feedback 2026-10-24 (verbatim): "어느새 GAID를 허브와 시스템으로 완전히 분리하고 있으며, GAID 시스템을 마치 서재가 메인
기능인것처럼 간주하고 있다. GAID 허브는 지구과학 연구자들이 논문, 문헌, 연구노트 등을 기반으로 양질의 지구과학용 워크플로우(또는
스킬)을 생성하고 공유하는 공간이고, 시스템은 해당 워크플로우를 설치하고 에이전트형 분석 작업을 수행하고 IDE와 에이전틱 기반 작업 및
지구과학친화적 분석 시스템이 종합된 분석 프레임워크이다. 이를 모두 합친 것이 GAID이며, 서재의 경우에는 GAID 시스템에 포함되어도
되고, 허브에 포함될 수 있지만 전체적으로 연구자 개인의 문헌 관리 공간으로 간주해야한다."

Diagnosis: the app bar offers "내 연구 | GAID 허브"; "내 연구" opens on tabs 프로젝트 / 서재, so the analysis framework reads as
projects plus a library, and its core (Workflow install, agent analysis, IDE-like files, geoscience viewers) appears only
inside a project. Docs and promo videos start the research cycle at 서재.

Names (user, verbatim): "제목은 GAID Connect 와 GAID Workspace가 적절한것 같다." Structure items 2 and 3 of the diagnosis
were accepted as recommended ("2, 3은 권장이다.").

## Decision

1. **Two places, one product.** GAID consists of **GAID Connect** (formerly GAID 허브: make, share and evaluate geoscience
   Workflows and skills from papers, literature, research notes, data and analyses; research feeds) and **GAID Workspace**
   (formerly 내 연구 / "GAID 시스템": install Workflows, agentic analysis with the AI agent, IDE-like files and code,
   geoscience viewers, research notes). The names stay English on Korean screens, like "Workflow" and "version".
2. **App bar.** The mark, then one segmented place switch `Workspace | Connect` (short names; the full names title each
   home), the page's own controls (project switcher inside a project), and at the trailing end the personal entries:
   `서재`, computer resources, settings. The mark opens the Workspace home.
3. **서재 is personal, not a place.** It is no longer a tab beside projects. The app-bar `서재` button opens its full screen
   over either place (the place switch shows no current place; a back action returns to the place it came from). Where
   literature is used, 서재 opens as a side panel: in Workspace as the inspector's second view beside the AI agent
   (project literature, citations → PDF page, Workflow source papers); in Connect authoring as the source picker.
4. **Workspace home.** The landing view: `이어서 하기` (recent analyses and notes across projects with their state:
   running, decisions, not reviewed, checked), projects, installed Workflows with readiness, and one primary action
   `분석 시작`. A sidebar lists 홈 / 프로젝트 / 설치한 Workflow / recent projects / archived projects.
5. **Connect home.** The current hub home under the new name, plus a "start from your material" row (paper PDF, 서재,
   research notes, Workspace analysis bundle) that makes the research cycle visible.
6. **Research cycle (docs, help, videos).** 연구 질문·자료 → Connect에서 Workflow 만들기·고르기 → Workspace에서 설치·분석 →
   정리 노트 → Connect에 공유·개선; 서재 supplies the literature at every step.
7. **Institute server and sharing.** Visible copy calls the institute hub server "기관 Connect 서버" (Institute Connect server). The action is "Connect에 공유" (Share on Connect), lists show "공유된 Workflow" (Shared Workflows), and the state is "공유됨" (Shared). Version numbering and stored registration records are unchanged.
8. **Compatibility.** Old `#hub…` links keep opening (new `#connect…` addresses are added); code identifiers, server routes
   (`/geo/hub/*`), modules and locale namespaces keep their names. Stored data is not rewritten.

## Alternatives considered

- Keep "허브 / 시스템" and only move 서재: does not fix the reading that the system is a project list, and "시스템" says nothing
  about analysis.
- 서재 as a third place in the switch: makes it look like a peer of the two places, which is what the feedback rejects.
- 서재 inside Workspace only: Connect authoring needs it as its main source of papers and notes.

## Consequences

- Visible copy that names the places changes (inventory in the report §3.6); `geo/copy/terminology.csv` gains
  GAID Workspace, GAID Connect and 서재 rows. Old place names are forbidden only where the validator can distinguish them from ordinary or external uses.
- AGENTS.md, `docs/design/ui-guide.md` (L2, N1, N5, D6), the hub authoring design doc and the research-hub-library ADR are
  updated with the implementation.
- The Workspace home needs cross-project summaries (recent sessions, notes with open decisions, installed Workflows) that
  today exist per project only.

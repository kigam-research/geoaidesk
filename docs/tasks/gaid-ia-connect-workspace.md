---
format: 1
status: active
updated: 2026-10-24T06:14:36Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"49e229f5-e223-4c4b-a51f-f69c6338d534","pid":470090,"provider":"claude","session":"1fed3167-fbe4-42c0-a6c3-57caef2f6f2a","start":"70915334","token":"13d0611975a16df25fac763a23c5ed15b1bf5ceff296277f35904f28695964ae"}
branch: task/gaid-ia-connect-workspace
target: main
parent: 
---
# gaid-ia-connect-workspace

## Goal and done criteria
Request from the starter:

# Goal: gaid-ia-connect-workspace — reframe GAID as GAID Connect + GAID Workspace, with 서재 as a personal space; design first

## User feedback (verbatim, 2026-10-24)

> 사용자의 피드백이다.어느새 GAID를 허브와 시스템으로 완전히 분리하고 있으며, GAID 시스템을 마치 서재가 메인 기능인것처럼 간주하고 있다. GAID 허브는 지구과학 연구자들이 논문, 문헌, 연구노트 등을 기반으로 양질의 지구과학용 워크플로우(또는 스킬)을 생성하고 공유하는 공간이고, 시스템은 해당 워크플로우를 설치하고 에이전트형 분석 작업을 수행하고 IDE와 에이전틱 기반 작업 및 지구과학친화적 분석 시스템이 종합된 분석 프레임워크이다. 이를 모두 합친 것이 GAID이며, 서재의 경우에는 GAID 시스템에 포함되어도 되고, 허브에 포함될 수 있지만 전체적으로 연구자 개인의 문헌 관리 공간으로 간주해야한다. 어떻게 체계화하여야 사용자가 제기한 문제를 해결할 수 있을지 진단 후 답변하여라.

Hub diagnosis (accepted): the app bar offers only "내 연구 | GAID 허브" (`web/src/geo/hub/top-nav.tsx` via `GaidAppBar`); "내 연구" has tabs
프로젝트 / 서재 (`web/src/components/project-view.tsx`, `ResearchTabs`), so the system's home reads as projects + library and the system's
core (Workflow install, agent analysis, IDE-like workspace, geo viewers) appears only inside a project; docs and promo videos start the
research cycle at 서재; recent units mostly grew 서재 screens.

Decisions (verbatim): "1번과 관련하여 허브와 시스템에 적절한 이름을 후보군을 조사하여 알려줘. ... 2, 3은 권장이다." then
"제목은 GAID Connect 와 GAID Workspace가 적절한것 같다."
1. Place names: **GAID Connect** (was 허브: create, share and evaluate geoscience Workflows/skills from papers, literature, research notes,
   data and analyses; feeds) and **GAID Workspace** (was 시스템: install Workflows, agentic analysis, IDE-like files/code, agent chat,
   geoscience viewers, research notes — the analysis framework). GAID = Connect + Workspace.
2. 서재 = the researcher's personal literature space, opened from either place (app-bar entry to its full screen; side panels where it
   is used: picking sources in Connect authoring, citations/PDF/source papers in Workspace) — no longer a tab beside projects.
3. Design first: mockups for the user's approval, then implementation (scenario C "서재 inspector" stays paused until this is decided).

## Done — phase 1 (this unit, before any app change)

- Mockups (code-built with the real tokens/components; no generated imagery) of: the app bar with the two places GAID Connect /
  GAID Workspace and the 서재 entry; the Workspace home (projects, installed Workflows, recent analyses, start an analysis); the Connect
  home (recommended Workflows, authoring, shared Workflows, 자료 소식); 서재 as full screen and as side panels in context. Korean
  screenshots, 계측 and 도폭, light and dark, 1440×900 (+1280×800 spot checks); give them via `task review-copy` and ask the user to
  approve or adjust. Proposed copy: the names stay English on Korean screens (like "Workflow", "version"); note collisions with existing
  terms ("작업 공간"/workspace in the project screen, `#hub` routes, "GAID 허브" strings) and how they map.
- Also propose the wording changes: ADR (new docs/adr/<date>-gaid-connect-workspace.md), terminology.csv, AGENTS.md, UI guide, and the
  research-cycle narrative ("연구 질문·자료 → Connect에서 Workflow 만들기·고르기 → Workspace에서 설치·분석 → 연구노트 → Connect에 공유·개선",
  서재 supporting every step).

## Phase 2 (after the user approves the mockups, same unit unless it is large — then child units via `task start --parent`)

- Implement the approved structure; keep routes backward compatible (old `#hub…` links still open); rename visible copy; move 서재 out of
  the project tabs; update docs above; scripts/check (UI quality kit impeccable/axe now blocking). Report with rule ids and screenshots.

Do not touch the review app or the hub server (the hub deploys after integration). Running in parallel: gaid-promo-video-v4-lemo (video).
Outside check: none.

## Current state
- Phase 1 in progress (2026-10-24): mockups are built as a development-only page `/dev/places`
  (`web/src/app/dev/places/page.dev.tsx`, `web/src/geo/dev/places/`, copy in locale namespace `devPlaces`), using the real
  tokens and shared parts (`PageHeader`, `SidebarGroup/Item`, `Button`, `Badge`, segmented styles). The app itself is unchanged.
- Screens (`?screen=`): `workspace` (Workspace home), `connect` (Connect home), `library` (서재 full screen),
  `project` (project screen with the 서재 side panel), `authoring` (Connect authoring source step with the 서재 panel).
- Screenshots: `~/data/geoaidesk/work/gaid-ia-connect-workspace/shots/`, decision-relevant PNGs copied to the report folder.
- Done 2026-10-24: five mockup screens, 20 shots at 1440×900 and 16 at 1280×800 (`shots/v1`, `shots/v1-1280`,
  `SHA256SUMS`), current-screen shots (`shots/before`, read-only views of the review app). Proposal report written
  (humanizer applied), ADR draft `docs/adr/2026-10-24-gaid-connect-workspace.md` (status proposed). Copy validator: no
  devPlaces warnings; `check-ui.mjs`: 0 errors; web `tsc --noEmit`: no errors in the new files. scripts/check not run
  (no app change in phase 1).
- Re-render: `cd web && npx next dev -p 3210`, then `~/data/geoaidesk/work/gaid-ia-connect-workspace/shoot.sh <out> 1440 900`.
## Next steps
1. Wait for the user's answers to the four decisions (report §6). On approval, plan phase 2 packages (Orchestration below),
   apply the ADR (status accepted), terminology, AGENTS.md and UI guide; then implement.
Blocked: waiting for the user's answers to the four decisions in report §6 (asked 2026-10-24).
## Orchestration
- Sequential: (1) place names, app-bar structure and 서재 entry (decided by the user, drawn here); (2) user approval of the
  mockups; (3) phase 2 implementation.
- Phase 1 is one tightly coupled design package: done by this writer. Read-only inventory of naming collisions by a native
  Explore sub-agent.
- Phase 2 packages (decide after approval): app bar + routes (`top-nav.tsx`, `app-bar.tsx`, `page.tsx`, hash aliases);
  Workspace home (`project-view.tsx`); 서재 relocation (`research-tabs.tsx`, `library-screen.tsx`, side panels); copy + docs
  (locales, terminology.csv, AGENTS.md, UI guide, ADR).
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.
Complete also closes every item that the hub answered with this unit as follow-up; add one literal
`Keeps: <slug>#<n>` line for each such item that this unit leaves unresolved, and complete reopens it instead.)
## Open items
- [결정] 시안 구조를 승인합니까 — 가) 그대로 2단계(실제 화면 적용) 진행 — 나) 고칠 화면과 내용을 지정해 시안 수정 — 권장: 가) 피드백의 세 가지(두 장소 역할, 서재 개인화, 시스템 핵심 노출)를 모두 반영 — 막힌 일: 2단계 구현 — 조건: 없음 — 근거: reports/2026-10-24-gaid-ia-connect-workspace#6
- [결정] 앱 바 장소 이름 표기 — 가) 앱 바는 Workspace·Connect, 홈 제목은 GAID Workspace·GAID Connect — 나) 앱 바에도 전체 이름 — 권장: 가) 바로 왼쪽 GAID 표지와 겹치지 않음 — 막힌 일: 앱 바 구현 — 조건: 없음 — 근거: reports/2026-10-24-gaid-ia-connect-workspace#6
- [결정] 기관 서버 이름 — 가) 기관 Connect 서버 — 나) 기관 GAID 허브 유지 — 권장: 가) 화면에서 허브라는 말이 사라지고 역할이 이름에 드러남 — 막힌 일: 설정·자료 소식·ORCID 문구 — 조건: 없음 — 근거: reports/2026-10-24-gaid-ia-connect-workspace#6
- [결정] Workflow를 올리는 동작 이름 — 가) 등록을 공유로(공유된 Workflow, Connect에 공유, 공유됨) — 나) 등록 유지(Connect에 등록) — 권장: 가) 피드백이 Connect를 생성하고 공유하는 공간으로 정의 — 막힌 일: Connect 문구 변경 — 조건: version 표기는 그대로 — 근거: reports/2026-10-24-gaid-ia-connect-workspace#6
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-24-gaid-ia-connect-workspace/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

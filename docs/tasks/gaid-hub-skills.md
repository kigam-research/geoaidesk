---
format: 1
status: active
updated: 2026-10-22T05:25:56Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"1feaee6d-25a2-4f86-8c96-6168fa426401","pid":3729624,"provider":"claude","session":"72093558-35de-4f81-99ef-1a6be8c11c3a","start":"53183203","token":"0f77e2794014ac0980c71fe32598208e9e17d14839428a13a9aca7f1f070e2fc"}
branch: task/gaid-hub-skills
target: main
parent: 
---
# gaid-hub-skills

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-skills

User decision (verbatim, 2026-10-22): "우선 첫표 두항목은 권장안대로 하자." — answers gaid-workflow-model#1 with option 가) design
it as a separate unit. The item: skill management in the GAID hub (user, 2026-10-20: "GAID 허브에서 스킬도 추후에 관리해야한다").
Context: gaid-workflow-model (ADR docs/adr/2026-10-20-workflow-runtime-form.md) made the hub Workflow-only; skills are parts a
Workflow uses (built-in catalogue, imported from GitHub and similar, bundled with a Workflow; "hub-managed skills later");
Settings → Skills imports from GitHub first. gaid-backend (active) is designing the shared backend (accounts, storage) for the hub.
Order: diagnose and propose first (no product code): what researchers need from hub-managed skills (find, share, version, review,
reuse in Workflows, import from GitHub into the hub), how it fits the Workflow model and the backend options; options with a
recommendation; discuss with the user in the writer tab (task review-copy); ADR; implement only the agreed scope. Coordinate with
gaid-backend through the hub for storage/auth assumptions. UI follows docs/design/ui-guide.md v2. Own GAID_HOME under
~/data/geoaidesk/work/gaid-hub-skills/; do not modify ~/.geoaidesk. Outside check: no outside check.

## Current state
Phase 1 proposal written and sent for user review, 2026-10-22. No product code changes.
- Report: reports/2026-10-22-gaid-hub-skills/index.md (humanizer pass done; review copy in vault
  `연구 보고서/geoaidesk/2026-10-22-gaid-hub-skills`). Recommendation 가) hub skill shelf with immutable revisions,
  Workflows pin revisions; 3 decisions (§6, mirrored under Open items).
- Diagnosis by code reading (Explore map, refs in report Appendix A); no app run.
- Web research: vault `웹 조사/geoaidesk/2026-10-22-research-question-answer-in-english-2--6b8718a6fe.md`
  (oracle session research-question-answer-in-english-2).
- Backend assumptions (report §3.8) checked by gaid-backend, route 0095d2a0c339 completed 2026-10-22: all four compatible with
  its proposal (recommended 가: institute GAID hub server, SQLite rows + write-once hash-addressed files; member/admin roles,
  reviewer role addable for phase 2). gaid-backend itself still awaits the user's 5 decisions.
## Next steps
1. Discuss the proposal with the user in this tab; record the 3 answers under Notes and decisions.
2. Then ADR `docs/adr/2026-10-22-hub-managed-skills.md`, shared contract (skill entry + `skills[].source: hub` ref) first,
   then implementation packages per the chosen scope (children if large), UI drafts per docs/design/ui-guide.md v2.
## Failed approaches
## Notes and decisions
- Plan (sequential): diagnose → research → proposal → user decision → ADR → implement. Implementation packages are decided
  after the user picks the scope; shared contract (skill entry schema, Workflow `skills[].source: hub` ref) first.
- Inputs read: ADR docs/adr/2026-10-20-workflow-runtime-form.md; reports/2026-10-20-gaid-workflow-model §3.6, §3.13;
  reports/2026-10-15-gaid-researcher-ecosystem (user goal: researchers make skills/Workflows from their papers and share;
  non-coders; institute "second brain"); gaid-backend diagnosis notes (hub-shared store is one process, X-GAID-User unchecked).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [결정] 허브에서 스킬을 어떻게 다룰지 — 가) 허브에 스킬 선반을 두고 스킬마다 판과 출처를 기록하며 Workflow가 판을 고정해 가리킴 — 나) 허브에는 추천 GitHub 주소 목록만 둠 — 다) 스킬은 지금처럼 Workflow 안에서만 나누고 다른 Workflow의 스킬을 가리킬 수 있게만 함 — 권장: 가) 기관 안에서 같은 사본을 나누고 GitHub 접속 없이 설치되며 Workflow 중심 구조를 유지 — 막힌 일: ADR과 구현 — 근거: reports/2026-10-22-gaid-hub-skills#6-결정할-일
- [결정] GitHub 등에서 들인 스킬을 다른 연구자에게 언제 보일지 — 가) 올리면 바로 보이되 "검토 전"으로 표시하고 확인한 사람이 "확인함"으로 바꿈 — 나) 관리자가 확인하기 전에는 올린 사람에게만 보임 — 권장: 가) 계정이 없는 1단계에서 승인 절차를 두면 아무도 쓰지 못함; 설치 전 미리보기와 신뢰 확인은 그대로 — 막힌 일: 1단계 구현 — 근거: reports/2026-10-22-gaid-hub-skills#6-결정할-일
- [결정] 1단계 범위 — 가) 3.7의 1단계 전체를 이번 작업에서 구현하고 2단계는 gaid-backend 계정 뒤 별도 작업 — 나) 스킬 선반(올리기, 상세, 설치)만 먼저 하고 Workflow·허브 작성 연결은 다음 작업 — 권장: 가) 지금 저장소로 되는 부분을 먼저 써 보고 검토 역할은 계정과 함께 정함 — 막힌 일: 구현 계획 — 근거: reports/2026-10-22-gaid-hub-skills#37-단계-나누기
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-22-gaid-hub-skills/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

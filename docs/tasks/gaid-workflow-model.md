---
format: 1
status: active
updated: 2026-10-20T12:28:30Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"dd7d1f93-03d6-4dca-953b-00e41c858900","pid":965617,"provider":"claude","session":"1a56399d-d1de-433f-a555-be30e08751b3","start":"38658235","token":"bb278cf12f9fe20443735ce69e3424ce3a001e5efa08c85b523ada62206e2191"}
branch: task/gaid-workflow-model
target: main
parent: 
---
# gaid-workflow-model

## Goal and done criteria
Request from the starter:

# Request: gaid-workflow-model

User request (verbatim, 2026-10-20, to the geoaidesk hub):
"현재 gaid 허브에서는 워크플로우를 방법이라고 표현하고 있다. 그리고 Gaid 시스템에는 스킬과 워크플로우가 별도의 기능으로 제공되고 있다. 또한, BYOK에서 제공하는 워크플로우는 지침의 형태로 구성되어 있는데 반해 GAID 허브에서 방법(워크플로우)는 어떻게 구성되어 있는지 허브에서도 보이지 않고 GAID 시스템에서도 보이지 않는다. 현재 스킬, 워크플로우, 방법이 혼용되고 있는 것도 이용자들은 혼선이 올 수 밖에 없다. 오히려 스킬은 github를 비롯한 곳에서 유용한 스킬을 가져올 수 있게하고, 워크플로우에 집중하는 것도 하나의 방법이라고 생각한다. 이와 관련하여 현황을 진단하고 어떻게 체계적으로 정리하고 개선할지 논의하고 개선하는 작업을 진행하자."

Scope (same pattern as gaid-notebook-review):
- Phase 1 (diagnosis and proposal, no code changes): diagnose how skills, Workflows (upstream BYOK Workflows are instruction
  prompts), hub "방법" (gaid-method/v1 packages with Workflows, 레시피, skills), 레시피 and catalogue items are named, stored,
  shown and related across the GAID hub and the GAID system (workspace Workflow panel, start settings, Settings → Skills, hub
  screens, locales/terminology in geo/copy/terminology.csv). Show where the composition of a hub method/Workflow is invisible.
  Produce a proposal with options and a recommendation; the user's own idea to evaluate: skills are imported from GitHub and
  similar sources, and GAID focuses on Workflows (hub entries = Workflows). Include a terminology table and the effect on
  existing data/packages (gaid-method/v1, installed methods, recipes) and the skill_hub producer contract.
- Discuss with the user in the writer tab; implement in phase 2 only the agreed scope. A policy/architecture decision with real
  alternatives goes in docs/adr/.
- Current context: review app on PC74 (~/deploy/geoaidesk, data ~/.geoaidesk, hub entries imported from test data on
  2026-10-20); do not modify ~/.geoaidesk; use your own GAID_HOME under ~/data/geoaidesk/work/gaid-workflow-model/.
Outside check: no outside check (product/IA work).

## Current state
- Phase 1 done (diagnosis and proposal, no code changes): report reports/2026-10-20-gaid-workflow-model/index.md
  (6 screenshots from the isolated app). Waiting for the user's four decisions (Open items).
- Findings: one hub entry is called 방법 / Workflow / 설치됨 스킬 depending on the screen; "Workflow" means three things
  (326 BYOK prompt templates; 7 catalogue start forms; the start form inside a hub package). The procedure lives in the
  skill (SKILL.md 8 steps) and separately in atlas.yaml procedure (7 nodes shown by the hub); geo-workflow/v1 has no
  steps. Prompt, skills and files are not visible before start in hub or project. GitHub skill import already exists
  (Settings → Skills, bundled `skills` CLI) but Workflows cannot reference such skills.
- Recommendation: Workflow-centred model (hub unit = Workflow; skills = parts from catalogue / GitHub etc. / bundled);
  phase 2 first does wording, one shared "Workflow 구성" view, skills-screen linkage and four defects, with no format
  change; format extension (Workflow steps, external skill refs) decided separately with skill_hub.
- Isolated app `gaid-wfm-app` (systemd user unit, ports 3110/18110, GAID_HOME
  ~/data/geoaidesk/work/gaid-workflow-model/home, log ../app.log) still running for phase 2 screenshots; stop with
  `systemctl --user stop gaid-wfm-app`.
## Next steps
1. Discuss the report with the user; record answers under Notes and decisions; then plan phase 2 packages
   (report §3.10) and, for the chosen scope, settle shared interfaces before delegating.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [결정] GAID의 기능 구조를 어느 방향으로 정리할까요? — 가) Workflow 중심: 허브 단위와 Workflow 패널의 줄을 모두 Workflow로 부르고 스킬은 부품으로 둠 — 나) 이름만 정리: "방법"을 허브 단위로 유지하고 화면마다 구성 보기를 붙임 — 다) 스킬 중심 — 권장: 가) 등록 항목이 이미 모두 Workflow 종류이고 연구자가 시작하는 단위와 이름이 같아짐 — 막힌 일: 2단계 구현 — 근거: reports/2026-10-20-gaid-workflow-model#6-결정할-일
- [결정] 허브에 스킬만 있는 항목을 어떻게 다룰까요? — 가) 허브에는 Workflow만 등록하고 스킬은 GitHub 등에서 가져옴 — 나) 스킬 항목도 허브의 별도 칸으로 남김 — 권장: 가) 허브에서 고른 것이 늘 바로 시작할 수 있는 Workflow가 됨, 영향받는 등록 항목 없음 — 막힌 일: 2단계 구현 — 근거: reports/2026-10-20-gaid-workflow-model#6-결정할-일
- [결정] 레시피를 어떤 이름으로 부를까요? — 가) "저장한 시작 설정"으로 통일 — 나) "레시피" 유지하고 정의만 용어집에 고정 — 권장: 가) 시작 설정 화면과 이름이 같아지고 연구 기능의 다른 "레시피"와 겹치지 않음 — 막힌 일: 2단계 문구 정리 — 근거: reports/2026-10-20-gaid-workflow-model#6-결정할-일
- [결정] 2단계에서 어디까지 할까요? — 가) 이름 정리, Workflow 구성 화면, 스킬 화면 연결, 결함 4건을 먼저 하고 패키지 형식 확장은 skill_hub와 맞춘 뒤 따로 정함 — 나) 형식 확장까지 이번에 함께 함 — 권장: 가) 기존 자료와 계약을 건드리지 않고 불편 대부분을 풂 — 막힌 일: 2단계 범위 — 근거: reports/2026-10-20-gaid-workflow-model#6-결정할-일
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
Report: reports/2026-10-20-gaid-workflow-model/index.md
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

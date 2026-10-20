---
format: 1
status: active
updated: 2026-10-20T13:30:24Z
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
1. Get the user's confirmation of the runtime form (ADR docs/adr/2026-10-20-workflow-runtime-form.md, report
   §3.11–3.15). Then: shared IO-free renderer + gaid-workflow/v1 types (parent), chat start block, then delegate the
   composition views, authoring steps and CLI export as child units.
2. Child gaid-workflow-model--terms (wording, skills-screen linkage, 3 defects) is running (checkpoint fcbac4509604;
   owns existing locale namespaces, skills-panel, skill-hub install preview; do not edit them until complete); `task complete` it when it
   finishes, before the parent's design implementation merges.
## Failed approaches
## Notes and decisions
- 2026-10-20 user (verbatim): "모두 권장하는 방식으로 진행해도 좋다. skill_hub는 legacy이므로 계획에 포함하지 말아야 한다. GAID 허브에서 스킬도 추후에 관리해야한다. 그리고 워크플로우에서 스킬을 사용하는 것은 어떻게 사용하는지도 설계되어야 하며, BYOK의 워크플로우는 지침이 GAID 시스템에서 보이는데 GAID 허브의 워크플로우는 어떤 형태로 GAID 시스템의 에이전트 채팅에 반영되는지도 정의되어야 한다. 지침형태로 되는 것인지? 아니면 지금의 형태가 어떻게 구현되어 있는지도 구체화되고 확정되어야 한다. 즉, GAID 허브에서도 최종 워크플로우 형태가 어떤 것인지 보여야 한다는 것이다. 현재는 워크플로우가 어떤 흐름으로 진행되는지 설명만 있을 뿐 에이전트 채팅(CLAUDE, CODEX 채팅 같은 형태), CLI 환경에서 어떻게 적용되는지가 불분명하다."
  Decisions (all 권장): Workflow-centred model; hub registers Workflows only for now (skills managed in the GAID hub
  later); "저장한 시작 설정" replaces 레시피; phase 2 = wording + one Workflow composition view + skills-screen linkage
  + defects, format change decided separately. skill_hub is legacy: no skill_hub work or contract alignment in the
  plan; GAID owns the Workflow format.
- New design requirement: define (and show in hub and project) the final runtime form of a Workflow in the agent chat
  and in a CLI agent, and how a Workflow uses skills. Verified current form (2026-10-20): system prompt gets the
  `<available_skills>` index limited to the Workflow's skills (exposure); the start message is an unsent composer
  draft = researcher settings + "Workflow 지시문" (one paragraph) + boundary; on send the composer appends "Make sure to
  use the skills: '<primary>'"; the procedure reaches the model only if it chooses to `read` SKILL.md.
- Orchestration (phase 2): sequential: (1) runtime-form design + ADR, confirmed by the user, (2) Workflow format /
  composition view / runtime implementation on it. Independent now: child `terms` = wording to the agreed terms
  (locales, geo/copy terminology, hub glossary, authoring prompt naming) + defects (registration copy over-promise,
  hub-install origin label "만든 초안", visible install preview). Child owns existing locale namespaces and those
  defect files; new UI for the composition view uses a new locale namespace owned by the parent. Integration: child
  first, then the parent's design implementation.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
- [결정] Workflow가 AI agent에게 가는 형태를 무엇으로 확정할까요? — 가) 지침 문서: 입력·조건·단계·사용 스킬·결과·한계로 GAID가 하나의 지침 문서를 만들고 허브·프로젝트·시작 설정·채팅 첫 메시지·CLI 파일이 모두 이 문서를 씀 — 나) 지금 형태 유지하고 보여 주기만 함 — 다) Workflow에 딸린 스킬의 지침 전문을 첫 메시지로 보냄 — 권장: 가) 허브에서 본 글이 곧 AI agent가 받는 글이 되고 CLI에서도 같은 파일을 씀 — 막힌 일: 2단계 (2)–(5) — 근거: reports/2026-10-20-gaid-workflow-model#6-결정할-일
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

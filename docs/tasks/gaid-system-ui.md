---
format: 1
status: active
updated: 2026-10-18T07:57:07Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"20c56c1e-1c40-4e4b-91a7-71f36f7eb67c","pid":1512234,"provider":"claude","session":"2cbf721c-43fd-4509-a2a4-c3d7f0dba0b8","start":"19721847","token":"f4f562224bbbdb6fbb1d4221f0ac42ff23998b39dd15d754d0d1787ba50a9aea"}
branch: task/gaid-system-ui
target: main
parent: 
---
# gaid-system-ui

## Goal and done criteria
Request from the starter:

# Request: gaid-system-ui

User message (verbatim, 2026-10-18, to the geoaidesk hub, after reading reports/2026-10-18-gaid-hub-followups/index.md):
"보고서를 확인하였다. GAID 허브는 비교적 OneUI기반의 프로젝트의 디자인 가이드를 기반으로 개선되었는데 GAID 시스템에서는 덜 반영된 곳들이 있다. workflow를 불러올 때 뜨는 팝업창에는 여전히 글자 수도 많고 디자인 완성도와 이용자 시인성이 부족한 편이다. 그리고 연구노트와 관련해서도 해당 기능이 개선될 필요가 있다. 사용자의 관점에서 obsidian vault 연구보고서를 정리하는 것을 참고하여 현재 연구노트 기능이 개선되었으면 한다. 지금의 방식은 단순히 에이전트의 작업 흐름만 따라가는 형태로 보이며, 해당 연구노트가 어디에 저장되고 어떻게 활용되는지에 대한 연계가 부족하다고 생각한다. 연구노트의 경우에는 별도 작업 트리로 현황을 진단해보고 어떻게 개선 수정하면 좋을지 검토 후 사용자와 논의하여 시스템을 개선할 필요가 있다. GAID 허브의 경우에는 GPT sol 6.1high 워커가 허브를 배경 지식과 맥락없이 처음 이용하는 이용자의 역할을 부여하였을 때 해당 허브를 올바르게 사용할 수 있는지를 검토하게 하는 작업을 통해 누락되거나 개선이 필요한 부분들을 개선하는 작업을 별도의 작업트리에서 수행하여야 한다."
After the hub proposed three units (gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui with option 가) for its scope): "권장대로 하고 모두 진행하자."

Sibling units started together: gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui.

Scope confirmed with the user (option 가)):
- Required: rebuild the Workflow start-settings popup (the dialog shown when a Workflow is opened/loaded, TaskSetup,
  also opened from the hub's "내 연구로 가져오기") to docs/design/ui-guide.md: far less text, better design finish
  and readability for researchers.
- Also audit the other GAID system screens against the UI guide (workspace, Workflow list, file panel, GAID cards
  in Settings). Fix clear violations with the same rules; list the rest in the report.
- gaid-hub-novice-review may send findings about the start-settings popup here through the hub; this unit owns
  that component. Hub screens (web/src/geo/hub/) are owned by gaid-hub-novice-review.
- Report with Korean screenshots at 1440x900 and 1280x800 per AGENTS.md.

Outside check: no outside check (UI work).

## Current state
- Plan settled (2026-10-18). Target design: the approved mockup of gaid-ui-guide
  (reports/2026-10-16-gaid-ui-guide/figures/01-setup-after*.png, docs/design/mockups/setup.html).
- Isolated runtime for screenshots: `systemd-run --user --unit gsu-runtime ... ~/data/geoaidesk/work/gaid-system-ui/bin/run.sh`
  (UI 127.0.0.1:3361, API 18361, data home ~/data/geoaidesk/work/gaid-system-ui/home, samples copied from ~/.geoaidesk).
  Stop: `systemctl --user stop gsu-runtime`. Before shots: ~/data/geoaidesk/work/gaid-system-ui/shots/before-*.
- web/ and server/ have their own `npm ci` node_modules (no symlinks to ~/deploy).
## Next steps
1. Rebuild TaskSetup as a stepper (package A below), screenshots, then audit (package B).
## Failed approaches
## Notes and decisions
- Orchestration: the popup (A) and the audit fixes (B) share workspace locales and readiness.tsx; both are done by
  this writer sequentially (A then B). No child writers: the work is tightly coupled and moderate in size.
- A. Start-settings popup (`web/src/geo/workspace/task-setup.tsx`, new `setup-steps.tsx`, `readiness.tsx`,
  `web/src/geo/locales/workspace/*`): 720 px dialog, header = title + one line, step rail grouped
  입력 파일 / 분석 조건 / 요약 (numbered pills, Q4/Q5), one question per step (Q1), file inputs as radio cards of
  fitting project files + 기타 (other project file) + 사용하지 않음 for optional roles (Q3), choices as radio cards
  with option labels + 기타 (직접 입력) + 작업 중 결정 (Q2/Q3), readiness blockers with their fix on the first step
  and the summary (Q4), summary with 수정 links and the one primary action (Q5), description/outputs/boundary behind
  disclosures (P3/F5), raw errors behind 기술 정보 (R2). No `권장`: the workflow contract has no recommendation
  source (Q2); recipe/method setup values are pre-selected and labelled as recipe values. A setup opened with
  initial values starts at the first unanswered step, else the summary (Q4).
- Terminology (W6): the hub calls this flow "시작 설정"; the workspace said "작업 설정". Unified to "시작 설정"
  in workspace strings; action "시작 초안 만들기" (as in the approved mockup).
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

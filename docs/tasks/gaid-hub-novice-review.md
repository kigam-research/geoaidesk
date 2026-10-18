---
format: 1
status: active
updated: 2026-10-18T08:06:21Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"d5ccf3fd-f3f5-4c7d-bd56-706709e93d52","pid":1500366,"provider":"claude","session":"08462f75-6cc2-44d7-8916-85fe4ec1ce7b","start":"19720226","token":"b3fc2052aa1f2db180340374b5e8418ae8568a6717a7cbdeffc044faf4daf5ce"}
branch: task/gaid-hub-novice-review
target: main
parent: 
---
# gaid-hub-novice-review

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-novice-review

User message (verbatim, 2026-10-18, to the geoaidesk hub, after reading reports/2026-10-18-gaid-hub-followups/index.md):
"보고서를 확인하였다. GAID 허브는 비교적 OneUI기반의 프로젝트의 디자인 가이드를 기반으로 개선되었는데 GAID 시스템에서는 덜 반영된 곳들이 있다. workflow를 불러올 때 뜨는 팝업창에는 여전히 글자 수도 많고 디자인 완성도와 이용자 시인성이 부족한 편이다. 그리고 연구노트와 관련해서도 해당 기능이 개선될 필요가 있다. 사용자의 관점에서 obsidian vault 연구보고서를 정리하는 것을 참고하여 현재 연구노트 기능이 개선되었으면 한다. 지금의 방식은 단순히 에이전트의 작업 흐름만 따라가는 형태로 보이며, 해당 연구노트가 어디에 저장되고 어떻게 활용되는지에 대한 연계가 부족하다고 생각한다. 연구노트의 경우에는 별도 작업 트리로 현황을 진단해보고 어떻게 개선 수정하면 좋을지 검토 후 사용자와 논의하여 시스템을 개선할 필요가 있다. GAID 허브의 경우에는 GPT sol 6.1high 워커가 허브를 배경 지식과 맥락없이 처음 이용하는 이용자의 역할을 부여하였을 때 해당 허브를 올바르게 사용할 수 있는지를 검토하게 하는 작업을 통해 누락되거나 개선이 필요한 부분들을 개선하는 작업을 별도의 작업트리에서 수행하여야 한다."
After the hub proposed three units (gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui with option 가) for its scope): "권장대로 하고 모두 진행하자."

Sibling units started together: gaid-notebook-review, gaid-hub-novice-review, gaid-system-ui.

Scope confirmed with the user:
- Give a reader worker on the Paseo "general work" profile (GPT sol 6.1 high; the user named this model) the role
  of a first-time GAID hub user with no background knowledge or context (no repo docs, no reports, no prior
  sessions; only the running app's screens). Have it try to use the hub correctly end to end (find/understand
  methods, author a draft from a source, register/use in own research, etc.) and report where it got lost, what
  is missing and what should improve.
- Fix the missing or weak parts found, then re-check them the same way (fresh first-time-user worker).
- Boundary with gaid-system-ui: the Workflow start-settings popup (TaskSetup, also opened by the hub's
  "내 연구로 가져오기") is owned by gaid-system-ui. Findings about that popup go to that unit (via the hub,
  `task hub --send --kind route`), not edited here.
- UI work follows docs/design/ui-guide.md and the copy rules in AGENTS.md.

Outside check: no outside check (app usability work; the first-time-user re-check is the acceptance evidence).

## Current state
- Test app: user service `gaid-novice-app` (dev mode, ports 3370/18370), script
  ~/data/geoaidesk/work/gaid-hub-novice-review/bin/dev.sh, GAID_HOME ~/data/geoaidesk/work/gaid-hub-novice-review/home
  (config/models copied from the gaid-hub-followups test home, Qwen model; shared hub entries copied so the hub is not
  empty; no personal authoring projects). Log logs/app.log there.
- Round 1 brief: ~/data/geoaidesk/work/gaid-hub-novice-review/briefs/novice-1.md; materials novice1/materials/
  (my-paper.pdf = authoring_preview_paper asset, Yilgarn_GIS_DB.csv = yilgarn-gis-db/20260911).
## Next steps
1. Round-1 reader running: Paseo agent 857f65bb-d15b-4929-8f05-83b1166c0f3e ("general work"), output
   ~/data/geoaidesk/work/gaid-hub-novice-review/novice1/{log,summary}.md. Do not edit web/server files while it runs
   (dev server hot-reloads). Wait for its final message.
2. Triage findings: hub fixes here; TaskSetup popup findings -> gaid-system-ui via `task hub --send --kind route`.
3. Fix, then round 2 with a fresh reader (novice2/), report.

Plan (sequential): round 1 review -> triage -> fixes (self or child writers if large, split by files) -> round 2.
## Failed approaches
## Notes and decisions
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

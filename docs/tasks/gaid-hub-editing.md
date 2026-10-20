---
format: 1
status: active
updated: 2026-10-20T08:31:30Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"973096b8-d85d-4540-8407-314c27f4b24a","pid":2418100,"provider":"claude","session":"2485ae34-3b6a-477b-a2a1-60e3eb8b9d65","start":"37298903","token":"a46848df5264acf9fe4f245bb6541d25f6cf250193347f9ea63666ff5eb8e35b"}
branch: task/gaid-hub-editing
target: main
parent: 
---
# gaid-hub-editing

## Goal and done criteria
Request from the starter:

# Request: gaid-hub-editing

User message (verbatim, 2026-10-20, to the geoaidesk hub):
"GAID 시스템 노트에서 결정한 일이 여러가지 일 경우 답변 하나를 클릭할 때마다 채팅창으로 메시지를 입력하게 하지 않고 전체 답변이 클릭되고 사용자가 답변 보내기라는 별도의 버튼을 클릭하면 한번에 전송될 수 있게 수정되어야 한다. 그리고 답변에서도 별도 지시 옵션이 추가되어 있어야 한다. 그리고 레시피 가져오기에서 GAID 허브가 연동되어 이용자들이 GAID 허브에서 레시피를 가져올 수 있게 연동되어야 한다. skill 추가 시에도 skill_hub는 legacy이며 GAID 허브에서 스킬을 찾을 수 있게 연동되어야 한다. 한편, GAID 허브에서는 등록된 방법을 수정할 수 있는 기능이 없으며, 사용자들이 작성한 방법을 클릭해서 들어갔을 때 이미 선택된 질문들도 수정이 되지 않는다. 또한 각 방법 초안에서 개념 그림도 어떻게 생성되는지 안내도 없으며, 기능도 보이지 않는다. 사용자가 해당 개념이 마음에 들지 않으면 수정하지도 못하는 것으로 보인다. 관련 현황을 확인 후 GAID 허브를 개선하여야 한다."
After the hub proposed two units (gaid-note-decisions, gaid-hub-editing): "진행하자."

Review app (user's view): PC74 ~/deploy/geoaidesk, unit gaid-review, data ~/.geoaidesk (ports 3000/18000). On 2026-10-20 the
task test data was imported there (hub registered methods 5, projects named "검토용 - ..."), so the user's observations refer to it.
Do not modify ~/.geoaidesk; use your own GAID_HOME under ~/data/geoaidesk/work/<slug>/ (copy from it if useful).
Sibling unit started together: gaid-note-decisions (owns web/src/geo/notes/ and server/src/geo/notes/) and gaid-hub-editing
(owns web/src/geo/hub/, server/src/geo/authoring/, server/src/geo/hub-shared/, recipe import in web/src/geo/workspace/, Settings
skills/skill_hub entry). Coordinate through the hub if you need the other's files.

Scope confirmed with the user:
0. First check the current behaviour of each point below in the real app and record it.
1. Recipe import: the Workflow panel's "레시피 가져오기" can find and import recipes from the GAID hub.
2. Skill install: Settings → Skills finds skills in the GAID hub. skill_hub becomes legacy: keep it only as an
   "이전 skill_hub" link (recommended option the user accepted), not the primary path.
3. Edit a registered method on the hub (default: an edit creates a new revision; design who may edit, given display-name
   users without accounts).
4. In a method draft, already answered questions can be changed again.
5. Concept pictures: explain how they are made and show the feature (today visible only with the OpenAI Codex (legacy)
   login); let the researcher regenerate or revise a picture they do not like (by instruction).
The writer may split independent packages into child units. UI guide + copy rules; Korean screenshots 1440x900 and 1280x800.
Outside check: no outside check (app work).

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
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

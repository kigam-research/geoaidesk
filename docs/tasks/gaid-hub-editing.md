---
format: 1
status: active
updated: 2026-10-20T08:49:23Z
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
Step 0 (current behaviour, 2026-10-20, trial app from this worktree with a copy of ~/.geoaidesk; screenshots
`~/data/geoaidesk/work/gaid-hub-editing/before/`): all five observations confirmed.
1. Recipe import: the Workflow panel's "레시피 가져오기" dialog only takes a `.geo-start.json` file; no hub search (07-recipe-import.png).
2. Settings → Skills → 스킬 추가: the first card is "skill_hub 스킬 추가" (skill_hub site link, page URL, .tar.gz); GAID hub
   entries are not listed (05-skill-add.png).
3. Registered entry page (`#hub/e/<id>`): star, comment, "내 프로젝트에서 시험" only; no edit action, also for the author
   (02-entry-own.png). Server: a new revision is accepted only from the same authoring project and the same display name.
   In the review data 2 of 5 entries (incl. the user's own "서성인" entry) have no authoring project on this server, so
   even the author could not reach a draft to edit.
4. Questions step: recorded answers are locked (`locked` in QuestionStep, all non-open questions); the review panel says
   "모든 답이 초안에 반영되었습니다. 바꿀 점은 … 고칠 점 알려주기" (04-questions.png). The server already supersedes a
   decision when the same question is answered again (`answerQuestion`), so the lock is UI-only.
5. Concept pictures: draft step shows a disabled "개념 그림 만들기" with a small grey line "그림 생성 계정이 연결되지
   않았습니다…" (03-draft.png); no explanation of how pictures are made, no link to connect, no per-picture regenerate or
   revise. Review data has 0 pictures.

Trial app: `systemd-run --user --unit gaid-hubedit-app --collect -E PATH=$PATH -E HOME=$HOME
~/data/geoaidesk/work/gaid-hub-editing/bin/run.sh` (UI 3380, API 18380, GAID_HOME `~/data/geoaidesk/work/gaid-hub-editing/home`).
## Next steps
1. Add `HubEntry.recipe` to the shared contract, then start children P1 and P2; implement P3 + P4 here.
## Failed approaches
## Notes and decisions
Plan (2026-10-20):
- Shared interface first (writer): `HubEntry.recipe?: boolean` (latest snapshot carries a 레시피/Workflow) in
  `web/src/geo/contracts/hub-shared.ts` + `server/src/geo/hub-shared/routes.ts` entryView.
- P1 child `hub-in-project` (Codex general work): items 1+2. Owns `web/src/geo/workspace/recipe-add.tsx`, a new hub
  picker under `web/src/geo/hub-picker/`, `web/src/geo/skill-hub/`, `server/src/geo/skill-hub.ts`,
  `server/src/geo/routes/skill-hub.ts`, locales `workspace`/`skillHub` (+ new `hubPicker`). Uses `GET /geo/hub/entries`,
  `POST /geo/hub/entries/:id/install`; skills preview reads hub entry bytes server-side through the existing preview gate.
- P2 child `concept-pictures` (Codex general work): item 5. Owns `server/src/geo/authoring/{visuals,codex-images}.ts`, the
  visuals route body, `GenerateVisualsBody`, draft-step/method-flow picture UI, hub locale keys `visuals.*`.
- Writer: P3 (item 3, edit registered method) in `server/src/geo/hub-shared/`, authoring store fields, entry page; P4
  (item 4, change recorded answers) in `question-step.tsx`/`hub-screen.tsx`.
- Integration order: P3/P4 here, then `task complete` P1, P2; resolve hub locale JSON merges; screenshots; report.

Decision (item 3, who may edit; display names are not accounts):
- The registering author (same display name) edits in place: "방법 고치기" opens the linked draft, or a draft seeded from
  the latest registered snapshot when the linked one is missing; registering it adds the next revision of the same entry.
  Earlier revisions stay installable; every revision records who registered it.
- Any other researcher gets "복사해서 고치기": a copy becomes their own draft (whole authoring project when it is on this
  server, otherwise the snapshot); registering it creates a separate entry that names the original (`basedOn`).
- Rejected: anyone adds revisions to any entry (wiki model) — with free display names it would let anyone overwrite the
  latest revision others install by default.
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

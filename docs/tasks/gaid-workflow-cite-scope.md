---
format: 1
status: active
updated: 2026-10-23T12:15:27Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"56c05725-7189-46a4-9615-7e1ddddb7ee0","pid":515641,"provider":"claude","session":"31d96ed7-e560-44e9-9232-a2b8aa7a787b","start":"64415659","token":"705a5edd3ea6c16b909c87cbd34aa6359cc9106a13b769c29f4592a9e6ef672d"}
branch: task/gaid-workflow-cite-scope
target: main
parent: 
---
# gaid-workflow-cite-scope

## Goal and done criteria
Request from the starter:

# Goal: gaid-workflow-cite-scope — close the research cycle on the paper (F23) and the example-data sharing notice (F21)

## User decision (verbatim, 2026-10-23)

> 남은일과 F23 작업까지 수행하자.

Context: the hub offered option 가 — start this unit now (consent-based attach, writer Opus 5.5 high fast) — for finding F23 from
gaid-pocheon-trial (D), and "남은 일" refers to D's remaining gap F21. Both come from D's report
`reports/2026-10-23-gaid-pocheon-trial/index.md` (review copy in the vault).

## F23 (D, verbatim summary)

The cycle 서재 paper → Workflow → analysis → note → 서재 does not close on the paper. The final-pass note (review app project
pgi-2-0-2-0-84f252, Workflow "항공자력·시추 코어 PGI 광체 추정" 0.2.0, built from the 서재 papers Heo et al. 2025 and Astic et al. 2020)
shows "인용한 논문이 없습니다" in 서재, and the papers' "내 연구에서 쓰인 곳" do not list the note. Cause: installing a hub Workflow into a
project does not attach the Workflow's source papers (known DOIs / 서재 items) to the project's citation scope
(`.kady/geo/literature.json`), so the agent's `library_*` tools and the note citation check never see them.

Done for F23: on install (or when the start settings run), GAID offers to attach the Workflow's source papers that are in the
researcher's 서재 to the project — with consent, no silent change; papers not in 서재 are listed as such (offer to add only through
the existing confirmed paths). Then the agent can cite them, the note citation check/reference list sees them, and 서재 shows
paper ↔ Workflow ↔ note links ("내 연구에서 쓰인 곳"). Works for hub Workflows whose package records source papers; a Workflow without
recorded sources behaves as today. Verify with a real cycle in an own instance (not the review app).

## F21 (D)

The Workflow registration dialog does not say that bundled example data are shared with the Workflow. Done: the registration preview
lists the bundled example files (name, size, licence/source, synthetic flag) and states they are shared with everyone who can see the
entry, before the researcher confirms. Close D's open item for F21 with a `Closes:` line if D recorded one.

## Notes

- Checks: scripts/check; UI guide v2 and copy rules (use "version", not 판). Outside check: none.
- The review app (PC74, loopback-only until the user turns LAN mode back on, planned Monday 2026-10-26) and the institute hub server
  (7703739a) are deployed by the hub after integration — do not touch them. If your change needs a hub-server code change, say so
  (the hub then redeploys it with a backup).
- After this unit, the hub does the final one-time review-app update and then starts the promo video v3 on the improved app.

## Current state
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)

Plan (2026-10-23, writer; tightly coupled, done by the writer without child units):
- F23 matching key: a package's `sources[]` keeps the DOI of a paper (`kind: "doi"`) and, for a paper without DOI, its
  file name + title (`documentKind` "paper…"). Library item ids are personal, so a Workflow's papers are matched against
  the installer's 서재 by normalised DOI, else by normalised exact title. No package format change; existing registered
  packages (the Pocheon Workflow 0.2.0) work as they are.
- Server: `server/src/geo/library/workflow-papers.ts` (resolve: attached | in-library | not-in-library);
  `GET /geo/library/workflow-papers?method=<runtimeName>` and `POST /geo/library/workflow-papers/attach`
  `{method, itemIds}` (only ids that resolve from that method's papers; merged into `.kady/geo/literature.json`).
- Consent point: the Workflow start window's 소개 step (every install route opens it) shows the Workflow's 근거 논문 with
  their state and one explicit 인용 범위에 붙이기 action; papers not in 서재 open the existing 논문 넣기 dialog with the DOI
  prefilled (lookup + researcher check, unchanged). Nothing is attached without that action.
- Start message: attached papers are named in the `<workflow>` 지침 (settings.papers, chat target only) with their
  citation keys, so the agent cites them in the note; RESEARCH_NOTE_RULE asks to cite relied-on library papers.
- 서재 uses: `buildUsesIndex` adds a `workflow` use per project-installed Workflow whose papers match the item
  (project, Workflow title), next to the existing authoring-draft use.
- F21: RegisterDialog lists the draft's bundled example files (name, size, licence/source, synthetic) and says they
  are shared with everyone who can see the entry; the "not shared" line no longer claims all 연구 자료.
- D's F21 open item is gaid-pocheon-trial#2 (hub confirmed it is on main, 2026-10-23); this unit's F21 change closes it:

Closes: gaid-pocheon-trial#2
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
- /home/seongin3/data/geoaidesk/runs/gaid-workflow-cite-scope-20261023T120649.699277Z/receipt.json
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

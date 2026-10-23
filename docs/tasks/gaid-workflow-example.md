---
format: 1
status: done
updated: 2026-10-23T07:14:39Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"cc577db8-acf4-4fcd-b382-03314cb2af71","pid":1746984,"provider":"claude","session":"bf5e0624-c00c-4da3-8d48-be9d0472fbca","start":"62320911","token":"08ec02ef4d15776d4adca0405d68c76559de4aefe662e800ff9e1e1ba2940de0"}
branch: task/gaid-workflow-example
target: main
parent: 
---
# gaid-workflow-example

## Goal and done criteria
Request from the starter:

# Goal: gaid-workflow-example (unit B) — default example data for Workflows

Your unit is B. Done: a Workflow can carry default example data per input (bundled small file, or public URL + sha256 for larger data, downloaded on first use with bounds and hash check); in the Workflow start settings the researcher uploads/chooses own data, and when none is given the example is selected so the analysis can run in GAID; the chat and the 지침 state clearly that example data was used. Hub authoring can attach examples to inputs; install/readiness/CLI export handle them; existing Workflows without examples behave as before. Checks: scripts/check; UI guide and copy rules. Outside check: none.

## User request (verbatim, 2026-10-23)

> 사용자는 논문 서재에서 시작해서 워크플로우를 만들고 분석을 수행하여 연구 노트를 생성한 후 해당 연구 노트를 다시 서재로 가져오는 흐름을 다른 논문으로 실전 검증하고 싶다. 실전 검증을 통해 부족한 부분이 발견되면 개선까지 진행하고 싶다. 현재 사용자의 zotero pc에 'Application of petrophysically and geologically guided inversion to aeromagnetic and drilling data for investigation of magnetite ore in Pocheon, Korea'이라는 논문을 수집해 두었다. 해당 논문의 데이터는 제공되지 않기 때문에 워크플로우를 만들 때 데이터를 사용하지 못한다. 이런 경우 가장 유사한 공개 데이터를 기반으로 워크플로우를 만들고 이용자들은 본인의 데이터를 올리거나 현재 테스트에서 사용되는 공개 데이터를 기반으로 워크플로우를 테스트 할 수 있게 하여야 한다. 즉, 워크플로우를 이용할 때 사용자가 이상적으로 데이터를 업로드하거나 지정하면 좋겠지만 이것이 어려울 경우 default example이 선택되어야 GAID 시스템에서 분석을 수행해 볼 수 있을 것이다. 그리고 현재 연구 노트를 서재로 다시 가져오는 기능은 구현되지 않은 것으로 알고 있기 때문에 이를 구현하여야 한다. 논문과는 별도의 연구 노트이므로 카테고리를 구분하여 관리할 수 있게 해야한다. 이것은 GAID 시스템에서 대화로그를 바탕으로 워크플로우를 만드는 기능과도 연계되어 있다고 생각하며, 기존 워크플로우 생성 도구에서도 문헌, 논문 뿐만 아니라 다수의 자료를 추가할 수 있게 해야한다. 여러개의 별도 작업트리로 진행해야 하는 작업들이다. 특히 다른 논문으로 워크플로우를 생성해보는 실전 검증의 경우에는 GAID 시스템의 워크플로우를 생성할 때 에이전트 모델은 GPT 6.1 sol high로 지정하고 writer가 직접 이용자 역할로 생성해보아야 한다. 그리고 생성 과정에서 논문의 분석과정과 다른 방식으로 유도되거나 너무 지엽적인 결과만 계산되게 하는 것은 아닌지도 검토하면서 개선점들을 정리하고 개선하여야 한다. 또한, 테스트이므로 너무 과도한 연산이 되지 않게 하여야 한다. 지난번 PU Bagging의 경우 목표와 달리 테스트가 너무 오래걸려서 작업의 진행을 지연시키는 것은 방지해야 한다. 해상도를 Fine하지 않게 하거나 수치 계산 허용 기준을 너무 타이트하게 하지 않는 등의 방법이 있을 것이다. 이외에도 모호한 부분이 있을 것이므로 사용자에게 필요한 사항을 질문하고 작업을 시작할 수 있도록 하자.

The hub proposed four units (A note→library, B Workflow default example data, C more authoring source kinds, D Pocheon
real-use trial) and seven decisions; the user answered (verbatim):

> 모두 권장대로이다. 하지만 워크플로우를 만들때 너무 쉬운 예제 및 논문에서는 많은 자료들을 활용하고 지구물리학적 지식이 포함되어 있는데 단순히 작업만 돌아가게 하는 형태로 구현하면 홍보 및 평가자들의 설득에 실패할 수 있다. 논문에 준하는 수준으로 분석은 이루어져야한다. 해상도는 거칠게 해도 되지만 분석 품질을 낮춰라는 얘기는 아니다. 그리고 writer들은 opus 5.5 high fast로 작업하자.

Recommended answers the user accepted:
1. Order: A, B, C and D start now; D's first pass finds gaps (fixed in D or forwarded to A/B/C through the hub); after A–C
   merge and the hub updates the review app, D verifies the whole cycle once more.
2. Public analogue data: D's writer surveys and picks a small, clearly licensed public dataset closest to the paper
   (aeromagnetic grid + drillholes with susceptibility/petrophysics); if no suitable real data exists, synthetic data built
   with an open tool such as SimPEG, labelled as synthetic.
3. Trial place: the review app (PC74), Workflow registered on the institute hub server as the admin account; connect the
   review app's library to the PC74 Zotero (local API 127.0.0.1:23119; the paper is item 2SUGC6Q2 with its PDF).
4. Compute: one analysis run finishes within 10 minutes; coarse mesh (order of tens of thousands of cells), loose tolerances;
   lower resolution further rather than exceed it. Quality of the method must stay at the paper's level (user, above).
5. Research notes in 서재: GAID library only, included in the institute hub server library sync; no Zotero writes.
6. Authoring sources to add: data files (CSV, shp, GeoTIFF, LAS …), library papers and research notes, several at once.
7. Example data: small examples (~10 MB or less) bundled in the Workflow package; larger ones as public URL + sha256,
   downloaded on first use (package limit 20 MiB compressed).

## Verified facts (hub, 2026-10-23)

- Library items today are papers/files (`LibraryItem` kind `pdf|other`); notes appear only as "used in" links
  (`LibraryUse` kind `note`). No research-note item exists. Contract `web/src/geo/contracts/library.ts`, server
  `server/src/geo/library/`, screens `web/src/geo/library/`.
- Authoring source kinds: `pdf | code | text | gaid-analysis | web` (`web/src/geo/contracts/authoring.ts` `SourceKind`,
  `server/src/geo/authoring/sources.ts`); the chat → Workflow path is `POST /geo/authoring/handoffs` (kind `gaid-analysis`).
- Workflow inputs: `InputPort.exampleRef` exists in the authoring contract; no bundled default example that is selected
  automatically was found.
- Review app: PC74 :3000/:18000, LAN-exposed with a fixed token (`~/data/geoaidesk/work/review-app/access-token`), main
  a8d35c6b, logged in to the institute hub server (admin seongin). Its library is not connected to Zotero yet.
  GPT-6.1 Sol is in its model picker (openai provider configured).
- KIGAM network blocks raw.githubusercontent.com (use `gh api` or codeload.github.com).

## Units and ownership (settle interfaces before overlapping edits)

- A `gaid-note-library`: research note → 서재 as a separate category (library contract/server/screens, notes link).
- B `gaid-workflow-example`: Workflow default example data (method package/Workflow input declaration, install,
  Workflow start settings choosing the example when the user gives no data, readiness).
- C `gaid-authoring-sources`: authoring tool accepts several sources at once, data files, library papers and research
  notes; aligned with the chat-log → Workflow handoff.
- D `gaid-pocheon-trial`: real-use trial and improvements.
- B ↔ C interface: C stores data-file sources in the authoring store with sha256; B lets an input port's example point to a
  bundled file (from such a source or an upload) or a public URL + sha256. Whoever merges second rebases onto the first.
- Do not restart or change the review app except D as a user of it; the hub updates the review app after A–C merge.

## Current state
- Shared contract settled: `web/src/geo/contracts/workflow-examples.ts` (`WorkflowInputExample`, files bundled at
  `examples/<roleId>/<name>` or `url` + sha256 + size, limits, validator `exampleProblems`, project folder
  `user_data/examples/<method>/<roleId>-<key>/`, `POST /geo/methods/examples`); `inputRoles[].example` added to
  `LocalWorkflow` (draft form `DraftInputExample` with `from` = data source file of unit C or upload at `examples/<sha256>`),
  `WorkflowDoc.inputRoles[].example`, `WorkflowDocSettings.examples`, summary `WorkflowInputRole.example` (state).
- Package R done (commits f6c29c3, d0ab2a4): validation, `server/src/geo/methods/examples.ts`, method summary states,
  `POST /geo/methods/examples`, 지침 rendering (chat/preview/cli), CLI README, start settings (example option, upload,
  default to example, mixed warning, summary note, preparing state), Workflow card label 예제 자료로 실행, hub InputPrep,
  workflow-view inputs, glossary term 예제 자료, AGENTS.md bullet.
  Verified: `server` `npx vitest run test/geo-workflow-examples.test.ts test/geo-methods.test.ts test/geo-workflow-doc.test.ts
  test/geo-cli-export.test.ts` 37 passed; `web` `npx vitest run src/geo src/lib` 827 passed after fixing one parse expectation;
  tsc clean both; copy 0 errors; ui 0 errors.
- Unit D was told the declaration shape (Paseo message to f483b642, 2026-10-23 15:18 KST; route-report
  d-interface-gaid-workflow-example).
- Full scripts/check run 1 (before child A, log `~/data/geoaidesk/work/gaid-workflow-example/check-1.log`): 2261 passed,
  1 failed: `geo-hub-server.test.ts` launcher CLI test timed out at 5 s under load average ~35 (other units testing in
  parallel); rerun alone passed in 4.4 s. Not related to this change.
- End-to-end in a dev app (ports 3300/18300, data `~/data/geoaidesk/work/gaid-workflow-example/app`, fixture method
  pocheon-mag with bundled + loopback-remote examples): start settings selected the examples, "시작 초안 만들기" wrote four
  files under `user_data/examples/pocheon-mag/<role>-<key>/`, the composer card showed 예제 자료로 실행, the tree showed the
  folder on its 15 s refresh, and the reopened setup reported 프로젝트에 이미 있습니다. Screenshots (both styles, both themes,
  1440x900 and 1280x800) in `~/data/geoaidesk/work/gaid-workflow-example/playwright/`; five copied to
  `reports/2026-10-23-gaid-workflow-example/figures/`. Dev app stopped.
- UI rules: Q1 (one input per step), Q2 (example pre-selected only when the researcher has no fitting file, reason shown
  in the hint), Q3 (example card placed before 기타, which stays last apart from 사용하지 않음 as before), Q4 (inputs with an
  example count as answered), Q5 (summary lists example values, note and mixed warning).
- Child A integrated (`task complete`, b9d04e1), closed after removing its build caches. Cross-side test added: the
  authoring package passes `parseMethodFile`. Authoring area captured in both styles/themes/sizes from the child's seeded
  store (`~/data/geoaidesk/work/gaid-workflow-example/playwright/authoring-*.png`).
- Final scripts/check (log `~/data/geoaidesk/work/gaid-workflow-example/check-2.log`): all geoaidesk checks passed
  (server 2269 passed + 8 skipped, web 1241 passed, copy 0 errors, ui 0 errors / 0 new debt, smoke PASS).
- Report written and humanized: `reports/2026-10-23-gaid-workflow-example/index.md`.
## Next steps
<!-- task:closed -->
Closed 2026-10-23T07:14:39Z: finished; task finish integrates it into main. No further steps in this unit; `task complete` verifies jobs and rollout and reports the outcome. Residual work: no open items recorded.

## Plan (orchestration)
Sequential decisions: contract first (done), then two independent packages.
- Package R (this writer): method-file validation, `server/src/geo/methods/examples.ts` (state, copy, bounded download,
  hash check, provenance user step), `local-methods.ts` summary, `routes/methods.ts` `POST /geo/methods/examples`,
  `workflow-doc.ts` (server roles + render: chat/preview/cli say example used), `cli-export.ts` README, start settings
  (`task-setup.tsx`, `setup-steps.tsx`: example option, upload option, default to example, mixed-data warning),
  `hub/input-prep.tsx`, `workflow/workflow-view.tsx` inputs, locales `workspace`/`workflowDoc`/`workflowView`/`hub` (prep keys).
- Package A (child `gaid-workflow-example--authoring`): hub authoring attach (upload / data source of unit C / public URL
  with server-side bounded fetch for sha256+size), store bytes, carry researcher examples across model revisions, package
  builder writes `examples/<roleId>/<name>` and strips `from`, schema extension, checks (limits), shared-hub edit seeding
  keeps bundled bytes, draft screen UI. Owns `server/src/geo/authoring/**`, `server/src/geo/hub-shared/edit.ts`,
  `web/src/geo/hub/**` except `input-prep.tsx`, locale namespace `hub` keys it adds.
- Child A started 2026-10-23 15:06 KST: unit `gaid-workflow-example--example-authoring`, writer Paseo
  4c42e845-8f67-4730-bef3-80cdb81d7110 (claude-opus-5-5 high, fast_mode true per user), prompt
  `~/data/geoaidesk/work/gaid-workflow-example/child-authoring.md`. Next: `task complete` it after its finish.
- Integration order: R and A in parallel → complete A → merge into this branch → scripts/check → UI screenshots.
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Report: reports/2026-10-23-gaid-workflow-example/index.md
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

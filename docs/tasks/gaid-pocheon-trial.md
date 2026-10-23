---
format: 1
status: active
updated: 2026-10-23T08:49:57Z
writer: {"boot":"b8f70902-d391-463d-a34d-115acded7724","host":"seongin3","paseo":"f483b642-f754-4209-bbab-640075e87a30","pid":1752543,"provider":"claude","session":"a8cd0069-059b-4ae1-a797-ae4c8ab3d65a","start":"62323311","token":"d43db119f0119fe97744373582ba5c12357a55bd4821fadf676c064c1f62efa6"}
branch: task/gaid-pocheon-trial
target: main
parent: 
---
# gaid-pocheon-trial

## Goal and done criteria
Request from the starter:

# Goal: gaid-pocheon-trial (unit D) — real-use trial of the research cycle with the Pocheon paper, and improvements

Your unit is D. Act as a researcher in the review app: 서재 (Zotero item 2SUGC6Q2, Heo et al. 2025, Geosciences Journal, DOI 10.1007/s12303-025-00067-8) → create a Workflow in the GAID hub with the authoring agent model set to GPT-6.1 Sol, thinking high (user requirement) → register/share it on the institute hub → run the analysis with it in a GAID project (show the map viewer / work screen) → research note → bring the note back into 서재 (unit A; until it merges, record the gap).

Quality bar (user, verbatim above): the analysis must be at the level of the paper — petrophysically and geologically guided inversion of aeromagnetic and drilling data for a magnetite ore body, using several data types and geophysical knowledge — not a toy that merely runs. Coarse resolution is allowed; method quality is not reduced. Within 10 minutes per run (learn from the slow PU-bagging test: docs/design/spatial-pu-pilot.md).

While doing it, review and record where the authoring/analysis steers away from the paper's method or ends in overly narrow results, and why (prompts, questions, defaults, skills, Workflow schema). Fix what lies in your scope; forward A/B/C-scope findings to the hub with task hub --send --kind route naming the target unit (or write them as open items if those units have finished). Keep a findings list in the task document and a report for the user (result first, with key figures).

Optional (outside check, offered by the hub): compare your results' order of magnitude (e.g. susceptibility contrast, ore body depth/volume) with the values the paper reports, noting the data differ.

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
- 2026-10-23 15:05 KST: started. Paper read from Zotero (item 2SUGC6Q2, attachment FYMLI68F; text in
  ~/data/geoaidesk/work/gaid-pocheon-trial/paper.txt, not in Git). Sibling units A/B/C just started (no code yet).
- Paper method (reference for the quality bar): drone TMI (25 m grid, 60 m terrain-following) → diurnal correction →
  Z-score > 3 outlier removal → IGRF removal (ppigrf) → crop; 271 core samples, 3 classes (host 0.0045, low-grade
  0.1587, ore 0.2828 SI; variances 2.04e-4, 3.00e-3, 7.56e-3) → 1D GMM; SimPEG PGI on 25 m cells with DEM topography,
  sensitivity weighting, start = host mean; PGI-full (fixed GMM) and PGI-none (means learned); ore by property
  isovalue (ore mean) and by P(ore) > 99 %; low-sensitivity cells excluded; volumes 453,125 / 1,046,870 m3 vs
  drill-interpreted 468,853 m3; IGRF inc 55.102°, dec -8.850°, 51,473.6 nT; boreholes KM20-1/KM20-2/KM21-1 (Table 1).
- SimPEG 0.25.2 + discretize 0.13.0 install with `uv run --no-project --with simpeg` (PC74).

## Plan (orchestration)
Sequential decisions: (1) analogue data choice (Oracle survey running) → (2) example dataset built and checked with a
reference PGI run ≤ 10 min (mesh size, tolerances) → (3) authoring in the review app as a researcher (GPT-6.1 Sol high)
→ (4) register on the institute hub → (5) run in a GAID project → (6) research note → (7) note → 서재 (unit A).
Independent packages: reference PGI script + example data (D, ~/data, later bundled per unit B's interface);
authoring-steering fixes inside D's scope (authoring prompts/questions) — decided after the first authoring pass.
Owned files: findings list here; report reports/2026-10-23-gaid-pocheon-trial/; fixes touch
server/src/geo/authoring/* prompt/question text only after checking A/B/C do not own them (C owns sources).
Integration order: A, B, C merge first; D rebases, then verifies the whole cycle once more.

## Findings (authoring/analysis steering, gaps)
(id — where — what — why — owner unit — status)
- F1 — authoring UI (`web/src/geo/hub/agent-model.tsx`, `source-step.tsx:216`; server `authoring/model.ts:237`) — the
  researcher can pick the model but not the thinking level; the UI never sends `thinkingLevel`, so every UI authoring
  run uses medium. The user's requirement "GPT 6.1 sol high" cannot be met from the screen. — D (fix: thinking selector
  next to the agent model, stored per authoring project) — open.
- F2 — first draft (`authoring/agent.ts:434-447` `draftRequest`) — the draft call gets only 10-40 verified findings
  (one anchor each), decisions and code file names, never the paper text; any method detail that did not become a
  finding is lost (e.g. Z-score rejection, sensitivity mask, two GMM-based extraction criteria). — D — open.
- F3 — trial scale (`prompts.ts:101-107`, `agent.ts:935-942`) — the recommended `quick-and-full` makes "quick" the start
  default without saying what quick may change; nothing forbids dropping method steps or data types to get there. —
  D (prompt: quick may coarsen resolution/limits only, never drop a method step, data type or comparison) — open.
- F4 — package content — the authoring model cannot write scripts; without researcher-supplied code the package is
  descriptive and the run agent writes all code at run time. For this paper the authors' own SimPEG PGI script is
  public (Springer ESM1, 11 KB, `12303_2025_67_MOESM1_ESM.py`, sha256 cf1b0e18…) and can be given as a code source;
  it covers mesh → PGI only, not processing or interpretation. — record; licence of ESM is the publisher's (see Notes).
- F5 — example data (`InputPort.exampleRef` never produced by authoring) — B's scope (gaid-workflow-example). — route
  after B's interface is known.
- F7 — 서재 paper detail (`web/src/geo/library/library-screen.tsx`) — "Workflow 만들기" is disabled until "본문 텍스트
  추출" has run, with no visible reason; a researcher sees a dead button. — A/C (library screen; C owns
  library→authoring) — to route.
- F8 — authoring project created from a 서재 item stores no `model`; the screen keeps the chosen model only in memory, so
  after a reload (here: the review-app restart) the selector shows the default model and the next draft/revise quietly
  runs on it. — D — fixed: analyze/draft/revise/answers store the model and reasoning level they name on the project
  (`rememberModel` in `authoring/routes.ts`, test in `geo-authoring.test.ts`).
- F9 — BLOCKER on the LAN review app: `newOpId()` (`web/src/geo/hub/api.ts`) calls `crypto.randomUUID`, which browsers
  expose only in secure contexts; the review app is plain http on 10.13.15.74 since 2026-10-23 11:35, so every hub
  authoring action (read sources, answers, draft, revise) fails with the toast "crypto.randomUUID is not a function"
  for every researcher on the institute LAN. — D — fixed in D (getRandomValues fallback + `web/src/geo/hub/api.test.ts`);
  trial continues with the same polyfill injected into the trial browser. Same class, minor: copy buttons use
  `navigator.clipboard` (undefined on insecure origins) in hub technical details, workflow-view, hub-feeds,
  hub-server admin/parts, note-figures — they throw or do nothing. — D (optional) — open.
- F10 — first-pass questions (project ap-bab647f7-674, GPT-6.1 Sol high, 38 findings, 7 questions; the findings
  covered the whole method and even caught that ESM1 overwrites the PGI-none settings with PGI-full) — the question
  "Workflow의 입력은 어느 처리 단계부터 받을까요?" recommended "보정된 자력 자료부터" because "올린 코드가 관측 위치·관측값·
  표준편차를 직접 읽으므로 … 역산과 광체 추정에 집중": the recommendation followed the supplied code's coverage and would
  drop the paper's diurnal correction, Z-score rejection and IGRF removal. Cause: ANALYZE_SYSTEM asks for a
  recommendation without saying it must keep the source's method. — D — fixed (ANALYZE_SYSTEM: prefer the option that
  keeps the whole method; never narrow because code covers part). The researcher (writer) answered
  "원자료와 보정 자료 모두".
- F11 — question card (`web/src/geo/hub/question-step.tsx`) — an option and "기타" words are mutually exclusive in the UI
  (typing in 기타 clears the option, choosing an option clears the text), although the API accepts `optionId` +
  `response`. A researcher cannot pick the recommended option and add a condition (e.g. "all bodies, but mark the
  one at the boreholes"). — D (optional) — open.
- F12 — trial-scale question text on main says quick results are "흐름 확인용" (flow check only), which contradicts the
  user's bar (coarse but paper-level, interpretable). — D — fixed with F3 (question reason/hint reworded).
- F13 — first draft (GPT-6.1 Sol high, accepted after one repair; 8 steps covering preprocessing, GMM, PGI-full and
  PGI-none, sensitivity thresholds, body separation, volume/depth/overlap against a reference body, report) — its
  "빠른 시험 설정" caps the quick run at 300 data, 2,000 active cells, 5 iterations, CG 10, 1 thread and says quick results
  are not for ore-body interpretation. 2,000 cells cannot resolve a 0.5 Mm3 body (~30 cells of 25 m); the writer's
  reference ran 82,807 active cells, 620 data, both variants in 220 s. Cause: DRAFT_SYSTEM asked for "about 10 minutes"
  with examples of what to cut but no floor (resolution of the target, convergence, threads), and main's text says
  quick results only check the flow. — D — fixed in DRAFT_SYSTEM (with F3); in the trial the researcher asks for a
  revision.
- F14 — first draft — 17 Workflow choices, 10 left for the start ("input-route", "preprocessing-settings",
  "uncertainty-policy", "gmm-weights", "mesh-design", "field-mode", "inversion-controls", "sensitivity-cutoffs",
  "boundary-policy", "body-rules") and approval gates in four steps ("승인받은 뒤 계산"). Paper values are offered as
  options but, by the authoring rule, never as defaults. — observe in the start settings and the run before deciding.
- F15 — first response referenced `scripts/run_pgi_workflow.py`, a script the authoring model cannot create; the repair
  removed it. The supplied ESM1 covers mesh → PGI only, so preprocessing and interpretation code is written by the run
  agent. — observe in the run.
- F16 — first draft SKILL.md tells the run agent to create `<skill>/scripts/run_pgi_workflow.py`, `<skill>/work/request.json`
  and write results under `<skill>/outputs/`. The package check rejects the missing script (error; "프로젝트에 설치하기"
  disabled although the draft was accepted after repair), and writing into the installed skill folder mixes results
  with the method. Cause: DRAFT_SYSTEM says to write code paths "in full from <skill>/" and nothing about where run-time
  files go. — D — fixed (DRAFT_SYSTEM: skill folder read-only; agent-written code and outputs in a named project work
  folder). Researcher feedback in the trial asked for `pgi_run/`.
- F17 — Workflow start settings (review app b74950e7) — every optional input defaults to "사용하지 않음" even when a fitting
  file is in the project; opened at the summary, one click would start the paper's method with only the DEM and a
  README (6 of 8 inputs unused). CSV roles list every CSV as candidate. — B (start settings, example selection) —
  routed 2026-10-23 16:31.
- F18 — analysis run (project pgi-2c2f48, GPT-6.1 Sol high, started 16:29:59) — although the Workflow says to run
  through and stop only for missing or malformed inputs, the agent opened an `interview` at ~16:31 with three detail
  rules (borehole penetration marking, numeric preprocessing/statistics/boundary rules, IGRF height basis), each with a
  sensible recommendation; nobody watched the chat, the form expired after 600 s and the agent went on with its
  recommendations labelled as assumptions. ~10 minutes lost for a run whose start settings were complete. Cause: the
  boreholes input had no ore-penetration column (paper Table 1 also has none; penetration comes from core logging,
  i.e. core_samples.csv classes), and interview guidance asks to block on missing authorization. — record; candidate
  fix: Workflow 지침 should state that details with a recommended default are recorded as assumptions, not asked,
  once the start settings are complete (D, prompt) — fixed: when the start settings leave no condition open, the
  rendered 지침 says to record such details as assumptions and run through, stopping only for a missing or misfitting
  required input (`settings.runThrough`, `web/src/geo/contracts/workflow-doc.ts`). Also seen: after the interview
  expired the agent stopped the run anyway (it asked for the three answers in its final message) although the tool
  result told it to proceed with its recommendations.
- F6 — data-file sources — authoring accepts pdf/code/text/web only; the example dataset cannot be given as a source
  yet. — C's scope (gaid-authoring-sources). — known to C (its goal).

- 2026-10-23 16:11: interim sync → main b74950e7 (PR #85; F1/F2/F3/F9-F16 + example generator/asset), merged with C;
  hub restarted the review app on b74950e7 at 16:12. Verified there without in-page patches: the reasoning selector
  shows on the sources step and the revise attempt ran as openai/gpt-6.1-sol high from a LAN browser (F1, F9).
- First pass done 17:24 KST: hub entry "PGI 기반 3차원 자철석 광체 추정" 1판 (registered 16:24 on the institute hub,
  folder 지구물리 역산, from authoring ap-bab647f7-674 draft 3); installed into project pgi-2c2f48; run 16:29 → interview
  expired (F18) → researcher answered at 16:45 → finished 17:24. Agent: wrote pgi_run/run_pgi_workflow.py, fixed two
  SimPEG 0.25 incompatibilities of ESM1 (SaveEveryIteration abstract; masked DEM array), 758 data, 57,503 active
  cells; PGI-full 23 iterations 235 s, PGI-none 25 iterations 241 s (inversion 479 s ≤ 10 min). Target body vs truth
  488,000 m3: full/property 640,625 (IoU 0.34), full/probability 171,875 (0.17), none/property 1,625,000 (0.26),
  none/probability 859,375 (0.35); PGI-none learned ore mean 0.290 → 0.143 SI; sensitivity cut-offs 0-0.05 identical.
  Research note 연구노트/2026-10-23-PGI-입력확인/index.md (title "두 PGI 조건으로 복원한 합성 자철석 광체", 3 decisions).
  Copies in ~/data/geoaidesk/work/gaid-pocheon-trial/pass1-run/. Note → 서재 not possible on b74950e7 (A not deployed).
- First pass history: authoring ap-bab647f7-674 (서재 → Workflow 만들기; sources heo2025.pdf + ESM1 zip); analyze
  (38 findings, 7 questions) → answers → draft 1 (package error, F13/F16) → revise 1 with researcher feedback
  (passes the package check; quick run keeps the core window, 25 m, all data, 30 iterations) → revise 2 (feedback:
  quick results interpretable at resolution; no per-step approval gates) running. Analysis project pgi-2c2f48
  ("포천 자철석 PGI 실전 검증") with the example files in user_data/.

## Next steps
Blocked: second pass waits for the hub's review-app update to main 1684c887+ (requested 17:45 KST via d-final-pass-ready; unit gaid-hub-rollout-versions).
1. Wait for the hub (unit gaid-hub-rollout-versions) to update the review app to main 1684c887+ (loopback-only,
   http://127.0.0.1:3000 on PC74 until the user re-enables LAN on 2026-10-26).
2. Second pass on the new main: 서재 → Workflow 만들기 (GPT-6.1 Sol, 높음 from the screen) with paper + ESM1 + the six
   example files as data sources (C) → answers → draft → attach the examples per input (B) → register (new entry) →
   new project → start settings with no own files (examples selected; check F17) → run → research note → bring the
   note into 서재 (A) → check library sync.
3. Report reports/2026-10-23-gaid-pocheon-trial/ (result first, figures from pass 1 and 2, findings, paper comparison).

## Failed approaches
## Notes and decisions
- 2026-10-23: Example data = SYNTHETIC at the real site (decision 2 fallback, pending the Oracle survey for real
  data): real terrain (Copernicus GLO-30 DSM tile N38 E127, downloaded from
  copernicus-dem-30m.s3.eu-central-1.amazonaws.com — the global S3 endpoint times out here), real IGRF via ppigrf
  (matches the paper: 55.102°, -8.850°, 51,473 nT → the paper's coordinates are EPSG:5186), the paper's borehole
  table (collars moved onto the DSM, which is ~95-110 m above the paper's 350 m collars; vertical drop kept), the
  paper's class statistics for 271 samples (99/36/136), synthetic ore lenses (target ~0.44 Mm3 near the holes +
  a neighbouring lens), drone lines 55 m apart at 60 m AGL with a high-flown patch NE of the target, base-station
  diurnal record, noise and spikes. Generator `~/data/geoaidesk/work/gaid-pocheon-trial/ref/make_example.py`,
  output `example-v1/` (~1.1 MB). Max anomaly ~920 nT (paper > 3000 nT; real ore is shallower/thinner).
- 2026-10-23: Oracle survey (Pro, 14m53s; vault `웹 조사/geoaidesk/2026-10-23-i-need-to-pick-a--f9401c05d3.md`): no
  public Pocheon data (Shin 2021, Shin & Shin 2022, Kim 2021 publish summaries/figures only); best real magnetite
  pairs are USGS Pea Ridge (CC0, but 400 m lines, deep IOA) and Iron Mountain–Menominee (CC0); it recommends the
  Pocheon-inspired synthetic hybrid as the default example, labelled by provenance, scored against the known truth
  (both volumes plus IoU/precision/recall), never tuned on the true volume. Decision: synthetic hybrid (decision 2
  fallback); a real-data case stays optional.
- 2026-10-23: B's example interface (writer of gaid-workflow-example, commit f6c29c3, not merged): one example per input
  role, `workflow.inputRoles[].example = {title, source, license?, synthetic?, files:[{name, sha256, size, path|url}]}`,
  bundled path `examples/<roleId>/<name>`, ≤ 10 MiB/file, ≤ 15 MiB per Workflow; different roles land in different
  project folders. D splits the example by role (aeromagnetic lines + base station; DEM; drillholes + core samples).
- 2026-10-23: C's interface: `sourceContext(store, project)` stays the source-text helper (now with data-file
  summaries); C bumped both prompt versions to 2026-10-23.1 (D bumped DRAFT to the same value; trivial conflict).
- 2026-10-23: The paper's supplementary script is public at Springer (ESM1). It is © the publisher/authors with no
  open licence stated; use as a code source in a hub draft needs the user's view (institute-internal hub).
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

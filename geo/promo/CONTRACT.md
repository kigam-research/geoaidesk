# GAID promo video production contract (v3)

Task `gaid-promo-video-v3` (v1/v2 contracts: git history of this file). Output: one ~100 s promotional film, 1920×1080,
30 fps, H.264, silent, internal review only (open item `gaid-release-proof#2`). Structure: task document
`docs/tasks/gaid-promo-video-v3.md` → "Structure draft v3". It is a promotional film (user, 2026-10-23: "정직한 영상을
원하는 것이 아니라 홍보용 영상을 원하는 것이다."): choose takes for visual quality; staging that the report records is allowed.

## Ownership

- Parent (`gaid-promo-video-v3`): this contract, `render.py`, `scene/`, `prepare_data.py`, README, task document,
  report, integration and the final video. All film work (scenes, tags, timing, render) is the parent's.
- Study-and-capture child (`gaid-promo-v3-study`): `capture*.py` (prefix `capture_` for new helpers), `CAPTURE.md`,
  the study in the review app and the external directories below. It does not edit the parent's files. Its beat labels
  are suggestions.
- Payloads (frames, video, copies) stay outside Git under `~/data/geoaidesk/work/gaid-promo-video-v3/`.

## The study (one real research cycle in the review app; user approval for v2, 2026-10-23: "검토용 앱에서 연구를 진행하고
Workflow를 기관 허브 서버에 등록해도 된다.")

Review app: PC74 `http://127.0.0.1:3000`, backend `:18000`, `GAID_HOME=~/.geoaidesk`, deployed main 7650e012, signed in to
its models and to the institute hub server (PC74 :8700) as the user's account. Paper: Heo et al. 2025 (Pocheon magnetite,
PGI), library item `li-79b57a297a46` (`heo2025`, Zotero-linked with PDF); method paper Astic et al. 2020
`li-a313027670f8` (`astic2020`). Example data: asset `pocheon_pgi_example` = `~/assets/gaid-pocheon-pgi-example/2026-10-23/`
(six input files; `truth/` is the answer key and is never given to the agent or bundled). Supplementary code: the
paper's Springer ESM1 script `~/data/geoaidesk/work/gaid-pocheon-trial/supp/12303_2025_67_MOESM1_ESM.py` (sha256 `cf1b0e18…209e1c`, see `reports/2026-10-23-gaid-pocheon-trial/` appendix A).

1. 서재: a new folder (e.g. `포천 자철석 PGI`) holding `heo2025` and `astic2020` (add to folder only; do not edit the items).
   Open the paper's PDF in the side panel.
2. Workflow from the paper: `heo2025` → "Workflow 만들기"; on 자료 add `astic2020` from 서재, the supplementary code and the
   six example input files together (data summaries visible); model GPT-6.1 Sol, reasoning high, chosen in the authoring
   picker. 질문: answer each, normally the recommended option, with the evidence viewer open beside it. 초안: 3–5 analysis
   stages (workflow-stages). Attach example data per input (from the draft's data sources), coarse settings allowed by the
   Workflow but the method kept whole. 형식 검사 통과.
3. 공유: register on the institute hub in folder 지구물리 역산 (version 0.1.0). Later in the study (after the analysis) make one
   small real improvement learned from the run and register the next version, so the register dialog shows the version
   choice and the shared example files (this take is the one the film uses).
4. 연구 분석: from the hub entry "내 프로젝트에서 시험" into a new project (e.g. `포천 자철석 광체 추정`); in the start window
   소개 attach both source papers ("근거 논문 2편 붙이기"), keep the example data on every input, then the summary and start.
   The researcher may add to the start message: save the reduced-to-pole/total-field anomaly map and a depth slice of the
   recovered susceptibility as GeoTIFFs in the data's CRS for GAID's map viewer, and cite the library papers with page
   numbers in the research note. One real run only: coarse/loose, ≤ 10 min compute, method kept whole (user rule).
5. 연구노트: the AI agent's note (result first, figure, citations with pages to both papers); answer one decision with
   "답변 보내기".
6. 다시 서재로: the note's "서재에 넣기" → 서재 정리 노트; the paper's "내 연구에서 쓰인 곳" (Workflow, project, note); "연결
   지도 열기".

Rules: touch only what this study creates (one folder, one authoring draft, one hub entry and its versions, one project, its
chat and note, one note library item); never delete, rename or edit other records; never read or copy `auth.json`,
`config.env`, `mcp-auth.json`, `hub-server/connection.json`; never change settings, restart or reconfigure `gaid-review` or
the hub server. If the review app restarts mid-run, wait and continue from the recorded state. Use a connected
subscription model picked per action if the default model fails (v2 precedent); no settings change. Record models,
token/cost readings shown by GAID, timings and every id (folder, authoring id, entry id + versions, project id, session id,
note path, note library item) in `study.json`, with before/after inventories of records outside the study.

## Capture

- Browser: installed Google Chrome via Playwright, viewport 1280×720 CSS px, device scale factor 2.25 (frames 2880×1620),
  Korean UI, light theme, style 계측. Drawn pointer and click ripple as in v2 `capture.py`; real hover.
- Film style (user feedback 2026-10-23): the parent shows each frame whole at one scale (no zoom, no pan). Inside a shot
  there is no scrolling and no jump; pick window states where the feature is visible without scrolling. A needed scroll
  becomes a cut between two shots.
- Live moments that cannot be revisited (authoring question with the evidence viewer, the AI agent working, the decision
  being answered) are recorded while the study runs; waiting is cut out (record the cuts). Everything else may be
  recorded afterwards by revisiting the stored state. Capture-only DOM text substitutions are allowed only for wording that
  reveals staging; record each one.

## Take interface (`capture-v3`)

Directory `~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/`, same schema as v2 (`gaid-promo-capture-v2`):

- `shots/<id>/frame-%05d.png`, 2880×1620; frame i = i/30 s of shot time.
- `capture.json`: `fps`, `width`, `height`, `css: {width:1280,height:720,scale:2.25}`, `app: {url, commit}`, and per shot
  `{id, frames, pattern, url, cuts: [{frame, removedSeconds, why}], actions: [{t, kind, target, rect}], beats: [{t0, t1,
  rect, label}]}`. `beats`: `rect` in CSS px of the region showing the feature, `label` a short Korean tag (≤ 18
  characters), 2–4 beats per shot, each ≥ 1.5 s, non-overlapping in time.
- `stills/<name>.png`: a clean result map, the 3D orebody figure, the Workflow stage diagram, the connection map, with
  their source in `capture.json`.

## Shot list v3 (targets; ±1 s fine; hold ≥ 0.4 s at start and end)

| id | s | Shows |
|---|---|---|
| L1 | 5 | 서재: the new folder with both papers → paper detail (bibliography, folders, 쓰인 곳 empty or prior). |
| L2 | 4 | "PDF 열기" → the PDF in the side panel beside the list, a page turn. |
| A1 | 5 | 자료 step with several sources: two library papers, the code, the data files with their data summaries. |
| A2 | 5 | 질문 live: question + evidence viewer (PDF page, quote marked); the recommended option picked, viewer moves. |
| A3 | 4 | 초안: Workflow as 3–5 stages (flow diagram) and the check passed. |
| A4 | 3.5 | Example data attached per input (example-data screen). |
| H1 | 4.5 | 허브 등록 dialog: next version choice (patch/minor/major) and shared example files → registered. |
| H2 | 3.5 | Hub entry: title, version, author, stars/comments, "내 프로젝트에서 시험". |
| R1 | 4.5 | Start window 소개: purpose, inputs, outputs, 근거 논문 → "근거 논문 2편 붙이기". |
| R2 | 4.5 | A stage page with example data chosen and conditions → summary → start. |
| R3 | 6 | Chat: Workflow card (예제 자료로 실행), the AI agent working (tool steps, orbit), a result figure appearing. |
| M1 | 5 | Map viewer: anomaly or susceptibility-slice GeoTIFF on a basemap, legend, a click showing a value. |
| N1 | 5.5 | 연구 노트: the note (result first, 3D orebody figure, cited pages) → decision, option picked, "답변 보내기". |
| L3 | 4 | Note "서재에 넣기" → 서재 정리 노트 list. |
| L4 | 4 | 서재 → the paper → "내 연구에서 쓰인 곳" (Workflow, project, note). |
| L5 | 3.5 | "연결 지도 열기": paper → Workflow → project → note. |

Total ≈ 71 s; the parent trims to fit.

## Visible text rules

Visible names "AI agent" and "GAID"; no Kady/K-Dense/BYOK except upstream attribution badges the app shows. Researcher-facing
"version", never "판". No emoji. Keep the app's own limits and statuses visible (예제 자료, 초안, 검토 전).

## Verification

Every frame exists at 2880×1620; first/last frames clean; no browser page errors; `study.json` ids resolve in the review
app; records outside the study unchanged (file list + mtimes of `~/.geoaidesk/projects/*/project.json`, library items and
hub entries other than the new ones, before/after); beat rects drawn on midpoint frames and checked.

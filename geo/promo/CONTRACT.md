# GAID promo video production contract (v2)

Task `gaid-promo-video-v2` (v1 contract: git history of this file). Output: one ~105 s promotional film, 1920×1080,
30 fps, H.264, silent, internal review only (open item `gaid-release-proof#2`). Structure: task document
`docs/tasks/gaid-promo-video-v2.md` → "Structure draft v2".

## Ownership

- Parent (`gaid-promo-video-v2`): this contract, `render.py`, `scene/`, `prepare_data.py`, README, task document,
  report, integration and the final video.
- Study-and-capture child (`gaid-promo-video-v2--study`): `capture*.py` (prefix `capture_` for helpers), `CAPTURE.md`,
  the study run in the review app and the external directories below. It does not edit the parent's files.
- Payloads (frames, video, copies) stay outside Git under `~/data/geoaidesk/work/gaid-promo-video-v2/`.

## The study (user decision 2026-10-23: "검토용 앱에서 연구를 진행하고 Workflow를 기관 허브 서버에 등록해도 된다.")

One coherent research cycle, done for real in the review app (PC74 `http://127.0.0.1:3000`, backend `:18000`,
`GAID_HOME=~/.geoaidesk`, already signed in to its models and to the institute hub server as the user's account):

1. 서재: add the user's paper (author manuscript `~/assets/gaid-authoring-preview/20261015/author-manuscript.pdf`, DOI
   `10.1007/s11053-026-10778-w`, Yilgarn Ni MPM with PU learning + conformal calibration) with "논문 넣기" (PDF + DOI),
   into a new folder (e.g. `광상 부존 가능성`).
2. Workflow from the paper: the paper's "Workflow 만들기" → 자료 → 질문 (answer each, normally the recommended option)
   → 초안 → 형식 검사 통과 → (concept pictures only if the app offers them without a new login).
3. 공유: "허브 등록 미리보기" → "허브에 등록" on the institute hub server (topic folder fitting MPM, a short note).
4. 연구 분석: from the hub entry "내 프로젝트에서 시험" into a new project (name e.g. `Yilgarn 니켈 광상 부존 가능성`),
   input prep with `~/assets/yilgarn-gis-db/20260911/Yilgarn_GIS_DB.csv`, attach the library folder to the project, start
   settings (quick trial scale) → "시작 초안 만들기" → send. The researcher may add to the start message that the
   priority zones are saved as a map file GAID's map viewer opens (GeoTIFF/GeoPackage; CRS only as far as verified,
   otherwise stated unknown) and that the research note cites the library paper with `[@key]`.
5. 연구노트: the AI agent's note (result first, with decisions); the researcher answers a decision with "답변 보내기".
6. 다시 서재로: the paper's "내 연구에서 쓰인 곳" lists the note and the Workflow; "연결 지도 열기" shows paper →
   Workflow → project → note.

Rules: touch only what this study creates (one folder, one paper, one authoring draft, one hub entry, one project);
never delete, rename or edit other records; never read or copy `auth.json`, `config.env`, `mcp-auth.json`,
`hub-server/connection.json`; never restart or reconfigure `gaid-review` or the hub server. If the review app is
restarted by someone else mid-run (another unit may update it), wait and continue from the recorded state. Record
model, token/cost readings shown by GAID, timings and every id (library item, authoring id, entry id + 판, project id,
session id, note id) in `study.json`.

## Capture

- Browser: installed Google Chrome via Playwright, viewport 1280×720 CSS px, device scale factor 2.25 (frames
  2880×1620), Korean UI, light theme, style 계측. Frames show the drawn pointer and click ripple of v1 `capture.py`;
  real hover (move the real mouse along the same path).
- Film style (user feedback 2026-10-23): the parent shows each frame whole at one scale (no zoom, no pan). So inside a
  shot there is no scrolling and no jump; pick window states where the explained feature is visible without scrolling.
  A needed scroll becomes a cut between two shots.
- Live moments that cannot be revisited (the authoring question step, the AI agent working in the chat, the note
  decision being answered) are recorded while the study runs; waiting is cut out (record the cuts). Everything else
  may be recorded afterwards by revisiting the stored state.

## Take interface (`capture-v2`)

Directory `~/data/geoaidesk/work/gaid-promo-video-v2/capture-v2/`:

- `shots/<id>/frame-%05d.png`, 2880×1620; frame i = i/30 s of shot time.
- `capture.json`, schema `gaid-promo-capture-v2`: `fps`, `width`, `height`, `css: {width:1280,height:720,scale:2.25}`,
  `app: {url, commit}`, and per shot `{id, frames, pattern, url, cuts: [{frame, removedSeconds, why}], actions: [{t,
  kind, target, rect}], beats: [{t0, t1, rect, label}]}`. `beats` are the feature callouts the parent draws: `rect` in
  CSS px of the region that shows the feature (a panel, card, dialog, step, map), `label` a short Korean tag (≤ 18
  characters, e.g. `폴더로 논문 정리`), `t0..t1` shot seconds when that feature is being shown/used. 2–4 beats per
  shot, each ≥ 1.5 s, non-overlapping in time.
- `stills/<name>.png` (2880×1620 or element crops): a clean result map, the result figure, the Workflow flow diagram,
  the connection map, with their source in `capture.json`.

## Shot list v3 (targets; ±1 s fine; hold ≥ 0.4 s at start and end)

| id | s | Shows |
|---|---|---|
| L1 | 6 | 서재: folder tree with the new folder, paper table with the paper → click it → paper detail (bibliography, PDF, folders). |
| L1b | 4 | 서재 import/export: "논문 넣기" dialog (PDF/DOI, 서지 파일) or the ORCID/Zotero cards, and "서지 내보내기" (BibTeX/RIS). |
| A1 | 4 | Paper detail → "Workflow 만들기" → authoring 자료 step with the paper as source. |
| A2 | 4.5 | 질문 step live: a question with the recommended option; the option is picked. |
| A3 | 4 | 초안: Workflow flow diagram and "형식 검사 통과". |
| H1 | 4 | 허브 등록 미리보기 → 허브에 등록 dialog (folder, note) → registered. |
| H2 | 4 | The hub entry on the institute hub: title, 판 1, author, star/의견, "내 프로젝트에서 시험". |
| R1 | 5 | Install → input prep with the CSV → start settings rail (입력 파일 → 분석 조건 → 요약) → "시작 초안 만들기". |
| R2 | 6 | Chat: Workflow block card, the AI agent working (tool steps, orbit), a result figure appearing (waits cut). |
| M1 | 5 | Result in the map viewer (priority zones), legend, a click showing a cell's value. |
| N1 | 5.5 | 연구 노트 tab: list → the note (result first, figure) → decision block, option picked, "답변 보내기". |
| N2 | 3.5 | The note's 참고문헌 with the library paper resolved. |
| L2 | 4.5 | 서재 → the paper → "내 연구에서 쓰인 곳" (note, Workflow, project). |
| L3 | 4 | "연결 지도 열기": paper → Workflow → project → note. |

Total ≈ 64 s.

## Visible text rules

Visible names "AI agent" and "GAID"; no Kady/K-Dense/BYOK except upstream attribution badges the app shows. Hide
nothing that changes meaning. No emoji, no fabricated responses: every message and result is the real one.

## Verification

Every frame exists at 2880×1620; first/last frames clean; no browser page errors; `study.json` ids resolve in the
review app; records outside the study unchanged (file list + mtimes of `~/.geoaidesk/projects/*/project.json`,
library items and hub entries other than the new ones, before/after).

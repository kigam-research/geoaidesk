# GAID promo capture (`capture-v1`)

Real-system takes for the promo film (contract `geo/promo/CONTRACT.md`, shot list v2 of 2026-10-23). Frames, stills and
`capture.json` live in `~/data/geoaidesk/work/gaid-promo-video/capture-v1/` (outside Git).

## Reproduce

1. Curated data copy (read-only from `~/.geoaidesk`, no credentials):
   `uv run --no-project python geo/promo/capture_data.py` → `~/data/geoaidesk/work/gaid-promo-video/home` and
   `capture-v1-data.json` (copied paths, adaptations, source digests).
2. Instance from this worktree on free ports:
   `systemd-run --user --unit gaid-promo-capture --working-directory=<worktree> --setenv=GAID_HOME=<home>
   --setenv=KADY_PORT=18320 --setenv=KADY_FRONTEND_PORT=3320 --setenv=PATH=$PATH --setenv=HOME=$HOME
   -p StandardOutput=append:<log> -p StandardError=append:<log> /bin/bash <worktree>/start-gaid.sh`.
   Basemap keys are read by the server from `~/.config/map_env/map-keys.env` (never copied or printed).
3. Takes: `uv run --no-project --with playwright==1.63.0 --with pillow==12.3.0 python geo/promo/capture.py [--only M1,R3]`
   (installed Google Chrome, 1280×720 CSS px at scale 2.25 → 2880×1620 frames, 30 fps film time; one shot per run
   merges into `capture.json`).
4. Contact sheet: `uv run --no-project --with pillow==12.3.0 python geo/promo/capture_sheet.py`.
5. Stop: `systemctl --user stop gaid-promo-capture`.

`capture_explore.py` is the exploration helper (screenshot + visible text of one screen).

## Shots (v2)

| id | frames | content | source |
|---|---|---|---|
| H1 | 150 | GAID 허브 home → registered Workflow (concept picture, 2판) → Workflow 단계 with step detail and skill | hub entry `entry-ap-a135f290-1c4` |
| R1 | 135 | Workflow panel → start settings: 입력 파일 → 분석 조건 (실행 규모) → 요약 보기 → hover 시작 초안 만들기 (not pressed) | project Yilgarn 니켈 탐사 우선순위 (`proj-035916`) |
| R2 | 120 | Stored chat started from a hub Workflow: AI agent result card (QC checks) with the result figure `outputs/variogram_fit.png` open | `proj-035916` session `01a14daa…` |
| R3 | 120 | Notes list (결정할 일, 검토 전) → note 서울 1:25만 암상도 … 면적표 → decision block, 권장 option picked (not sent) | `review-notebook` |
| R5 | 105 | LAS depth viewer, `25_9-1.las` (GR, RHOB, NPHI, DTC), pointer along the tracks | `proj-bc576f` |
| M1 | 165 | Shapefile viewer, `Seoul_Geology_250K_Litho.shp` coloured by LITHONAME on NGII 바로e맵 영상지도; KIGAM 1:5만 지질도 overlay switched on and off; polygon click → attributes | `review-notebook` |
| M2 | 120 | Same layer: attribute table, 전체 레이어 면적표 for LITHONAME with 타원체 측지 면적 computed (`/geo/area-table`) | `review-notebook` |
| L1 | 150 | 내 연구 → 서재: folder 공간 검증 → paper → 내 연구에서 쓰인 곳 (project and notes with pages) | library copy |
| R6 | 180 | Research note with page citations `[@valavi2018, pp. 11–12]` → reference list built from the library | `proj-ca300f` |
| L2 | 135 | Library paper → 연결 지도 (1단계 → 2단계) | library + `proj-ca300f` |

Total 1,380 frames (46.0 s). Each shot starts and ends with ≥ 0.4 s of hold.

## Deviations from the contract

- H3 (hub skill shelf) skipped: the review data has no hub skill records (`pi-agent/skill-hub/shared/skills/` is empty).
- R2: no stored chat starts with a `<workflow>` block (all method chats predate the block form). The closest real chat
  is the one started from the installed hub Workflow's start settings (exposure `method:pu-conformal-zone-priority`);
  its first message is the older plain start text.
- R3: the note list has no 확인함 group (no note is marked confirmed in the data).
- L1: the library has one folder and three GAID-managed papers; no nested folders or Zotero items exist in the data.
- M1: the Fault and boundary layers were not added (time); basemap is NGII 영상지도 (satellite) with the KIGAM 1:5만 overlay.

## Adaptations (copy-only, recorded in `capture.json` → `data.adaptations`)

- Project names without `검토용 - ` / `수용 시험`: 문헌 근거 공간 교차검증, 25/9-1 검층 그림, 25/9-1 LAS 점검,
  Yilgarn 니켈 탐사 우선순위, 서울 지질도 암상 면적; other review projects hidden.
- Test personas 새연구자/새연구자2/새연구자3/Test → 연구자 이/박/최/정 (exact string values only).
- Authoring draft title `my-paper` → PU 학습 광상 부존 가능성 논문; library folder `수용 시험 - 공간 검증` → 공간 검증.
- Pi session header `cwd` rewritten to the copied sandbox (Pi lists only sessions whose header matches).
- DOM: the status words `연결 안 됨` (composer model chip) and `Zotero 연결 안 됨` are hidden, because the capture
  instance has no credentials or Zotero connection file.
- Never copied: `auth.json`, `config.env`, `mcp-auth.json`, `connection.json`, `.venv`, library `secrets/`, `zotero.json`.

## Verification (2026-10-23)

All frames exist at 2880×1620 (checked per shot in `capture.json` → `verification`); browser errors: none; blocked
requests: none (non-GET calls were only `/geo/inspect`, `/geo/suggestions`, `/geo/vector-page`, `/geo/series-window`,
`/geo/area-table`); instance stopped; `~/.geoaidesk` file list with sizes and mtimes identical before and after
(`capture-evidence/geoaidesk-{before,after}.tsv`, empty diff).

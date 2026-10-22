# GAID promo video production contract

Task `gaid-promo-video`. Output: one 90-second promotional film, 1920×1080, 30 fps, exactly 2,700 frames, H.264,
no audio (both references were silent; recorded decision). Internal review only until the institutional brand/logo
approval (open item `gaid-release-proof#2`).

## Ownership

- Parent (`gaid-promo-video`): this contract, `render.py`, `scene/` (HTML/CSS/JS motion scenes), `data/` extraction,
  README, task document, report, integration and the final video.
- Capture child (`gaid-promo-video--capture`): `capture.py` (and helpers it needs, prefixed `capture_`), `CAPTURE.md`,
  and the external directories below. The child does not edit the parent's files.
- All payloads (copied app data, frames, video) stay outside Git under `~/data/geoaidesk/`.

## Capture instance

- A separate GAID instance started from the child's worktree with the GAID launcher, on free ports (not 3000/18000,
  which the shared review app uses; check `ss -ltn` first). `GAID_HOME` (and so `KADY_PROJECTS_ROOT`) =
  `~/data/geoaidesk/work/gaid-promo-video/home`. Run it with `systemd-run --user` and absolute paths, file logs; stop it
  when the take is accepted.
- Data: a curated copy of the review app's data (`~/.geoaidesk`, read-only source). Copy only what the shots need
  (hub store `pi-agent/skill-hub/`, the library under `pi-agent/research/`, selected projects, `models.json` without keys).
  Never copy or read `auth.json`, `config.env`, `mcp-auth.json`, `hub-server/connection.json`, `.venv`. No live model
  calls are needed: shots show stored chats, notes and hub records. Copy-only adaptations are allowed and recorded:
  project names without the `검토용 - ` prefix, a clean project list (hide test projects), test-persona names.
  Never change values, results or content.
- Korean UI, light theme, style 계측 (default). Viewport 1280×720 CSS px at device scale factor 2.25 (frames
  2880×1620), so app text reads larger in the 1080p film and the parent can zoom up to ~1.8× without blur.
- Legibility (user feedback 2026-10-23: "영상에서 카드박스나 글자가 너무작아도 안된다. 시인성을 생각하고 공간여백을 너무
  크게두어서 어색한부분이 생기는것을 조심해야한다."): every shot gives 1–3 `focus` rects on the readable region the parent
  zooms into; keep pointer actions inside them; prefer screens whose content fills the frame.

## Take interface (`capture-v1`)

Directory `~/data/geoaidesk/work/gaid-promo-video/capture-v1/`:

- `shots/<id>/frame-%05d.png`, 2880×1620. Frame index i = i/30 s of that shot (film time, not wall time; edit out
  loading and waiting, record what was cut).
- `capture.json`, schema `gaid-promo-capture-v1`: `fps: 30`, `width: 2880`, `height: 1620`, `css: {width:1280,
  height:720, scale:2.25}`, and per shot `{id, frames, pattern, url, actions: [{t, kind, target, rect}], focus:
  [{t, rect, label}]}` where rects are CSS-px boxes of the elements the parent may zoom to or highlight (cards, step rail,
  decision block, map canvas, depth track, citation). Plus data provenance: copied paths, adaptations, app commit.
- `stills/<name>.png` (2880×1620 or element crops at scale 2.25): clean frames and element crops the motion scenes reuse
  (hub card, concept picture, Workflow flow diagram, step list, research-note decision block, map, depth track,
  a real result figure from a project sandbox such as a PU zone map). List them in `capture.json` with their source.
- Frames show a smooth drawn pointer (no OS cursor) and a subtle click ripple; hover states must be real (move the
  real mouse along the same path). No full-frame camera jumps inside a shot; the parent does zooms.

## Shot list v2 (durations are targets; ±1 s is fine)

User requests 2026-10-23: "그리고 서재기능도 강조되어야한다. 최신기능들이 반영되어있어야한다." and "Gaid시스템에서 shp형식의
맵데이터 뷰어기능들도 소개되어야한다."

| id | s | What the shot shows |
|---|---|---|
| H1 | 5 | GAID 허브 home (sidebar, recommended cards) → the registered Workflow with concept pictures and 판 2 → its Workflow view. |
| H3 | 3.5 | Hub skill shelf: skill list → one skill with source, licence, check and review record (skip with a note if no records). |
| R1 | 4.5 | Workflow panel → start settings (입력 파일 → 분석 조건 → 요약), ends on the summary with the primary action highlighted (no send). |
| R2 | 4 | A stored chat started from a Workflow: Workflow block card and the AI agent's reply with a result figure. |
| R3 | 4 | Research notes → `2026-10-18-seoul-250k-litho-area-map` (review-notebook) with its decisions; pointer picks an option (no send). |
| R5 | 3.5 | LAS depth viewer on `25_9-1.las`: hover the tracks. |
| M1 | 5 | Shapefile map viewer: `Seoul_Geology_250K_Litho.shp` (+ fault/boundary layers if supported) on a basemap; pan/zoom, click a polygon for its attributes. Keys only server-side. |
| M2 | 4 | The shapefile's attribute table / area table for LITHONAME (or the note's `lithoname_area_table.csv` in the table viewer). |
| L1 | 5 | 내 연구 → 서재: nested folders, items (Zotero-linked or GAID-managed), a folder attached to a project. |
| R6 | 6 | A stored answer or note with page citations `[@key, pp. x]` and the reference list from the library. |
| L2 | 4.5 | Library paper → projects that used it → connection map (skip with a note if no data). |

Total ≈ 49 s. Extra hold (≈ 0.5 s) at the start and end of each shot helps transitions.

## Visible text rules

Visible names "AI agent" and "GAID"; no Kady/K-Dense/BYOK in frames except upstream attribution badges the app shows.
Hide nothing that changes meaning (status words, limits); hide machinery only where the app already would (UI guide
section 10). No emoji, no fabricated responses.

## Verification

Every frame exists and has the declared size; first/last frames of each shot are clean (no spinner unless the shot is
about running work); no browser page errors; the instance was stopped; the source data in `~/.geoaidesk` is unchanged
(compare a file list + mtimes before/after).

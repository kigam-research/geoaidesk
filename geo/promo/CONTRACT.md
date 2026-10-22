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
- Korean UI, light theme, style 계측 (default). Viewport 1440×810 CSS px at device scale factor 2 (frames
  2880×1620), so the parent can downscale to 1080p and zoom up to 1.5× without blur.

## Take interface (`capture-v1`)

Directory `~/data/geoaidesk/work/gaid-promo-video/capture-v1/`:

- `shots/<id>/frame-%05d.png`, 2880×1620. Frame index i = i/30 s of that shot (film time, not wall time; edit out
  loading and waiting, record what was cut).
- `capture.json`, schema `gaid-promo-capture-v1`: `fps: 30`, `width: 2880`, `height: 1620`, `css: {width:1440,
  height:810, scale:2}`, and per shot `{id, frames, pattern, url, actions: [{t, kind, target, rect}], focus:
  [{t, rect, label}]}` where rects are CSS-px boxes of the elements the parent may zoom to or highlight (cards, step rail,
  decision block, map canvas, depth track, citation). Plus data provenance: copied paths, adaptations, app commit.
- `stills/<name>.png` (2880×1620 or element crops at scale 2): clean frames and element crops the motion scenes reuse
  (hub card, concept picture, Workflow flow diagram, step list, research-note decision block, map, depth track,
  a real result figure from a project sandbox such as a PU zone map). List them in `capture.json` with their source.
- Frames show a smooth drawn pointer (no OS cursor) and a subtle click ripple; hover states must be real (move the
  real mouse along the same path). No full-frame camera jumps inside a shot; the parent does zooms.

## Shot list (durations are targets; ±1 s is fine)

| id | s | What the shot shows |
|---|---|---|
| H1 | 6 | GAID 허브 home: recommended cards and topic folders; pointer opens a registered Workflow entry (prefer the one with concept pictures and 판 2) and its detail with flow diagram and steps. |
| H2 | 5 | Hub authoring draft: one question with its recommended option and 기타; pointer chooses; the draft's flow diagram / step list visible. |
| R1 | 6 | Project workspace → Workflow panel row → start settings (step rail 입력 파일 → 분석 조건 → 요약), ends on the summary with the primary start action highlighted (do not send to a model). |
| R2 | 5 | A stored chat that started from a Workflow: the Workflow block card and the AI agent's reply with result figure. |
| R3 | 5 | Research notes: list grouped 결정할 일/검토 전/확인함 → a note with a decision; pointer picks an option (do not send). |
| R4 | 4 | Map viewer with a real raster/vector sample (and basemap if the keys are readable server-side): pan or click a pixel. |
| R5 | 3 | LAS depth viewer on the sample well: scroll or hover the tracks. |
| R6 | 4 | Library / page citations: an answer or note with `[@key, pp. x]` citations and the reference list from the library. |

Total ≈ 38 s (1,140 frames). Extra seconds of hold at the start and end of each shot (≈ 0.5 s) help transitions.

## Visible text rules

Visible names "AI agent" and "GAID"; no Kady/K-Dense/BYOK in frames except upstream attribution badges the app shows.
Hide nothing that changes meaning (status words, limits); hide machinery only where the app already would (UI guide
section 10). No emoji, no fabricated responses.

## Verification

Every frame exists and has the declared size; first/last frames of each shot are clean (no spinner unless the shot is
about running work); no browser page errors; the instance was stopped; the source data in `~/.geoaidesk` is unchanged
(compare a file list + mtimes before/after).

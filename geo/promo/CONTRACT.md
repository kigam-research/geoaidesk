# GAID promo video production contract (v5)

Task `gaid-promo-video-v5` (v1–v3 contracts: git history of this file; v4 reused the v3 takes). Output: one ~100 s
promotional film, 1920×1080, 30 fps, H.264, silent, internal review only (open item `gaid-release-proof#2`).
It is a promotional film (user, 2026-10-23: "정직한 영상을 원하는 것이 아니라 홍보용 영상을 원하는 것이다."): choose takes for
visual quality; staging that the report records is allowed. Direction: task document `docs/tasks/gaid-promo-video-v5.md`
→ "Direction v5".

## Ownership

- Parent (`gaid-promo-video-v5`): this contract, `render.py`, `scene/`, README, task document, report, integration and the
  final video. All film work (layout, windows, highlight frames, tags, timing, render) is the parent's.
- Capture child (`gaid-promo-video-v5--capture`): new helpers named `capture_v5*.py`, a v5 section in `CAPTURE.md`, the
  takes in the review app and the external directory below. It does not edit the parent's files or the v3 takes.
- Payloads stay outside Git under `~/data/geoaidesk/work/gaid-promo-video-v5/`.

## Footage sources

- v3 takes (Pocheon magnetite PGI study, unchanged): `~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/`, see
  `CAPTURE.md` ("Takes", "Record IDs"). The parent re-derives their highlight rects from the frames (whole UI regions).
- v5 takes (Yilgarn nickel MPM example, new): `~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5/`, shot list below.

## Review app rules for the v5 takes

Review app: PC74 `http://127.0.0.1:3000`, backend `:18000`, `GAID_HOME=~/.geoaidesk`, deployed main 7650e012, institute hub
server PC74 :8700. The parent told the hub before use and tells it after; the child does not restart, reconfigure or change
settings of `gaid-review` or the hub server.

- Revisit stored state only: no model runs, no chat messages, no Workflow start, no registration, no star, no comment, no
  install, no library or note edits. Every take is a revisit of records that already exist.
- Block writes from the capture browser: a Playwright route answers every `PUT`/`DELETE` and every `POST` that is not on an
  explicit read-only allowlist (map/inspection reads such as `/geo/inspect`, `/geo/vector-page`, `/geo/raster-*`,
  `/geo/series-window`; list the final allowlist in `CAPTURE.md`) without reaching the backend, and logs it. In particular
  `/geo/workspace-state` saves never reach the server (the Yilgarn project's last workspace must stay as it is).
- Never read or copy `auth.json`, `config.env`, `mcp-auth.json`, `hub-server/connection.json`.
- Before/after inventory (paths, sizes, mtimes, sha256) of `~/.geoaidesk/projects/yilgarn-cd7814/` (excluding `.venv`),
  `~/.geoaidesk/pi-agent/research/library/` and `~/.geoaidesk/pi-agent/skill-hub/`; report any difference.

## Capture

- Installed Google Chrome via Playwright, viewport 1280×720 CSS px, device scale factor 2.25 (frames 2880×1620), Korean UI,
  light theme, style 계측. Drawn pointer and click ripple as in v2/v3 `capture.py`; real hover; real clicks only on
  navigation and view controls.
- No scrolling inside a take; a needed scroll or navigation becomes a cut (record it). Hold ≥ 0.4 s at start and end.
- Choose window states where each featured region is fully visible inside the viewport.

## Take interface (`capture-v5`, schema `gaid-promo-capture-v2` plus `selector`/`region`)

- `shots/<id>/frame-%05d.png`, 2880×1620; frame i = i/30 s of shot time.
- `capture.json`: `schema`, `fps`, `width`, `height`, `css: {width:1280,height:720,scale:2.25}`, `app: {url, commit}`, and per
  shot `{id, frames, pattern, url, cuts: [{frame, removedSeconds, why}], actions: [{t, kind, target, rect}], beats: [{t0, t1,
  rect, label, region, selector}]}`.
- Beats are the parent's highlight frames, so their `rect` must be one whole UI region: the `getBoundingClientRect()` of one
  DOM element (a panel, card, dialog section, list, table, figure, legend or popup), or the union of whole sibling elements,
  measured in CSS px at the beat's state — never a hand-drawn rectangle and never part of an element. The element must lie
  fully inside the viewport (no clipping by the window or by a scroll container). `region` names it in words, `selector`
  records how it was found. 1–3 beats per shot, each ≥ 1.5 s, non-overlapping in time. `label` is a suggestion (≤ 18 chars).
- `stills/<name>.png` with their source in `capture.json`: the original `yilgarn_priority_map.png` and the PU-컨포멀 hub
  entry's concept picture file (original bytes, as served).
- `beat-checks/`: every beat rect drawn on its midpoint frame plus contact sheets; inspect each one.

## Shot list v5 (Yilgarn; targets ±1 s)

| id | s | Shows | Beats (whole regions) |
|---|---|---|---|
| Y1 | 4.5 | GAID 허브 home: 추천 Workflow with the "PU-컨포멀 탐사 우선순위 존 분류" card and its concept picture → click folder 광상 부존 가능성(MPM) → the folder's Workflow list. | recommended card; folder list table |
| Y2 | 5 | That hub entry (`entry-ap-a135f290-1c4`): header card (title, version, author, picture, "내 프로젝트에서 시험", star) → cut to its Workflow 단계 / steps section (WorkflowView) in a state where it fits without scrolling. | header card; steps section |
| Y3 | 6 | Yilgarn project (`yilgarn-cd7814`): Workflow panel row "PU-컨포멀 탐사 존 분류 (새 지역)" (등록됨 · version) → start window 소개 → a stage page with `Yilgarn_GIS_DB.csv` bound and its conditions → 요약. Never press the start action. | panel row or intro; stage page inputs/conditions; summary |
| Y4 | 5 | The Yilgarn chat with history: the Workflow card at the top of the conversation, then the AI agent's tool steps and a result figure in the chat. | Workflow card; tool steps or figure |
| Y5 | 5 | Map viewer on `outputs/yilgarn_priority_zones.geomap.json` (or the `.gpkg`) over OpenStreetMap: zones, legend; a click on a zone shows its original attribute values. | map with legend; value popup |
| Y6 | 6 | Research note `연구노트/2026-10-23-yilgarn-priority/index.md` in the notebook tab: title, headline/한눈에, the map figure, the zone table → the decision section with the recorded answer. | summary block; figure; decision |
| Y7 | 4.5 | 서재: the 광상 부존 가능성 folder → the `ahn2026` paper detail with "내 연구에서 쓰인 곳" (Workflow, project, note). | paper list; uses list |

Total ≈ 36 s; the parent trims and composes. A take that cannot show its state cleanly is reported, not faked.

## Visible text rules

Visible names "AI agent" and "GAID"; no Kady/K-Dense/BYOK except upstream attribution badges the app shows. Researcher-facing
"version", never "판". No emoji. Keep the app's own limits and statuses visible (예제 자료, 초안, 검토 전). No DOM text
substitutions; if a screen shows legacy wording (e.g. "판"), report it and pick another state.

## Verification

Every frame exists at 2880×1620; first/last frames clean (no loading or error overlays); no browser page errors; every beat
rect equals a whole element's bounds at that state (checked on the drawn midpoint frames); blocked-request log reviewed;
before/after inventories identical.

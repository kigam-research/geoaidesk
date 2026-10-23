# GAID review-app study capture (`capture-v2`)

Completed: 14 shots, 1,950 PNG frames, 65 seconds at 30 fps. All 31 feature beats have annotated midpoint
frames and visually checked bounds. The parent owns film integration and the canonical report.

Artifacts: `~/data/geoaidesk/work/gaid-promo-video-v2/`:

- `capture-v2/capture.json`, `shots/`, `stills/`, `contact-sheet.jpg`, `beat-checks/index.json` and 31 check PNGs.
- `study.json`: record IDs, models, usage, authoring attempts, timing, cuts, staging and output paths.
- `evidence-{before,after}.json`, `evidence-comparison.json`, `hub-{before,after}.json`: local stat inventories
  and remote hub snapshots. `prior-results.json` records copied input hashes. `note-final.json` records the final note.
- Alternative takes and live segment sources remain outside `capture-v2/shots/`.

## Delivered scenes

| Shot | Seconds | Recorded content |
|---|---:|---|
| L1 | 6 | Library folder, paper and its detail actions |
| L1b | 4 | PDF/DOI import dialog and bibliography export formats |
| A1 | 4 | Paper to Workflow source |
| A2 | 4.5 | Live interview question and actual selected answer |
| A3 | 4 | Seven-step draft and selected step instructions, below the fixed header |
| H1 | 4 | Actual registration dialog and newly registered Workflow |
| H2 | 4 | Institute hub entry, revision 1, author and project trial action |
| R1 | 6 | Installation consent, input preparation and Workflow start settings |
| R2 | 6 | Workflow card, real active citation-check tools, then the finished new figure |
| M1 | 5 | Neutral priority-zone map over OSM, legend and selected cell values |
| N1 | 5.5 | New note list, figure and actual new decision answer being sent |
| N2 | 3.5 | Note bibliography with the library paper resolved |
| L2 | 4.5 | Paper's project and research-note use links |
| L3 | 4 | Recorded library connection graph, one and two steps |

## Study results

The study created one folder (`lc-0a58cae5488a`), paper (`li-9c9d1be4e0ca`, key `ahn2026`), authoring draft
(`ap-33965983-5f2`), institute hub entry (`entry-ap-33965983-5f2`, revision 1), project (`yilgarn-cd7814`) and chat
(`01a166b1-256d-71f4-b5e3-53298806a36d`). Draft revision 2 passed the authoring check with no findings.

The final note is `연구노트/2026-10-23-yilgarn-priority/index.md`. Its figure is
`outputs/yilgarn_priority_map.png`; the viewer opens `outputs/yilgarn_priority_zones.geomap.json`, backed by
`outputs/yilgarn_priority_zones.gpkg`. Visible map title: `Yilgarn 탐사 우선순위 구역`.
The researcher chose `가) 최우선·우선순위 구역부터 검토합니다.`; the agent reflected the answer.
The bibliography resolves `ahn2026`. The app retains `형식 확인 필요` (`decision-format`) after the decision
is converted to prose; the parent explicitly accepted this badge.

### Models and usage

After two failures from the unconfigured default, the parent authorized the connected subscription picker.
Authoring used `openai-codex/gpt-6.1-sol` (medium); chat used `openai/gpt-6.1-sol`, OAuth subscription, shown as
`제공사의 구독 한도 적용`. Both resolve to GPT-6.1 Sol; the provider refs differ. Settings defaults and keys stayed
unchanged. Authoring attempts recorded `costUsd: 0`. Final chat ledger: 3,904,532 subscription tokens,
`totalUsd: 0`, `computeUsd: 0`; the separate list-price equivalent was USD 0.8187376, not a charge.

## Accepted staging and deviations

- The user prohibited training and the full pipeline. Five existing paper `zone_assignments.csv` files were
  copied byte-for-byte into this project's `user_data/prior_results/`. Source files were read-only.
  The short real run wrote a map, figure and cited note; no BaggingPU or other model training ran.
- The priority display retains classes 0–2: 588 immediate, 616 priority and 1,236 follow-up cells. Classes 3–4
  remain in the source but are omitted from the display. EPSG:3857 follows the parent's display instruction;
  it was not independently established from the CSV.
- R1 and the chat use existing Workflow `entry-ap-a135f290-1c4` revision 2 because new authoring was delayed.
  H1/H2 show the newly registered entry. The new draft's missing command examples were corrected through the
  normal authoring UI before registration. A temporary ineffective edit of its own cached record was restored.
- R2 combines the Workflow start view, a later actual read-only citation-check run, and the already finished
  new figure. The clean working segment shows real library/read tools and the working indicator. Earlier failed
  background-fetch steps are outside the chosen segment. This is an editorial sequence, not uninterrupted chronology.
- N1 cuts between the list, figure and decision panel; navigation and off-camera scrolling are excluded.
  L2/L3 were recorded before the redraw, so the graph's figure node has the earlier neutral filename.
- A3 shows the actual step flow/detail; the format pass is verified by API, outside its viewport. H1 starts at
  the registration dialog. L3 has five recorded nodes; the project is graph scope, not a separate node.
- Measured click-settle waits appear in `cuts`. `removedSeconds: 0` with `durationKnown: false` marks an unmeasured
  editorial cut, not zero waiting time. Authoring model waits are documented by attempt timestamps in `study.json`.

## Evidence and checks

All 27 pre-existing local domain/index records in the inventory have unchanged size and mtime. Expected new-folder,
link and automatic sync/Zotero bookkeeping changed. No Zotero setting was fixed. The remote existing Workflow's trial
count increased by one. An unrelated entry (`entry-ap-3b21b377-454`) changed from one star to zero during the session;
the study never opened or mutated it. Attribution is unknown; the parent was notified and it was not restored.

Artifact validation passed: all frame filenames and dimensions, shot/beat timing, Korean label lengths and CSS bounds.
All 31 rectangles were drawn at scale 2.25 on their midpoint frames and visually inspected, with at most 8 CSS px slack.
N1's figure rectangle follows its visible UI-clipped image; L3 follows the graph canvas. A3, dialog and map bounds
were corrected after animation/layout settling. No browser page errors were observed. Capture Chrome closed once
before final A3 and was replaced within the existing job; neither the review service nor hub was restarted.
The application test suite was not run: no application source changed. Python syntax and artifact checks passed.

```sh
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_verify.py
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_beat_checks.py
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_sheet.py --take ~/data/geoaidesk/work/gaid-promo-video-v2/capture-v2
```

## Capture procedure

The existing review app was `http://127.0.0.1:3000`, backend `:18000`, deployment
`ad9399d1da4fdd79e71d8159f2ec60907c7e9487`. Do not replay study creation: the records already exist.

1. The recorded controller job used `task job run -- uv run --no-project --with playwright==1.63.0
   --with pillow==12.3.0 python geo/promo/capture_study.py`. Resume its receipt if interrupted before starting;
   never launch a duplicate job. Its source snapshot predates the later helper fixes.
2. The loopback `/exec` controller runs bounded Python on Playwright's owner thread. Use real UI clicks and file
   inputs for study writes. The token gate uses the normal launcher link without printing or saving credentials.
3. Chrome uses 1280×720 CSS px, scale 2.25, Korean, light, 계측. `StudyTake` reuses v1's drawn pointer, real mouse
   interpolation and ripple. Static holds repeat one screenshot; changing pointer/ripple frames are captured separately.
4. Stage screens before recording. Keep scrolling off-camera; record an explicit cut when the layout changes.
   Measure beat bounds after animation, then inspect `capture_beat_checks.py` output. The frame set is 2880×1620.
5. `capture_stage.py` creates a new priority-only vector display from prior results in the already prepared
   project environment. It refuses to overwrite the vector file. Its CRS assignment is the instructed display choice.

No provider changes, credential-file reads, service restart, other-record edits or concept-picture calls were needed.

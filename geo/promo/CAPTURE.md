# GAID promo v3 study and captures

## Delivered result

Sixteen real-app takes, 2,175 frames / 72.5 s at 30 fps, are ready for the parent film writer at:

`~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3/`

Frames are 2880×1620 PNGs from 1280×720 CSS px at scale 2.25, Korean/light/계측, installed Google Chrome through Playwright. `capture.json` uses the agreed `gaid-promo-capture-v2` schema, contains all actions, cut boundaries and 36 feature beats, and identifies deployed app SHA `7650e012ebf3c0bcb20eed9ff115c2fb10c23553`. The six stills retain their sources in the manifest. No app code, service configuration or global model settings changed. The parent owns the final edit and report; this is its capture/evidence handoff.

The study created a four-stage Workflow from two papers, the supplementary script and six example inputs, registered version 0.1.0, ran the complete coarse comparison once, answered a note decision, saved the note in 서재, and registered a run-derived example-description improvement as version 0.1.1. The project's installed copy remains 0.1.0.

## Takes

| ID | Frames | Seconds | Recorded state |
|---|---:|---:|---|
| L1 | 150 | 5 | New two-paper folder, then Heo paper detail and existing uses. |
| L2 | 120 | 4 | PDF side panel, page 1 then page 3. Starts with PDF open. |
| A1 | 150 | 5 | Two library papers, supplementary code and data summaries. |
| A2 | 150 | 5 | Live question, marked PDF evidence, recommended answer, second source. |
| A3 | 120 | 4 | Four analysis stages and PGI procedure detail. |
| A4 | 105 | 3.5 | Examples attached per input, provenance and licence. |
| H1 | 135 | 4.5 | Patch/minor/major choice, six shared examples, actual 0.1.1 registration. |
| H2 | 105 | 3.5 | Registered title/version/author, star, comments link, trial action/count. |
| R1 | 135 | 4.5 | Start introduction, purpose/source papers, attach both papers. |
| R2 | 135 | 4.5 | Evaluation-stage example selected, summary, create chat draft. |
| R3 | 180 | 6 | Example Workflow card, actual ongoing tools, finished 3D figure. |
| M1 | 150 | 5 | Actual GeoTIFF over OpenStreetMap, legend and original pixel value. |
| N1 | 195 | 6.5 | Result-first note, figure, both papers' page citations, decision sent. |
| L3 | 120 | 4 | Note's 서재에 넣기 action, then library note list. |
| L4 | 120 | 4 | Paper's project/Workflow uses and note citation/page link. |
| L5 | 105 | 3.5 | Project-scoped connection map; paper, Workflows and note selection. |
| Total | 2175 | 72.5 | N1 is one second above target; other takes match target. |

Every take begins and ends with at least 0.4 s held. Pointer motion and click ripples are capture overlays; hovers and writes are real UI actions. Static holds reuse an actual screenshot. There are no mocked routes, fabricated results or DOM text substitutions.

### Cut boundaries and closest states

**Treat each manifest cut as an edit boundary.** The take files concatenate staged states for the editor; the final film should split at these boundaries to meet the no-scroll/no-jump rule. No scrolling is recorded. Minor click-settle waits and long model waits are omitted. Exact removed durations and reasons are in `capture.json`.

| Take | Cut frame(s) | Reason |
|---|---|---|
| L1 | 75 | Paper detail opens. |
| L2 | 60 | Page jump. |
| A2 | 75, 120 | Answer; manually select Astic evidence. |
| A3 | 60 | Select PGI stage. |
| R1 | 75 | Attach both source papers. |
| R2 | 60, 120 | Summary, then chat draft. |
| R3 | 60, 120 | Selected live tools after 132.29 s; finished result after another 1,328.22 s, including off-camera navigation. |
| M1 | 75 | Pixel-value popup. |
| N1 | 45, 90, 135, 150, 180 | Off-camera summary/figure/citations/decision positioning, select, send. |
| L3 | 60 | Add note, then 39.6 s off-camera navigation to library. Two events share this frame. |
| L5 | 60 | Select note node. |
| H1 | 45, 90 | Stage shared-file list off camera; register patch. |

A1/A4/L4/H2 have no cuts. The following limits affect the edit:

- L2 starts with the side-panel PDF already open; its opening click is not in the take.
- A1 shows the first two CSV summaries with the papers and code. All nine sources are verified, but do not fit simultaneously.
- A2's three final question anchors are verified. The generated options have no option-specific anchors, so choosing the answer does not automatically move the viewer; the Astic PDF page is selected manually. Initial quote-validation retries remain in authoring evidence.
- A3 shows the actual four-stage rail, not a separate generated diagram. Draft checks passed, but that badge is outside the captured stage viewport. A4 shows two example rows and part of a third; all six inputs have examples.
- R1 shows the purpose and two source papers; not every input/output fits that introduction viewport. Four method stages produce three setting pages because only stages with settings appear in the start rail. R2's newly created composer briefly has its default model; before sending the actual analysis, GPT-6.1 Sol/high was selected per action, visible in R3.
- R3's working section was recorded during the real initial run. A separate unselected 120-frame working alternative is archived under `R3-working-alternative/`; it includes a rejected Japanese notebook-tool draft that the agent subsequently corrected to Korean. The selected take uses earlier genuine tools after off-camera positioning, without text changes.
- M1 is a coarse 17×15 anomaly raster in EPSG:5186; the UI reports an unknown unit. The clicked original pixel is row 9, column 7, value 1217.0977783203125. No smoothing or unit-label substitution was applied.
- N1's embedded 3D figure is clipped by the real split-pane viewport. Its complete source is also delivered as a still. The decision was genuinely sent once; it started a same-session review of saved outputs, not another inversion.
- L3's route back to the library uses the project-list button, off camera. L4 includes prior uses as well as the new ones; those records were not edited.
- L5 has five recorded nodes: the paper, this note, this Workflow and two prior global Workflow links. The project is the map's scope, not a node. It cannot show a literal four-node paper→Workflow→project→note chain in this app.
- H1/H2 show 0.1.1, appropriate for an example-description patch. No minor feature update was invented to display 0.2.0.

### Stills

- `stills/workflow-stages.png`: real draft step-rail screenshot.
- `stills/result-map.png`: original `magnetic_maps.png` scientific figure.
- `stills/orebody-3d.png` and `stills/orebody-3d-probability.png`: original computed comparisons; empty/fixed-cell cases retained.
- `stills/map-viewer.png`: app PNG export with OpenStreetMap attribution.
- `stills/connection-map.png`: actual project-scoped library connection dialog.

## Record IDs

| Record | ID or path |
|---|---|
| Library folder | `lc-0b809e67ade8` — 포천 자철석 PGI |
| Heo paper | `li-79b57a297a46` / `heo2025` |
| Astic paper | `li-a313027670f8` / `astic2020` |
| Authoring draft | `ap-574620c7-44d`, final draft revision 8, nine sources |
| Analyze attempt | `att-81c3b674-cd8` |
| Draft attempt | `att-8e46fd29-b50` |
| Workflow | `pocheon-pgi-magnetic-trial` — 포천 자철석 광체 추정 |
| Hub entry | `entry-ap-574620c7-44d` |
| Hub folder | `folder-22af6f15d09010d0d68f6c931273acd9` — 지구물리 역산 |
| Registrant | `seongin`, `acc-6c937e14ce51b1ad68ae5be3f67b9e98` |
| Registered versions | 0.1.0 / revision 1 / draft 7; 0.1.1 / revision 2 / draft 8 |
| Project | `proj-af4c46` — 포천 자철석 광체 추정 |
| Session | `01a169b9-9c13-74e2-b9da-57749e4f1203` |
| Initial run | `run_7b452a64-faa7-4adf-ab82-2507b0a48395` |
| Note | `연구노트/2026-10-24-pocheon-pgi/index.md` |
| Note library item | `li-55a9e83b40d4` |

Version 0.1.0 package SHA-256 is `c70475e1b326f2dedb48e2894f0f47aec33388cc85e603bc9c9c56d83c9f0ab3`; version 0.1.1 is `b37a8b2c09bb3ed27398e42d3822ab89c67bee379269fa03fe00b980a8b90847`. Complete descriptors, digests, sources and hashes are in `study.json`, `authoring-final.json` and `hub-entry-final.json` under the payload root (one level above `capture-v3/`). All IDs were read back through the review app; the final note has two recognized paper citations and no parser problems, and remains 검토 전.

## Actual analysis and follow-up

The initial request was sent once at 2026-10-23 17:05:34 UTC (2026-10-24 KST). Source PDFs were read through the library; no `truth/` content was read, uploaded or bundled. Only the six named example files were supplied. `orebody_reference.csv` was withheld from fitting and opened for evaluation after selection rules/masks were frozen. Input hashes and the request are preserved in `input-files.json`, `analysis-request.txt` and `analysis-sent.json`.

The whole method remained: preprocessing and IGRF correction, conventional inversion, PGI-full/PGI-none with and without sample-cell geology, two boundary criteria, low-sensitivity exclusion before/after, comparison and interpretation. There were five models and 16 evaluation combinations. Researcher assumptions included a borehole-derived ROI +300 m, 50×50×25 m cells, 50 m observation aggregation, six outer iterations per model, CG 20/tolerance 1e-2, four CPU threads, normalized sensitivity cutoff .05 and a 600 s compute cap with no enlarged rerun. These were not truth-derived settings.

The reported pipeline stage times total **98.321 s**: prepare 7.381, invert 14.943, freeze 0.501, evaluate 22.665, figures 24.682 and validate 28.150. This is the sum of recorded stage timings, not model latency or environment/setup wall time. Preprocessing compatibility/time-unit errors were repaired before inversion. A PGI initialization compatibility error occurred after conventional inversion; the saved conventional model and sensitivity were reused and only unexecuted PGI work resumed. Later figure/validation repairs did not enlarge or repeat the model experiment.

There are 221 observations, 17,155 active cells, seven unanimous hard-prior sample cells and five conflicting cells left unconstrained. Eighty-nine of 271 cores map to terrain-inactive cells and were not moved to neighbours. All models reached the six-iteration cap without reaching the data target; PGI-none means collapsed. These outputs do not establish a converged orebody or resource estimate. Ninety-two internal checks passed, which is not independent scientific validation.

The result files are in `~/.geoaidesk/projects/proj-af4c46/sandbox/pgi_run/outputs/`: 11-band anomaly GeoTIFF, five-band depth-100 m susceptibility GeoTIFF (both EPSG:5186), vertical sections without a false CRS, maps, 3D comparisons, models, masks, metrics, timing and manifests. The note cites Heo PDF 3–4 and 7–9 (including p.4) and Astic manuscript PDF 10–12, 25 and 40, distinguishing PDF and printed pages.

The recommended note decision requested review of saved sample/active-cell mapping and GMM mean history. That review completed in **0.546 s** of recorded compute, without inversion or GMM refitting; hashes of protected models/masks/evaluation files stayed unchanged. It found 50 inactive samples at/below local DEM and 39 above it, and a padding volume fraction of 0.9961 in the mean-learning support. This does not isolate causes or prove a correction. Detailed outputs and protected-file hashes are in `pgi_run/review_sample_means/review_summary.json`. The final note marks the decision as history, while the app parser still displays its options. No further answer was sent.

The small real improvement was to the cores example title/provenance: users are told to check sample/active-cell mapping and exclusions, and not move samples to neighbouring cells. Draft 8 checks pass with the same dependency/import warnings as draft 7. All six final example descriptors retain the original input hashes/byte counts; data and method were not changed.

## Model and usage readings

All actual model actions used connected `openai-codex/gpt-6.1-sol`, OAuth subscription, reasoning high. No fallback model was used and no global setting was changed.

| Action | Recorded elapsed time | Input/output or usage | GAID charge |
|---|---:|---|---:|
| Analyze sources | 336 s | input 41,164; output 14,015 | USD 0 |
| Draft | 854 s, one automatic repair | input 117,686; output 40,102 | USD 0 |
| Initial analysis | Model/tool latency separate from compute | 6,833,750 subscription tokens; 6,608,512 cached | USD 0 |
| Saved-output decision review | Model/tool latency separate from compute | 4,764,521 subscription tokens; 4,691,456 cached | USD 0 |
| Final chat total | Both turns | 11,598,271 subscription tokens | USD 0; compute USD 0 |

GAID's final chat `listPriceUsd` estimate is 2.2375468 (initial 1.4835672 + review 0.7539796), **not a charge**. These usage readings include cached tokens and are not unique input text. Authoring readings are separate from the chat total. Raw receipts: `authoring-final.json`, `analysis-costs.json` (initial), `analysis-costs-final.json` and both history snapshots.

## Verification and outside-record comparison

- `capture_verify.py` passed: 16 shots, every consecutive frame exists at 2880×1620, 2–4 beats per take, each at least 1.5 s, non-overlapping, within the viewport, labels at most 18 characters.
- All 36 midpoint frames with drawn bounds were inspected in `capture-v3/beat-checks/`. Header and attachment bounds were tightened after inspection. First/middle/last contact sheets were inspected for all 16 takes; frames are stable and have no loading/error overlays.
- Browser `pageerror` count is zero. `browser-errors.json` retains the console resource errors as well; two unlocated 404 messages were observed, not page exceptions.
- Forty-seven preexisting file records and 49 final file records were inventoried with paths, mtimes, sizes and SHA-256. All 18 old project metadata files, old local hub records and all unrelated library item files retained both hashes and mtimes. The new project and note item account for the two added inventory files.
- API comparisons show all eight old institute hub entries and all 18 old projects unchanged. The only new entry/project/note item are those above. Existing paper bibliography/coverage is unchanged; `collectionIds` adds the new folder and derived `used` counts reflect the new draft, registration, project and note.
- Expected aggregate changes: `collections.json`, the two source-paper item files (folder membership), `links.json` (new uses), and `zotero.json`. The latter's API-visible change is only `failedAt`, from an existing closed-Zotero connection retry (`ECONNREFUSED`); library version and last successful sync are unchanged. No Zotero write was requested. These service-maintained changes prevent a literal claim that every preexisting file byte stayed unchanged.
- Evidence: `evidence-before.json`, `evidence-after.json`, `evidence-comparison.json`, plus `hub-*`, `library-*`, `projects-*` snapshots. No unrelated record was repaired, renamed or removed.
- Job 2 `scripts/check` succeeded: backend 209 files/2,300 tests passed, one file/eight tests suite-skipped; frontend 204 files/1,289 tests passed; geo 58 passed/zero failures/one skip; environment imports and isolated production start/stop/restart smoke passed. The review app and institute hub were not restarted. Capture helper syntax and `git diff --check` were checked separately.

## Tools and safe re-verification

`capture_v3.py` is the persistent loopback controller, adapted from v2 `capture_study.py`; `capture_wait.py` only watches an existing own attempt/session and never starts model work. Controller job 1 closed normally with exit 0 after capture; its browser was closed and port 18339 is inactive. Watcher/check jobs 2–5 also exited 0. All receipts are in the child task document. Long-running work used `task job run`. Historical v2 instructions remain available in Git history.

To verify the delivered payload without starting a browser, registering anything or sending analysis:

```sh
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_verify.py --take ~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_beat_checks.py --take ~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_sheet.py --take ~/data/geoaidesk/work/gaid-promo-video-v3/capture-v3
```

Do not resend `analysis-request.txt`, recreate the study records, reinstall the updated Workflow into the existing project or restart app/hub services to reproduce a take. The results and frame payloads are retained externally; the parent can edit from them without the live controller.


## v5 Yilgarn takes (2026-10-24)

Seven real-app takes are ready in `~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5/`: 1,096 frames (36.533 s),
2880×1620, 30 fps, viewport 1280×720 at scale 2.25. They revisit the existing Yilgarn study in the PC74 review app,
`http://127.0.0.1:3000`, deployed main `7650e012`. Korean UI, light theme and 계측 style were selected in the isolated
browser profile. Tools: Google Chrome 156.0.8078.47, Playwright 1.63.0 and Pillow 12.3.0.
`capture_v5.py` reuses the v3/StudyTake pointer, click ripple and static-hold recorder without text masks.
The film parent owns selection and composition; these takes have no captions or film graphics baked in.

### Takes

| Take | Frames | Seconds | Off-camera cuts | Captured states |
|---|---:|---:|---:|---|
| Y1 | 135 | 4.500 | 1 | Recommended PU-conformal card, then MPM folder and all five Workflow rows |
| Y2 | 150 | 5.000 | 2 | Entry title/version/author/picture/actions, then the complete selected-step card |
| Y3 | 187 | 6.233 | 4 | Introduction, existing Yilgarn CSV selected, conditions, summary; no start action |
| Y4 | 159 | 5.300 | 2 | Collapsed original Workflow card, original tool sequence, structured result map |
| Y5 | 150 | 5.000 | 1 | Original GeoPackage on OpenStreetMap with legend/table, then original feature attributes |
| Y6 | 180 | 6.000 | 4 | Note summary, whole map figure, zone table, recorded answer and decision-status text |
| Y7 | 135 | 4.500 | 2 | Mineral-prospectivity paper table, then the complete paper uses card |

All takes hold 12 frames (0.4 s) at both ends. A cut removes navigation/scroll/loading time; no recorded action is a scroll.
`capture.json` records each cut's frame, omitted seconds and reason. The Y3 conditions page is an additional 18-frame
view between the input and summary beats. These are start-window settings only, not a replay of the previous calculation.
The selected system is Ni / 코마티이트. Its four undecided conditions remain undecided; the start action was never pressed.

### Whole-region beat geometry

Each single-element rect came directly from `getBoundingClientRect()`, with viewport and scroll-ancestor clipping checks.
The final Y6 rect is the union of two complete sibling elements. Values below are rounded for reading; `capture.json`
retains the measured precision. Selectors describe the actual Playwright locators.

| Take / beat | Region | Selector | CSS rect (x, y, w, h) |
|---|---|---|---|
| Y1 / 1 | Recommended PU-conformal Workflow card | `text exact PU-컨포멀 탐사 우선순위 존 분류 -> ../..` | 280, 272, 578.656, 348 |
| Y1 / 2 | MPM folder Workflow list, heading and all five rows | `text exact 이름 -> ../..` | 280, 272, 968, 352 |
| Y2 / 1 | Hub entry header: title, version, author, picture and actions | `button name 내 프로젝트에서 시험 -> ../..` | 297, 149, 934, 478 |
| Y2 / 2 | Whole selected Workflow step card including input examples | `text exact 단계 1 / 10 -> ../..` | 560, 116, 696, 568.625 |
| Y3 / 1 | Whole Workflow introduction and start-window rail | `role=dialog at Workflow 소개` | 180, 54, 920, 612 |
| Y3 / 2 | Whole input stage with existing Yilgarn CSV bound | `role=dialog at 입력 자료` | 180, 54, 920, 612 |
| Y3 / 3 | Whole summary with selected Yilgarn CSV and Ni/komatiite condition | `role=dialog at 요약` | 180, 54, 920, 612 |
| Y4 / 1 | Whole collapsed original Workflow card | `button aria-label starts Workflow · PU-컨포멀` | 712.359, 120, 424.906, 32 |
| Y4 / 2 | Whole original tool sequence for creating and checking the map | `text exact outputs/yilgarn_priority_map.png:last -> ../../..` | 667, 132.375, 557.641, 356 |
| Y4 / 3 | Complete original map figure in structured chat result | `article containing h3 Yilgarn 니켈 탐사 우선순위 구역 -> img` | 681, 117.625, 529.641, 384 |
| Y5 / 1 | Whole map workspace with OSM, legend and original attribute table | `.gaid-map-body` | 0, 225, 1279, 495 |
| Y5 / 2 | Whole original feature attribute popup | `text exact 선택한 피처의 속성 -> ../../..` | 582, 233, 288, 218 |
| Y6 / 1 | Whole 한눈에 research-note summary table | `[data-streamdown=table-wrapper]:first` | 159.5, 311, 960, 248 |
| Y6 / 2 | Whole map figure in the research-note viewer, resized by real pane controls | `img alt exact Yilgarn 니켈 탐사 우선순위 구역입니다.` | 289, 347, 332.984, 346.859 |
| Y6 / 3 | Union of whole decision-status heading and paragraph; recorded answer remains in the completed-work list above | `h1 text exact 결정할 일 + following-sibling::p[1] (whole sibling union)` | 159.5, 648.125, 960, 54 |
| Y7 / 1 | Whole paper table in the mineral-prospectivity folder | `visible table:first after folder 광상 부존 가능성` | 260, 374, 636, 180 |
| Y7 / 2 | Whole paper uses card with project, note and two Workflow links | `text exact 내 연구에서 쓰인 곳 -> ../..` | 916, 274.5, 340, 274 |

The Y6 figure is 332.984×346.859 CSS px in the note viewer. Real file/chat pane controls and the supported maximum chat
width made the whole figure fit; no CSS zoom or image substitution was used. Its complete original pixels are also in the
still below. The original final-list rect excluded outside-painted bullets. It was replaced with the whole decision-status
heading and paragraph, remeasured in the identical scroll state (the list bounds matched exactly). The screen pixels were
not changed. `geometryChanges` and `elementRects` retain that check.

### Read-only protection and inventory

No messages, model runs, Workflow starts, uploads, installations, stars, comments, registrations, note/library edits or
service changes were requested. The controller closed both Chrome sessions normally; jobs 1 and 2 exited 0. The review app
and hub server were not restarted or reconfigured.

All PUT/DELETE requests and non-allowlisted POST requests were answered locally with HTTP 200 `{}`. The final helper also
blocks PATCH. No PATCH request occurred. Only these POST paths were allowlisted:
`/geo/inspect`, `/geo/result`, `/geo/vector-page`, `/geo/raster-window`, `/geo/raster-style`, `/geo/raster-point`,
`/geo/series-window`. The initial `/geo/result` attempt was blocked. After checking its read-only implementation in
`server/src/geo/routes/maps.ts`, it was explicitly allowed and the map reopened off camera.

| Request | Count | Outcome |
|---|---:|---|
| PUT /geo/workspace-state | 21 | Blocked locally; no save reached the server |
| POST /geo/suggestions | 7 | Blocked locally |
| POST /geo/result | 1 | Initial attempt blocked locally |
| POST /geo/inspect | 2 | Allowed read |
| POST /geo/result | 1 | Allowed manifest read |
| POST /geo/vector-page | 1 | Allowed attribute/geometry read |

Inventories cover the full Yilgarn project, library and skill-hub trees, excluding `.venv`, symlinks and prohibited secret
files/directories. They retain paths, sizes, nanosecond mtimes and SHA-256. Both inventories contain 1,641 files. There are
no added or removed files. Every Yilgarn project file, including its stored workspace, and every skill-hub file is unchanged.

One existing file changed: `~/.geoaidesk/pi-agent/research/library/zotero.json` (427 bytes before and after). Its SHA-256
changed from `0405d18850ea3c32c0f88ea96b97bfbe305add0b5610616a20cc5f55b7d1cfe1` to
`2190eabb76daf416e669da435fc196fcbe934c0a46ec3984add26e0a14110239`; mtime changed from
`1792806423589381789` to `1792807161988660357` ns. The app's GET `/geo/library` invokes `refreshIfStale()`
(`server/src/geo/routes/library.ts`); the Zotero service can update its state after a failed background refresh
(`server/src/geo/library/zotero-service.ts`). This is consistent with the observed Zotero refresh-failure notice.
The baseline retained hashes, not file contents, so the exact changed JSON field was not established. Thus the contract's
literal identical-inventory check is **not met**. No unrelated data was restored or edited to conceal this difference.
All other 1,640 files retain size, mtime and hash.

Evidence at the payload root: `evidence-before.json`, `evidence-after.json`, `evidence-comparison.json`, `requests.json`,
`browser-errors.json`; capture-specific checks are `capture-v5/verification-v5.json` and the manifest.

### Stills

- `stills/yilgarn-hub-concept.png`: original served bytes; source `http://localhost:18000/geo/hub/entries/entry-ap-a135f290-1c4/cover?revision=2`; SHA-256 `49ca4777d1b1d66eb760bcb880015698c4db338e5b34ee5cdc5e6b8055e7275a`.
- `stills/yilgarn_priority_map.png`: original file bytes; source `/home/seongin3/.geoaidesk/projects/yilgarn-cd7814/sandbox/outputs/yilgarn_priority_map.png`; SHA-256 `509e3805ea50dd0cd6ef095c0feb32af4bc578c5eaa70c29eea6767a50cb7fbc`.

### Visible limits and staging

- Y1's recommended PU-conformal entry belongs to the hub's 일반 folder. Clicking the MPM folder shows five other existing
  entries; no move, rename or implied new registration was made.
- Y2 and Y3 retain the existing ten-step, previous-format Workflow. Y3 therefore uses the app's input/conditions fallback
  pages. The legacy expanded chat instruction was not used because it contains `(1판)`; Y4's collapsed original card
  reads `version 0.1.0` and the installed Workflow in Y3 reads `version 0.1.1`. No text was substituted.
- Y4 shows the actual disconnected model chip and preexisting unsent composer draft. Neither was hidden, edited or sent.
  The app's scroll-to-bottom button remains over the lower white margin of the result figure. Tool rows are historical
  records, not new execution during capture.
- Y5 shows the existing viewer colours and legend as rendered, including its nodata entry; they were not replaced by the
  scientific figure's colours. The original click selected `priority_zones` feature 1414: index 42226, X 13610000,
  Y -3330000, zone 2, zone_name FOLLOW_UP, 구역 후속 검토 구역.
- Y6 retains 검토 전 and 형식 확인 필요. Its recorded choice is to inspect the immediate/priority zones first; no new answer
  was sent. The decision-status paragraph says the answer is already reflected and nothing else is pending.
- Y7 retains the existing Zotero refresh-failure status and the two preexisting global Workflow links. The uses card also
  shows the Yilgarn project and the note's p.14 citation. Its Workflow names are the app's original truncated paper titles.

### Verification and reuse

`capture_verify.py` and `capture_v5_verify.py` pass: all 1,096 consecutive frames exist at 2880×1620; all 17 beats have
region/selector evidence, last at least 1.5 s, stay non-overlapping within their take and fit the viewport. Both original
stills match their source hashes. All 17 drawn midpoint images were individually opened and inspected, along with every
take's first/middle/last contact sheet (updated Y4 separately). No selected first/last frame has loading or error overlays.
There are zero browser page exceptions. Three HTTP 413 console resource messages occurred while staging the stored
15.3 MB CSV; the selected takes do not show its preview-limit card. Original connection/status notices remain as above.

No automated app checks were run: this child changed capture helpers and evidence, not app code. Helper syntax,
`git diff --check`, frame checks and visual checks were run. The only unmet verification condition is the one-file
service-maintained inventory difference documented above. Parent integration and the final film are separate.

Safe offline checks (no browser or model work):

```sh
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_v5_verify.py
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_verify.py --take ~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_beat_checks.py --take ~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5
uv run --no-project --with pillow==12.3.0 python geo/promo/capture_sheet.py --take ~/data/geoaidesk/work/gaid-promo-video-v5/capture-v5
```

Use `capture-v5/` as the film input. Rejected alternatives `Y3-alternative-inherited-CuPGE-settings/` and
`Y4-alternative-no-tools/` remain one level above it and are not inputs to the film.

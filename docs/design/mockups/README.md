# GAID UI guide screen references

Three reference mockups and eleven Korean screenshots show the guide applied to existing screens. They do not
change the running app. Open `setup.html`, `map.html` or `method.html` in a browser; each file contains its own CSS,
script and data, with no external libraries, fonts or requests. The inlined theme variables come from
`geo/copy/gaid-app.css`. The installed system font supplies the Korean fallback.

The parent report is `reports/2026-10-16-gaid-ui-guide/index.md`. This child supplies its figures and this source
record; it does not create a separate report. Figure paths below are repository-relative.

## 1. Workflow setup

- Before: `reports/2026-10-16-gaid-ui-guide/figures/01-setup-before.png`.
- After: `reports/2026-10-16-gaid-ui-guide/figures/01-setup-after.png` and
  `reports/2026-10-16-gaid-ui-guide/figures/01b-setup-after-summary.png`.
- Reference: `docs/design/mockups/setup.html`.
- Rules: Q1–Q6, D2, B1, W5, L6, N2 and A1–A2 for the demonstrated controls.

The before image is a live capture of `TaskSetup` opened from the Workflows panel for the pinned catalogue's
`geo-map-and-crs` workflow. Source snapshot: `fed75bc3ff170276df0525c4f413253e861eee5e` (app source unchanged from
`2de915213e321bf527729d285f9a8342057fe9fb`). Catalogue: 0.2.1. The isolated project's only map input is a copy of
`user_data/samples/vector/seoul_geology_250k/Seoul_Geology_250K_Litho.shp` and its companions.

The five tabs cover input, area of interest, class field, area method and summary. Each decision has a recommended
first option and a final `기타 (직접 입력)` option. Direct input persists when navigating; an empty direct input blocks
Next. Arrow keys move between tabs. The summary offers Edit links and one disabled primary action, preserving
the captured missing-skills/missing-environment state. It does not claim that a draft was created or an analysis ran.

| Before content | After destination |
|---|---|
| All inputs and scientific conditions in one scrolling form | One decision per tab, followed by the summary |
| Long description and output/limit paragraphs | Four-box flow; summary disclosure `예상 결과와 한계 자세히` |
| Raw area method identifiers `projected-crs`, `geodesic` | `투영 CRS 지정`, `측지 면적` |
| CRS-unknown question shown for every input | Area-method details explain the conditional check; the sample has declared CRS |
| Repeated missing-skill text | One blocking line next to the summary action |

Recommendations apply to this sample, not every dataset: the existing file for input, full extent when no area
restriction is supplied, LITHONAME for a lithology map, and geodesic area when no calculation CRS is supplied. The
last choice is a proposed default for later implementation, not a catalogue-provided recommendation. A production
stepper must condition its CRS question on inspection and must not suppress it for an unknown or conflicting CRS.

## 2. Map and attribute table

- Before: `reports/2026-10-16-gaid-ui-guide/figures/02-map-before.png`.
- After: `reports/2026-10-16-gaid-ui-guide/figures/02-map-after.png`.
- Reference: `docs/design/mockups/map.html`.
- Rules: MAP1–MAP5, X1–X4, P2–P3, W5–W6, R1 and B4.

The before is a live capture from the same snapshot and sample as setup, with the conversation pane hidden,
LITHONAME categorical colours and FID 113 selected. Current file-task suggestions remain above the map; they consume
vertical space in the before image. No app elements were removed by a screenshot-only DOM edit.

The after embeds the actual 133 features returned by the isolated `/geo/vector-page` API in EPSG:3857. SVG coordinates
are rounded to a tenth of a display-coordinate unit after mapping the full extent to 1,000 SVG units. Attributes are
unchanged. This is display geometry, not an analytical replacement for the source. Colours use the app's existing
category hash and palette. FID 113 has `대보관입암류 화강암`, `중생대 쥬라기`, `Jgr`, `화강암류`; MAPIDX is missing. No
source EPSG authority was returned, so the original CRS stays `Transverse_Mercator`, not an inferred EPSG code.

| Before content | After destination |
|---|---|
| Layer, long legend and verbose metadata inside a tall panel | Fixed 320 px panel: layer, internally scrolling legend, four basic information rows |
| Sampling/internal display notes and full sandbox path | Omitted from the overview; extent and source/display CRS distinction remain behind `자세히` |
| Generic preview disclaimer including raster guidance on a vector | Relevant source/display distinction behind `자세히` |
| Online-basemap network note when no online basemap is selected | Omitted in this offline view |
| Long raw feature popup | Five labelled attributes and `모든 속성 보기` for the complete 22-field record |
| Twenty-two columns and long filter-scope explanation | Five default columns, column menu, one-line row state and scope tooltip |
| Full-layer area calculation form below the viewer | Separate task, outside this read-only inspection view |
| File-task suggestions above the map | Workflow navigation, outside the map's work area |

Sorting, per-column text filtering, selecting rows/features, the complete record, column selection, opacity and
zoom controls work locally. Filtering `암상명` by `화강` gives 37 of 133 rows, matching the source. Filtering changes
the table only. PNG export and More do not call the app; they report that this is a reference. The initial popup is
open for comparison; later feature clicks place it by the click, bounded by the map edges.

## 3. Method detail

- Before: `reports/2026-10-16-gaid-ui-guide/figures/03-method-before.png`.
- After: `reports/2026-10-16-gaid-ui-guide/figures/03-method-after.png`.
- Reference: `docs/design/mockups/method.html`.
- Rules: P1/P3, R1–R4, D2, G1/G2, F5, W5 and L6.

The before is reused unchanged from
`reports/2026-10-16-gaid-hub-integration/figures/02-method-detail-after.png`, recorded with the existing method and
trial in the report available at main `0679b17`. Its size is already 1440×900. A new paid or local model run was not
made for these mockups.

The method content and trial outcome come from that figure and
`reports/2026-10-16-gaid-hub-integration/index.md`. The trial stopped before the first block-size checkpoint; the
researcher assessed it as `수정 필요`. The observed files were `pyproject.toml` and `scripts/01_variogram.py`. No map,
priority list or successful method validation is invented.

| Before content | After destination |
|---|---|
| Five or more badges, repeated readiness and full method description | Three badges: draft, code included, revision needed; one context line |
| Tool-call/failure counts, model name, chat ID, raw workflow ID and revision enum | Omitted from the researcher overview; the app's original trial data is unchanged |
| Full outputs and trial detail stacked below workflow and recipe cards | Recent-trial summary and `결과 파일과 기록 보기` disclosure |
| Multiple start actions for method, workflow and recipe | One `시작 설정 열기` action; workflow/recipe details in a disclosure |
| Long scientific boundary paragraph | One visible `검토 전` limit and full boundary behind `해석 한계 자세히` |
| Assessment form mixed into the detail | Existing assessment shown behind `평가 보기`; no assessment writes |

The static reference links its start action to the separate setup reference. That reference demonstrates a map
workflow, so this link is a navigation demonstration, not the PU method's implemented setup. Original hub-check
receipts, provenance and assessment records remain in the real app; this prototype does not replace or modify them.

## Verification and scope

All seven main figures are 1440×900. Four additional `*-1280.png` figures cover each after view and the setup summary
at 1280×800. Every PNG is below 400 KB. The browser screenshots use CSS pixels with no downscaling or recompression.

| First-view check | Setup | Map | Method |
|---|---:|---:|---:|
| Visible UI characters, including labels/headings/actions, excluding supplied data and collapsed details | 197 | 262 | 270 |
| Page overflow, horizontal/vertical at both sizes | 0 / 0 | 0 / 0 | 0 / 0 |
| Primary action in the viewport at both sizes | Yes | Yes | Yes |
| Initial side panel requires scrolling at either size | — | No | — |

The count includes labels and headings, making it stricter than the guide's body-text budget. The map legend and
attribute table have their own scroll regions. Dialogs stay within 85% of viewport height with fixed footers. The
method detail initially shows its limit disclosure at 1280×800; opening longer details scrolls only its body.

Browser checks covered custom-answer persistence and validation, step arrows and summary, Escape, numeric descending
sort, the 37-row category filter, row selection, the full 22-field record, retained scientific limits and the separate
setup link. Status meaning is also written as text. UI text uses at least 12 px; visible secondary text uses the
body colour. Native control borders and missing-value text are darkened from token roles with `color-mix` for contrast.
This is a light-theme layout/reference check, not a release accessibility audit. Dark mode and 200% browser zoom
were not checked.

Declared checks:

- `node geo/ui/check-ui.mjs`: 0 errors, 96 existing accepted-debt entries, 0 resolved. No baseline was changed.
- `node --test geo/tests/ui-check.test.mjs`: 5 passed.
- The child brief does not require full `scripts/check`. Any additional repository-wide gate enforced by
  `task finish` is recorded in the CLI completion receipt, separately from the visual checks above.

These checks cover the existing locale/code rules, not the static HTML's text. Korean-only reference copy is inline
as requested; no application locale/catalogue strings changed, so there is no production ko/en string migration.

## Capture isolation and cleanup

The throwaway frontend/backend ran from the recorded snapshot, using existing installed dependencies, on ports
3347/18347. All user data and logs were under `~/data/geoaidesk/work/gaid-ui-guide--screens/`. The user's review
instances, `~/.geoaidesk` and the deployed app were not changed. Only the named sample's five source files were copied
read-only from the user data home.

The first browser connection was blocked because the capture launcher omitted its custom frontend port from the
backend's CORS configuration. The browser capture used a local Playwright request bridge to the same isolated API;
no app source or API response data was changed. Static mockups were served by Playwright route fulfilment, so their
rendering made no external requests. Direct file URLs are blocked by this automation tool.

Recorded job: `~/data/geoaidesk/runs/gaid-ui-guide--screens-20261016T084840.096516Z/receipt.json`. The capture process
stopped normally with exit 0 and released both ports. Its generated build cache and dependency links are in the job's
external source snapshot; the task worktree has no runtime cache or app-written files. They were removed after capture.
Browser evidence and replay snippets remain under `~/data/geoaidesk/work/gaid-ui-guide--screens/`.

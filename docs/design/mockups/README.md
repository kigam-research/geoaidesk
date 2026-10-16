# GAID UI guide screen references

Three static references and thirteen Korean PNGs show the revised guide on workflow setup, a map and a method detail.
The running application is unchanged. Eight after PNGs were replaced and two area-step PNGs were added in
`gaid-ui-guide--screens2`; the three before PNGs are byte-for-byte unchanged.

Open `setup.html`, `map.html` or `method.html` in a browser. Each contains its CSS, script and data without external
libraries, fonts or requests. Theme variables come from `geo/copy/gaid-app.css`; the installed system font supplies
the Korean fallback. The parent report is `reports/2026-10-16-gaid-ui-guide/index.md`. Paths below are repo-relative.

## Workflow setup

Source: `docs/design/mockups/setup.html`. Figures in `reports/2026-10-16-gaid-ui-guide/figures/`:

- `01-setup-before.png`: unchanged live capture.
- `01-setup-after.png` and `01-setup-after-1280.png`: input and readiness.
- `01b-setup-after-summary.png` and `01b-setup-after-summary-1280.png`: answers and disabled draft action.
- `01c-setup-after-area.png` and `01c-setup-after-area-1280.png`: area method, its reason and alternatives.

Rules: Q1–Q6, D1–D2, B1, W5–W6, L6–L7, N2, F5 and A1–A2 for the demonstrated controls. Agreed changes 7–12 are
addressed. Review references: researcher-persona §1b–d and top changes 2–3/5; Codex N2's sequence concern.

The step tabs are the only sequence: 입력 → 관심 지역 → 범주 → 면적 계산 → 요약. The sole existing file is a fact,
without `권장`; its projection-only CRS state and 133 features appear at selection. Both file questions use native
file choosers for `기타 (파일 선택)`. Field and area-condition questions retain free text. File selection and answers
persist across tabs; missing required input disables Next.

The first step names the disabled 범주 지도·좌표계·면적 표 skill and the unprepared GeoPandas environment, with
`필요한 스킬 켜기` and `환경 준비` controls. These controls report that the mockup does not change settings. The
same readiness condition remains next to the disabled `시작 초안 만들기` action. It does not claim a draft was
created or an analysis ran.

The area step explains that the calculation method changes the area. Geodesic area is explicitly a proposed
default when no calculation CRS is specified, not a recommendation supplied by the catalogue. The projection
alternative requires a calculation CRS. Selecting another file, whose CRS this static reference has not inspected,
adds `원본 CRS 확인` within the area step and requires the source CRS and its evidence before proceeding. The known
sample does not show that conditional input. This models the missing/unconfirmed-CRS branch; it does not inspect
uploaded files or infer their CRS. Production must use actual inspection and preserve the missing/conflicting-CRS
question.

Terms across setup and method: the flow is `시작 설정`, opening it is `시작 설정 열기`, its draft is `시작 초안`, and
the final action is `시작 초안 만들기`. The opening label follows the current `methods.setup` locale; `workflow`
retains its glossary meaning and the existing Workflow navigation label. Disclosures name their contents, including
`예상 결과와 한계 보기`. No production locale ids or ko/en strings changed: these Korean-only HTML references are
not application components.

The before image captured `TaskSetup` for catalogue 0.2.1's `geo-map-and-crs` workflow at
`fed75bc3ff170276df0525c4f413253e861eee5e` (app source unchanged from
`2de915213e321bf527729d285f9a8342057fe9fb`). The isolated project's only map input was a copy of
`user_data/samples/vector/seoul_geology_250k/Seoul_Geology_250K_Litho.shp` and its companions.

## Map and attribute table

Source: `docs/design/mockups/map.html`. Figures in `reports/2026-10-16-gaid-ui-guide/figures/`:

- `02-map-before.png`: unchanged live capture from the same snapshot and sample as setup.
- `02-map-after.png` and `02-map-after-1280.png`: revised map, panel and six complete table rows.

Rules: MAP1–MAP6, X1–X4, P2–P3, W5–W6, R1, B4, L6 and A1–A3 for the demonstrated controls. Agreed changes 1–6 are
addressed. Review references: Claude B1/N5; Codex N3; researcher-persona §2b–d and top changes 1/5.

The 320 px information panel spans the map and table height. The legend uses its free height, showing all classes
at 1440×900 and scrolling internally at 1280×800. `범례 14개` and `모두 보기` expose the complete legend without
silently clipping it. The source actually contains 14 distinct non-null LITHONAME values, including the literal
`0`. The previous generic missing-value legend entry was removed because no LITHONAME value in this sample is null.
Missing attribute values, such as MAPIDX, still display `결측값`.

The table has six complete rows at both sizes, five initial columns, per-column sort and 24×24 px filter controls.
Any additional columns can be selected, with horizontal overflow confined to the table; there is no 1–8 cap.
`암상명` is consistent across legend, popup and table, with `LITHONAME` available on hover. Other fields also retain
their raw names in tooltips. Numeric descending sort, filtering, row/feature selection and the full 22-field record
work locally. Filtering 암상명 by 화강 returns 37 of 133 rows. Sorting/filtering changes only the table.

The overlay toggle `KIGAM 1:5만 지질도` and `레이어 추가` are visible without opening settings. Adding a layer opens
a native file chooser. Actual layer loading, online overlays and PNG export are not implemented; controls explain
that limit without making external requests. Opacity, layer visibility, zoom and zoom-to-layer work locally. The
selected FID 113 has a blue outline and stronger fill, also reflected in its selected table row.

The scale bar tracks SVG zoom and resize. It labels display-CRS map distance, not ground distance; its tooltip
states that distinction. Cursor coordinates are derived from the SVG transform in EPSG:3857 and show metres.
The source row says `Transverse_Mercator · 투영법만 기록됨`. No source authority was returned and no EPSG code is
invented. Extent and the source/display distinction remain under `범위와 표시 조건 보기`; the PNG action explains
its display-only scope in a tooltip.

The embedded 133 API features, their attributes and SVG display geometry are unchanged. The source API returned
display geometry in EPSG:3857; coordinates were mapped to 1,000 SVG units and rounded to a tenth of a display unit.
This is not an analytical replacement for the source. Colours retain the app's category hash and palette. FID 113
has 대보관입암류 화강암, 중생대 쥬라기, Jgr and 화강암류, with missing MAPIDX.

## Method detail

Source: `docs/design/mockups/method.html`. Figures in `reports/2026-10-16-gaid-ui-guide/figures/`:

- `03-method-before.png`: unchanged reuse of the gaid-hub-integration detail figure.
- `03-method-after.png` and `03-method-after-1280.png`: workflow list and its adjacent detail pane.

Rules: D1/D3, P1/P3/P4, R1–R4, G1/G2, F5, W5–W6, L6–L7 and A1–A2 for the demonstrated controls. Agreed changes
13–16 are addressed. Review references: Codex N4; researcher-persona §3b–d and top change 4.

Method browsing uses a right-hand detail pane with a light shadow and no dim backdrop or modal focus trap. The list
stays usable beside it. The two package badges, `초안` and `코드 포함`, have tooltips. `연구자 평가: 수정 필요` is a
separate trial assessment. `KIGAM 방법 허브` replaces the raw source label `skill_hub`; PU and CV expand on hover.

The visible limit names the actual boundary: validation only in the Yilgarn Ni case; other geological settings are
unvalidated. `해석 한계 보기` retains the full boundary on deposit guarantees, pIQR's limited uncertainty scope,
exchangeability and spatial autocorrelation. It is visible without scrolling at both sizes.

The trial summary states the documented reason: repeated variogram calculation for more than 45 minutes led the
researcher to stop before the block-size checkpoint. Evidence: `reports/2026-10-16-gaid-hub-integration/index.md`,
section 3, and its unchanged before figure. The observed files remain `pyproject.toml` and `scripts/01_variogram.py`.
No successful method validation, map or priority list is invented.

`채팅 열기` opens an explicitly labelled connection mockup; it does not access the real chat. `기록 보기` contains
the read-only, selectable model name `kigam-qwen/qwen3.8-flash-next`, taken verbatim from the before figure, plus a
copy action, trial date and observed files. On an insecure static origin where Clipboard API is unavailable, the
copy action selects the value and explains the copy-shortcut fallback. The model name is absent from the overview.

`시작 설정 열기` links to the map setup reference as a navigation demonstration. It is not an implemented PU-method
setup. Original hub-check receipts, provenance, chat and assessment records stay in the real application. No new
paid or local-model run was made.

## Verification

Eight PNGs are 1440×900 and five are 1280×800. All thirteen are below 400,000 bytes; the largest new/updated PNG is
242,849 bytes. Browser captures use CSS pixels without downscaling or recompression. Steps 2 and 3, the conditional
CRS branch and the expanded model record were also checked; their extra evidence stays outside Git.

| Focused view | W5 body characters | All UI characters, including headings/controls |
|---|---:|---:|
| Setup input | 170 | 261 |
| Setup area of interest | 117 | 182 |
| Setup category field | 146 | 213 |
| Setup area method | 165 | 249 |
| Setup summary | 134 | 244 |
| Map main work area and information panel | 97 | 298 |
| Method detail pane | 213 | 300 |

Counts are identical at both sizes. The focused view excludes app chrome, the adjacent method list, supplied data
marked `data-user`, SVG labels and collapsed content. Text-node edges are trimmed; internal spaces and punctuation
count. Body counts additionally exclude headings, buttons, disclosure labels, select controls, metadata labels and
step tabs. The all-UI count retains those, so even that stricter count stays at or below 300. Cursor values, unlike
its label, are data and are excluded. The browser replay contains the exact traversal.

All captured views have zero horizontal/vertical page overflow and visible primary actions. All five setup steps
fit without body scrolling. The map panel itself needs no scrolling (698 px at 1440×900, 598 px at 1280×800); only
the legend and table have internal scroll. The method body also fits initially; expanding its records or scientific
boundary scrolls the body while keeping the start action fixed.

Checks against guide section 10 covered one primary action, density, grouped actions, scoped disclosures, hidden
internals, setup navigation, map legend/info, table controls, textual statuses, visible selection and keyboard focus.
Keyboard checks include step arrows, Escape, retained answers, numeric sort and row selection. The filter targets
measure 24×24 px with 8 px gaps from adjacent header controls. This is a light-theme reference review, not a release
accessibility audit; dark mode, 200% zoom and a formal contrast/greyscale audit were not run.

Declared checks:

- `node geo/ui/check-ui.mjs`: 10,562 strings, 0 errors, 102 existing accepted-debt entries, 0 resolved. No baseline changed.
- `node --test geo/tests/ui-check.test.mjs`: 5 passed.
- Playwright interaction/capture replay: passed, no page errors and no external requests.
- Source comparison: all three before PNGs, embedded attributes and map display geometry are unchanged.

The two repository checks cover application locale/code rules, not static HTML copy. No full `scripts/check`, new
app instance, new dependencies, application changes or deployment belong to this child brief. Any additional gate
required by `task finish` is recorded separately in the completion receipt. No guide exception or new baseline debt
was introduced by these references.

## Capture and replay

This revision used Playwright CLI route fulfilment at `http://gaid-ui.local/`, without a server. Browser state, scripts,
logs and intermediate captures are under `~/data/geoaidesk/work/gaid-ui-guide--screens2/`. There are no runtime caches
in this worktree. The user's review instances, user data home and deployment were not touched.

Replay from this task worktree (update the hard-coded worktree path in `verify.js` if relocated):

```bash
PLAYWRIGHT_MCP_OUTPUT_DIR=/home/seongin3/data/geoaidesk/work/gaid-ui-guide--screens2/playwright playwright-cli -s=screens2 open about:blank
uv run --no-project python /home/seongin3/data/geoaidesk/work/gaid-ui-guide--screens2/route.py
playwright-cli -s=screens2 run-code --filename /home/seongin3/data/geoaidesk/work/gaid-ui-guide--screens2/route.js
playwright-cli -s=screens2 run-code --filename /home/seongin3/data/geoaidesk/work/gaid-ui-guide--screens2/verify.js
playwright-cli -s=screens2 close
```

The previous before captures and original source-data preparation remain documented by
`docs/tasks/gaid-ui-guide--screens.md` and its external evidence folder
`~/data/geoaidesk/work/gaid-ui-guide--screens/`. Its isolated runtime job exited normally and released its ports;
this revision did not restart it.

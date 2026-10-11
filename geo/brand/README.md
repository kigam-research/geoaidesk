# GAID shared image assets

Shared assets for the GeoAIDesk site (WP08) and app (WP07). The user selected the **original orbital-G direction**
after seeing the desk-motif revision (2026-10-11: "이전 버전이 낫다. 이전버전으로 하자."). The desk motif is removed.
`GAID` remains the primary visible logo text, following the earlier abbreviation preference; `GeoAIDesk` remains the
full product name and secondary lockup. **Institutional branding clearance for public release is still pending.**

## Files and consumers

| Path within design/assets/ | Purpose |
|---|---|
| `logo/mark-{color,mono,on-dark}.svg` | Symbol alone, browser/app chrome |
| `logo/horizontal-{color,mono,on-dark}.svg` | Primary horizontal symbol + **GAID** |
| `logo/stacked-{color,mono,on-dark}.svg` | Primary stacked symbol + **GAID** |
| `logo/compact-{color,mono,on-dark}.svg` | Compact symbol + **GAID**, small app chrome |
| `logo/fullname-{color,mono,on-dark}.svg` | Secondary **GeoAIDesk** lockup for first mentions |
| `icons/favicon.svg` | Adaptive SVG favicon: brand on light browser theme, brandOnDark on dark |
| `icons/favicon-color.svg`, `icons/favicon-on-dark.svg` | Fixed-theme SVG favicons |
| `icons/favicon-32.png`, `icons/favicon-32-on-dark.png` | 32×32 transparent theme-specific PNG fallbacks |
| `icons/apple-touch-icon.png` | 180×180, opaque white, no baked-in rounded corners; `-on-dark` version uses ink |
| `icons/icon-192.png`, `icons/icon-512.png` | Opaque white app/PWA icons, purpose `any`; matching `-on-dark` PNGs use ink |
| `icons/icon-maskable-512.png` | Opaque blue/white, purpose `maskable`; `icon-maskable-512-on-dark.png` uses ink/brandOnDark |
| `domain/well-log.svg` | Depth scale and log trace |
| `domain/map-gis.svg` | Folded map, pinned Lucide source |
| `domain/pumping-test.svg` | Well, discharge and drawdown |
| `domain/geochemistry.svg` | Assay flask, pinned Lucide source |
| `social/og-{ko,en}.{svg,png}` | 1200×630 light social cards; `og-{ko,en}-on-dark.{svg,png}` uses ink canvas |
| `preview/concepts.png` | Three symbol directions at 16, 32, 64 and 256 px on white/ink |
| `preview/contact-sheet.png` | Final logo variants, icons and social cards on intended backgrounds |
| `preview/legibility.png` | Actual 16/32px raster samples, nearest-neighbour magnification and contrast |
| `preview/contrast.json` | Computed WCAG relative-luminance contrast ratios |
| `preview/review-notes.md` | Requested independent reviews and main-writer dispositions |
| `source/marks.json` | Generated geometric source for all three directions; selected key controls derivatives |
| `source/palette.json` | User-approved brandOnDark asset token; parent-owned shared-token promotion proposal |
| `scripts/prepare-marks.py` | Analytic mark geometry, flattened into transparent filled paths |
| `scripts/render.sh`, `scripts/render.py` | Reproducible external rendering and byte comparison |
| `manifest.json` | SHA-256 of generated files and original font; **not a PWA web manifest** |
| `licenses/` | Pretendard OFL and Lucide ISC/Feather MIT notices |

No logo SVG contains text, embedded bitmap, masks, filters, external references or a required font. Text is outlined.
Domain SVGs use a 24-unit grid, 2-unit `currentColor` strokes and round caps/joins, compatible with Lucide.

## Use rules

- Default on white: `color` (brand blue symbol **and lettering**). On ink: `on-dark` (lighter brandOnDark blue
  symbol **and lettering**). The user explicitly chose one shared lighter blue for the complete on-dark logo.
- `mono` is deliberately a single inherited colour; the contact sheet uses ink on white and white on ink. It is
  distinct from the blue on-dark family. Do not place the original all-blue `color` lockup on ink for text use.
- `mono` uses `currentColor`. Inline the SVG to inherit CSS color; an external `<img>` does not inherit the page's
  `color`. Supply an explicit accessible name at the component boundary, or hide decorative repeated icons.
- Keep aspect ratios. Do not skew, rotate, add gradients, glow, shadows or outlines, or detach/rearrange parts.
- Clear space: at least **8 units per 64-unit symbol box** on every side of a lockup. The mark box's internal inset
  does not replace surrounding clear space. Do not crop the supplied SVG viewBox.
- Minimum symbol file size: **16×16px** for browser/system chrome; **24×24px** in normal UI. At 16px the silhouette
  is the identifier; inspect the orbit details at 32px or larger. All lockup minima below refer to the **rendered
  SVG file**, not the visible ink or an internal mark box. Below those limits, use the mark alone.

  | File family | Intrinsic viewBox | Minimum rendered size |
  |---|---|---|
  | horizontal | 175×64 | 32px high (87.5px wide) |
  | fullname | 263×64 | 32px high (131.5px wide) |
  | compact | 146×48 | 24px high (73px wide) |
  | stacked | 104×124 | 100px wide (119.2px high) |

  Compact removes the old vertical padding; stacked fits the art with a small inset. The mark geometry is unchanged.
- Use `*-on-dark` app icons on ink-oriented product surfaces instead of placing the white-backed PNGs there.
  Both maskable variants keep all symbol ink inside the central circle of radius 40% of the canvas; the background
  fills the whole image. Do not apply an extra rounded mask to source artwork.
- Use adaptive `favicon.svg` as an external `<link rel="icon">` or `<img>` resource, not inline page markup:
  its internal `svg` media-query selector belongs to that isolated SVG document. For inline logo UI use the fixed
  logo files (including `mono` for inherited colour), not the adaptive favicon.
- Browser favicon SVG can follow `prefers-color-scheme`. Apple touch icons and installed PWA icons do not reliably
  switch automatically with the current page theme: choose one coherent icon set in each consumer's icon/manifest
  configuration. Supply the explicit dark variants where the consumer supports them; do not claim automatic OS switching.
- Social cards are complete opaque images. Choose the appropriate `og-ko`/`og-en` and light/on-dark file explicitly;
  link-preview crawlers do not apply the page theme to the image. Both languages have both backgrounds.
- Domain icons communicate task families, not availability or successful scientific validation. Pair them with labels.
- Keep the full-name alternate for first mentions where needed; do not rename the product to “GAID Desk”.

## Palette and contrast

Source: `design/gaid-tokens.json`, plus the user-approved asset extension `source/palette.json`:
`color.brandOnDark = #4d7fff`. Parent should promote this one token to the shared design tokens; that file is outside
this child's owned scope. Renderer uses the shared token when present, otherwise the explicit asset extension.
No KIGAM CI colour is added.

| Token pair | Ratio | Use |
|---|---:|---|
| `brand` #1f5eff / `canvas` #ffffff | 5.118:1 | Colour symbol, colour wordmark and social headline |
| `brandOnDark` #4d7fff / `ink` #0a0a0a | 5.464:1 | On-dark symbol, lettering and social headline |
| Original `brand` / `ink` | 3.869:1 | Not used for on-dark lettering |
| `ink` / `canvas` | 19.798:1 | Light-background mono wordmark |
| `canvas` / `ink` | 19.798:1 | Dark social description and white mono artwork |

Graphic threshold: 3:1. Wordmark threshold: 4.5:1. `muted` is used only for evidence-sheet notes on white. Pixel-edge
antialiasing is shown in the legibility sheet; ratios describe the specified solid colours, not every edge pixel.

## Rebuild

From the repository root on PC74:

```bash
# Regenerate geometry only after deliberately editing its construction:
uv run --frozen python design/assets/scripts/prepare-marks.py

# Render externally; source SVGs/domain icons stay in the repository:
design/assets/scripts/render.sh

# After visually reviewing the external outputs, copy the curated deliverables:
cp -a ~/data/skill_hub/work/gaid-design-copy--assets/rendered/. design/assets/

# Re-render and compare with the committed artifacts:
design/assets/scripts/render.sh --check
```

`render.sh` uses the existing project Python dependencies plus a transient `brotli==1.2.0` WOFF2 decoder. It changes
neither project dependencies nor `web/package.json`. Verified toolchain: fontTools 4.65.0, Pillow 12.3.0,
Playwright 1.63.0, Shapely 2.1.2, Chrome 155.0.8059.39 at `/opt/google/chrome/chrome`. Chrome must match for byte-exact
PNG reproduction. `--font`, `--chrome`, `--output` override local inputs; `TASK_DATA_DIR` overrides the default
`~/data/skill_hub`. The source font is external, not a runtime dependency of the delivered SVGs:

- `~/data/skill_hub/work/geo-byok-plan/figures-src/PretendardVariable.woff2`
- Pretendard version 1.309 (release 1.3.9), weight 650 outlines.
- SHA-256: `9599f12fd42fc0bce1cd50b47a0c022e108d7aa64dd0d1bb0ed44f3282d900b4`.

The social template reads `hero.title` and `hero.titleHighlight` from `design/copy/approved/{ko,en}.json` at each run.
Those catalogues still say GeoAIDesk and remain pending the user's final approval; this child does not edit copy.
The GAID logo is separate from the literal catalogue headline. Long titles fail when the template cannot fit them.

## Provenance

- Design model: **GPT-6 Astra, high**, native read-only `logo_geometry` contributor. It authored the three mark
  directions and reviewed the well-log/pumping-test geometry. The task writer integrated its geometry, outlined
  typography and produced deterministic derivatives. No image-generation model, raster tracing or paid evaluation
  was used. No Adobe templates or stock branding assets were used.
- Design brief: KIGAM-related G and earth ellipse; clean digital geometry; no gradients or generic AI glyphs; blue,
  ink and white tokens; compare at 16/32/64/256px. Follow-up: primary text **GAID**; a desk-symbol exploration was generated and then discarded at the user's request.
  Final user-approved colour refinement: lighter blue for both on-dark symbol and lettering, plus genuinely dark
  app icons and Korean/English social images. This is a theme derivative, not new model-designed geometry.
- Official KIGAM CI page: https://www.kigam.re.kr/menu.es?mid=a10206070000 (accessed 2026-10-11).
  The page describes an emphasized G and an earth-shaped ellipse. Originals were inspected but not traced or copied.
- Official reference images (same access date):
  - https://www.kigam.re.kr/main/img/sub/0206_1.jpg — SHA-256
    `8734abb9452c1972aa3ef7e0a82aae5d38ca27ce3805c00f131ef826d013a5b5`.
  - https://www.kigam.re.kr/main/img/sub/0206_3.jpg — SHA-256
    `80c031ad007bddec382ec5320e4e82ca01947498dfdf09b9669c8bfd98187756`.
- Original KIGAM files, rendered CI HTML and retrieval manifest remain outside Git under
  `~/data/skill_hub/work/gaid-design-copy--assets/ref/`. Chrome fetched them successfully after direct HTTP clients
  returned 400. `oracle-search` instructions were read, but no Oracle request was launched because browser retrieval
  resolved the known URL. No institutional login was used.
- `map-gis.svg` and `geochemistry.svg`: unchanged geometry from Lucide 0.577.0 (`map`, `flask-conical`), local Icon Wiki
  pin `20261007`; upstream https://lucide.dev/icons/. ISC and Feather MIT notices are bundled.
- `well-log.svg` and `pumping-test.svg`: custom geometry following the Lucide grid/stroke conventions, not upstream
  Lucide icons. Claude Fable 5.1/max proposed bounded clearance corrections; GPT-6 Astra/high visually reviewed and
  accepted them. The final well-log omits the crowded right border; the pumping arrow clears the static water line.
  The main writer applied these corrections, retaining the domain meanings and 24-unit/2-unit stroke system.
- Pretendard: https://github.com/orioncactus/pretendard/tree/v1.3.9, copyright Kil Hyung-jin, SIL OFL 1.1; licence
  fetched from that tag via GitHub API. Font outlines are embedded as artwork; no font file is distributed here.

## Rights and release status

KIGAM's logo is an institutional mark. **Public use of the KIGAM-derived GAID logo and of the KIGAM name requires the
institutional branding check in `docs/specs/geo-byok-plan.md` §1.2 before public release. No institutional approval is claimed.**
The geometric reinterpretation does not grant trademark rights or imply KIGAM branding clearance. The same section's
GeoAIDesk/GAID naming check remains separate. This task does not publish or deploy the assets.

## Design decision and evidence

**Selected: A, the original angular G with oblique orbit.** The faceted G retains the reference's geoscience initial;
the tilted ellipse preserves the earth/orbit relationship. The main label is GAID, not GAID Desk. The original
three-direction sheet is kept: B emphasizes a pixel grid but is noisier at 16px; C is softer and less architectural.
A has the strongest small-size G silhouette and an explicit digital construction without generic AI imagery.

Construction on a 64-unit grid: an 18-vertex filled G polygon, plus a tilted ellipse centred at (32,32), radii 29
and 14, rotation −27°, 4-unit stroke. A 2.5-unit transparent clearance separates the ellipse from the G. The two
resulting filled contours are flattened from analytic geometry, not traced from a bitmap. Details and sampling
precision are in `scripts/prepare-marks.py`. The original KIGAM artwork is not embedded.

The user's intervening request for a desk motif was explored as three alternatives (desk below G, desk sharing the
G crossbar, elliptical tabletop). The user then chose the previous version. Those furniture shapes and the unchosen
“GAID + Desk” wording are not shipped. The parent incorporates this delivery and the user's choice in its report.

Visual evidence: `preview/concepts.png`, `preview/contact-sheet.png`, `preview/legibility.png`. The latter shows
real 16/32px renders and nearest-neighbour zoom, not a large vector presented as a small-size test. The mark retains
its G silhouette at 16px; the separated orbit is clearer at 32px. All PNGs are well below the 5MB repository limit.

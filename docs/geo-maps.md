# Map inspection and map-plus-area outputs (WP05)

The map viewer is a read-only surface over project sandbox files. It uses OpenLayers for interaction and the same
`geo-inspection/v1` metadata that `geo_inspect` returns to the agent. It does not require an external basemap or a model
call; optional online basemaps are described in `docs/geo/basemaps.md`. Raster/vector source coordinates are never
rewritten for display.

## Display delivery (gaid-map-tiles)

Decision record: research and choice of OpenLayers + tiles in `docs/tasks/gaid-map-tiles.md` and the report
`reports/2026-10-12-gaid-map-tiles/index.md`.

- **View CRS.** A layer whose declared source CRS is projected and has an EPSG code (for example EPSG:5186/5179) opens
  in that CRS; the helper returns its PROJ string and the viewer registers it with proj4. Web Mercator (EPSG:3857) is
  selectable; geographic sources open in Web Mercator. Unknown CRS stays native/pixel, without basemaps or overlays.
- **Raster tiles.** `POST /geo/raster-style` returns the whole-raster display style once per layer/band/view CRS:
  full extent in the view CRS, source pixel size, colour range (2nd/98th percentile of an overview sample, or the
  classes of that sample for categorical display) and a source version. OpenLayers then requests
  `GET /geo/raster-tile?path&band&crs&bbox&size&low&high|categorical&v` for a deterministic grid: standard XYZ in
  EPSG:3857, otherwise one grid per layer extent (top-left origin, resolutions halving from one tile to a quarter of
  the source pixel). Tiles are 256 px nearest-neighbour PNGs, transparent outside the raster and for nodata/mask.
- **Pixel values.** A click calls `POST /geo/raster-point`, which reads the original file at full resolution (row,
  column, value or nodata). Tiles and colour ranges are display-only and never feed analysis.
- **Large rasters.** A raster over 2048 px without overviews gets a derived display overview VRT (nearest) in the
  map cache (`GAID_MAP_CACHE_DIR`, default `<GAID_HOME>/cache/maps`, else next to the skills cache; pruned oldest-first
  above `GAID_MAP_CACHE_BYTES`, default 4 GiB). The source file is never modified; the cache key includes its
  path, size and mtime.
- **Vectors.** The viewer first requests the whole layer (`full: true`: up to 20,000 features / 400,000 vertices /
  24 MiB) and draws it client-side without further requests. A larger layer falls back to the bounded viewport pages
  below (500 features per request). The attribute table pages the whole layer in the browser.
- **Workers and caches.** The backend keeps a pool of long-lived helper processes (`helper.py --serve`, JSON lines;
  `GAID_MAP_WORKERS`, default min(3, CPUs/2)) that keep datasets, CRS transformers and vector metadata open. A worker
  that exceeds its time/output budget is killed and replaced. Tile responses are cached in a 96 MiB in-memory LRU with
  in-flight de-duplication and sent with `Cache-Control: private, max-age=86400` under versioned URLs.

## Workflow

1. Open GeoTIFF, Shapefile, GeoPackage or GeoJSON in the sandbox file viewer. Ordinary TIFF falls back to the existing
   imaging viewer; OME-TIFF keeps the microscopy dispatch.
2. Select the vector layer (GeoPackage can contain several), variable or raster band. Add other project layer paths
   to overlay them. Source and display CRS remain separate. An unknown source CRS has native/pixel inspection only;
   it cannot be placed in a geographic overlay or used for area calculations without confirmed source metadata.
3. Pan/zoom, inspect a feature or a sampled raster pixel, and review the displayed attributes, legend, mask/nodata,
   extent and sampling labels. Display pages are not full analytical datasets.
4. For an area request, choose a polygon class field and an explicit method: geodesic on the source datum ellipsoid,
   or a suitable projected area CRS. Web Mercator is a display CRS, not the area default. The resulting numerical
   table is shown alongside the map and downloadable as CSV; the current rendered figure is downloadable as PNG.

Area sums feature areas by class; overlaps count twice. Percentages use summed feature area as denominator.
Invalid or non-polygon geometries are not silently repaired; calculations exceeding limits fail rather than return
an analytical table from a display subset. A fixture test is engineering evidence, not geoscientific validation.

## HTTP and helper contracts

Every route uses the active project (`X-Project-Id`/existing project scope); a body `projectId` never overrides it.
Paths are sandbox relative. The source and its implicitly read companion files must pass sandbox validation.

| Route | Input | Output |
|---|---|---|
| `POST /geo/inspect` | `{path}` | Shared metadata, CRS, layers/bands, issues, source fingerprint |
| `POST /geo/vector-page` | `{path, layer?, variable?, displayCrs?, bbox?, offset?, limit?, full?}` | Bounded GeoJSON features, attributes, legend, source/display CRS and preview scope; `full` = whole layer when within bounds |
| `POST /geo/raster-window` | `{path, band?, categorical?, displayCrs?, bbox?, width?, height?}` | Bounded PNG and matching sample values; null represents mask/nodata (kept for compatibility; the viewer uses tiles) |
| `POST /geo/raster-style` | `{path, band?, categorical?, displayCrs?}` | Whole-raster display style: extent, colour range/classes, source pixel size, version |
| `GET /geo/raster-tile` | query `path, band, crs, bbox, size (256/512), low+high or categorical, v` | One display tile (PNG) |
| `POST /geo/raster-point` | `{path, band?, displayCrs?, coordinate}` | Original-file pixel value at full resolution |
| `POST /geo/area-table` | `{path, layer?, classField, method, areaCrs?}` | Full-layer class areas in m², percentages and limitations |
| `POST /geo/result` | `{path}` | Validated map manifest with referenced-layer inspections |

Display bbox is `[minX,minY,maxX,maxY]` in display CRS. A declared source defaults to EPSG:3857 display; an unknown one
uses `native`. Requests accept EPSG identifiers or `native`, not arbitrary driver or network strings. Raster responses
have at most 256×256 pixels/samples; vector pages have at most 500 features and offset at most 100000. Python also bounds
geometry complexity, attributes, class counts and analysis feature counts. Categorical raster previews use nearest
neighbor. Non-COG rasters use backend windows rather than whole-raster browser downloads. GDAL may read source blocks
internally; this is an output/allocation limit, not a promise of a fixed on-disk byte count.

The helper (`server/src/geo/maps/helper.py`) reads one JSON stdin request and writes one JSON stdout response, or
with `--serve` one JSON line per request. The bridge uses the prepared uv helper environment, no shell or implicit
dependency installation; a bounded worker pool, 20 seconds/request (180 s for a style that prepares overviews) and
32 MiB per response. A failure is visible, never replaced by invented CRS or an empty success.

Inspection fingerprints include primary size/mtime, available Shapefile components, raster auxiliary/mask/overview/
world files and inspector version. They invalidate metadata identity when companions change; they are not content hashes.

## Map result artifact adapter

Write a small `*.geomap.json` file into the same existing project sandbox; all references are sandbox-root relative.
Do not embed raster arrays or the area table. The manifest limit is 64 KiB and 16 layers. Current source metadata is
checked on open, so a stale source CRS declaration cannot silently relabel a changed file. Existing research artifacts,
agent scripts and provenance stay in the existing project; this is not a second research-record store.

```json
{
  "schemaVersion": "geo-result/v1",
  "kind": "map-layer",
  "title": "Lithology map and area table",
  "layers": [{
    "path": "user_data/lithology.gpkg",
    "layer": "lithology",
    "variable": "rock",
    "sourceCrs": "EPSG:5186",
    "displayCrs": "EPSG:3857",
    "unit": "class",
    "legend": [{"label": "granite", "value": "granite", "color": "#aa7755"}],
    "nodata": null,
    "extent": [14000000, 4400000, 14200000, 4600000]
  }],
  "analysis": {
    "method": "Full-layer feature-area sum in EPSG:5186; overlaps counted twice",
    "tablePath": "results/area-table.csv",
    "scriptPath": "analysis/map.py"
  },
  "limitations": ["Source CRS and area CRS must be suitable for the actual dataset; this example is not a recommendation for all locations."]
}
```

The typed adapter lives in `web/src/geo/contracts/maps.ts`. The WP06 `geo-map-and-crs` skill can continue producing its
map, area table, CRS inventory and `run.json`; this small manifest optionally opens those project layers together.
The present package does not add a new chat-card protocol or rewrite WP06 skill output automatically.

## Evidence scope

`server/test/geo-maps.test.ts` covers project scoping, request bounds, companion invalidation and artifact references.
`geo/tests/maps-helper.test.mjs` generates synthetic known-answer fixtures outside Git for format, coordinate, area,
window and error checks. Viewer tests cover state/request interactions. Full integration is checked by `scripts/check`.
See the task's canonical result report for actual executed checks and browser evidence; this document is usage guidance,
not a claim that an arbitrary dataset, model route or operating system has been scientifically qualified.

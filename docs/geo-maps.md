# Map inspection and map-plus-area outputs (WP05)

The map viewer is a read-only surface over project sandbox files. It uses OpenLayers for interaction and the same
`geo-inspection/v1` metadata that `geo_inspect` returns to the agent. It does not require an external basemap or a model
call. Raster/vector source coordinates are never rewritten for display.

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
| `POST /geo/vector-page` | `{path, layer?, variable?, displayCrs?, bbox?, offset?, limit?}` | Bounded GeoJSON features, attributes, legend, source/display CRS and preview scope |
| `POST /geo/raster-window` | `{path, band?, categorical?, displayCrs?, bbox?, width?, height?}` | Bounded PNG and matching sample values; null represents mask/nodata |
| `POST /geo/area-table` | `{path, layer?, classField, method, areaCrs?}` | Full-layer class areas in m², percentages and limitations |
| `POST /geo/result` | `{path}` | Validated map manifest with referenced-layer inspections |

Display bbox is `[minX,minY,maxX,maxY]` in display CRS. A declared source defaults to EPSG:3857 display; an unknown one
uses `native`. Requests accept EPSG identifiers or `native`, not arbitrary driver or network strings. Raster responses
have at most 256×256 pixels/samples; vector pages have at most 500 features and offset at most 100000. Python also bounds
geometry complexity, attributes, class counts and analysis feature counts. Categorical raster previews use nearest
neighbor. Non-COG rasters use backend windows rather than whole-raster browser downloads. GDAL may read source blocks
internally; this is an output/allocation limit, not a promise of a fixed on-disk byte count.

The helper (`server/src/geo/maps/helper.py`) reads one JSON stdin request and writes one JSON stdout response. The
bridge uses the prepared uv helper environment, no shell or implicit dependency installation; four concurrent readers,
20 seconds/request and 8 MiB stdout. A failure is visible, never replaced by invented CRS or an empty success.

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

# LAS depth views and table semantics (WP04)

## LAS workflow

Open a `.las` file from the project file list. The self-fetching viewer uses the shared
`POST /geo/inspect` metadata contract, then `POST /geo/series-window`. No full raw file is
loaded into the text preview or a model context. No model call is made by these viewers.

- LAS 2.0 numeric logs only. Binary LiDAR LAS and LAS 3 are explicitly unsupported.
- The first LAS column stays the index; a second `TVD` or `DEPTH_MD` column is not substituted.
  MD/TVD/elevation remains unknown unless explicitly declared; no desurveying occurs.
- Original column names, parser-renamed duplicates, unit strings, finite coverage and NULL
  counts are in Inventory. Zero is a value; declared NULL and nonfinite values are blank.
- Source rows are 1-based logical numeric samples, **not** physical lines. This also applies
  to wrapped LAS. Data order is preserved, including descending runs and reversed passes.
- Each track has its own numeric scale and original unit. Depth increases downward. Lines
  break at missing values, duplicated/missing depth, large index gaps and reversals.
- Display reduction retains source-order bucket extrema, endpoints and missing/depth-break
  boundaries. If topology itself exceeds the cap, a contiguous source prefix is returned
  and labelled truncated. Display rows are not analysis data. Source-row pages remain exact.
- Header STRT/STOP/STEP comparisons use 0.001 in original index units. Missing depth units
  stay unresolved. Range/spike/enlargement screening is not performed by this viewer;
  imported flags are review candidates, not proof of invalid geology.

Limits: 64 MiB source; 128 named curves; one complete numeric table; 1,000,000 samples or
8,000,000 numeric values; up to 8 selected curves; up to 2,000 display samples or 200 exact
source samples per response; 30 s subprocess timeout; 4 MiB response. Larger datasets
require a format-aware analysis script. A size/mtime fingerprint is not a content hash.

### Depth result adapter

The dedicated suffix `.depth.json` opens `geo-result/v1` `depth-track` manifests through
`POST /geo/depth-result`. This WP04 adapter is LAS-backed; CSV-derived depth tracks and the
generic three-kind geo-result card dispatcher remain outside this slice. Existing result
artifact cards can link to a `.depth.json` just as to any project file. Original result
cards/history are unchanged. The source/code download links are project-scoped.

```json
{
  "schemaVersion": "geo-result/v1",
  "kind": "depth-track",
  "dataPath": "logs/well.las",
  "depth": { "column": 0, "unit": "M", "basis": "unknown" },
  "curves": [{ "column": 1, "unit": "API" }],
  "flags": [{ "kind": "spike", "fromRow": 125, "toRow": 125, "column": 1 }],
  "status": "raw",
  "sourceRow": 125,
  "codePath": "analysis/qc.py",
  "limitations": ["Candidate only; interpretation has not been reviewed."]
}
```

Paths are sandbox-root-relative, columns are zero-based, and source-row IDs are 1-based.
Units must match the source literally: the adapter does not convert units or rewrite values.
The file's basis and the manifest's declared basis are labelled separately. `raw`/`derived`
records the producer's declaration, not a provenance certification. Row IDs refer to the
current file: this adapter does not certify that the input has not changed since analysis.

Flag marks differ in shape and colour: missing ○, gap ═, duplicate □, reversal ↶,
range ●, spike ▲ and enlargement ◆. A track only marks flags represented by its displayed
samples; every manifest flag remains in the source-row link list, including omitted samples.
Clicking a flag opens the exact source row. Manifests are capped at 256 KiB and 2,000 flags.

## Checks

- `node --test geo/tests/well.test.mjs`: generated known-answer LAS fixtures, including
  multi-MB input, LiDAR, LAS 3, wrapped rows, unknown units, index NULL, duplicates,
  downward runs, spike preservation, missing boundaries and display caps.
- `cd server && npx vitest run test/geo-depth.test.ts`: path/limit checks, changing-source
  detection and manifest/source/code resolution.
- `cd web && npm test -- src/geo/viewers/depth/viewer.test.tsx`: line discontinuities,
  distinct marks, project-scoped exact-row links and metadata mismatch rejection.
- Optional licensed real-data concordance:
  `uv run --frozen --project server/src/helpers python geo/tests/force-concordance.py --asset <force2020_welllogs asset> --output <external task output>`.
  Inputs are named in `configs/inputs.toml`; do not copy them into Git. The two FORCE exports
  are from the same provider, not independent physical measurements.

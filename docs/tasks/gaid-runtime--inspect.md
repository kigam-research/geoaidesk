---
format: 1
status: active
updated: 2026-10-11T03:22:58Z
writer: {"boot":"02f44cdd-0481-4957-ab4c-2e8fc0942338","host":"seongin3","paseo":"c3f9df1b-1dd5-4a0a-a822-373c20d04da4","pid":3662480,"provider":"codex","session":"01a128e4-26db-75a0-b2fc-633122ae641e","start":"15340371","token":"24985bfef43fa5f7bac45a53c26cd688ccc83aae65ffd3b9f0ad66d153f353f8"}
branch: task/gaid-runtime--inspect
target: task/gaid-runtime
parent: gaid-runtime
---
# gaid-runtime--inspect

## Goal and done criteria
Request from the starter:

# Child brief: `inspect` — shared inspection, geo tools and read hints (GAID WP03)

Goal (WP03 done criteria): "useful file summaries" and "unsuitable large-file reads return a bounded next action",
from ONE inspector shared by the browser and the agent (plan §3.2, §3.8 "Large-file reading"). The 2026-10-10 trial:
a local model `read` a whole 5.8 MB LAS file and overflowed a 98K context; the file panel showed LAS as "too large",
a shapefile as binary garbage, and a GeoTIFF as "microscopy" (trial notes:
/home/seongin3/data/skill_hub/work/geo-byok-plan/trial/trial-notes.md, read-only; real sample files used there are under
/home/seongin3/data/skill_hub/work/geo-byok-plan/trial/ — use them only for manual checks, never copy them into the repo).

Contract: `geo-inspection/v1` in web/src/geo/contracts/inspection.ts (published; extend only additively).
Dispatch skeleton: server/src/geo/inspection.ts (`registerGeoInspector`, `inspectGeoFile`; keep the exports).

Deliver:
1. `inspectGeoFile`: resolve the path inside the project sandbox with the existing sandbox resolver (see
   server/src/sandbox-fs.ts / server/src/api/sandbox.ts; reject escapes and dot-dirs like the sandbox routes do), sniff
   the format from name + magic bytes, group companions (shapefile .shp/.shx/.dbf/.prj/.cpg by basename,
   case-insensitive), compute the fingerprint (size+mtime of every source file + inspector version; NOT a content
   hash), dispatch to the registered inspector, and always return a valid inspection with `issues[]` instead of
   throwing for unreadable content. Bounded work: never read a whole large file to answer (cap bytes read per file).
2. Baseline inspectors in TypeScript (no Python needed): LAS 2.0 header (~V ~W ~C ~P; version, wrap, NULL, STRT/STOP/
   STEP + unit, curves with units; LAS 3.0 → issue; depth basis `unknown` unless stated; bounded first data rows),
   shapefile (shape type and feature count from .shp/.shx headers, fields from the .dbf header, CRS from .prj WKT
   name/authority if present else `crs.status: unknown` with `missing-prj` issue; missing companions listed),
   TIFF/GeoTIFF (parse IFD0: size, samples, sample format/bits, GeoKeyDirectory/ModelTiepoint/ModelPixelScale/
   ModelTransformation present → `geotiff` with CRS from ProjectedCSTypeGeoKey/GeographicTypeGeoKey when simple, else
   plain `tiff`; BigTIFF → handle or issue), GeoJSON (bounded structural sniff: type, feature count when small,
   `crs` member or default WGS84 per RFC 7946 stated as such), CSV/TSV/text (size, header line, bounded rows, row
   estimate), GeoPackage (sqlite header + application_id; layer list from gpkg_contents only if you can do it without
   a native dependency, else an issue pointing to the Python helper).
3. Optional richer inspection via a Python helper `server/src/helpers/geo_inspect_helper.py` (pyogrio/rasterio/pyproj
   — the sibling child `env` adds these to the helper venv; until then they may be missing) following the existing
   helper contract (server/src/api/sci-helpers.ts: exit 0 ok / 3 deps-missing / 4 not-found / 5 bad-value / 1 other;
   run with `helperPython()`), used for GeoPackage layers and raster/vector CRS details; on exit 3 fall back to the TS
   result with an issue. Helper tests skip visibly when the modules are absent.
4. `POST /geo/inspect` `{ path, previewRows? }` in server/src/geo/routes/inspection.ts (stub exists; keep the export
   name), active-project scoped, 400/403/404 like the sandbox routes.
5. Agent tools in server/src/geo/tools.ts (`makeGeoTools`, keep the signature; registered for the lead through
   server/src/geo/session.ts already): `geo_inspect { path }` → compact text (≤ ~3 KB) + `details.inspection`;
   `geo_read_window { path, offset?, limit? }` → a bounded line/row window of a text, LAS or delimited file
   (hard caps e.g. 200 lines and 64 KB). Clear descriptions, promptSnippet and promptGuidelines (keep them short:
   every line costs context in every request).
6. Read hints in server/src/geo/read-hints.ts (`makeGeoReadHintExtension`, keep the signature): a `tool_call` hook on
   the built-in `read` tool. When the target is a recognized non-text geo file, or a text data file above a size
   threshold (constant, e.g. 256 KB) read without `limit` or with a large `limit`, return
   `{ block: true, reason }` where `reason` is a bounded summary (≤ ~2 KB) from the same inspector plus the next
   actions (geo_inspect, geo_read_window with arguments, and a short `uv run python` snippet for full-file analysis).
   Small or bounded reads pass unchanged. Do not try to police `bash` (state that limit in a code comment).
   Test the model-facing text: the hook's reason AND, if feasible with Pi's SDK in tests (look at
   server/test/data-guard.test.ts and other tests that drive a session/tool pipeline), that the blocked read reaches
   the model as a tool result containing that text.
7. Web: implement `web/src/geo/viewers/inspection-viewer.tsx` (default export, `ViewerProps`): fetch
   `POST /geo/inspect` with the active project (follow how other self-fetching viewers call the API, e.g.
   web/src/components/viewers/arraydata-viewer.tsx), render format/size, CRS status (unknown is shown as unknown,
   never guessed), extent, layers/fields, bands, curves (mnemonic/unit), depth, missing companions, issues, preview
   rows, sampled/truncated flags, and the inspector name/version. For category `geo-raster` with a non-georeferenced
   TIFF (`format: "tiff"`), render the upstream imaging viewer instead (lazy `@/components/viewers/imaging-viewer`),
   so microscopy TIFFs keep working. Strings in `web/src/geo/viewers/strings.ts` via `defineGeoStrings`. Vitest with
   mocked fetch for LAS, shapefile, GeoTIFF and plain-TIFF fallback.
8. Tests (server/test/geo-inspection*.test.ts, geo-read-hints.test.ts, geo-tools.test.ts) with small synthetic
   fixtures you generate (LAS 2.0 and 3.0 snippets, a 2-feature shapefile set with and without .prj, a tiny GeoTIFF
   with and without geokeys, plain TIFF, GeoJSON, CSV) — keep fixtures tiny or generate them in the test.

Out of scope: depth-track and map viewers (WP04/WP05 replace your generic viewer per category), windows/pages
endpoints beyond `geo_read_window`, skill exposure, environments.
Owned files: server/src/geo/{inspection,tools,read-hints}.ts, server/src/geo/inspectors/**,
server/src/geo/routes/inspection.ts, server/src/helpers/geo_inspect_helper.py, server/test/geo-inspection*.test.ts,
server/test/geo-read-hints.test.ts, server/test/geo-tools.test.ts, server/test/fixtures/geo/**, web/src/geo/viewers/**
(except registry.ts, which you may not change).
## Common rules for this child unit (parent: geoaidesk task gaid-runtime, WP03)
- Repository: kigam-research/geoaidesk (GeoAIDesk = GAID, fork of K-Dense BYOK). Read AGENTS.md and
  docs/tasks/gaid-runtime.md (section "Plan") in your worktree first. The plan source is skill_hub
  docs/specs/geo-byok-plan.md §3.2 and §3.8; a local copy is at
  /home/seongin3/data/geoaidesk/work/gaid-runtime/specs/geo-byok-plan.md (read-only).
- Network: raw.githubusercontent.com is blocked on the KIGAM network. Use
  `gh api repos/OWNER/REPO/contents/PATH?ref=REF -H "Accept: application/vnd.github.v3.raw"` if you need a GitHub file.
- The pinned geo catalogue archive is at ~/assets/geo-catalogue/0.2.0/geo-catalogue-0.2.0.tar.gz (read-only asset);
  an unpacked copy for reading is at /home/seongin3/data/geoaidesk/work/gaid-runtime/cat-0.2.0/ (environments.json,
  workflows.json, catalogue/index.json, runtime/skills/). Code loads it through `loadGeoCatalogue()`
  (server/src/geo/catalogue.ts); tests pass explicit options and must not depend on ~/assets (build a small fixture
  archive in the test, or skip visibly when the asset is absent).
- Settled interfaces you build on (do not change their signatures; ask the parent through your task document /
  final report if one must change): server/src/geo/{catalogue,catalogue-types,context,session,routes,inspection}.ts,
  web/src/geo/contracts/inspection.ts, web/src/geo/viewers/registry.ts, web/src/geo/i18n.ts (`defineGeoStrings`).
- server/vitest.config.ts sets `GAID_CATALOGUE=off` so upstream tests keep the upstream catalogue path; geo-mode tests
  set the env per test (and reset module state) or pass explicit options.
- GAID code lives in server/src/geo/, web/src/geo/. Any edit to an upstream file is a seam: keep it to the lines
  named in your brief and list every such file in your final report; the parent records them in
  geo/integration-boundaries.json (do not edit that file yourself).
- Visible UI strings: Korean first, English second, in a `strings.ts` next to your component built with
  `defineGeoStrings`; plain wording, no marketing claims, no claim that something is tested when it is not.
- Server style: match the surrounding upstream code (TypeScript run by tsx, typebox, fastify, vitest in server/test/).
  Tests deterministic, no network to model providers, no paid model runs. Put test fixtures under
  server/test/fixtures/geo/ (small files only, nothing over 200 KB).
- App data for manual checks goes under ~/data/geoaidesk/work/gaid-runtime/<your-slug>/, never inside the repo.
- Checks before finishing: `cd server && npm run typecheck && npx vitest run <your tests>`, `cd web && npx tsc --noEmit`
  and the web tests you touched, plus a full `cd server && npm test` once. Report exact commands and results; do not
  write "tests passed" for tests you did not run.
- Use the task CLI for saving/finishing (`task save`, `task finish`); your finish notifies the parent.

## Current state
- Shared dispatcher, TS baseline parsers, optional metadata helper, project-scoped POST route, geo tools,
  read hint extension and self-fetching viewer are implemented. No published signature/contract/registry changes.
- Verified: server typecheck; web tsc; targeted server tests 27 passed / 1 visibly skipped (optional geo modules
  absent); viewer tests 5 passed. The actual SDK session with a fake provider stream receives the blocked-read
  reason as its model-facing tool result (no model/network call).
- Manual read-only trial: 5,876,460-byte LAS → 21 curves, depth 25–3283.9641113 m, unknown basis, 872-byte
  blocked-read reason; shapefile → Polygon, 133 features, 22 fields and declared WKT (no guessed EPSG);
  GeoTIFF → EPSG:5186, float64 band. Outputs: pc74:~/data/geoaidesk/work/gaid-runtime/inspect/manual-check.json.
  Original samples were neither copied into Git nor modified.
- First `task finish` ran `scripts/check`: server typecheck and 1538 tests passed / 12 skipped; frontend
  893 passed / 1 unrelated existing LaTeX editor test timed out at 5 seconds under parallel load.
  The check script visibly excluded the 2 known PSI-MS vocabulary/network-dependent mzML tests.
  Log: pc74:~/.local/state/backbone/check-logs/beb99bb9d216ecd9/check-iclqrqyp.log.
  The failing LaTeX file passes alone (9 tests). Rerun `VITEST_MAX_WORKERS=4 task finish` without source changes;
  Vitest's installed config resolver explicitly honors that environment setting. Full checks remain pending.
  The attempted separate task job did not start: snapshot validation rejects the existing tracked `.env.example`.
  No source/config file was removed to bypass that guard and no job receipt was created.
  Safe targeted recheck: from server,
  `npm run typecheck` and `npx --no-install vitest run test/geo-inspection*.test.ts test/geo-read-hints.test.ts test/geo-tools.test.ts`;
  from web, `npx tsc --noEmit` and `npx --no-install vitest run src/geo/viewers/inspection-viewer.test.tsx`.
## Next steps
1. Rerun task finish with VITEST_MAX_WORKERS=4 (declared full checks), then record exact final results.

## Failed approaches
- Pi 1.0 does not export AuthStorage from its root SDK. The integration test now supplies an in-memory
  CredentialStore and fake provider stream through supported ModelRuntime/session APIs.
- An initial root-directory npx invocation selected an unpinned Vitest; it was stopped and all recorded
  verification commands were rerun inside server/web with the lockfile-pinned executables.
- `task job run -- bash -lc 'uv sync --frozen --project server/src/helpers --python 3.12.14 --python-preference only-managed && cd server && npm ci --no-audit --no-fund && npm test'`
  failed before starting because the snapshot guard rejects the repository's existing tracked `.env.example`.
  Use the task CLI's own finish/check path; do not change an unrelated tracked example or restart a missing job.
- Full check attempt 1: frontend `latex-editor.test.tsx` / "adds the root preamble for chapter AI edits and
  requires review before saving" exceeded 5000 ms; the rest of the web suite (893) and all server tests passed.
  `cd web && npx --no-install vitest run src/components/latex/latex-editor.test.tsx`: 9 passed.
  No implementation workaround or timeout change was made for that unrelated test.
## Notes and decisions
- Implementation is tightly coupled around one inspection result; no child writers or readers are needed.
- Sequential decisions: preserve published signatures; keep all parser IO under a per-file byte budget;
  reject unsafe paths before parsing; content failures become issues, request/path failures remain HTTP errors.
- Owned interfaces/files are those in the brief. No registry or other parent's seam edits are planned.
- Integration order: dispatcher + TS inspectors → optional metadata-only helper → API/tools/read hook → viewer.
- Bounds: TS inspection reads <=256 KiB/source file (including sniffing); preview <=50 rows; tool summaries
  <=3000 bytes; read hints <=2000 bytes; physical-line windows <=200 lines and <=64 KiB model text, with a
  <=4 MiB scan budget. Partial lines and scan limits are explicit. bash is intentionally not policed.
- Optional helper is metadata-only (no features/pixels); 5-second subprocess deadline, SQLite metadata row/progress
  limits, 128 KiB accepted JSON. Missing dependencies keep the TS result with an issue. BigTIFF has an explicit issue;
  Python may recover its CRS but baseline BigTIFF dimensions are not promised. LAS 3/wrapped/LiDAR are explicit issues.
- GeoJSON RFC 7946 default applies only to a complete bounded structure; large fragments retain unknown CRS/count.
- A TIFF is geo only when georeference tags exist; ordinary TIFF retains the upstream lazy imaging viewer.
- Upstream seam list for parent integration-boundaries: new `server/src/helpers/geo_inspect_helper.py` only;
  no existing upstream file was edited. Every other implementation file is under server/src/geo or web/src/geo.
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
Child contribution for the parent's canonical report (no separate child report):
- Delivered: one bounded metadata/preview result shared by HTTP, agent tools and the read hook; the browser now
  displays LAS curves/depth, vector companions/fields/CRS and georeferenced raster metadata. Plain TIFF preserves
  the imaging viewer. Unknown source CRS/depth basis is not guessed.
- Evidence: deterministic synthetic-format/path/budget tests, a real SDK blocked-read/tool-result test with a fake
  provider, project-scope route tests, mocked-fetch viewer tests, and the three original trial files read-only.
- Limitations: baseline LAS 2.0 only (wrapped/3.0/LiDAR issue); TIFF IFD0 only (BigTIFF issue); optional helper
  dependencies may be absent until child env is integrated; GeoJSON over the byte cap reports unknown count/CRS;
  physical-line samples do not substitute for full-data analysis; no bash interception or map/depth rendering.
- Integration: retain parent registration seams; add the new Python helper to integration-boundaries if required.
  Full regression outcome will be appended after the declared check finishes.
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

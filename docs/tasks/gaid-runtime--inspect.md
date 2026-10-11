---
format: 1
status: waiting
updated: 2026-10-11T02:56:36Z
writer: {"host":"seongin3","reserved":"24985bfef43fa5f7bac45a53c26cd688ccc83aae65ffd3b9f0ad66d153f353f8"}
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
(what is done, how it was verified, safe commands to re-verify)
## Next steps
1. (the next session's first action)
## Failed approaches
## Notes and decisions
(To close an existing ledger item when this top-level unit completes, add one literal `Closes: <slug>#<n>` line.)
## Open items
(user decisions, checks and accepted debt that outlive this unit, one line each:
`- [<kind>] <question> — 가) <option> — 나) <option> — 권장: 가) <why> — 막힌 일: <x> — 조건: <y> — 근거: reports/<folder>#<section>`,
kind 결정|확인|대기|선택|부채; task finish numbers them <slug>#<n> and carries them to docs/open-items/<slug>.md;
the project hub answers or closes them with `task item`)
## Report
(for a result the user reviews: `Report: reports/<date>-<topic>/index.md`, its one canonical report in Git,
written from backbone templates/report.md; none for workflow-only or trivial tasks, and none of its own for a
child unit, which adds sections to the parent's report. Dated snapshot; live status stays here.)
## Running jobs
<!-- task:jobs -->
<!-- /task:jobs -->
<!-- task:cloud -->
<!-- /task:cloud -->

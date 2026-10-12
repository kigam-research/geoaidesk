/** Real-GDAL known answers for the long-lived helper (`--serve`) and raster display tiles. Fixtures are temporary. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gaid-map-tiles-'));
const cache = path.join(temporary, 'cache');
const uvArgs = ['run', '--frozen', '--project', path.join(root, 'server/src/helpers'), 'python', '-I'];
const helper = path.join(root, 'server/src/geo/maps/helper.py');

/** One worker session: every request on its own line, replies in order. */
function serve(requests) {
  const input = requests.map((r, id) => JSON.stringify({ id, ...r, path: path.join(temporary, r.path) })).join('\n') + '\n';
  const result = spawnSync('uv', [...uvArgs, helper, '--serve'], { cwd: root, input, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GAID_MAP_CACHE_DIR: cache } });
  assert.equal(result.status, 0, result.stderr);
  const [ready, ...replies] = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(ready, { ready: true });
  assert.deepEqual(replies.map(r => r.id), requests.map((_, id) => id));
  return replies;
}
/** RGBA pixels of a returned tile, decoded independently with Pillow. */
function pixels(png) {
  const probe = spawnSync('uv', [...uvArgs, '-c', 'import sys,json,base64,io; from PIL import Image; p=Image.open(io.BytesIO(base64.b64decode(sys.stdin.read()))).convert("RGBA"); print(json.dumps([p.size, list(p.getdata())]))'], { input: png, encoding: 'utf8', timeout: 20000 });
  assert.equal(probe.status, 0, probe.stderr);
  const [[width], data] = JSON.parse(probe.stdout);
  return (x, y) => data[y * width + x];
}
before(() => {
  const result = spawnSync('uv', [...uvArgs, path.join(root, 'geo/tests/fixtures/maps_fixture.py'), temporary], { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('a serve worker answers in order and survives a failed request', () => {
  const [bad, good] = serve([{ path: 'classes.tif', operation: 'raster-tile', displayCrs: 'EPSG:32631' }, { path: 'classes.tif', operation: 'inspect' }]);
  assert.equal(bad.code, 5); assert.match(bad.error, /bbox/);
  assert.equal(good.result.asset.format, 'geotiff');
  assert.equal(good.result.crs.authority, 'EPSG:32631'); assert.equal(good.result.crs.projected, true); assert.match(good.result.crs.proj4, /\+proj=utm/);
});

test('categorical style, tiles and source pixels keep classes and nodata; outside the raster is transparent', () => {
  const [style, tile, half, inPixel, nodata, outside] = serve([
    { path: 'classes.tif', operation: 'raster-style', displayCrs: 'EPSG:32631', categorical: true },
    { path: 'classes.tif', operation: 'raster-tile', displayCrs: 'EPSG:32631', categorical: true, bbox: [0, 0, 40, 40], size: 16 },
    { path: 'classes.tif', operation: 'raster-tile', displayCrs: 'EPSG:32631', categorical: true, bbox: [20, 20, 60, 60], size: 16 },
    { path: 'classes.tif', operation: 'raster-point', displayCrs: 'EPSG:32631', coordinate: [15, 35] },
    { path: 'classes.tif', operation: 'raster-point', displayCrs: 'EPSG:32631', coordinate: [35, 35] },
    { path: 'classes.tif', operation: 'raster-point', displayCrs: 'EPSG:32631', coordinate: [45, 35] },
  ]).map(r => r.result);
  assert.deepEqual(style.bbox, [0, 0, 40, 40]); assert.equal(style.resolution, 10);
  assert.deepEqual(style.legend.map(i => i.value), [1, 2, null]);
  const color = value => style.legend.find(i => i.value === value).color.slice(1).match(/../g).map(h => parseInt(h, 16));
  // values row 0 = [1, 2, 1, nodata]; 16 px tile = 4 px per source cell.
  const px = pixels(tile.png);
  assert.deepEqual(px(1, 1).slice(0, 3), color(1)); assert.deepEqual(px(5, 1).slice(0, 3), color(2));
  assert.equal(px(13, 1)[3], 0); assert.equal(px(1, 1)[3], 255);
  // Tile [20,60]x[20,60]: left-bottom quarter covers source cells; the rest is outside the raster.
  const hx = pixels(half.png);
  assert.equal(hx(2, 14)[3], 255); assert.equal(hx(14, 2)[3], 0); assert.equal(hx(14, 14)[3], 0);
  assert.deepEqual(inPixel, { kind: 'raster-point', band: 1, inside: true, row: 0, col: 1, value: 2, sourceCoordinate: [15, 35] });
  assert.equal(nodata.value, null); assert.equal(nodata.inside, true);
  assert.deepEqual(outside, { kind: 'raster-point', band: 1, inside: false });
});

test('native (unknown CRS) tiles stay in source coordinates; geographic display warps with the shared stretch', () => {
  const [tile, style, warped] = serve([
    { path: 'native.tif', operation: 'raster-tile', displayCrs: 'native', bbox: [100, 160, 140, 200], size: 16, low: 1, high: 2 },
    { path: 'geographic.tif', operation: 'raster-style', displayCrs: 'EPSG:3857' },
    { path: 'geographic.tif', operation: 'raster-tile', displayCrs: 'EPSG:3857', bbox: [0, 0, 111319.49, 111325.14], size: 16, low: 1, high: 2 },
  ]).map(r => r.result);
  const px = pixels(tile.png);
  // Continuous ramp: low (1) and high (2) have fixed colours on every tile.
  assert.deepEqual(px(1, 1).slice(0, 3), [30, 70, 180]); assert.deepEqual(px(5, 1).slice(0, 3), [230, 220, 40]); assert.equal(px(13, 1)[3], 0);
  assert.equal(style.displayCrs, 'EPSG:3857'); assert.equal(style.low, 1); assert.equal(style.high, 2);
  assert.equal(warped.empty, false);
});

test('a large raster without overviews gets a derived display overview; the source file is unchanged', () => {
  const source = path.join(temporary, 'large.tif');
  const before = fs.statSync(source);
  const [style, tile, point] = serve([
    { path: 'large.tif', operation: 'raster-style', displayCrs: 'EPSG:32631', prepare: true },
    { path: 'large.tif', operation: 'raster-tile', displayCrs: 'EPSG:32631', bbox: [0, 0, 4096, 4096], size: 256, low: 0, high: 30 },
    { path: 'large.tif', operation: 'raster-point', displayCrs: 'EPSG:32631', coordinate: [300, 3700] },
  ]).map(r => r.result);
  assert.equal(style.overviews, true); assert.equal(style.needsOverviews, false);
  const derived = fs.readdirSync(cache);
  assert.ok(derived.some(f => f.endsWith('.vrt')) && derived.some(f => f.endsWith('.vrt.ovr')), derived.join(','));
  const after = fs.statSync(source);
  assert.equal(after.mtimeMs, before.mtimeMs); assert.equal(after.size, before.size);
  assert.ok(!fs.readdirSync(temporary).some(f => f.startsWith('large.tif.')), 'no sidecar next to the source');
  assert.equal(tile.empty, false);
  // Block (row 1, col 1) has value 2; the point is read from the source, not the overview.
  assert.equal(point.value, 2); assert.deepEqual([point.row, point.col], [396, 300]);
});

test('whole-layer vector display returns every feature or marks itself truncated', () => {
  const [all, paged] = serve([
    { path: 'points.geojson', operation: 'vector', full: true },
    { path: 'paged.gpkg', operation: 'vector', full: true, limit: 500 },
  ]).map(r => r.result);
  assert.equal(all.full, true); assert.equal(all.nextOffset, null); assert.equal(all.features.features.length, all.preview.totalFeatures);
  assert.equal(paged.full, false); assert.equal(paged.nextOffset, 500); assert.equal(paged.features.features.length, 500);
});

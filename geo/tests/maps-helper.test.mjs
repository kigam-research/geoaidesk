/** Deterministic real-GDAL known answers. Synthetic binaries are temporary, never tracked. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gaid-map-fixtures-'));
const uvArgs = ['run', '--frozen', '--project', path.join(root, 'server/src/helpers'), 'python', '-I'];
function run(script, args = [], input) {
  return spawnSync('uv', [...uvArgs, path.join(root, script), ...args], {
    cwd: root, input: input === undefined ? undefined : JSON.stringify(input), encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  });
}
function request(file, operation, extra = {}, expected = 0) {
  const result = run('server/src/geo/maps/helper.py', [], { path: path.join(temporary, file), operation, ...extra });
  assert.equal(result.status, expected, result.stderr || result.error?.message || result.stdout);
  if (expected) { assert.equal(result.stdout, ''); return result.stderr; }
  return JSON.parse(result.stdout);
}
before(() => {
  const result = run('geo/tests/fixtures/maps_fixture.py', [temporary]);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
after(() => fs.rmSync(temporary, { recursive: true, force: true }));
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('projected full-layer area is exactly 10000 m² per 100 m rectangle', () => {
  const result = request('rectangle.gpkg', 'area', { classField: 'class', method: 'projected', areaCrs: 'EPSG:32631', bbox: [0, 0, 1, 1], limit: 1 });
  assert.equal(result.scope, 'full-layer');
  assert.equal(result.totalArea, 20000);
  assert.deepEqual(result.rows, [{class: 'A', featureCount: 1, area: 10000, percent: 50}, {class: 'B', featureCount: 1, area: 10000, percent: 50}]);
  assert.equal(result.featureCount, 2);
  assert.equal(result.unit, 'm²');
  assert.ok(result.limitations.some(s => /Overlapping/.test(s)));
});
test('source/display coordinates agree with independent spherical Mercator oracle', () => {
  const result = request('points.geojson', 'vector');
  assert.equal(result.sourceCrs.status, 'declared');
  assert.equal(result.displayCrs, 'EPSG:3857');
  assert.deepEqual(result.features.features[0].geometry.coordinates, [0, 0]);
  const [x, y] = result.features.features[1].geometry.coordinates;
  close(x, 6378137 * Math.PI / 180, 1e-6);
  close(y, 6378137 * Math.log(Math.tan(Math.PI / 4 + Math.PI / 360)), 1e-6);
  assert.ok(result.issues.some(i => i.code === 'geojson-coordinate-interpretation'));
  assert.ok(request('points.json', 'inspect').issues.some(i => i.code === 'geojson-coordinate-interpretation'));
  const filtered = request('points.geojson', 'vector', { bbox: [100000, 100000, 120000, 120000] });
  assert.equal(filtered.features.features.length, 1);
  assert.equal(filtered.features.features[0].properties.number, 1);
});
test('GeoPackage lists multiple spatial layers and unsupported tables/rasters', () => {
  const result = request('multi.gpkg', 'inspect');
  assert.equal(result.layers.length, 2);
  assert.ok(result.issues.some(i => i.code === 'unsupported-table'));
  assert.ok(result.issues.some(i => i.code === 'unsupported-gpkg-content'));
  assert.match(request('multi.gpkg', 'vector', {}, 5), /Select a layer/);
  assert.equal(request('multi.gpkg', 'vector', { layer: 'points' }).features.features.length, 2);
  assert.match(request('multi.gpkg', 'vector', {layer: 'nope'}, 5), /does not exist/);
});
test('unknown Shapefile CRS stays native; companion selection resolves primary', () => {
  const result = request('missing.shp', 'inspect');
  assert.equal(result.crs.status, 'unknown');
  assert.ok(result.issues.some(i => i.code === 'missing-prj'));
  const page = request('missing.dbf', 'vector');
  assert.equal(page.displayCrs, 'native');
  assert.equal(page.sourceCrs.status, 'unknown');
  assert.match(request('missing.shp', 'vector', {displayCrs: 'EPSG:3857'}, 5), /Missing source CRS/);
  assert.match(request('missing.shp', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:32631'}, 5), /declared source CRS/);
  const broken = request('broken.shp', 'inspect');
  assert.deepEqual(broken.missingCompanions, ['broken.shx', 'broken.dbf']);
  assert.equal(broken.issues.filter(i => i.severity === 'error').length, 2);
  request('broken.shp', 'vector', {}, 5);
  assert.equal(request('unknown.gpkg', 'inspect').crs.status, 'unknown');
});
test('plain TIFF fallback differs from GeoTIFF including affine-only unknown CRS', () => {
  assert.equal(request('plain.tif', 'inspect').asset.format, 'tiff');
  assert.equal(request('classes.tif', 'inspect').asset.format, 'geotiff');
  assert.equal(request('identity-geotags.tif', 'inspect').asset.format, 'geotiff');
  const unknown = request('native.tif', 'inspect');
  assert.equal(unknown.asset.format, 'geotiff');
  assert.equal(unknown.crs.status, 'unknown');
  assert.equal(unknown.extent.coordinateSpace, 'native');
  const result = request('native.tif', 'raster', {width: 4, height: 4});
  assert.equal(result.displayCrs, 'native');
  assert.deepEqual(result.bbox, [100, 160, 140, 200]);
  assert.deepEqual(result.values[0], [1, 2, 1, null]);
  request('native.tif', 'raster', {displayCrs: 'EPSG:3857'}, 5);
});
test('categorical nearest-neighbor samples preserve classes and nodata; PNG alpha agrees', () => {
  const result = request('classes.tif', 'raster', {displayCrs: 'EPSG:32631', width: 8, height: 8, categorical: true});
  assert.equal(result.preview.width, 8);
  assert.equal(result.preview.height, 8);
  assert.deepEqual(new Set(result.values.flat()), new Set([1, 2, null]));
  assert.deepEqual(result.values[0], [1, 1, 2, 2, 1, 1, null, null]);
  assert.ok(result.image.startsWith('data:image/png;base64,iVBOR'));
  assert.deepEqual(result.bbox, [0, 0, 40, 40]);
  assert.deepEqual(result.legend.slice(0, 2).map(i => i.value), [1, 2]);
  const second = request('classes.tif', 'raster', {displayCrs: 'EPSG:32631', width: 4, height: 4, categorical: true});
  assert.deepEqual(result.legend, second.legend);
  const mask = request('mask.tif', 'raster', {displayCrs: 'EPSG:32631', width: 4, height: 4, categorical: true});
  assert.equal(mask.values[0][0], null);
  assert.equal(mask.values[0][1], 0);
  const rgba = request('rgba.tif', 'raster', {displayCrs: 'EPSG:32631', width: 4, height: 4});
  assert.equal(rgba.values[0][0], null);
  assert.equal(rgba.values[0][1], 100);
  // Decode the actual returned PNG independently with Pillow; values/null must match alpha.
  const probe = spawnSync('uv', [...uvArgs, '-c', 'import sys,json,base64,io; from PIL import Image; a=json.load(sys.stdin); p=Image.open(io.BytesIO(base64.b64decode(a["image"].split(",")[1]))); print(json.dumps(list(p.getdata())))'], {input: JSON.stringify(mask), encoding: 'utf8', timeout: 20000});
  assert.equal(probe.status, 0, probe.stderr);
  const pixels = JSON.parse(probe.stdout);
  assert.equal(pixels[0][3], 0);
  assert.equal(pixels[1][3], 255);
});
test('non-COG source uses bounded windows and capped grids; display warp preserves viewport', () => {
  const result = request('large.tif', 'raster', {displayCrs: 'EPSG:32631', bbox: [256, 3584, 512, 3840], width: 999, height: 999});
  assert.equal(result.values.length, 256);
  assert.equal(result.values[0].length, 256);
  assert.deepEqual(new Set(result.values.flat()), new Set([2]));
  assert.deepEqual(result.bbox, [256, 3584, 512, 3840]);
  const warp = request('geographic.tif', 'raster', {bbox: [0, 0, 111319, 111325], width: 8, height: 8, categorical: true});
  assert.equal(warp.displayCrs, 'EPSG:3857');
  assert.deepEqual(warp.bbox, [0, 0, 111319, 111325]);
  assert.deepEqual(new Set(warp.values.flat()), new Set([1, 2, null]));
});
test('vector pagination, field/geometry limits and display subset labels are explicit', () => {
  const first = request('paged.gpkg', 'vector', {limit: 999, displayCrs: 'native', variable: 'class'});
  assert.equal(first.features.features.length, 500);
  assert.equal(first.nextOffset, 500);
  assert.equal(first.preview.truncated, true);
  assert.equal(first.preview.sampled, true);
  const last = request('paged.gpkg', 'vector', {limit: 500, offset: 500, displayCrs: 'native'});
  assert.equal(last.features.features.length, 5);
  assert.equal(last.nextOffset, null);
  assert.equal(last.preview.sampled, true);
  assert.match(request('huge-geometry.gpkg', 'vector', {}, 5), /vertex limit/);
  const text = request('long-label.gpkg', 'vector');
  assert.equal(text.features.features[0].properties.class.length, 512);
  assert.ok(text.issues.some(i => i.code === 'attribute-truncated'));
  request('paged.gpkg', 'vector', {variable: 'absent'}, 5);
  request('paged.gpkg', 'vector', {offset: 100001}, 5);
});
test('area requires valid polygon CRS/method, converts feet and rejects partial-result limits', () => {
  request('rectangle.gpkg', 'area', {classField: 'class', method: 'projected'}, 5);
  request('rectangle.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:4326'}, 5);
  request('invalid.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:32631'}, 5);
  request('points.geojson', 'area', {classField: 'class', method: 'geodesic'}, 5);
  request('long-label.gpkg', 'area', {classField: 'class', method: 'geodesic'}, 5);
  assert.match(request('oversized.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:32631'}, 5), /100000 features/);
  const feet = request('feet.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:2227'});
  close(feet.totalArea, 10000 * (1200 / 3937) ** 2, 1e-6);
  const empty = request('empty.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:32631'});
  assert.equal(empty.emptyCount, 1);
  assert.equal(empty.featureCount, 2);
  assert.equal(empty.totalArea, 100);
});
test('ellipsoidal geodesic area matches fixed WGS84 known answers; holes subtract', () => {
  const result = request('geodesic.geojson', 'area', {classField: 'class', method: 'geodesic'});
  close(result.totalArea, 12308778361.469452, 0.01);
  const holes = request('holes.geojson', 'area', {classField: 'class', method: 'geodesic'});
  close(holes.totalArea, 9231614224.814976, 0.1);
  assert.match(result.limitations.join(' '), /WGS 84/);
});
test('boolean categories obey legend/area scalar contracts and agree with attributes', () => {
  const page = request('booleans.gpkg', 'vector', {variable: 'class'});
  assert.deepEqual(page.features.features.map(f => f.properties.class), ['true', 'false']);
  assert.deepEqual(new Set(page.legend.map(i => i.value)), new Set(['true', 'false']));
  const area = request('booleans.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'EPSG:32631'});
  assert.deepEqual(area.rows.map(row => row.class), ['false', 'true']);
  assert.equal(area.totalArea, 200);
});
test('normal request/source errors have concise stderr and defined exit codes', () => {
  request('absent.tif', 'inspect', {}, 4);
  request('classes.tif', 'nonsense', {}, 5);
  request('classes.tif', 'raster', {width: 0}, 5);
  request('classes.tif', 'raster', {band: 2}, 5);
  request('classes.tif', 'raster', {displayCrs: 'not-a-crs'}, 5);
  request('points.geojson', 'vector', {displayCrs: 'not-a-crs'}, 5);
  request('rectangle.gpkg', 'area', {classField: 'class', method: 'projected', areaCrs: 'not-a-crs'}, 5);
  request('classes.tif', 'raster', {bbox: [0, 0, 0, 1]}, 5);
  request('classes.tif', 'raster', {bbox: [1000, 1000, 2000, 2000], displayCrs: 'EPSG:32631'}, 5);
});

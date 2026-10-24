/** Maps helper known answers: rasters and projected area. Shared setup: maps-helper-common.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { request, close, uvArgs } from './maps-helper-common.mjs';

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

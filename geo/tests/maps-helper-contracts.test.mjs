/** Maps helper known answers: geodesic area, boolean categories, errors and non-ASCII paths. Shared setup: maps-helper-common.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { request, close, temporary, root, uvArgs } from './maps-helper-common.mjs';

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

test('a non-ASCII path reaches the helper intact when stdin is not UTF-8 (Windows code pages)', () => {
  // `python -I` ignores PYTHON* variables, so emulate a cp949/latin-1 console by wrapping stdin.
  const dir = path.join(temporary, '지도 자료');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(temporary, 'rectangle.gpkg'), path.join(dir, 'rectangle.gpkg'));
  const helper = path.join(root, 'server/src/geo/maps/helper.py');
  const wrapper = `import io, runpy, sys; sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='latin-1'); sys.argv = [${JSON.stringify(helper)}]; runpy.run_path(${JSON.stringify(helper)}, run_name='__main__')`;
  const result = spawnSync('uv', [...uvArgs, '-c', wrapper], {
    cwd: root, encoding: 'utf8', timeout: 20000,
    input: JSON.stringify({ path: path.join(dir, 'rectangle.gpkg'), operation: 'inspect' }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).layers.length > 0);
});

/** Maps helper known answers: vector formats, coordinates and pagination. Shared setup: maps-helper-common.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { request, close } from './maps-helper-common.mjs';

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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { command, upload, sha } from './install-common.mjs';
const fixtureScript = fileURLToPath(new URL('./install-fixtures.py', import.meta.url));
const las = `~Version\nVERS. 2.0 : version\nWRAP. NO : wrap\n~Well\nSTRT.M 100 : start\nSTOP.M 102 : stop\nSTEP.M 1 : step\nNULL. -999.25 : null\nWELL. RELEASE : well\n~Curve\nDEPT.M : Depth\nGR.API : Gamma ray\n~ASCII\n100 10\n101 -999.25\n102 30\n`;
const tables = { 'intervals.csv': 'hole_id,from_depth,to_depth,depth_unit\nA,0,2,m\nA,1,3,m\nA,4,4,m\n', 'intervals.tsv': 'hole_id\tfrom_depth\tto_depth\tdepth_unit\nA\t0\t2\tm\nA\t1\t3\tm\nA\t4\t4\tm\n' };
export async function fixtures(e, g, dir) {
  const folder = path.join(e.out, 'fixtures');
  command('uv', ['run', '--frozen', '--project', path.join(dir, 'server/src/helpers'), 'python', '-I', fixtureScript, folder], { log: path.join(e.out, 'fixtures.log') });
  const files = {};
  files.las = await upload(g, 'exact.las', las);
  for (const [name, text] of Object.entries(tables)) files[name] = await upload(g, name, text);
  for (const name of ['rectangles.gpkg', 'classes.tif']) files[name] = await upload(g, name, fs.readFileSync(path.join(folder, name)));
  e.record.inputs = ['rectangles.gpkg', 'classes.tif'].map(name => ({ name, sha256: sha(path.join(folder, name)) }));
  return files;
}
export async function basics(e, g, prefix, o) {
  await e.step(`${prefix}health`, async () => { const r = await g.json('GET', '/health'); assert.equal(r.status, 'ok'); return r; });
  await e.step(`${prefix}production-ui`, async () => {
    const r = await fetch(g.ui, { signal: AbortSignal.timeout(60_000) }); const html = await r.text();
    assert.equal(r.status, 200); assert.match(html, /_next\//); assert.doesNotMatch(html, /webpack-hmr|nextjs-portal/);
    assert.match(g.log(), /production build/); assert.ok(fs.existsSync(path.join(g.checkout, 'web/.next/BUILD_ID')));
    return { status: r.status, buildId: fs.readFileSync(path.join(g.checkout, 'web/.next/BUILD_ID'), 'utf8').trim() };
  });
  await e.step(`${prefix}catalogue`, async () => {
    const c = await g.json('GET', '/geo/catalogue'); e.record.catalogue = { source: o['catalogue-archive'] ? 'archive' : o['catalogue-url'] ? 'download' : 'asset', ...c.status };
    assert.equal(c.status.state, 'ready'); assert.ok(c.skills.length > 0); return { status: c.status, count: c.skills.length };
  });
  await e.step(`${prefix}provision`, async () => {
    assert.ok((await g.json('GET', '/projects')).some(p => p.id === 'default'));
    const c = await g.json('GET', '/geo/catalogue'); const s = await g.json('GET', '/skills/all?scope=project');
    const names = new Set([...s.enabled, ...s.disabled].map(s => s.name));
    for (const skill of c.skills) assert.ok(names.has(skill.runtimeName), `Unprovisioned ${skill.runtimeName}`);
    return { enabled: s.enabled.length, disabled: s.disabled.length, sync: s.sync };
  });
}
export async function previews(e, g, f, prefix = '') {
  await e.step(`${prefix}las-inspect`, async () => { const r = await g.json('POST', '/geo/inspect', { body: { path: f.las } }); assert.match(JSON.stringify(r), /las/i); return r; });
  await e.step(`${prefix}las-window`, async () => {
    const r = await g.json('POST', '/geo/series-window', { body: { path: f.las, columns: [1], mode: 'rows' } });
    assert.equal(r.sourceRows, 3); assert.deepEqual(r.rows.map(r => r.depth), [100, 101, 102]); assert.deepEqual(r.rows.map(r => r.values), [[10], [null], [30]]); return r;
  });
  await e.step(`${prefix}raster-window`, async () => {
    const r = await g.json('POST', '/geo/raster-window', { body: { path: f['classes.tif'], displayCrs: 'EPSG:32631', width: 4, height: 2, categorical: true } });
    assert.deepEqual(r.values, [[1, 2, 1, null], [2, 1, 2, 1]]); return { ...r, image: '(PNG omitted from record)' };
  });
  await e.step(`${prefix}vector-page`, async () => {
    const r = await g.json('POST', '/geo/vector-page', { body: { path: f['rectangles.gpkg'], layer: 'rectangles', displayCrs: 'native' } });
    assert.equal(r.features.features.length, 2); assert.deepEqual(r.features.features.map(f => f.properties.class), ['A', 'B']); return r;
  });
  await e.step(`${prefix}area-table`, async () => {
    const r = await g.json('POST', '/geo/area-table', { body: { path: f['rectangles.gpkg'], layer: 'rectangles', classField: 'class', method: 'projected', areaCrs: 'EPSG:32631' } });
    assert.equal(r.scope, 'full-layer'); assert.equal(r.totalArea, 20000); assert.deepEqual(r.rows.map(r => r.area), [10000, 10000]); return r;
  });
  for (const name of Object.keys(tables)) await e.step(`${prefix}${name}`, async () => {
    const r = await g.json('POST', '/geo/tables/inspect', { body: { path: f[name], mapping: { hole_id: 0, from_depth: 1, to_depth: 2, depth_unit: 3 } } });
    assert.equal(r.rowsAssessed, 3); assert.ok(r.issues.some(i => i.code === 'overlap')); assert.ok(r.issues.some(i => i.code === 'invalid_interval')); return r;
  });
}
export const previewIds = ['las-inspect', 'las-window', 'raster-window', 'vector-page', 'area-table', ...Object.keys(tables)];
export const basicIds = ['health', 'production-ui', 'catalogue', 'provision'];

/** Shared setup for the maps helper known-answer tests (geo/tests/maps-helper*.test.mjs).
 * Synthetic binaries are temporary, never tracked. The tests are split over several files so `node --test` runs them in
 * parallel; each file generates its own fixture directory. */
import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const uvArgs = ['run', '--frozen', '--project', path.join(root, 'server/src/helpers'), 'python', '-I'];
export const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gaid-map-fixtures-'));
export function run(script, args = [], input) {
  return spawnSync('uv', [...uvArgs, path.join(root, script), ...args], {
    cwd: root, input: input === undefined ? undefined : JSON.stringify(input), encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024,
  });
}
export function request(file, operation, extra = {}, expected = 0) {
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
export const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

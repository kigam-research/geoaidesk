#!/usr/bin/env node
/** Fresh production install + known-answer API previews + restart, without any model call.
 * node geo/release-proof/install-proof.mjs --repo <git repository> --ref <ref> --out <fresh dir>
 * Optional: --archive <git-archive tar>, --catalogue-archive <tar.gz>, --catalogue-url <URL>, --host <label>.
 */
import assert from 'node:assert/strict';
import { options, Evidence, checkout, launch } from './install-common.mjs';
import { basics, fixtures, previews, basicIds, previewIds } from './install-checks.mjs';
const o = options();
const e = new Evidence('install', o, ['checkout', 'first-start', ...basicIds, 'environments', 'fixtures', ...previewIds, 'stop', 'restart', 'build-reused', ...basicIds.map(s => `reopen-${s}`), ...previewIds.map(s => `reopen-${s}`), 'final-stop']);
let g, dir, f, ports;
try {
  if (!await e.step('checkout', () => { dir = checkout(e, o, o.ref ?? 'HEAD'); return e.record.app; })) throw Error('Checkout unavailable');
  if (!await e.step('first-start', async () => { g = await launch(e, o, dir, 'first-start'); ports = g.ports; return { readyMs: g.readyMs, ports }; })) throw Error('First start unavailable');
  await basics(e, g, '', o);
  await e.step('environments', async () => {
    const initial = await g.json('GET', '/geo/environments', { timeoutMs: 180_000 }); assert.equal(initial.state, 'ready');
    const project = [];
    for (const env of initial.environments.filter(x => !x.optional)) {
      const helper = env.targets.find(t => t.target === 'helper'); if (helper) assert.equal(helper.ready, true, `${env.id}/helper`);
      if (env.targets.some(t => t.target === 'project')) {
        const r = await g.json('POST', `/geo/environments/${env.id}/prepare`, { body: { target: 'project' }, timeoutMs: 600_000 }); project.push(r);
        assert.equal(r.ready, true, `${env.id}/project`); assert.ok(r.imports.every(x => x.status === 'ok'));
      }
    }
    return { initial, project, probe: 'Real API uses catalogue-owned importProbeScript; no duplicated module list' };
  });
  if (await e.step('fixtures', async () => { f = await fixtures(e, g, dir); return f; })) await previews(e, g, f);
  if (!await e.step('stop', async () => { const r = await g.stop(); g = null; return r; })) throw Error('Stop failed');
  if (!await e.step('restart', async () => { g = await launch(e, o, dir, 'restart', ports); return { readyMs: g.readyMs, ports }; })) throw Error('Restart unavailable');
  await e.step('build-reused', () => { assert.match(g.log(), /Production UI build is up to date/); return 'Launcher reused production build'; });
  await basics(e, g, 'reopen-', o);
  if (f) await previews(e, g, f, 'reopen-');
} catch (error) { e.record.interruption = error.message; }
finally {
  if (g) await e.step('final-stop', async () => { const r = await g.stop(); g = null; return r; });
  else if (e.record.steps.find(s => s.id === 'stop').outcome === 'passed') await e.step('final-stop', () => 'Already stopped; no live instance');
  e.finish();
}

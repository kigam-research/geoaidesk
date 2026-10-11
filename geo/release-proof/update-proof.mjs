#!/usr/bin/env node
/** Base -> candidate checkout, same GAID_HOME; API-authored state, no paid calls.
 * node geo/release-proof/update-proof.mjs --repo <repo> --ref <candidate> --base-ref 882cd56 --out <fresh dir>
 * --base-catalogue-archive <0.2.0.tar.gz> --catalogue-archive <0.2.1.tar.gz>
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { options, Evidence, checkout, launch, command, upload, source, file } from './install-common.mjs';
const o = options();
if (o.archive) throw Error('Update proof requires Git refs (source archives are supported by install-proof)');
const checks = ['projects', 'upload', 'edited-skill', 'user-skill', 'disabled-skill', 'spend-limit', 'instructions', 'sessions', 'history', 'notebook-annotations', 'provenance', 'catalogue-pin', 'untouched-skill'];
const e = new Evidence('update', o, ['checkout-base', 'base-start', 'seed-project', 'seed-upload', 'seed-skills', 'seed-settings', 'seed-history', 'seed-notebook', ...checks.map(s => `before-${s}`), 'base-stop', 'checkout-candidate', 'candidate-start', ...checks.map(s => `after-${s}`), 'final-stop']);
let g, dir, ports, state = {};
const project = 'release-proof-user';
const api = (method, route, body) => g.json(method, route, { project, ...(body === undefined ? {} : { body }), timeoutMs: 180_000 });
async function verify(prefix) {
  await e.step(`${prefix}projects`, async () => { const r = await api('GET', '/projects'); assert.ok(r.some(p => p.id === project)); assert.ok(r.some(p => p.id === 'default')); return r; });
  await e.step(`${prefix}upload`, async () => { assert.equal(await file(g, state.upload, project), 'sample,value\nA,42\n'); return state.upload; });
  await e.step(`${prefix}edited-skill`, async () => { assert.equal(await source(g, state.edited, project), state.editedContent); return state.edited; });
  await e.step(`${prefix}user-skill`, async () => { assert.equal(await source(g, 'release-user-skill', project), state.userContent); return 'release-user-skill'; });
  await e.step(`${prefix}disabled-skill`, async () => { const r = await api('GET', '/skills/all?scope=project'); assert.ok(r.disabled.some(s => s.name === state.disabled)); return state.disabled; });
  await e.step(`${prefix}spend-limit`, async () => { const r = await api('GET', `/projects/${project}`); assert.equal(r.spendLimitUsd, 12.34); return r.spendLimitUsd; });
  await e.step(`${prefix}instructions`, async () => { assert.equal(await file(g, 'AGENTS.md', project), state.instructions); return await api('GET', `/projects/${project}/instructions`); });
  await e.step(`${prefix}sessions`, async () => { const r = await api('GET', '/sessions'); assert.ok(r.some(s => s.id === state.session)); return r; });
  await e.step(`${prefix}history`, async () => { const r = await api('GET', `/sessions/${state.session}/history`); assert.match(JSON.stringify(r.messages), /Release proof synthetic history/); return r.messages; });
  await e.step(`${prefix}notebook-annotations`, async () => { const r = await api('GET', `/sessions/${state.session}/notebook/annotations`); assert.deepEqual(r, state.notes); return r; });
  await e.step(`${prefix}provenance`, async () => { const r = await api('GET', `/sandbox/provenance?path=${encodeURIComponent(state.upload)}`); assert.match(JSON.stringify(r), /user-actions|upload/); return r; });
  await e.step(`${prefix}catalogue-pin`, async () => {
    const r = await api('GET', '/geo/catalogue'); assert.equal(r.status.state, 'ready');
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'geo/distribution.json'))).catalogue.version;
    assert.match(JSON.stringify(r.status), new RegExp(version.replaceAll('.', '\\.')));
    return { expectedVersion: version, status: r.status };
  });
  await e.step(`${prefix}untouched-skill`, async () => {
    const r = await api('GET', '/skills/all?scope=project'); const c = await api('GET', '/geo/catalogue');
    assert.ok([...r.enabled, ...r.disabled].some(s => s.name === state.untouched));
    assert.match(JSON.stringify(r.sync), new RegExp(JSON.parse(fs.readFileSync(path.join(dir, 'geo/distribution.json'))).catalogue.version.replaceAll('.', '\\.')));
    // Compare live untouched bytes against the verified staged pin, not just a label.
    const cache = path.join(g.dataHome, 'skills-cache', `geo-catalogue-${c.status.version}-${c.status.sha256.slice(0, 12)}`);
    function locate(folder) {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const child = path.join(folder, entry.name);
        if (entry.name === state.untouched && fs.existsSync(path.join(child, 'SKILL.md'))) {
          const content = fs.readFileSync(path.join(child, 'SKILL.md'), 'utf8');
          if (content === state.currentUntouched) return child;
        }
        const found = locate(child); if (found) return found;
      }
    }
    state.currentUntouched = await source(g, state.untouched, project);
    const staged = locate(cache); assert.ok(staged, 'Live untouched skill must match verified staged catalogue bytes');
    return { skill: state.untouched, sync: r.sync, catalogueSkills: c.skills.length, matchedStagedBytes: true };
  });
}
try {
  if (!await e.step('checkout-base', () => { dir = checkout(e, o, o['base-ref'] ?? '882cd56'); e.record.app.fromCommit = e.record.app.commit; e.record.app.fromVersion = e.record.app.version; return e.record.app; })) throw Error('No base checkout');
  if (!await e.step('base-start', async () => { g = await launch(e, o, dir, 'base-start', undefined, true); ports = g.ports; return { readyMs: g.readyMs, ports }; })) throw Error('No base instance');
  if (!await e.step('seed-project', async () => { const r = await g.json('POST', '/projects', { body: { id: project, name: 'Release user project', description: 'Update preservation proof', spendLimitUsd: 12.34 } }); await api('POST', `/projects/${project}/sandbox/init`, { download_skills: true }); return r; })) throw Error('No user project');
  await e.step('seed-upload', async () => { state.upload = await upload(g, 'user.csv', 'sample,value\nA,42\n', project); return state.upload; });
  await e.step('seed-skills', async () => {
    const c = await api('GET', '/geo/catalogue'); const s = await api('GET', '/skills/all?scope=project');
    const names = new Set(s.enabled.map(s => s.name)); const available = c.skills.filter(s => names.has(s.runtimeName)).map(s => s.runtimeName);
    assert.ok(available.length >= 3); [state.edited, state.disabled, state.untouched] = available;
    state.editedContent = (await source(g, state.edited, project)) + '\nUser edit: preserve release proof.\n';
    await api('PUT', `/skills/${state.edited}/source?scope=project`, { content: state.editedContent });
    await api('POST', `/skills/${state.disabled}/disable?scope=project`, {});
    await api('POST', '/skills/create', { name: 'release-user-skill', description: 'User authored release proof', scope: 'project' });
    state.userContent = await source(g, 'release-user-skill', project);
    return { edited: state.edited, disabled: state.disabled, untouched: state.untouched, user: 'release-user-skill' };
  });
  await e.step('seed-settings', async () => {
    state.instructions = (await file(g, 'AGENTS.md', project)) + '\nRelease proof user instructions.\n';
    await api('PUT', '/sandbox/file?path=AGENTS.md', state.instructions); return { spendLimitUsd: 12.34, instructionsEdited: true };
  });
  await e.step('seed-history', async () => {
    // Use Pi's installed serializer offline; it writes the actual JSONL header/entry chain.
    const script = path.join(e.out, 'seed-session.mjs');
    fs.writeFileSync(script, `import { SessionManager } from ${JSON.stringify(pathToFileURL(path.join(dir, 'server/node_modules/@earendil-works/pi-coding-agent/dist/index.js')).href)};\nconst s=SessionManager.create(process.argv[2],process.argv[3]);s.appendMessage({role:'user',content:[{type:'text',text:'Release proof synthetic history'}],timestamp:Date.now()});console.log(JSON.stringify({id:s.getSessionId(),file:s.getSessionFile()}));\n`);
    const sandbox = path.join(g.dataHome, 'projects', project, 'sandbox');
    const r = JSON.parse(command(process.execPath, [script, sandbox, path.join(sandbox, '.pi/sessions')], { log: path.join(e.out, 'seed-history.log') }).split('\n').at(-1));
    state.session = r.id; return { ...r, synthetic: true, modelCalled: false, method: 'Pi SessionManager.appendMessage offline (not a model-produced chat)' };
  });
  await e.step('seed-notebook', async () => { state.notes = { version: 1, annotations: [{ id: 'release-proof-note', kind: 'note', body: 'User notebook note retained through update', createdAt: Date.now() }] }; return await api('PUT', `/sessions/${state.session}/notebook/annotations`, state.notes); });
  await verify('before-');
  if (!await e.step('base-stop', async () => { const r = await g.stop(); g = null; return r; })) throw Error('Base stop failed');
  if (!await e.step('checkout-candidate', () => {
    command('git', ['fetch', 'origin'], { cwd: dir, log: path.join(e.out, 'fetch.log') });
    command('git', ['checkout', '--detach', o.ref ?? 'origin/task/gaid-release-proof'], { cwd: dir, log: path.join(e.out, 'update-checkout.log') });
    e.record.app = { ...e.record.app, commit: command('git', ['rev-parse', 'HEAD'], { cwd: dir }), version: JSON.parse(fs.readFileSync(path.join(dir, 'geo/distribution.json'))).version, method: 'git-checkout' }; return e.record.app;
  })) throw Error('Candidate checkout failed');
  if (!await e.step('candidate-start', async () => { g = await launch(e, o, dir, 'candidate-start', ports); return { readyMs: g.readyMs, ports }; })) throw Error('Candidate start failed');
  const c = await api('GET', '/geo/catalogue'); e.record.catalogue = { source: o['catalogue-archive'] ? 'archive' : o['catalogue-url'] ? 'download' : 'asset', ...c.status };
  await verify('after-');
} catch (error) { e.record.interruption = error.message; }
finally { if (g) await e.step('final-stop', async () => { const r = await g.stop(); g = null; return r; }); e.finish(); }

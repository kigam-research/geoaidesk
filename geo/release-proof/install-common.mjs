import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostFacts, startInstance } from './instance.mjs';

export const sha = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function options(argv = process.argv.slice(2)) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) throw Error('Expected --name value arguments');
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}
export function command(cmd, args, { cwd, log, env = process.env, timeout = 20 * 60_000 } = {}) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (log) fs.writeFileSync(log, (r.stdout ?? '') + (r.stderr ?? '') + (r.error?.message ?? ''));
  if (r.status !== 0) throw Error(`${cmd} exited ${r.status}: ${(r.error?.message ?? r.stderr ?? '').slice(-1500)}`);
  return r.stdout.trim();
}
export function freshOutput(dir) {
  dir = path.resolve(dir);
  let parent = dir;
  while (true) {
    if (fs.existsSync(path.join(parent, '.git'))) throw Error('--out must be outside a Git checkout');
    const next = path.dirname(parent); if (next === parent) break; parent = next;
  }
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw Error('--out must be new or empty; evidence is never overwritten');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
export function outcome(steps) {
  return steps.some(s => s.outcome === 'failed') ? 'failed' : steps.some(s => s.outcome !== 'passed') ? 'partial' : 'passed';
}
export class Evidence {
  constructor(kind, o, ids) {
    this.out = freshOutput(o.out ?? process.env.TASK_OUTPUT_DIR ?? path.join(os.homedir(), 'data/geoaidesk/work/gaid-release-proof', `${kind}-${Date.now()}`));
    this.record = { schema: 'gaid-install-evidence/v1', kind, recordedAt: new Date().toISOString(), host: { label: o.host ?? os.hostname(), ...hostFacts() }, app: {}, catalogue: { source: 'missing', state: 'not-run' }, steps: ids.map(id => ({ id, outcome: 'not-run' })), result: 'not-run', logs: [], setup: o.setup ?? null };
    this.write();
  }
  write() {
    this.record.result = outcome(this.record.steps);
    fs.writeFileSync(path.join(this.out, 'record.json'), JSON.stringify(this.record, null, 2) + '\n');
  }
  async step(id, fn) {
    const s = this.record.steps.find(s => s.id === id); if (!s) throw Error(`Unknown step ${id}`);
    const start = Date.now();
    try { s.detail = await fn(); s.outcome = 'passed'; }
    catch (e) { s.outcome = 'failed'; s.detail = e.stack ?? String(e); }
    s.durationMs = Date.now() - start; this.write();
    console.log(`${id}: ${s.outcome} (${s.durationMs}ms)`);
    return s.outcome === 'passed';
  }
  finish() {
    this.record.logs = fs.readdirSync(this.out).filter(f => f.endsWith('.log')).map(file => ({ file, sha256: sha(path.join(this.out, file)) }));
    this.write(); console.log(`Evidence: ${path.join(this.out, 'record.json')} (${this.record.result})`);
    process.exitCode = this.record.result === 'passed' ? 0 : 1;
  }
}
export function checkout(e, o, ref) {
  const dest = path.join(e.out, 'checkout');
  if (o.archive) {
    fs.mkdirSync(dest); command('tar', ['-xf', path.resolve(o.archive), '-C', dest]);
    e.record.app = { version: JSON.parse(fs.readFileSync(path.join(dest, 'geo/distribution.json'))).version, commit: o.ref ?? null, method: 'source-archive', archiveSha256: sha(o.archive) };
  } else {
    command('git', ['clone', '--no-hardlinks', '--no-checkout', o.repo ?? process.cwd(), dest], { log: path.join(e.out, 'clone.log') });
    command('git', ['checkout', '--detach', ref], { cwd: dest, log: path.join(e.out, 'checkout.log') });
    e.record.app = { version: JSON.parse(fs.readFileSync(path.join(dest, 'geo/distribution.json'))).version, commit: command('git', ['rev-parse', 'HEAD'], { cwd: dest }), method: 'git-clone' };
  }
  return dest;
}
export function catalogueEnv(o, base = false) {
  const archive = o[base ? 'base-catalogue-archive' : 'catalogue-archive'];
  const url = o[base ? 'base-catalogue-url' : 'catalogue-url'];
  return archive ? { GAID_CATALOGUE_ARCHIVE: path.resolve(archive) } : url ? { GAID_CATALOGUE_URL: url } : {};
}
export async function launch(e, o, dir, label, ports, base = false) {
  return startInstance({ checkout: dir, dataHome: path.join(e.out, o['data-name'] ?? 'GAID home 한글'), runDir: e.out, label, ports, env: catalogueEnv(o, base) });
}
export async function upload(g, name, bytes, project = 'default') {
  const form = new FormData(); form.append('files', new Blob([bytes]), name);
  const r = await g.json('POST', '/sandbox/upload', { project, body: form });
  if (r.uploaded?.length !== 1) throw Error(`Upload failed: ${JSON.stringify(r)}`);
  return r.uploaded[0];
}
export async function source(g, name, project = 'default') { return (await g.json('GET', `/skills/${name}/source?scope=project`, { project })).content; }
export async function file(g, name, project = 'default') {
  const r = await g.request('GET', `/sandbox/file?path=${encodeURIComponent(name)}`, { project });
  if (r.status !== 200) throw Error(`Read ${name}: ${r.status} ${r.text}`); return r.text;
}

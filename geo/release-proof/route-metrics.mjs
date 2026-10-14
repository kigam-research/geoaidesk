import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './route-tasks/tasks.mjs';

export function metrics() {
  return { turns: 0, toolCalls: 0, retries: 0, dependencyRepairs: [], contextPeakTokens: null,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, errors: [], toolErrors: [], done: false };
}
export function observe(m, frame) {
  if (frame.type === 'turn_end') {
    m.turns++;
    m.inputTokens += frame.usage?.input ?? 0;
    m.outputTokens += frame.usage?.output ?? 0;
    m.cacheReadTokens += frame.usage?.cacheRead ?? 0;
    const u = frame.usage;
    if (u && [u.input, u.output, u.cacheRead, u.cacheWrite].some(Number.isFinite)) {
      m.contextPeakTokens = Math.max(m.contextPeakTokens ?? 0,
        (u.input ?? 0) + (u.output ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0));
    }
  }
  if (frame.type === 'context_usage' && Number.isFinite(frame.tokens)) {
    m.contextPeakTokens = Math.max(m.contextPeakTokens ?? 0, frame.tokens);
  }
  if (frame.type === 'tool_start') {
    m.toolCalls++;
    const command = frame.args?.command;
    if (frame.toolName === 'bash' && typeof command === 'string' && /\b(?:uv\s+(?:add|sync)|uv\s+pip\s+install|pip3?\s+install|npm\s+(?:install|ci)|apt(?:-get)?\s+install)\b/.test(command)) {
      m.dependencyRepairs.push({ toolCallId: frame.toolCallId, command });
    }
  }
  if (frame.type === 'retry') m.retries++;
  if (frame.type === 'error') m.errors.push(frame);
  if (frame.type === 'tool_end' && frame.isError) m.toolErrors.push(frame);
  if (frame.type === 'cost') {
    m.ledgerCostUsd = frame.runCost;
    m.billingMode = frame.runBillingMode;
    m.provider = frame.runProvider;
  }
  if (frame.type === 'done') m.done = true;
}

export function jsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
}
export function fileEvidence(file, root) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const bytes = fs.readFileSync(file);
  return { path: path.relative(root, file), size: bytes.length, sha256: sha256(bytes) };
}
export function checkArtifacts(sandbox, expected, reference) {
  const dir = path.join(sandbox, 'results/route-trial');
  const expectedArtifacts = expected.map(a => ({ ...a,
    artifacts: a.files.map(f => fileEvidence(path.join(dir, f), sandbox)),
    present: a.files.every(f => (fs.existsSync(path.join(dir, f)) && fs.statSync(path.join(dir, f)).size > 0)) }));
  let areaCheck = null;
  if (reference) {
    const file = path.join(dir, 'area-table.csv');
    areaCheck = { passed: false, expected: reference.expected_area_m2, toleranceM2: 1e-6, actual: {}, errors: [] };
    try {
      const rows = parseCsv(fs.readFileSync(file, 'utf8'));
      const header = rows.shift().map(s => s.trim().toLowerCase());
      const c = header.findIndex(s => ['class', 'lithology', 'category', 'class_value'].includes(s));
      const a = header.findIndex(s => ['area_m2', 'area_m²', 'area_sq_m'].includes(s));
      if (c < 0 || a < 0) throw new Error('Area table needs class and area_m2 columns');
      for (const row of rows) if (row[c]) areaCheck.actual[row[c]] = (areaCheck.actual[row[c]] ?? 0) + Number(row[a]);
      areaCheck.passed = Object.keys(areaCheck.actual).length === Object.keys(reference.expected_area_m2).length &&
        Object.entries(reference.expected_area_m2).every(([k,v]) => Number.isFinite(areaCheck.actual[k]) && Math.abs(areaCheck.actual[k] - v) <= 1e-6);
    } catch (e) { areaCheck.errors.push(e.message); }
  }
  const count = expectedArtifacts.filter(a => a.present).length;
  return { expectedArtifacts, areaCheck,
    outcome: count === expectedArtifacts.length && (!areaCheck || areaCheck.passed) ? 'passed' : count ? 'partial' : 'failed' };
}

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

/** Installed skill directories of a project sandbox (enabled and disabled). */
export function installedSkills(sandbox) {
  const list = dir => { try { return fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'SKILL.md'))).sort(); } catch { return []; } };
  return { enabled: list(path.join(sandbox, '.pi/skills')), disabled: list(path.join(sandbox, '.pi/skills-disabled')) };
}

/**
 * Which skill files a session's tool calls touched, and which absolute paths outside the sandbox
 * they named. Observation only: a bash `cat` of a skill counts as a mention, not a verified read.
 */
export function skillUse(sessionFile, sandbox, skillNames) {
  const root = path.resolve(sandbox);
  const inside = p => { if (p.startsWith('~')) return false; const r = path.resolve(root, p); return r === root || r.startsWith(root + path.sep); };
  const reads = [], mentions = new Set(), outside = new Set();
  for (const row of jsonLines(sessionFile)) {
    if (row.type !== 'message' || row.message?.role !== 'assistant') continue;
    for (const c of row.message.content ?? []) {
      if (c.type !== 'toolCall') continue;
      const args = c.arguments ?? {};
      const text = c.name === 'bash' ? String(args.command ?? '') : String(args.path ?? '');
      if (['read', 'write', 'edit'].includes(c.name) && args.path) {
        const p = String(args.path);
        if (!inside(p)) outside.add(p);
        if (c.name === 'read' && /(^|\/)skills\//.test(p)) reads.push({ path: inside(p) ? path.relative(root, path.resolve(root, p)) : p, inSandbox: inside(p) });
      }
      for (const name of skillNames) if (text.includes(name)) mentions.add(name);
      if (c.name === 'bash') for (const m of text.matchAll(/(?:^|[\s'"=])((?:\/|~\/)[^\s'";|&<>]+)/g)) if (!inside(m[1]) && !/^\/(dev|tmp|usr|bin|proc)\b/.test(m[1])) outside.add(m[1]);
    }
  }
  return { skillFileReads: reads, skillNamesMentioned: [...mentions].sort(), outsideSandboxPaths: [...outside].slice(0, 40) };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { freshOutput, outcome } from '../release-proof/install-common.mjs';
test('evidence cannot overwrite an existing run or write inside any Git checkout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gaid-proof-'));
  try {
    const out = freshOutput(path.join(tmp, 'run')); fs.writeFileSync(path.join(out, 'record.json'), '{}');
    assert.throws(() => freshOutput(out), /never overwritten/);
    fs.mkdirSync(path.join(tmp, '.git')); assert.throws(() => freshOutput(path.join(tmp, 'nested/run')), /outside a Git/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
test('missing steps never become a passing proof; failures remain failures', () => {
  assert.equal(outcome([{ outcome: 'passed' }, { outcome: 'not-run' }]), 'partial');
  assert.equal(outcome([{ outcome: 'passed' }, { outcome: 'failed' }]), 'failed');
  assert.equal(outcome([{ outcome: 'passed' }]), 'passed');
});

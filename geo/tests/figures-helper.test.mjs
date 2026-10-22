import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skill = path.join(root, 'geo/skills/gaid-figures');
const helper = path.join(root, 'server/src/helpers');
let dir, journals;
const uv = (args) => spawnSync('uv', ['run', '--frozen', '--project', helper, 'python', ...args], {
  cwd: dir, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024,
});
const report = (file, options = []) => {
  const out = path.join(dir, `${file}-${options.join('-').replaceAll('/', '_') || 'default'}.json`);
  const run = uv([path.join(skill, 'scripts/check_figure.py'), path.join(dir, file), '--journals', journals,
    '--journal', 'elsevier', '--width', 'single', '--kind', 'data-figure', '--out', out, ...options]);
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(fs.readFileSync(out, 'utf8'));
};
const line = (r, id) => r.items.find(i => i.id === id);

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gaid-figure-check-'));
  // Stable fixture rules, independent of changing journal websites. Profile schema is also checked below.
  const source = JSON.parse(fs.readFileSync(path.join(skill, 'assets/journals.json'), 'utf8'));
  const profile = structuredClone(source.profiles.find(p => p.id === 'elsevier'));
  profile.widths = [{ id: 'single', label: 'Single', mm: 90 }, { id: 'unknown', label: 'Unverified', mm: null }];
  profile.minFontPt = 7; profile.dpi = { photo: 300, combination: 500, lineArt: 1000 };
  profile.formats = { vector: ['pdf', 'eps'], raster: ['tiff', 'jpeg'] };
  profile.aiPolicy = { 'data-figure': 'disclose', 'code-diagram': 'allowed', 'ai-picture': 'disclose', 'ai-graphical-abstract': 'forbidden', 'image-edit': 'forbidden' };
  journals = path.join(dir, 'journals.json');
  fs.writeFileSync(journals, JSON.stringify({ schema: source.schema, profiles: [profile] }));
  const generated = uv(['-c', `
import sys
sys.path.insert(0, ${JSON.stringify(path.join(skill, 'scripts'))})
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from figure_export import export_figure
with plt.rc_context({'font.size': 9}):
 fig,ax=plt.subplots(figsize=(90/25.4, 50/25.4),layout='constrained')
 ax.imshow(np.tile(np.linspace(0,1,256), (30,1)),cmap='jet',aspect='auto')
 ax.set(xlabel='Time (s)',ylabel='Depth (m)')
 export_figure(fig,'jet',formats=('png','pdf'),dpi=300)
 plt.close(fig)
with plt.rc_context({'font.size': 9}):
 fig,ax=plt.subplots(figsize=(90/25.4,50/25.4),layout='constrained')
 ax.plot([1,2,3],[2,1,4]); ax.set(xlabel='Time (s)',ylabel='Rate (m/s)')
 export_figure(fig,'vector',formats=('pdf',),dpi=300)
 plt.close(fig)
from PIL import Image
Image.new('RGB',(1063,400),'white').save('plain.png',dpi=(900,900))
`]);
  assert.equal(generated.status, 0, generated.stderr);
  fs.writeFileSync(path.join(dir, 'small.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="40mm"><g transform="scale(0.5)"><text x="2" y="15" style="font-size:10pt">Depth (m)</text></g></svg>');
  fs.writeFileSync(path.join(dir, 'css.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="40mm"><style>text { font-size: 20pt }</style><text x="2" y="15">Text</text></svg>');
  fs.writeFileSync(path.join(dir, 'outlined.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="40mm"><path d="M0 0 L10 20" /></svg>');
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('90 mm / 300 dpi jet PNG: physical DPI, plot-font metadata, advisory hue ramp and actual CVD previews', () => {
  const r = report('jet.png', ['--artwork', 'photo']);
  assert.equal(r.schema, 'gaid-figure-check/v1');
  assert.match(r.sha256, /^[a-f0-9]{64}$/);
  assert.equal(r.path, 'jet.png');
  assert.equal(r.target.widthMm, 90);
  assert.match(line(r, 'pixel-size').measured, /^1062|^1063/);
  assert.equal(line(r, 'dpi').status, 'ok');
  assert.match(line(r, 'dpi').measured, /300\.0|299\.7/);
  assert.equal(line(r, 'min-font').status, 'ok');
  assert.match(line(r, 'min-font').measured, /metadata; not OCR/);
  assert.equal(line(r, 'colour-map').status, 'warn');
  assert.equal(line(r, 'format').status, 'fail'); // PNG is a display companion, not an Elsevier submission format.
  assert.equal(r.cvdPreviews.length, 3);
  for (const f of r.cvdPreviews) assert.ok(fs.statSync(path.join(dir, f)).size > 100);
  const inspect = uv(['-c', `from PIL import Image; import json; print(json.dumps([list(Image.open(p).getpixel((600,260))) for p in ${JSON.stringify(r.cvdPreviews)}]))`]);
  assert.equal(inspect.status, 0, inspect.stderr);
  assert.equal(new Set(JSON.parse(inspect.stdout).map(x => JSON.stringify(x))).size, 3);
});

test('SVG transformed 5 pt live text fails the text floor; outlined/CSS text is never certified', () => {
  const r = report('small.svg');
  assert.equal(line(r, 'min-font').status, 'fail');
  assert.equal(line(r, 'min-font').measured, '5.00 pt');
  assert.equal(line(r, 'fonts-embedded').status, 'warn');
  assert.equal(line(r, 'cvd').status, 'not-measured');
  assert.equal(line(report('css.svg'), 'min-font').status, 'not-measured');
  assert.equal(line(report('outlined.svg'), 'fonts-embedded').status, 'not-measured');
});

test('vector PDF: live text and embedded font programs, never fictitious vector DPI', () => {
  const r = report('vector.pdf');
  assert.equal(line(r, 'format').status, 'ok');
  assert.equal(line(r, 'min-font').status, 'ok');
  assert.equal(line(r, 'fonts-embedded').status, 'ok');
  assert.equal(line(r, 'dpi').status, 'not-measured');
  assert.equal(line(r, 'pixel-size').status, 'not-measured');
});

test('no PNG font metadata means unmeasured; saved 900 dpi tag never substitutes for target DPI', () => {
  const r = report('plain.png');
  assert.equal(line(r, 'min-font').status, 'not-measured');
  assert.match(line(r, 'dpi').measured, /300\.0/);
  assert.equal(line(r, 'dpi').status, 'warn'); // photo passes, combination/line art do not.
  assert.equal(line(r, 'colour-map').status, 'not-measured');
  const unknown = report('plain.png', ['--width', 'unknown']);
  assert.equal(unknown.target.widthMm, null);
  assert.equal(line(unknown, 'dpi').status, 'not-measured');
});

test('AI figure/use policy is enforced even when file bytes are identical', () => {
  const explanatory = report('plain.png', ['--kind', 'ai-picture']);
  const abstract = report('plain.png', ['--kind', 'ai-picture', '--use', 'graphical-abstract']);
  assert.equal(explanatory.sha256, abstract.sha256);
  assert.equal(line(explanatory, 'ai-policy').status, 'warn');
  assert.equal(abstract.kind, 'ai-graphical-abstract');
  assert.equal(line(abstract, 'ai-policy').status, 'fail');
});

test('default report and CVD filenames stay in the hidden content-keyed check directory', () => {
  const run = uv(['-I', path.join(skill, 'scripts/check_figure.py'), 'plain.png', '--journals', journals]);
  assert.equal(run.status, 0, run.stderr);
  const { out, sha256 } = JSON.parse(run.stdout);
  assert.equal(out, `.kady/geo/figure-checks/${sha256}.json`);
  const r = JSON.parse(fs.readFileSync(path.join(dir, out), 'utf8'));
  assert.deepEqual(r.cvdPreviews, ['deuteranopia', 'protanopia', 'tritanopia'].map(name => `.kady/geo/figure-checks/${sha256}-cvd-${name}.png`));
});

test('bad options/values and missing files have helper exit codes and do not overwrite the input', () => {
  const script = path.join(skill, 'scripts/check_figure.py');
  const base = [script, 'plain.png', '--journals', journals, '--out', 'out.json'];
  assert.equal(uv([...base, '--journal', 'missing']).status, 5);
  assert.equal(uv([...base, '--kind', 'photo']).status, 5);
  assert.equal(uv([...base, '--width', 'single']).status, 5);
  assert.equal(uv([script, 'missing.png', '--journals', journals, '--out', 'out.json']).status, 4);
  assert.equal(uv([...base, '--out', 'plain.png']).status, 5);
});

test('profiles are complete snapshots with explicit unknowns and first-party provenance', () => {
  const data = JSON.parse(fs.readFileSync(path.join(skill, 'assets/journals.json'), 'utf8'));
  assert.equal(data.schema, 'gaid-journal-figures/v1');
  assert.deepEqual(data.profiles.map(p => p.id), ['elsevier', 'copernicus', 'agu', 'springer', 'gsa', 'jgsk', 'eeg']);
  for (const p of data.profiles) {
    assert.ok(p.notes.length);
    assert.ok(p.widths.length);
    assert.match(p.rulesCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
    for (const s of p.sources) { assert.ok(s.title); assert.ok(new URL(s.url)); assert.ok(s.checkedAt); }
    for (const v of Object.values(p.dpi)) assert.ok(v === null || (Number.isFinite(v) && v > 0));
    assert.deepEqual(Object.keys(p.aiPolicy).sort(), ['data-figure', 'code-diagram', 'ai-picture', 'ai-graphical-abstract', 'image-edit'].sort());
  }
});

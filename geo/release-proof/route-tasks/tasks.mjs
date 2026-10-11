import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function archiveJson(archive, member) {
  return JSON.parse(execFileSync('tar', ['-xOzf', archive, member], { maxBuffer: 16 * 1024 * 1024 }));
}

/** Read the pinned workflow contract, never a separately maintained expected-output list. */
export function prepareTask({ workflowId, assetsRoot, runDir, catalogueVersion }) {
  const assetDir = path.join(assetsRoot, 'geo-catalogue', catalogueVersion);
  const archive = path.join(assetDir, `geo-catalogue-${catalogueVersion}.tar.gz`);
  const workflow = archiveJson(archive, 'workflows.json').find(w => w.id === workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);
  const inputsDir = path.join(runDir, 'inputs');
  fs.mkdirSync(inputsDir, { recursive: true });
  let files, choices, reference = null;
  if (workflowId === 'well-log-qc') {
    const file = path.join(assetsRoot, 'force2020-welllogs/c8d01ee9/las/25_9-1.las');
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) !== '5604b035b6d6406eb51b01796d48688505a1b56cc77e50ec17dcf00cb40252ce') {
      throw new Error('FORCE input differs from configs/inputs.toml');
    }
    files = [{ file, name: '25_9-1.las', rights: 'CC BY 4.0 / NOLD 2.0; FORCE 2020' }];
    choices = 'Use the original first LAS index in its original units; depth basis and datum are unconfirmed (label unknown), no TVD conversion. Plot 1400–1800 in original index units; inspect all rows. Do not infer missing curve units. Skip unit-dependent range/spike checks for unconfirmed units. Preserve and explicitly report any STRT/STOP/STEP versus sample discrepancy as a finding, not an automatic data correction or logging-failure verdict.';
  } else if (workflowId === 'geo-map-and-crs') {
    // The permitted example contains a recipe, not its binary source layers.
    const examples = path.join(assetDir, `geo-examples-${catalogueVersion}.tar.gz`);
    reference = archiveJson(examples, 'examples/kigam/geo-map-and-crs/synthetic-rectangles/rectangle-spec.json');
    const geojson = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: reference.crs } },
      features: reference.rectangles.map((r, i) => {
        const [x0, y0, x1, y1] = r.bounds;
        return { type: 'Feature', properties: { id: i + 1, [reference.class_field]: r.class },
          geometry: { type: 'Polygon', coordinates: [[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]] } };
      }) };
    const file = path.join(inputsDir, 'rectangles.geojson');
    fs.writeFileSync(file, JSON.stringify(geojson, null, 2) + '\n');
    files = [{ file, name: 'rectangles.geojson', rights: reference.rights }];
    choices = `This is MIT synthetic example data, not field measurements. The recipe declares source CRS ${reference.crs}; do not guess any other CRS. Class field: ${reference.class_field}. Use full geometries and planar area in ${reference.crs}, units m2; sum feature areas by class, overlaps count twice. No AOI subset. Produce BOTH map.png and area-table.csv (class, area_m2, percentage); also crs-inventory.json, crs-inventory.csv and run.json. Display CRS is separate from area CRS. Do not calculate area from a rendered preview.`;
  } else throw new Error(`Unsupported trial workflow: ${workflowId}`);
  const expectedArtifacts = workflow.expectedArtifacts.filter(a => a.required || a.id === 'area-table')
    .map(a => ({ id: a.id, files: a.files ?? (a.id === 'map' ? ['map.png'] : []), required: true }));
  if (expectedArtifacts.some(a => !a.files.length)) throw new Error('Expected artifact has no file contract');
  const prompt = [workflow.prompt.en, choices,
    `Inputs: ${files.map(f => `user_data/${f.name}`).join(', ')}.`,
    `Read the workflow skill instructions before acting. Write all final outputs under results/route-trial/ using exactly these names: ${expectedArtifacts.flatMap(a => a.files).join(', ')}. Include a reproducible analysis script.`,
    'Use the project uv environment (uv run python), never bare python or pip. Work locally in this session only; do not delegate, call other models, use paid tools, or fetch replacement datasets. All choices for this bounded trial are supplied above; if a scientific fact remains unconfirmed, label it unknown and continue only the applicable checks. Do not claim scientific validation. Complete the files, not only a plan.'
  ].join('\n\n');
  fs.writeFileSync(path.join(runDir, 'workflow.json'), JSON.stringify(workflow, null, 2) + '\n');
  fs.writeFileSync(path.join(runDir, 'prompt.txt'), prompt + '\n');
  return { workflow, files, prompt, expectedArtifacts, reference,
    inputs: files.map(f => ({ name: f.name, sha256: sha256(fs.readFileSync(f.file)), rights: f.rights })) };
}

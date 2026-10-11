#!/usr/bin/env node
/** One real route/workflow trial; see route-usage.md. No default paid route. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { startInstance, requestJson, hostFacts, sleep } from './instance.mjs';
import { prepareTask } from './route-tasks/tasks.mjs';
import { metrics, observe, jsonLines, fileEvidence, checkArtifacts } from './route-metrics.mjs';

export function options(args) {
  const { values: o } = parseArgs({ args, options: {
    route: { type: 'string', default: 'local' }, workflow: { type: 'string', default: 'well-log-qc' },
    context: { type: 'string', default: '65536' }, model: { type: 'string' }, out: { type: 'string' },
    api: { type: 'string' }, 'data-home': { type: 'string' }, 'assets-root': { type: 'string' },
    'ollama-url': { type: 'string', default: 'http://127.0.0.1:11434' },
    'allow-paid': { type: 'boolean', default: false }, 'timeout-minutes': { type: 'string', default: '45' },
    'spend-limit-usd': { type: 'string', default: '1' }, help: { type: 'boolean' },
  } });
  if (o.help) return o;
  if (!['local','api-key','chatgpt-signin'].includes(o.route)) throw new Error('Unknown route');
  if (o.route !== 'local' && !o['allow-paid']) throw new Error('Paid/subscription route refused: explicit --allow-paid is required');
  if (!['well-log-qc','geo-map-and-crs'].includes(o.workflow)) throw new Error('Unknown workflow');
  o.context = Number(o.context);
  if (!Number.isSafeInteger(o.context) || o.context < 65536) throw new Error('Context must be at least 65536');
  o.timeoutMs = Number(o['timeout-minutes']) * 60_000;
  if (!Number.isFinite(o.timeoutMs) || o.timeoutMs <= 0) throw new Error('Invalid timeout');
  o.spendLimit = o.route === 'local' ? 0 : Number(o['spend-limit-usd']);
  if (!Number.isFinite(o.spendLimit) || o.spendLimit < 0) throw new Error('Invalid spend limit');
  if (o.api && !o['data-home']) throw new Error('Attach requires --data-home to collect sandbox and ledger evidence');
  if (o.route !== 'local' && (!o.api || !o.model)) throw new Error('Paid routes require --api and explicit --model on an already connected instance');
  o.model ??= 'qwen3:30b-a3b-instruct-2507-q4_K_M';
  return o;
}

async function modelRequest(url, route, body) {
  const response = await fetch(`${url.replace(/\/$/,'')}${route}`, {
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Ollama ${route}: HTTP ${response.status}`);
  return response.json();
}

/** Bound the model run, explicitly abort on timeout/disconnect, then wait for server-owned accounting. */
export async function runChat({ json, api, project, session, model, prompt, runDir, label, timeoutMs, ollamaUrl }) {
  const m = metrics(), started = Date.now();
  const log = fs.createWriteStream(path.join(runDir, `${label}.sse`));
  const psLog = fs.createWriteStream(path.join(runDir, `${label}-ollama.jsonl`));
  const samples = []; let sampling = false;
  const sample = async () => {
    if (!ollamaUrl || sampling) return;
    sampling = true;
    try {
      const ps = await modelRequest(ollamaUrl, '/api/ps');
      let cli = null;
      try { cli = execFileSync('ollama', ['ps'], { encoding: 'utf8', timeout: 5000, env: { ...process.env, OLLAMA_HOST: ollamaUrl } }); } catch { /* API evidence remains available */ }
      const s = { at: new Date().toISOString(), ...ps, cli };
      psLog.write(JSON.stringify(s) + '\n'); samples.push(s);
    } catch (e) { psLog.write(JSON.stringify({ at: new Date().toISOString(), error: e.message }) + '\n'); }
    finally { sampling = false; }
  };
  const timer = setInterval(sample, 15_000);
  await sample();
  try {
    const response = await fetch(`${api}/sessions/${session.id}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Project-Id': project },
      body: JSON.stringify({ model, message: prompt, thinkingLevel: 'off' }), signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Run HTTP ${response.status}: ${(await response.text()).slice(0,1000)}`);
    let pending = ''; const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      log.write(chunk);
      pending += decoder.decode(chunk, { stream: true });
      let end;
      while ((end = pending.indexOf('\n\n')) >= 0) {
        const block = pending.slice(0,end); pending = pending.slice(end+2);
        const data = block.split('\n').filter(s => s.startsWith('data:')).map(s => s.slice(5).trim()).join('\n');
        if (data) observe(m, JSON.parse(data));
      }
    }
    if (!m.done) throw new Error('SSE ended without done frame');
  } catch (e) {
    m.errors.push({ type: 'harness', message: e.message });
    try { await json('POST', `/sessions/${session.id}/abort`, { project }); } catch (abortError) { m.errors.push({ message: `abort: ${abortError.message}` }); }
  } finally {
    clearInterval(timer);
    while (sampling) await sleep(100);
    await sample(); log.end(); psLog.end();
  }
  const settleDeadline = Date.now() + 120_000;
  let settled = false;
  while (Date.now() < settleDeadline) {
    const state = await json('GET', `/sessions/${session.id}/run/state?frames=0`, { project });
    if (state.status !== 'running') { settled = true; break; }
    await sleep(1000);
  }
  if (!settled) m.errors.push({ message: 'Server still running 120s after stream ended/abort' });
  m.durationMs = Date.now() - started;
  m.settled = settled;
  m.sessionId = session.id;
  m.sessionFile = session.sessionFile;
  const messages = jsonLines(session.sessionFile).filter(r => r.type === 'message').map(r => r.message);
  m.reportedModels = [...new Set(messages.filter(x => x?.role === 'assistant').map(x => `${x.provider}/${x.model}`))];
  m.offload = samples.flatMap(s => (s.models ?? []).filter(x => model.endsWith('/' + x.name)).map(x => ({ at: s.at,
    model: x.name, loadedContextTokens: x.context_length, sizeBytes: x.size, vramBytes: x.size_vram,
    vramFraction: x.size ? x.size_vram / x.size : null, cli: s.cli })));
  return m;
}

export async function main(args = process.argv.slice(2)) {
  const o = options(args);
  if (o.help) { console.log('node geo/release-proof/route-trial.mjs --route local --context 65536|98304 --workflow well-log-qc|geo-map-and-crs [--out DIR]\nSee geo/release-proof/route-usage.md for attach/paid routes.'); return; }
  const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const runDir = path.resolve(o.out ?? process.env.TASK_OUTPUT_DIR ?? path.join(os.homedir(), 'data/geoaidesk/work/gaid-release-proof--routes', `${Date.now()}-${o.workflow}-${o.context}`));
  const dataHome = path.resolve(o['data-home'] ?? path.join(runDir,'home'));
  for (const dir of [runDir, dataHome]) if (dir === checkout || dir.startsWith(checkout + path.sep)) throw new Error('Evidence/data must be outside the checkout');
  fs.mkdirSync(runDir, { recursive: true });
  const recordFile = path.join(runDir,'record.json');
  if (fs.existsSync(recordFile)) throw new Error('Refusing to overwrite an evidence record');
  if (!o.api && fs.existsSync(dataHome) && fs.readdirSync(dataHome).length) throw new Error('New instance requires a fresh data home');
  const distribution = JSON.parse(fs.readFileSync(path.join(checkout,'geo/distribution.json')));
  const record = { schema: 'gaid-route-evidence/v1', recordedAt: new Date().toISOString(), host: { label: os.hostname(), ...hostFacts() },
    app: { version: distribution.version, commit: process.env.TASK_SOURCE_SHA ?? execFileSync('git',['rev-parse','HEAD'],{cwd:checkout,encoding:'utf8'}).trim() },
    route: { accountRoute: o.route, appContextTokens: o.context },
    connection: { outcome: 'not-run' }, task: { workflowId: o.workflow, outcome: 'not-run', errors: [] },
    knownLimits: ['Artifact existence and synthetic area agreement are engineering acceptance, not scientific validation.', 'Context peak uses provider usage plus app context frames; unavailable usage stays null.', 'Ollama VRAM fraction is byte allocation, not a measured fraction of GPU compute.'],
  };
  let instance, model, json, prepared;
  const save = () => fs.writeFileSync(recordFile, JSON.stringify(record,null,2)+'\n');
  save();
  try {
    prepared = prepareTask({ workflowId: o.workflow, assetsRoot: o['assets-root'] ?? process.env.TASK_ASSETS_DIR ?? path.join(os.homedir(),'assets'), runDir, catalogueVersion: distribution.catalogue.version });
    if (o.api) instance = { api: o.api, dataHome, stop: async () => {} };
    else instance = await startInstance({ checkout, dataHome, runDir, env: { OLLAMA_BASE_URL: o['ollama-url'] } });
    json = (method, route, opts) => requestJson(instance.api, method, route, opts);
    if (o.route === 'local') {
      const status = await json('POST','/geo/local-model/configure', { body: { model: o.model, contextWindow: o.context, maxTokens: 8192, createVariant: true, setDefault: true } });
      const info = status.models.find(x => x.model === status.provider?.models[0]?.id);
      if (info?.configuredContext !== o.context || status.verification.state !== 'verified') throw new Error(`Local context mismatch: ${JSON.stringify(status.verification)}`);
      model = `gaid-local/${info.model}`;
      record.route = { ...record.route, provider: 'gaid-local', modelId: info.model, serverContextTokens: info.configuredContext, billingMode: 'local' };
    } else {
      model = o.model;
      const provider = model.split('/')[0];
      if (o.route === 'chatgpt-signin' && !['openai','openai-codex'].includes(provider)) throw new Error('ChatGPT sign-in requires openai or openai-codex');
      if (o.route === 'api-key') {
        const providers = await json('GET','/providers');
        if (!providers.providers.some(p => p.id === provider && p.configured && p.authType === 'api_key')) throw new Error('Selected provider is not API-key connected in GAID Settings');
      }
      const list = await json('GET', o.route === 'api-key' ? '/providers/models' : '/model-providers/models');
      const selected = list.models.find(x => x.id === model || `${x.provider}/${x.modelId}` === model);
      if (!selected) throw new Error('Selected route/model not listed: connect the intended credential in GAID Settings first');
      record.route = { ...record.route, provider, modelId: model.slice(provider.length+1), appContextTokens: selected.context_length,
        billingMode: selected.billingMode, pricingUsdPerMillionTokens: selected.pricing };
    }
    const project = await json('POST','/projects', { body: { name: `Route trial ${o.workflow} ${o.context}`, spendLimitUsd: o.spendLimit } });
    record.projectId = project.id;
    const sandbox = path.join(dataHome,'projects',project.id,'sandbox');
    if (!fs.existsSync(sandbox)) throw new Error('Attach data home does not match the API project storage');
    const connectionSession = await json('POST','/sessions', { project: project.id, body: { geoExposure: `workflow:${o.workflow}` } });
    record.connection = { outcome: 'not-run', testedAt: new Date().toISOString(), sessionId: connectionSession.id }; save();
    const conn = await runChat({ json, api: instance.api, project: project.id, session: connectionSession, model,
      prompt: 'Connection check only. Reply with exactly GAID_ROUTE_OK. Do not use tools or read files.', runDir, label: 'connection', timeoutMs: Math.min(o.timeoutMs, 10*60_000), ollamaUrl: o.route === 'local' ? o['ollama-url'] : null });
    const messages = jsonLines(connectionSession.sessionFile).filter(r => r.type === 'message').map(r => r.message);
    const answer = messages.filter(m => m?.role === 'assistant').flatMap(m => m.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('');
    record.connection = { ...conn, testedAt: record.connection.testedAt, latencyMs: conn.durationMs,
      outcome: conn.done && !conn.errors.length && conn.toolCalls === 0 && answer.trim() === 'GAID_ROUTE_OK' && conn.reportedModels.includes(model) ? 'passed' : 'failed' };
    save();
    // Run the workflow even after a failed connection, preserving independent outcomes.
    const form = new FormData();
    for (const f of prepared.files) form.append('files', new Blob([fs.readFileSync(f.file)]), f.name);
    await json('POST','/sandbox/upload', { project: project.id, body: form });
    const session = await json('POST','/sessions', { project: project.id, body: { geoExposure: `workflow:${o.workflow}` } });
    const context = await json('GET',`/geo/context?sessionId=${session.id}&model=${encodeURIComponent(model)}`,{ project: project.id });
    fs.writeFileSync(path.join(runDir,'initial-context.json'),JSON.stringify(context,null,2)+'\n');
    record.task = { workflowId: o.workflow, outcome: 'not-run', startedAt: new Date().toISOString(), inputs: prepared.inputs, sessionId: session.id }; save();
    const m = await runChat({ json, api: instance.api, project: project.id, session, model, prompt: prepared.prompt, runDir, label: 'task', timeoutMs: o.timeoutMs, ollamaUrl: o.route === 'local' ? o['ollama-url'] : null });
    const ledgerPath = path.join(sandbox,'.kady/runs',session.id,'costs.jsonl');
    const ledger = jsonLines(ledgerPath);
    const artifacts = checkArtifacts(sandbox,prepared.expectedArtifacts,prepared.reference);
    const accountingPassed = ledger.length > 0 && (o.route !== 'local' || ledger.every(r => r.billingMode === 'local' && r.costUsd === 0));
    const loaded = [...conn.offload,...m.offload];
    const allocationPassed = o.route !== 'local' || (loaded.length > 0 && loaded.every(s => s.loadedContextTokens === o.context));
    record.task = { ...record.task, ...m, ...artifacts, contextPeakRatio: m.contextPeakTokens === null ? null : m.contextPeakTokens/record.route.appContextTokens,
      streamedInputTokens: m.inputTokens, streamedOutputTokens: m.outputTokens,
      inputTokens: ledger.length ? ledger.reduce((s,r) => s+r.promptTokens,0) : m.inputTokens,
      outputTokens: ledger.length ? ledger.reduce((s,r) => s+r.completionTokens,0) : m.outputTokens,
      tokenAccounting: ledger.length ? 'ledger-including-compaction-and-aborted-usage' : 'streamed-turns-only',
      ledgerCostUsd: ledger.length ? ledger.reduce((s,r) => s+r.costUsd,0) : null, ledger,
      accountingPassed, allocationPassed,
      evidence: { session: fileEvidence(session.sessionFile,runDir), ledger: fileEvidence(ledgerPath,runDir),
        notebookPath: path.relative(runDir,path.join(sandbox,'.kady/notebook',`${session.id}.jsonl`)),
        provenancePath: path.relative(runDir,path.join(sandbox,'.kady/provenance',session.id,'steps.jsonl')) } };
    if (!m.done || !m.settled || m.errors.length || !accountingPassed || !allocationPassed) record.task.outcome = artifacts.outcome === 'failed' ? 'failed' : 'partial';
  } catch (e) {
    record.task.errors ??= [];
    record.task.errors.push({ type: 'harness', message: e.stack ?? e.message });
    record.task.outcome = 'failed';
  } finally {
    if (instance && o.route === 'local' && record.route.modelId) {
      try { await modelRequest(o['ollama-url'],'/api/generate',{ model: record.route.modelId, keep_alive: 0 }); }
      catch (e) { record.knownLimits.push(`Model unload failed: ${e.message}`); }
    }
    if (instance) {
      try { await instance.stop(); record.serviceStopped = !o.api; }
      catch (e) { record.serviceStopped = false; record.knownLimits.push(`Service cleanup failed: ${e.message}`); }
    }
    record.recordedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ record: recordFile, connection: record.connection.outcome, task: record.task.outcome }));
  }
  if (record.task.outcome !== 'passed' || record.connection.outcome !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

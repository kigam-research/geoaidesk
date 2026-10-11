import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { options, runChat } from './route-trial.mjs';
import { metrics, observe, checkArtifacts } from './route-metrics.mjs';

test('paid and subscription calls are opt-in before any run', () => {
  for (const route of ['api-key','chatgpt-signin']) assert.throws(() => options(['--route',route]), /refused/);
  assert.throws(() => options(['--api','http://localhost:8000']), /data-home/);
});

test('artifact presence cannot pass a wrong synthetic area table', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'gaid-route-artifacts-'));
  try {
    fs.mkdirSync(path.join(root,'results/route-trial'), { recursive: true });
    const file = path.join(root,'results/route-trial/area-table.csv');
    const expected = [{id:'area-table', files:['area-table.csv']}];
    const reference = { expected_area_m2: { A: 30000, B: 20000 } };
    fs.writeFileSync(file,'class,area_m2\nA,30001\nB,20000\n');
    assert.equal(checkArtifacts(root,expected,reference).outcome,'partial');
    fs.writeFileSync(file,'class,area_m2\n"A",30000\nB,20000\n');
    assert.equal(checkArtifacts(root,expected,reference).outcome,'passed');
    fs.writeFileSync(file,'');
    assert.equal(checkArtifacts(root,expected,reference).outcome,'failed');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});

test('provider usage, recovered tool errors and dependency repairs remain distinct', () => {
  const m = metrics();
  observe(m,{type:'context_usage',tokens:null});
  assert.equal(m.contextPeakTokens,null);
  observe(m,{type:'turn_end',usage:{input:100,output:10,cacheRead:50}});
  observe(m,{type:'tool_start',toolName:'bash',args:{command:'uv add lasio'}});
  observe(m,{type:'tool_end',isError:true});
  observe(m,{type:'retry'});
  assert.equal(m.contextPeakTokens,160);
  assert.equal(m.dependencyRepairs.length,1);
  assert.equal(m.toolErrors.length,1);
  assert.equal(m.errors.length,0);
  assert.equal(m.retries,1);
});

test('timed-out stream aborts server work and waits for settled accounting', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'gaid-route-stream-'));
  const sessionFile = path.join(root,'session.jsonl'); fs.writeFileSync(sessionFile,'');
  const server = http.createServer((_req,res) => { res.writeHead(200,{'Content-Type':'text/event-stream'}); res.write('data: {"type":"turn_start"}\n\n'); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const calls = [];
  try {
    const result = await runChat({ json: async (method,route) => { calls.push([method,route]); return {status:'complete'}; },
      api:`http://127.0.0.1:${server.address().port}`, project:'trial',session:{id:'s',sessionFile},model:'gaid-local/test',prompt:'test',
      runDir:root,label:'timeout',timeoutMs:100,ollamaUrl:null });
    assert.equal(result.done,false);
    assert.equal(result.settled,true);
    assert.equal(calls[0][1],'/sessions/s/abort');
    assert.ok(result.errors.length);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root,{recursive:true,force:true}); }
});

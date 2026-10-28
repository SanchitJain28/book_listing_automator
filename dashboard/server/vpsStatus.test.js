import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { vpsStatusMiddleware } from './vpsStatus.js';
const require = createRequire(import.meta.url);
const { vps6Credentials } = require('../../scripts/vps-status.js');

test('SSH target and password are selected only from the configured VPS 6 section', () => {
  const fixture = '# Servers\n## VPS 5\n- IP : 162.35.176.48\n- PASSWORD : nope\n\n## VPS 6\n- IP : 200.234.32.63\n- PASSWORD : `example test password`\n\n## VPS 7\n- IP : 162.35.180.234\n- PASSWORD : other\n';
  assert.deepEqual(vps6Credentials(fixture), { host: '200.234.32.63', password: 'example test password' });
  assert.throws(() => vps6Credentials(fixture.replace('200.234.32.63', '203.0.113.99')), /differs from the configured batch/);
  assert.throws(() => vps6Credentials('## VPS 6\n- IP : 200.234.32.63\n'), /credentials are missing/);
});

test('status endpoint is local, read-only, accepts no targets, and coalesces concurrent checks', async () => {
  let calls = 0, finish;
  const result = { vps: 'VPS 6', scrapers: [] };
  const handler = vpsStatusMiddleware('/unused', () => { calls++; return new Promise(resolve => { finish = () => resolve(result); }); });
  async function request(url, headers = {}, method = 'GET') {
    const response = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } };
    await handler({ url, method, headers: { host: '127.0.0.1:5174', ...headers } }, response, () => { response.next = true; });
    return response;
  }
  assert.equal((await request('/api/vps-status', { origin: 'https://example.com' })).statusCode, 403);
  assert.equal((await request('/api/vps-status', { host: 'example.com' })).statusCode, 403);
  assert.equal((await request('/api/vps-status', { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
  assert.equal((await request('/api/vps-status', {}, 'POST')).statusCode, 405);
  assert.equal((await request('/api/vps-status?host=another')).statusCode, 400);
  assert.equal((await request('/other')).next, true);
  const first = request('/api/vps-status'), second = request('/api/vps-status');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1); finish();
  for (const res of await Promise.all([first, second])) { assert.deepEqual(res.body, result); assert.equal(res.headers['Cache-Control'], 'no-store'); }
});

test('collector counts latest input outcomes, distinguishes blocks and errors and ignores unfinished writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vps-status-'));
  try {
    const rows = [
      { input_index: 0, stock_status: 'Blocked', error: 'HTTP 503' },
      { input_index: 1, stock_status: 'Error', error: 'extraction failed' },
      { input_index: 2, stock_status: 'In Stock', in_stock: true, found: true, isbn_matched: true },
      { input_index: 3, stock_status: 'Not Listed', found: false },
      { input_index: 4, stock_status: 'ISBN mismatch', found: false, in_stock: true },
      { input_index: 5, stock_status: 'Out of Stock', in_stock: false, found: true, listings: [{ isbn_match: true }] },
      { input_index: 0, stock_status: 'Not Listed', found: false }, // latest retry wins
    ];
    const file = path.join(dir, 'results.jsonl');
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\nnot json\n{"input_index":6');
    const collector = path.resolve('..', 'scripts/vps-status/collector.py');
    const program = `import importlib.util,json,sys\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('collector',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nr,b,t,e=m.read_output(Path(sys.argv[2]),10);c,status=m.summarize(r);print(json.dumps({'rows':len(r),'invalid':b,'counts':c,'statuses':status}))`;
    const processResult = spawnSync('python3', ['-c', program, collector, file], { encoding: 'utf8' });
    assert.equal(processResult.status, 0, processResult.stderr);
    const data = JSON.parse(processResult.stdout);
    assert.equal(data.rows, 6); assert.equal(data.invalid, 1);
    assert.deepEqual(data.counts, { blocked: 0, errors: 1, matched: 2, found: 2, in_stock: 1, out_of_stock: 1, not_listed: 2, isbn_mismatch: 1 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('process collector sorts RAM, follows scraper ancestry and does not expose command arguments', () => {
  const collector = path.resolve('..', 'scripts/vps-status/collector.py');
  const program = `import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('collector',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(json.dumps(m.parse_processes(sys.stdin.read(),1024*1024*1024,limit=3)))`;
  const fixture = [
    '100 1 102400 node node scrapers/mypustak/mypustak-isbn.js --secret=PRIVATE_SECRET',
    '101 100 204800 chrome chrome --type=renderer --token=PRIVATE_SECRET',
    '102 101 51200 chrome chrome --type=utility',
    '103 1 512000 service service --password=PRIVATE_SECRET',
  ].join('\n');
  const child = spawnSync('python3', ['-c', program, collector], { input: fixture, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.ok(!child.stdout.includes('PRIVATE_SECRET'));
  const data = JSON.parse(child.stdout);
  assert.equal(data.process_count, 4); assert.deepEqual(data.processes.map(row => row.pid), [103, 101, 100]);
  assert.equal(data.processes[1].browser_type, 'renderer'); assert.equal(data.processes[1].scraper, 'mypustak');
  assert.equal(data.processes[1].memory_percent, 19.53);
  assert.deepEqual(data.scraper_groups, [{ scraper: 'mypustak', rss_bytes: 358400 * 1024, process_count: 3 }]);
});

test('shared runner monitoring distinguishes queued jobs and identifies the shared process tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-monitor-'));
  try {
    fs.mkdirSync(path.join(dir, 'output'));
    fs.writeFileSync(path.join(dir, 'output/result.jsonl'), '{"input_index":0,"stock_status":"In Stock","found":true}\n');
    fs.writeFileSync(path.join(dir, 'output/result.jsonl.blocked.jsonl'), '{"input_index":1,"stock_status":"Blocked"}\n');
    fs.writeFileSync(path.join(dir, 'output/runtime.json'), JSON.stringify({ runtime: { browser_instances:2,active_contexts:4,queued_contexts:4 }, scrapers:{ mypustak:{state:'Queued'} } }));
    fs.writeFileSync(path.join(dir, 'sessions.json'), JSON.stringify({mypustak:{total_inputs:3,output:'output/result.jsonl',session:'shared-session',exit_file:path.join(dir,'exit'),runtime_status:'output/runtime.json'}}));
    const collector=path.resolve('..','scripts/vps-status/collector.py');
    const program=`import importlib.util,json,sys\nfrom pathlib import Path\nfrom types import SimpleNamespace\ns=importlib.util.spec_from_file_location('collector',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nm.subprocess.run=lambda *a,**k:SimpleNamespace(returncode=0,stdout='shared-session\\n',stderr='')\nm.process_info=lambda *a:{}\nr=m.collect(Path(sys.argv[2]),Path(sys.argv[2])/'sessions.json')\np=m.parse_processes('100 1 100 node node scripts/run-shared-scrapers.js input.txt\\n101 100 200 chrome chrome --type=renderer',1000000)\nprint(json.dumps({'status':r,'processes':p}))`;
    const child=spawnSync('python3',['-c',program,collector,dir],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);const data=JSON.parse(child.stdout);
    assert.equal(data.status.scrapers[0].state,'Queued');assert.equal(data.status.scrapers[0].running,false);assert.equal(data.status.scrapers[0].session_alive,true);
    assert.equal(data.status.scrapers[0].processed,1);assert.equal(data.status.scrapers[0].counts.blocked,1);assert.equal(data.status.shared_runtime.active_contexts,4);assert.equal(data.processes.processes[0].scraper,'shared-pool');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

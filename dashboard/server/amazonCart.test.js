import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { AmazonCartService, amazonCartMiddleware } from './amazonCart.js';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amazon-dashboard-'));
  await fs.mkdir(path.join(root, 'sheet_configs'));
  await fs.writeFile(path.join(root, 'sheet_configs', 'books.json'), JSON.stringify({ tabName: 'Books & editions', items: [{ isbn: '9780813507699' }], latestCursor: { batchNumber: 17, sheetRowNumber: 902 } }));
  const child = new EventEmitter(); child.pid = 123456; child.connected = true; child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.sent = []; child.send = data => child.sent.push(data); child.kill = signal => { child.killed = signal; queueMicrotask(() => child.emit('exit', 0, null)); };
  let spawned;
  const service = new AmazonCartService(root, { fork: (...args) => { spawned = args; return child; }, killGroup: () => {} });
  return { root, service, child, spawned: () => spawned, cleanup: async () => { service.close(); await fs.rm(root, { recursive: true, force: true }); } };
}
const start = { op: 'start', config: 'books.json', profile: '2', mode: 'manual', cursor: '17' };
const event = (child, name, data) => child.emit('message', { type: 'amazon-cart', event: name, data });

test('launches only the fixed cart script with listed config and validated arguments', async () => {
  const f = await fixture();
  try {
    await f.service.start(start);
    const [script, args, options] = f.spawned();
    assert.equal(script, path.join(f.root, 'scripts', 'amazon-cart-automator.js'));
    assert(args.includes('--dashboard')); assert(args.includes('--profile=2')); assert(args.includes('--cursor=17')); assert(!args.includes('--auto'));
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe', 'ipc']); assert.deepEqual(options.execArgv, []);
    await assert.rejects(f.service.start(start), /already open/);
  } finally { await f.cleanup(); }
});

test('rejects arbitrary config paths, profiles and cursors, and serializes concurrent launches', async () => {
  const f = await fixture();
  try {
    for (const edit of [{ config: '../../credentials.json' }, { profile: '2; touch bad' }, { cursor: '17 --auto' }, { mode: 'shell' }]) await assert.rejects(f.service.start({ ...start, ...edit }));
    const results = await Promise.allSettled([f.service.start(start), f.service.start(start)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  } finally { await f.cleanup(); }
});

test('manual prompts accept one matching reply and reject stale or invalid actions', async () => {
  const f = await fixture();
  try {
    await f.service.start(start); event(f.child, 'prompt', { id: '1', kind: 'add', defaultValue: 'YES' });
    const body = { sessionId: f.service.session.id, promptId: f.service.session.prompt.id, value: 'YES' };
    assert.throws(() => f.service.reply({ ...body, value: 'START' }), /offered/);
    assert.throws(() => f.service.reply({ ...body, promptId: 'old' }), /changed/);
    f.service.reply(body); assert.deepEqual(f.child.sent.at(-1), { type: 'dashboard:reply', id: '1', value: 'YES' });
    assert.throws(() => f.service.reply(body), /changed/); assert.equal(f.child.sent.length, 1);
  } finally { await f.cleanup(); }
});

test('structured updates preserve title reasons, bound history and strip offer tokens', async () => {
  const f = await fixture();
  try {
    await f.service.start(start);
    event(f.child, 'evaluation', { chosenOffer: { candidateAsin: '1905721005', offerId: 'secret-token', productUrl: 'signed-url' }, identityChecks: [{ titleCheck: { isMatching: true, reason: 'Same work, same volume.' } }] });
    assert.equal(f.service.snapshot().session.evaluation.chosenOffer.offerId, undefined);
    assert.equal(f.service.snapshot().session.evaluation.identityChecks[0].titleCheck.reason, 'Same work, same volume.');
    for (let i = 0; i < 105; i++) event(f.child, 'record', { isbn: String(i), cartAddedSuccess: true, cartItemsThisBatch: 5, evaluatedOffers: [{ title: 'Large detail' }] });
    assert.equal(f.service.session.records.length, 100); assert.equal(f.service.session.added, 105); assert.equal(f.service.session.records[0].evaluatedOffers, undefined);
    for (let i = 0; i < 305; i++) f.child.stdout.write(`\x1b[31mline ${i}\x1b[0m\n`);
    assert.equal(f.service.session.logs.length, 300); assert(!f.service.session.logs[0].message.includes('\x1b'));
    const snap = f.service.snapshot(); snap.session.logs.length = 0; assert.equal(f.service.session.logs.length, 300);
  } finally { await f.cleanup(); }
});

test('pause/resume do not send replies; stop terminates only the owned child', async () => {
  const f = await fixture();
  try {
    await f.service.start(start);
    f.service.control({ op: 'pause', sessionId: f.service.session.id }); assert.equal(f.service.session.status, 'pausing');
    event(f.child, 'state', { status: 'paused' }); f.service.control({ op: 'resume', sessionId: f.service.session.id });
    assert.deepEqual(f.child.sent.map(m => m.type), ['dashboard:pause', 'dashboard:resume']);
    f.service.control({ op: 'stop', sessionId: f.service.session.id }); assert.equal(f.child.killed, 'SIGTERM');
    await new Promise(resolve => setImmediate(resolve)); assert.equal(f.service.session.status, 'stopped');
  } finally { await f.cleanup(); }
});

test('reconnecting snapshots never replay prompt replies; exit clears obsolete prompts', async () => {
  const f = await fixture();
  try {
    await f.service.start(start); event(f.child, 'prompt', { id: '1', kind: 'feedback' });
    const id = f.service.snapshot().session.prompt.id;
    assert.equal(f.service.snapshot().session.prompt.id, id); assert.equal(f.child.sent.length, 0);
    f.child.emit('exit', 1); assert.equal(f.service.session.status, 'failed'); assert.equal(f.service.session.prompt, null);
  } finally { await f.cleanup(); }
});

async function request(middleware, { method = 'GET', origin, host = '127.0.0.1:5173', body, url = '/api/amazon-cart', fetchSite } = {}) {
  const req = new EventEmitter(); req.url = url; req.method = method;
  req.headers = { host, ...(origin && { origin }), ...(body && { 'content-type': 'application/json' }), ...(fetchSite && { 'sec-fetch-site': fetchSite }) };
  req[Symbol.asyncIterator] = async function* () { if (body) yield JSON.stringify(body); };
  const res = new EventEmitter(); res.headers = {}; res.statusCode = 200;
  res.setHeader = (key, value) => { res.headers[key] = value; }; res.end = text => { res.body = text; };
  await middleware(req, res, () => { res.next = true; }); return res;
}

test('HTTP mutations are same-origin only, and GET never starts a process', async () => {
  const f = await fixture();
  try {
    const middleware = amazonCartMiddleware(f.service);
    const catalog = await request(middleware); assert.equal(JSON.parse(catalog.body).tabs[0].name, 'Books & editions'); assert.equal(f.spawned(), undefined);
    for (const options of [{ host: 'attacker.example' }, { method: 'POST', body: start }, { method: 'POST', origin: 'https://attacker.example', body: start }, { fetchSite: 'cross-site' }]) assert.equal((await request(middleware, options)).statusCode, 403);
    const launched = await request(middleware, { method: 'POST', origin: 'http://127.0.0.1:5173', body: start }); assert.equal(launched.statusCode, 200); assert(f.spawned());
  } finally { await f.cleanup(); }
});

test('engine IPC prompts wait for the matching web response and pause at a checkpoint', async () => {
  const filename = fileURLToPath(new URL('../../scripts/amazon-cart-automator.js', import.meta.url));
  const code = await fs.readFile(filename, 'utf8');
  const processStub = new EventEmitter(); processStub.argv = ['node', filename, '--dashboard']; processStub.env = {}; processStub.connected = true;
  const messages = []; processStub.send = message => messages.push(message);
  const sandbox = { module: { exports: {} }, require: createRequire(filename), __dirname: path.dirname(filename), process: processStub, console, setTimeout, clearTimeout, setInterval, clearInterval, AbortController };
  vm.runInNewContext(`${code}\nmodule.exports.ask = ask; module.exports.checkpoint = dashboardCheckpoint;`, sandbox);
  const pending = sandbox.module.exports.ask('🛒 [FIELD 2] ADD TO CART? (YES / NO) [default: YES]: ');
  const prompt = messages.at(-1).data; assert.equal(prompt.kind, 'add'); assert.equal(prompt.defaultValue, 'YES');
  processStub.emit('message', { type: 'dashboard:reply', id: 'stale', value: 'YES' }); assert.equal(messages.at(-1).event, 'prompt');
  processStub.emit('message', { type: 'dashboard:reply', id: prompt.id, value: 'NO' }); assert.equal(await pending, 'NO');
  processStub.emit('message', { type: 'dashboard:pause' }); const paused = sandbox.module.exports.checkpoint(); assert.equal(messages.at(-1).data.status, 'paused');
  processStub.emit('message', { type: 'dashboard:resume' }); await paused; assert.equal(messages.at(-1).data.status, 'running');
});

test('live stream sends the latest snapshot and removes listeners when the browser leaves', async () => {
  const f = await fixture();
  try {
    const req = new EventEmitter(); req.url = '/api/amazon-cart/events'; req.method = 'GET'; req.headers = { host: '127.0.0.1:5173' };
    const res = new EventEmitter(); res.setHeader = () => {}; res.flushHeaders = () => {};
    const writes = []; res.write = data => { writes.push(data); return true; }; res.end = () => {};
    await amazonCartMiddleware(f.service)(req, res, () => {});
    assert(writes[0].includes('event: snapshot')); assert.equal(f.service.listenerCount('change'), 1);
    f.service.changed(); await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(writes.length, 2); assert(writes[1].includes('"version":1'));
    res.emit('close'); assert.equal(f.service.listenerCount('change'), 0);
  } finally { await f.cleanup(); }
});

test('a failed process launch leaves a retryable failed session', async () => {
  const f = await fixture();
  try {
    f.service.spawn = () => { throw new Error('Browser process could not start'); };
    await assert.rejects(f.service.start(start), /could not start/);
    assert.equal(f.service.session.status, 'failed');
    f.service.spawn = () => f.child; await f.service.start(start); assert.equal(f.service.session.status, 'starting');
  } finally { await f.cleanup(); }
});

test('real child-process IPC carries a web decision through to a completed session', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amazon-ipc-'));
  await fs.mkdir(path.join(root, 'sheet_configs')); await fs.mkdir(path.join(root, 'scripts'));
  await fs.writeFile(path.join(root, 'sheet_configs', 'books.json'), JSON.stringify({ tabName: 'Fixture only', items: [{ isbn: '9780813507699' }] }));
  await fs.writeFile(path.join(root, 'scripts', 'amazon-cart-automator.js'), `
    const send = (event, data) => process.send({type:'amazon-cart',event,data});
    send('configuration', {total:1,mode:'manual'});
    send('book', {isbn:'9780813507699',sheetRowNumber:902,index:1,total:1,cartItemsThisBatch:0});
    send('evaluation', {isbn:'9780813507699',status:'QUALIFIED'});
    send('prompt', {id:'1',kind:'add',defaultValue:'YES'});
    process.on('message', message => {
      if(message.type==='dashboard:reply' && message.id==='1' && message.value==='YES') {
        send('record', {isbn:'9780813507699',cartAddedSuccess:true,cartItemsThisBatch:1});
        send('finished',{completed:true});
        setTimeout(()=>process.exit(0),20);
      }
    });
  `);
  const service = new AmazonCartService(root);
  const waitFor = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { service.off('change', check); reject(new Error('Fixture IPC timed out')); }, 3000);
    const check = () => { if (predicate()) { clearTimeout(timer); service.off('change', check); resolve(); } };
    service.on('change', check); check();
  });
  try {
    await service.start({ ...start, cursor: '' }); await waitFor(() => service.session.prompt?.kind === 'add');
    service.reply({ sessionId: service.session.id, promptId: service.session.prompt.id, value: 'YES' });
    await waitFor(() => service.session.status === 'completed');
    assert.equal(service.session.added, 1); assert.equal(service.session.processed, 1); assert.equal(service.session.prompt, null);
  } finally { service.close(); await fs.rm(root, { recursive: true, force: true }); }
});

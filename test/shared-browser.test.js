const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { SharedBrowserPool } = require('../utils/sharedBrowserPool');
const { createRecyclingPageSession } = require('../utils/managedBrowser');
const { runShared, registry } = require('../scripts/run-shared-scrapers');

function fakeLaunch() {
  const browsers = [];
  const launch = async () => {
    const browser = { connected: true, contexts: [], isConnected() { return this.connected; }, async close() { this.connected = false; for (const context of this.contexts) await context.close(); },
      async newContext(options) {
        const context = Object.assign(new EventEmitter(), { options, live: [], routes: 0, closed: false,
          pages() { return this.live.filter(page => !page.closed); },
          async newPage() { const page = { closed: false, isClosed() { return this.closed; }, async close() { this.closed = true; } }; this.live.push(page); this.emit('page', page); return page; },
          async route() { this.routes++; }, async storageState() { return { cookies: [{ name: 'test', value: 'session', domain: 'example.test', path: '/' }], origins: [] }; },
          async close() { this.closed = true; for (const page of this.live) await page.close(); },
        });
        browser.contexts.push(context); return context;
      } };
    browsers.push(browser); return browser;
  };
  return { launch, browsers };
}
function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-browser-'));
  return Promise.resolve().then(() => fn(dir)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('pool uses two browsers, caps active contexts, saves private state and releases queued work fairly', () => fixture(async dir => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, stateDir: dir, logger: () => {} });
  const leases = await Promise.all(['a','b','c','d'].map(name => pool.acquire(name)));
  assert.equal(fake.browsers.length, 2); assert.equal(pool.stats().active_contexts, 4);
  let resolved = false; const queued = pool.acquire('e').then(lease => { resolved = true; return lease; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(resolved, false);
  await leases[0].release(); const fifth = await queued;
  assert.equal(leases[0].context.closed, true); assert.equal(pool.stats().active_contexts, 4);
  assert.equal(fs.statSync(path.join(dir, 'a.json')).mode & 0o777, 0o600);
  await fifth.release(); for (const lease of leases.slice(1)) await lease.release();
  const resumed = await pool.acquire('a'); assert.equal(resumed.context.options.storageState.cookies[0].name, 'test');
  await resumed.release(); await pool.close();
  assert.ok(fake.browsers.every(browser => !browser.connected));
}));
test('pool context cleanup removes extra pages; cache mode installs no routes', async () => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, browserCount: 1, concurrency: 1, resources: 'cache' });
  const lease = await pool.acquire('a'); await lease.context.newPage(); await lease.context.newPage();
  assert.equal(lease.context.pages().length, 2); await lease.clean();
  assert.equal(lease.context.pages().length, 1); assert.equal(lease.context.routes, 0);
  await pool.close();
});
test('closing a pool during browser launch closes the newly launched browser and rejects its waiter', async () => {
  const fake = fakeLaunch(); let resolveLaunch;
  const pool = new SharedBrowserPool({ browserCount: 1, concurrency: 1, launch: () => new Promise(resolve => { resolveLaunch = resolve; }) });
  const lease = pool.acquire('a'); const rejection = assert.rejects(lease, /closed/);
  const closed = pool.close(); resolveLaunch(await fake.launch());
  await closed; await rejection; assert.equal(fake.browsers[0].connected, false);
});
test('a disconnected browser is replaced before its next lease', async () => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, browserCount: 1, concurrency: 1 });
  const first = await pool.acquire('a'); fake.browsers[0].connected = false; await first.release();
  const second = await pool.acquire('a'); assert.equal(fake.browsers.length, 2); await second.release(); await pool.close();
});
test('standalone session recycles at a saved input boundary and cleans stray pages', async () => {
  const fake = fakeLaunch(); const browser = await fake.launch();
  const session = createRecyclingPageSession({ recycleEvery: 2, logger: () => {}, open: async () => { const context = await browser.newContext({}); return { context, page: await context.newPage() }; } });
  const first = await session.getPage(); await browser.contexts[0].newPage(); await session.afterRecord();
  assert.equal(browser.contexts[0].pages().length, 1); assert.equal(await session.getPage(), first);
  await session.afterRecord(); assert.equal(browser.contexts[0].closed, false);
  assert.notEqual(await session.getPage(), first); assert.equal(browser.contexts[0].closed, true);
  assert.equal(session.stats().generation, 2); await session.close();
});
test('shared runner yields bounded batches, preserves duplicate positions and resumes at the last saved row', () => fixture(async dir => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, browserCount: 1, concurrency: 1 });
  const items = [{ searched_isbn: 'a' }, { searched_isbn: 'a' }, { searched_isbn: 'b' }], calls = [];
  const identity = row => row.searched_isbn;
  const jobs = ['one','two'].map(name => ({ name, identity, output: path.join(dir, name+'.jsonl'), scrape: async (_, item) => { calls.push(name); return { found: true, isbn_matched: true, stock_status: 'In Stock' }; } }));
  const states = await runShared({ jobs, items, pool, batchSize: 1, sleep: async () => {}, logger: () => {} });
  assert.deepEqual(calls, ['one','two','one','two','one','two']);
  assert.ok(Object.values(states).every(state => state.state === 'Finished' && state.context_batches === 3));
  const rows = fs.readFileSync(jobs[0].output, 'utf8').trim().split('\n').map(JSON.parse); assert.deepEqual(rows.map(row => row.input_index), [0,1,2]);
  calls.length = 0;
  const secondPool = new SharedBrowserPool({ launch: fake.launch, browserCount: 1, concurrency: 1 });
  await runShared({ jobs, items, pool: secondPool, sleep: async () => {}, logger: () => {} }); assert.equal(calls.length, 0);
}));
test('a blocked platform stops without saving the blocked ISBN while other jobs finish', () => fixture(async dir => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, browserCount: 1, concurrency: 2 });
  const items = [{ searched_isbn: 'a' },{ searched_isbn: 'b' }];
  const jobs = [{ name: 'blocked', identity: row => row.searched_isbn, output: path.join(dir,'blocked.jsonl'), scrape: async () => ({ stock_status:'Blocked', error_code:'blocked' }) },
    { name: 'good', identity: row => row.searched_isbn, output: path.join(dir,'good.jsonl'), scrape: async () => ({ found:true, isbn_matched:true }) }];
  const states = await runShared({ jobs, items, pool, sleep: async () => {}, logger: () => {} });
  assert.equal(states.blocked.state,'Blocked'); assert.equal(states.blocked.processed,0); assert.equal(states.good.processed,2);
  assert.equal(fs.existsSync(jobs[0].output),false); assert.equal(fs.existsSync(jobs[0].output+'.shared-pause.json'),true);
}));
test('interruption leaves the in-flight input unsaved and resumable', () => fixture(async dir => {
  const fake = fakeLaunch(), pool = new SharedBrowserPool({ launch: fake.launch, browserCount:1, concurrency:1 });
  const stop = new AbortController(), output = path.join(dir,'job.jsonl'); let calls=0;
  const jobs=[{name:'a',identity:row=>row.searched_isbn,output,scrape:async()=>{calls++;if(calls===2)stop.abort();return {found:true};}}];
  const states=await runShared({jobs,items:[{searched_isbn:'a'},{searched_isbn:'b'}],pool,signal:stop.signal,sleep:async()=>{},logger:()=>{}});
  assert.equal(states.a.state,'Stopped');assert.equal(states.a.processed,1);assert.equal(fs.readFileSync(output,'utf8').trim().split('\n').length,1);
}));
test('registry calls all eight platform interfaces correctly and excludes Amazon', async () => {
  const names={atlanticbooks:'scrapeAtlanticBook',bookswagon:'scrapeBookswagon',flipkart:'scrapeFlipkart',mypustak:'scrapeMyPustakBook',sapnaonline:'scrapeSapnaOnline',ompublication:'scrapeOmPublication',bookchor:'scrapeBookChor',abebooks:'scrapeAbeBooksBook'};
  const registered=registry();assert.deepEqual(Object.keys(registered).sort(),Object.keys(names).sort());
  const item={searched_isbn:'9780306406157',buy_url:'https://example.test/book'},page={};
  for(const [name,key] of Object.entries(names)){
    const module=require(`../scrapers/${name}/scraper`),original=module[key];let received;
    module[key]=async(...args)=>{received=args;return {};};
    try{await registered[name].scrape(page,item);assert.equal(received[0],page);
      if(['atlanticbooks','mypustak','abebooks'].includes(name))assert.deepEqual(received[1],{isbn:item.searched_isbn,directUrl:item.buy_url});
      else assert.deepEqual(received.slice(1),[item.buy_url,item.searched_isbn]);
    }finally{module[key]=original;}
  }
  assert.deepEqual(registered.bookswagon.prepareItems([item,item]).map(row=>row.input_occurrence),[1,2]);
});

test('shared runner resumes legacy AbeBooks output that contains a derived product URL', () => fixture(async dir => {
  const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:1});
  const output=path.join(dir,'abe.json'),items=[{searched_isbn:'9780306406157'},{searched_isbn:'9780816069613'}];
  fs.writeFileSync(output,JSON.stringify({...items[0],url:'https://www.abebooks.com/product',found:true,isbn_matched:true})+'\n');
  let calls=0;const job={...registry().abebooks,output,scrape:async()=>{calls++;return {found:true,isbn_matched:true};}};
  const states=await runShared({jobs:[job],items,pool,sleep:async()=>{},logger:()=>{}});
  assert.equal(calls,1);assert.equal(states.abebooks.processed,2);assert.equal(states.abebooks.matched_count,2);
}));
test('context close failure retires its browser before the next lease',async()=>{
 const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:1,logger:()=>{}});
 const first=await pool.acquire('a');first.context.close=async()=>{throw Error('failed close');};await first.release();
 assert.equal(fake.browsers[0].connected,false);
 const second=await pool.acquire('b');assert.equal(fake.browsers.length,2);await second.release();await pool.close();
});

test('oversized session state is preserved without restoring it, and future state excludes IndexedDB',()=>fixture(async dir=>{
 const {MAX_STATE_BYTES,boundedState}=require('../utils/sharedBrowserPool');const file=path.join(dir,'flipkart.json');fs.writeFileSync(file,Buffer.alloc(MAX_STATE_BYTES+1,32));
 const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:1,stateDir:dir,logger:()=>{}});
 const lease=await pool.acquire('flipkart');assert.equal(lease.context.options.storageState,undefined);assert.ok(fs.readdirSync(dir).some(name=>name.startsWith('flipkart.json.oversized-')));
 const safe=boundedState({cookies:[],origins:[{origin:'https://example.test',indexedDB:[{huge:'cache'}],localStorage:[{name:'small',value:'kept'},{name:'huge',value:'x'.repeat(70000)}]}]});
 assert.equal(safe.origins[0].indexedDB,undefined);assert.deepEqual(safe.origins[0].localStorage,[{name:'small',value:'kept'}]);await lease.release();await pool.close();
}));
test('cleanup failure never closes a browser while a sibling scraper is using it',async()=>{
 const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:2,logger:()=>{}});
 const first=await pool.acquire('a'),sibling=await pool.acquire('b');first.context.close=async()=>{throw Error('failed cleanup');};await first.release();
 assert.equal(fake.browsers[0].connected,true);assert.equal(sibling.page.isClosed(),false);
 let opened=false;const queued=pool.acquire('c').then(lease=>{opened=true;return lease;});await new Promise(r=>setImmediate(r));assert.equal(opened,false);
 await sibling.release();const next=await queued;assert.equal(fake.browsers.length,2);await next.release();await pool.close();
});
test('runner recovers a closed page and retries only the unsaved ISBN',()=>fixture(async dir=>{
 const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:1});const calls=[],output=path.join(dir,'flipkart.jsonl');
 const jobs=[{name:'flipkart',identity:r=>r.searched_isbn,output,scrape:async(page,item)=>{calls.push(item.searched_isbn);if(calls.length===1){await page.close();return {error:'Target page, context or browser has been closed',stock_status:'Error'};}return {found:true,isbn_matched:true,stock_status:'In Stock'};}}];
 const states=await runShared({jobs,items:[{searched_isbn:'a'},{searched_isbn:'b'}],pool,sleep:async()=>{},logger:()=>{}});
 assert.deepEqual(calls,['a','a','b']);assert.equal(states.flipkart.state,'Finished');assert.equal(states.flipkart.context_recoveries,1);
 const records=fs.readFileSync(output,'utf8').trim().split('\n').map(JSON.parse);assert.deepEqual(records.map(r=>r.input_index),[0,1]);assert.equal(records.length,2);
}));
test('context startup failure has bounded retries without consuming a pending input',()=>fixture(async dir=>{
 const fake=fakeLaunch();let calls=0;const launch=async()=>{const b=await fake.launch();b.newContext=async()=>{calls++;throw Error('browser.newContext: Target page, context or browser has been closed');};return b;};
 const pool=new SharedBrowserPool({launch,browserCount:1,concurrency:1});const output=path.join(dir,'flipkart.jsonl');const jobs=[{name:'flipkart',identity:r=>r.searched_isbn,output,scrape:async()=>assert.fail('No initialized page')}];
 const states=await runShared({jobs,items:[{searched_isbn:'pending'}],pool,sleep:async()=>{},logger:()=>{}});assert.equal(calls,3);assert.equal(states.flipkart.state,'Failed');assert.equal(states.flipkart.processed,0);assert.equal(fs.existsSync(output),false);
}));
test('a genuine block is not retried as browser recovery even if the page also closes',()=>fixture(async dir=>{
 const fake=fakeLaunch(),pool=new SharedBrowserPool({launch:fake.launch,browserCount:1,concurrency:1});let calls=0;const output=path.join(dir,'blocked.jsonl');
 const jobs=[{name:'flipkart',identity:r=>r.searched_isbn,output,scrape:async page=>{calls++;await page.close();return {stock_status:'Blocked',error_code:'blocked',error:'HTTP 429'};}}];
 const states=await runShared({jobs,items:[{searched_isbn:'pending'}],pool,sleep:async()=>{},logger:()=>{}});assert.equal(calls,1);assert.equal(states.flipkart.state,'Blocked');assert.equal(states.flipkart.processed,0);assert.ok(fs.existsSync(output+'.shared-pause.json'));
}));

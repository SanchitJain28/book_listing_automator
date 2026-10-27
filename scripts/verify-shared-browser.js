#!/usr/bin/env node
// Real Chromium lifecycle check against a loopback fixture; no retail requests.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { SharedBrowserPool } = require('../utils/sharedBrowserPool');
const { runShared } = require('./run-shared-scrapers');
const { openFirstResult } = require('../scrapers/mypustak/core/search');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-browser-fixture-'));
  let assetRequests = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { assetRequests++; res.setHeader('Content-Type', 'application/javascript'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end('window.fixtureLoaded = true;'); return; }
    res.setHeader('Content-Type', 'text/html');
    if (req.url.startsWith('/book/')) res.end('<main><span itemprop="ISBN">9780306406157</span><h1>Fixture product</h1></main>');
    else res.end('<script src="/fixture.js"></script><div data-book-grid-index="0"><h2 aria-label="Fixture book" onclick="window.open(\'/book/fixture\')">Fixture book</h2></div>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let pool;
  try {
    const results = [];
    for (const resources of ['block-assets', 'cache']) {
      pool = new SharedBrowserPool({ browserCount: 2, concurrency: 4, stateDir: path.join(dir, resources, 'state'), resources, logger: () => {} });
      let peakContexts = 0, peakBrowsers = 0;
      const assetStart = assetRequests;
      const callsPerJob = Array(8).fill(0);
      const jobs = Array.from({ length: 8 }, (_, index) => ({ name: `fixture${index}`, output: path.join(dir, resources, `${index}.jsonl`), identity: row => row.searched_isbn,
        scrape: async page => {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          const previous = await page.evaluate(() => localStorage.getItem('fixture-owner'));
          if (callsPerJob[index]++ === 0) assert.equal(previous, null);
          else assert.equal(previous, `fixture${index}`);
          await page.evaluate(owner => localStorage.setItem('fixture-owner', owner), `fixture${index}`);
          const product = await openFirstResult(page);
          assert.match(product.html, /9780306406157/);
          assert.equal(page.context().pages().length, 1);
          const stats = pool.stats(); peakContexts = Math.max(peakContexts, stats.active_contexts); peakBrowsers = Math.max(peakBrowsers, stats.browser_instances);
          return { found: true, isbn_matched: true, stock_status: 'In Stock', title: 'Fixture product' };
        } }));
      const started = Date.now();
      const state = await runShared({ jobs, items: Array.from({ length: 12 }, (_, i) => ({ searched_isbn: `fixture-${i}` })), pool, batchSize: 5, sleep: async () => {}, logger: () => {} });
      assert.equal(peakBrowsers, 2); assert.equal(peakContexts, 4);
      assert.ok(Object.values(state).every(row => row.processed === 12 && row.context_batches === 3 && row.state === 'Finished'));
      assert.equal(pool.stats().active_contexts, 0); assert.equal(pool.stats().browser_instances, 0);
      results.push({ resources, browser_instances: peakBrowsers, peak_active_contexts: peakContexts, contexts_recycled: 24, inputs_saved: 96, unexpected_pages_after_input: 0, static_asset_requests: assetRequests - assetStart, elapsed_ms: Date.now() - started, node_rss_mib: Math.round(process.memoryUsage().rss / 1024 ** 2) });
    }
    assert.ok(results[1].static_asset_requests < results[0].static_asset_requests);
    console.log(JSON.stringify({ fixture: 'localhost only', results }, null, 2));
  } finally { await pool?.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });

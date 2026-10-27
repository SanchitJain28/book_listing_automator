const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequestPolicy, retryAfterMs } = require('../scrapers/amazon-isbn/core/requestPolicy');
const { navigate } = require('../scrapers/amazon-isbn/core/international');
const { runBatch } = require('../scrapers/amazon-isbn/internationalRunner');

function clockPolicy(options = {}) {
  let time = Date.parse('2026-10-26T00:00:00Z');
  const waits = [];
  return { waits, now: () => time, policy: createRequestPolicy({ now: () => time, random: () => 0,
    sleep: async ms => { waits.push(ms); time += ms; }, logger: () => {}, ...options }) };
}
test('Retry-After accepts seconds and HTTP dates, ignores invalid/past values', () => {
  const now = Date.parse('2026-10-26T00:00:00Z');
  assert.equal(retryAfterMs('120', now), 120000);
  assert.equal(retryAfterMs('Mon, 26 Oct 2026 00:03:00 GMT', now), 180000);
  for (const value of ['invalid', '-2', '1.5', 'Sun, 25 Oct 2026 00:00:00 GMT', null]) assert.equal(retryAfterMs(value, now), 0);
});
test('successful search-to-product requests are paced and failures back off exponentially', async () => {
  const { policy, waits } = clockPolicy();
  await policy.beforeRequest(); assert.equal(waits.length, 0);
  policy.success(); await policy.beforeRequest(); assert.equal(waits.reduce((a,b) => a+b, 0), 2000);
  waits.length = 0;
  policy.failure(); await policy.beforeRequest(); assert.equal(waits.reduce((a,b) => a+b, 0), 30000);
  waits.length = 0;
  policy.failure(); await policy.beforeRequest(); assert.equal(waits.reduce((a,b) => a+b, 0), 60000);
  waits.length = 0;
  policy.success(); await policy.beforeRequest(); assert.equal(waits.reduce((a,b) => a+b, 0), 2000);
});
test('Retry-After is honored even beyond the backoff cap', async () => {
  const { policy, waits } = clockPolicy();
  await policy.beforeRequest(); policy.failure({ retryAfter: '600' }); await policy.beforeRequest();
  assert.equal(waits.reduce((a,b) => a+b, 0), 600000);
});
test('three HTTP blocks stop navigation, honoring Retry-After between attempts', async () => {
  const { policy, now } = clockPolicy(); const visits = [];
  const page = { goto: async () => { visits.push(now()); return { status: () => 503, headers: () => ({ 'retry-after': '90' }) }; }, content: async () => '<body>Unavailable</body>' };
  await assert.rejects(navigate(page, 'https://www.amazon.com/s?k=9780816069613', policy), error => error.code === 'blocked' && error.circuit_open && error.consecutive_blocks === 3);
  assert.deepEqual(visits.map(time => time - visits[0]), [0, 90000, 180000]);
  await assert.rejects(policy.beforeRequest(), /circuit is paused/);
  assert.equal(visits.length, 3);
});
test('batch preserves completed rows, checkpoints pending ISBN, and resumes after cooldown', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-pause-'));
  const output = path.join(dir, 'results.jsonl');
  const items = ['9780816069613','9780763741419','9780132862554'].map(searched_isbn => ({ searched_isbn }));
  let calls = [];
  const success = async (_, { isbn }) => { calls.push(isbn); return { searched_isbn: isbn, found: true, isbn_matched: true, stock_status: 'In Stock' }; };
  try {
    const first = await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (...args) => {
      if (calls.length === 1) { calls.push(args[1].isbn); return { stock_status: 'Blocked', error_code: 'blocked', circuit_open: true, resume_after: new Date(Date.now() + 900000).toISOString() }; }
      return success(...args);
    } });
    assert.equal(first.stopped, true); assert.equal(first.report.results.length, 1); assert.equal(calls.length, 2);
    const saved = fs.readFileSync(output, 'utf8'); assert.equal(saved.trim().split('\n').length, 1);
    assert.equal(fs.readFileSync(output + '.blocked.jsonl', 'utf8').trim().split('\n').length, 1);
    const pause = JSON.parse(fs.readFileSync(output + '.pause.json'));
    assert.equal(pause.input_index, 1); assert.ok(Date.parse(pause.resume_after) > Date.now() + 800000);
    calls = [];
    const early = await runBatch({ items, output, page: {}, scrape: success });
    assert.equal(early.stopped, true); assert.equal(calls.length, 0); assert.equal(fs.readFileSync(output, 'utf8'), saved);
    fs.writeFileSync(output + '.pause.json', JSON.stringify({ ...pause, resume_after: new Date(0).toISOString() }));
    const resumed = await runBatch({ items, output, page: {}, delay: async () => {}, scrape: success });
    assert.deepEqual(calls, items.slice(1).map(item => item.searched_isbn));
    assert.equal(resumed.report.matched_count, 3); assert.equal(fs.existsSync(output + '.pause.json'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('slow policy doubles navigation pacing and pauses on the first blocked response', async () => {
  const { SLOW_DEFAULTS } = require('../scrapers/amazon-isbn/core/requestPolicy');
  const { policy, waits, now } = clockPolicy(SLOW_DEFAULTS);
  await policy.beforeRequest(); policy.success(); await policy.beforeRequest();
  assert.equal(waits.reduce((a, b) => a + b, 0), 4000);
  const pause = policy.failure({ blocked: true });
  assert.equal(pause.circuit_open, true); assert.equal(pause.consecutive_blocks, 1);
  assert.equal(Date.parse(pause.resume_after) - now(), 1800000);
  await assert.rejects(policy.beforeRequest(), /circuit is paused/);
});
test('slow policy honors Retry-After beyond its longer cooldown', async () => {
  const { SLOW_DEFAULTS } = require('../scrapers/amazon-isbn/core/requestPolicy');
  const { policy, now } = clockPolicy(SLOW_DEFAULTS);
  await policy.beforeRequest();
  const pause = policy.failure({ blocked: true, retryAfter: '3600' });
  assert.equal(Date.parse(pause.resume_after) - now(), 3600000);
});
test('slow mode stops the batch after its first HTTP block and saves a thirty-minute checkpoint', async () => {
  const { SLOW_DEFAULTS, setPolicyForPage } = require('../scrapers/amazon-isbn/core/requestPolicy');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-slow-'));
  const output = path.join(dir, 'results.jsonl'), visits = [];
  const page = { goto: async url => { visits.push(url); return { status: () => 503, headers: () => ({}) }; },
    content: async () => '<body>Unavailable</body>', waitForTimeout: async () => {} };
  setPolicyForPage(page, SLOW_DEFAULTS);
  try {
    const result = await runBatch({ items: [{ searched_isbn: '9780816069613' }, { searched_isbn: '9780763741419' }],
      output, page, cooldownMs: SLOW_DEFAULTS.cooldownMs, delay: async () => {} });
    assert.equal(result.stopped, true); assert.equal(visits.length, 1);
    assert.ok(Date.parse(result.pause.resume_after) >= Date.now() + 1790000);
    assert.equal(fs.existsSync(output), false);
    assert.equal(fs.readFileSync(output + '.blocked.jsonl', 'utf8').trim().split('\n').length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

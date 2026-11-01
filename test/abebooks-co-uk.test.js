const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractSearch, money } = require('../scrapers/abebooks-co-uk/core/extract');
const { sameIsbn } = require('../scrapers/abebooks-co-uk/core/isbn');
const { scrapeAbeBooksUk, retryAfterMs } = require('../scrapers/abebooks-co-uk/scraper');
const { runBatch } = require('../scrapers/abebooks-co-uk/runner');
const reference = fs.readFileSync(path.join(__dirname, '../references/abebooks/closest-match.md'), 'utf8');
const exact = fs.readFileSync(path.join(__dirname, 'fixtures/abebooks-co-uk/exact-search.html'), 'utf8');

test('supplied closest-match reference scopes price, shipping and seller to each UK listing', () => {
  const data = extractSearch(reference, '9783382004262');
  assert.equal(data.listings.length, 5);
  const first = data.listings[0];
  assert.equal(first.match_type, 'closest_match');
  assert.equal(first.isbn_matched, false);
  assert.equal(first.price, 8.15);
  assert.equal(first.shipping_price, 8.49);
  assert.match(first.url, /^https:\/\/www.abebooks.co.uk\/.+\/bd$/);
  assert.ok(first.seller);
  assert.equal(data.listings[1].shipping_price, 0);
  assert.equal(data.listings[3].shipping_price, 0.56);
});

test('exact search card uses independent ISBN evidence and preserves GBP fields', () => {
  const row = extractSearch(exact, '9788192082318').listings[0];
  assert.equal(row.match_type, 'exact');
  assert.equal(row.isbn_matched, true);
  assert.equal(row.found_isbn, '9788192082318');
  assert.equal(row.isbn_match_source, 'search_card_isbn');
  assert.equal(row.price, 104.18);
  assert.equal(row.shipping_price, 15.03);
  assert.equal(row.seller, 'Books Puddle');
  assert.equal(row.currency, 'GBP');
});

test('query, page banner and stock image cannot certify an exact ISBN match', () => {
  const card = exact.replace(/data-test-id="listing-isbn-link"/g, 'data-ignored="isbn"').replace(/data-test-id="isbn-0"/g, 'data-ignored="isbn"');
  const row = extractSearch('<h1>ISBN: 9788192082318</h1>' + card, '9788192082318', 'https://www.abebooks.co.uk/servlet/SearchResults?isbn=9788192082318').listings[0];
  assert.equal(row.isbn_matched, false);
  assert.equal(row.match_type, 'unverified');
  assert.equal(row.isbn_match_source, 'search_card_stock_image_unverified');
});

test('conflicting card ISBN disqualifies exact match; equivalent ISBN-10/13 match', () => {
  assert.equal(extractSearch(exact, '9783382004262').listings[0].match_type, 'isbn_mismatch');
  assert.equal(extractSearch(exact, '8192082318').listings[0].isbn_matched, true);
  assert.equal(sameIsbn('0-306-40615-2', '9780306406157'), true);
  assert.equal(sameIsbn(null, '9780306406157'), false);
});

test('closest recommendations are fallback only; unrelated links are excluded', () => {
  const rows = extractSearch(exact + reference + '<a href="https://example.com/123/bd">ad</a>', '9788192082318').listings;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].match_type, 'exact');
});

test('distinguishes blocked, explicit empty and unrecognized pages', () => {
  assert.equal(extractSearch('<h1>Robot Check</h1>').blocked, true);
  assert.equal(extractSearch('<main>We were unable to find exact matches based on your search.</main>').no_results, true);
  assert.equal(extractSearch('<main>Loading</main>').no_results, false);
  assert.equal(money('£ 1,234.56'), 1234.56);
  assert.equal(money('Call for price'), null);
});

test('availability is not inferred from search query or unrelated recommendation prices', () => {
  const card = exact.replace('£&nbsp;104.18', 'Currently not available');
  const row = extractSearch(card + reference, '9788192082318').listings[0];
  assert.equal(row.price, null);
  assert.equal(row.in_stock, false);
  assert.equal(row.isbn_matched, true);
});

test('advanced search fills real form and submits it instead of using the normal ISBN endpoint', async () => {
  const calls = []; let html = '<form id="advanced"><input id="isbn"></form>';
  const response = { status: () => 200, headers: () => ({}) };
  const page = {
    goto: async url => { calls.push(url); return response; }, content: async () => html,
    url: () => 'https://www.abebooks.co.uk/servlet/SearchResults?isbn=9788192082318', waitForTimeout: async () => {},
    waitForNavigation: async () => { html = exact; return response; },
    locator: selector => ({ fill: async value => calls.push([selector, value]), click: async () => calls.push(selector), first() { return this; }, waitFor: async () => {} }),
  };
  const result = await scrapeAbeBooksUk(page, { isbn: '9788192082318' });
  assert.equal(result.found, true);
  assert.deepEqual(calls, ['https://www.abebooks.co.uk/servlet/SearchEntry', ['#isbn', '9788192082318'], '#search-button']);
});

test('HTTP block honors Retry-After and never becomes not found', async () => {
  const result = await scrapeAbeBooksUk({ goto: async () => ({ status: () => 429, headers: () => ({ 'retry-after': '3600' }) }), url: () => 'https://www.abebooks.co.uk/servlet/SearchEntry' }, { isbn: '9788192082318' });
  assert.equal(result.error_code, 'blocked');
  assert.ok(Date.parse(result.resume_after) >= Date.now() + 3599000);
  assert.equal(retryAfterMs('120'), 120000);
});

test('resume preserves completed output; block leaves next input pending', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abebooks-uk-'));
  try {
    const output = path.join(dir, 'results.jsonl');
    const items = [{ searched_isbn: '9788192082318' }, { searched_isbn: '9783382004262' }];
    fs.writeFileSync(output, JSON.stringify({ ...items[0], found: true, match_type: 'exact' }) + '\n');
    let count = 0;
    const scrape = async () => { count++; return { stock_status: 'Blocked', error_code: 'blocked', error: 'HTTP 429', resume_after: new Date(Date.now() + 1800000).toISOString() }; };
    await runBatch({ items, output, scrape, delay: async () => {} });
    assert.equal(count, 1);
    assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 1);
    await runBatch({ items, output, scrape, delay: async () => {} });
    assert.equal(count, 1);
    fs.rmSync(output + '.pause.json');
    const { report } = await runBatch({ items, output, scrape: async () => ({ found: true, match_type: 'closest_match' }), delay: async () => {} });
    assert.equal(report.verified_count, 2);
    assert.equal(report.closest_match_count, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('explicit retry-failed preserves exact and closest successes and retries only missing results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abebooks-uk-retry-'));
  try {
    const output = path.join(dir, 'results.jsonl');
    const items = ['9788192082318', '9783382004262', '9781534803435'].map(searched_isbn => ({ searched_isbn }));
    fs.writeFileSync(output, items.map((item, i) => JSON.stringify({ ...item, input_index: i, match_type: ['exact', 'closest_match', null][i], stock_status: i === 2 ? 'Not Found' : 'In Stock' })).join('\n') + '\n');
    const calls = [];
    const { report } = await runBatch({ items, output, retryFailed: true, scrape: async (page, { isbn }) => { calls.push(isbn); return { found: false, stock_status: 'Not Found', error_code: 'not_found' }; }, delay: async () => {} });
    assert.deepEqual(calls, ['9781534803435']);
    assert.equal(report.verified_count, 2);
    assert.equal(report.processed_count, 3);
    assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 4);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

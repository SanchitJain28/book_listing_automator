const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseSearch, searchUrl, productUrl, walmartUrl, pageFailure } = require('../scrapers/walmart/core/search');
const { parseProduct, money } = require('../scrapers/walmart/core/productExtractor');
const { verifyIsbn, sameIsbn, isValidIsbn } = require('../scrapers/walmart/core/isbn');
const { scrapeWalmart } = require('../scrapers/walmart/walmart-isbn');
const { runBatch } = require('../scrapers/walmart/runner');
const reference = fs.readFileSync(path.join(__dirname, '../references/walmart-reference.md'), 'utf8');
const isbn = '9798287703462';
const url = 'https://www.walmart.com/ip/Traces-of-Strength-Navigating-Teenage-Depression-with-Courage-Paperback-9798287703462/16857721376';
function product(identifier = isbn, extra = '', stock = '<button data-automation-id="atc">Add to cart</button>') {
  return `<main><h1 id="main-title">A complete book title</h1><div id="top-highlights-module"><ul><li>ISBN: ${identifier}</li><li>Author: Test Author</li></ul></div><div class="buy-box-container"><span itemprop="price">$19.95</span>${stock}</div>${extra}</main>`;
}
function search(links = [url], extra = '') {
  return `<main><div data-testid="item-stack">${links.map((link,i) => `<div data-item-id="BOOK${i}"><a link-identifier="${i}" href="${link}"><span data-automation-id="product-title">Book</span></a></div>`).join('')}${extra}</div></main>`;
}
function fakePage(pages, status = 200) {
  let current;
  return { visits: [], waits: [], async goto(target) { this.visits.push(target); current = target; if (!pages[target]) throw Error(`Unexpected URL ${target}`); return { status: () => status, headers: () => ({}) }; },
    url: () => current, content: async () => pages[current], waitForSelector: async () => {}, async waitForTimeout(ms) { this.waits.push(ms); } };
}
function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walmart-test-'));
  return Promise.resolve().then(() => fn(path.join(dir, 'results.jsonl'))).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

test('reference search yields the actual organic card and excludes unrelated links', () => {
  assert.equal(searchUrl(isbn), `https://www.walmart.com/search?q=${isbn}`);
  const result = parseSearch(reference, searchUrl(isbn));
  assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].url, url); assert.equal(result.candidates[0].id, '16857721376');
  assert.equal(parseSearch(`<aside><a href="${url}">Recommendation</a></aside>`, searchUrl(isbn)).candidates.length, 0);
  assert.equal(parseSearch(search([], `<div data-item-id="AD">Sponsored<a href="${url}">Ad</a></div>`), searchUrl(isbn)).candidates.length, 0);
});
test('reference product preserves full title, author, pages, binding, actual price, seller and shipping information', () => {
  const data = parseProduct(reference, url);
  assert.equal(data.title, 'Traces of Strength: Navigating Teenage Depression with Courage, (Paperback)');
  assert.equal(data.author, 'Kenny Grace'); assert.equal(data.binding, 'Paperback'); assert.equal(data.pages, 60);
  assert.equal(data.publication_date, '2025-06-11'); assert.equal(data.price, 17.99); assert.equal(data.currency, 'USD'); assert.equal(data.seller, 'Walmart.com');
  assert.equal(data.mrp, null); assert.equal(data.publisher, null); assert.equal(data.in_stock, true); assert.match(data.delivery_info, /Nov 6/);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_specifications');
});
test('pickup and local delivery unavailability do not override an available shipping offer', () => {
  assert.equal(parseProduct(reference, url).in_stock, true);
});
test('product specifications reject a conflicting ISBN despite target query, slug or matching structured ISBN', () => {
  const html = product('9780306406157', `<script type="application/ld+json">${JSON.stringify({ '@type': 'Book', name: 'A complete book title', isbn })}</script>`);
  const validation = verifyIsbn(isbn, parseProduct(html, url + '?q=' + isbn));
  assert.equal(validation.isbn_matched, false); assert.equal(validation.isbn_match_source, 'product_isbn_conflict');
});
test('equivalent ISBN-10 is supported; no ISBN evidence stays unverified', () => {
  assert.equal(sameIsbn('0306406152', '9780306406157'), true);
  assert.equal(verifyIsbn('9780306406157', parseProduct(product('0306406152'), url)).isbn_matched, true);
  assert.equal(verifyIsbn(isbn, parseProduct(product(''), url)).isbn_matched, false);
});
test('JSON-LD and primary Next data support independent ISBN and price evidence', () => {
  const primary = { usItemId: '16857721376', name: 'Structured Book', isbn13: isbn, author: 'Structured Author', priceInfo: { currentPrice: { price: 123.45, currencyUnit: 'USD' }, wasPrice: { price: 150 } }, availabilityStatus: 'IN_STOCK', sellerDisplayName: 'Book Seller', specificationHighlights: [{ name: 'Publisher', value: 'Book Press' }] };
  const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { initialData: { data: { product: primary, recommendations: { isbn: '9780306406157', price: 1 } } } } } })}</script>`;
  const data = parseProduct(html, url); assert.equal(data.price, 123.45); assert.equal(data.publisher, 'Book Press'); assert.equal(data.mrp, 150); assert.equal(data.in_stock, true);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_structured_data');
  const schema = { '@type': 'Book', name: 'Structured', url, isbn, offers: { price: '9.99', priceCurrency: 'USD', availability: 'https://schema.org/OutOfStock' } };
  const other = parseProduct(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`, url);
  assert.equal(other.title, 'Structured'); assert.equal(other.price, 9.99); assert.equal(other.in_stock, false); assert.equal(verifyIsbn(isbn, other).isbn_matched, true);
});
test('unrelated structured products, recommendations and membership prices cannot fill primary fields', () => {
  const html = product(isbn, '<aside>Out of Stock $1</aside><div data-testid="recommendation-carousel"><span itemprop="price">$2</span><li>ISBN: 9780306406157</li></div>').replace('<span itemprop="price">$19.95</span>', '<span>Walmart+ membership $1</span>');
  const schema = { '@type': 'Product', name: 'Unrelated', url: 'https://www.walmart.com/ip/Other/12345', isbn: '9780306406157', offers: { price: 1 } };
  const data = parseProduct(html + `<script type="application/ld+json">${JSON.stringify(schema)}</script>`, url);
  assert.equal(data.price, null); assert.equal(data.in_stock, true); assert.equal(verifyIsbn(isbn, data).isbn_matched, true);
  for (const text of ['Buy at $1 with membership', '4 payments of $5', '', undefined]) assert.equal(money(text), null);
});
test('matching out-of-stock product remains found with its retained price', async () => {
  const data = await scrapeWalmart(fakePage({ [url]: product(isbn, '', '<button disabled>Out of stock</button>') }), url, isbn);
  assert.equal(data.found, true); assert.equal(data.in_stock, false); assert.equal(data.price, 19.95);
});
test('disabled purchase controls and missing prices remain null without invented stock', () => {
  const data = parseProduct(product(isbn, '', '<button data-automation-id="atc" disabled>Add to cart</button>').replace('$19.95',''), url);
  assert.equal(data.price, null); assert.equal(data.in_stock, null);
});
test('a later exact candidate is found after rejecting the wrong first book, with per-page pacing', async () => {
  const wrong = 'https://www.walmart.com/ip/Other/12345';
  const page = fakePage({ [searchUrl(isbn)]: search([wrong,url]), [wrong]: product('9780306406157'), [url]: product() });
  const data = await scrapeWalmart(page, null, isbn);
  assert.equal(data.found, true); assert.equal(data.url, url); assert.equal(page.visits.length, 3); assert.equal(page.waits.length, 2);
  assert.ok(page.waits.every(ms => ms >= 2000 && ms <= 5000));
});
test('pagination stays on Walmart and preserves the query', () => {
  const next = searchUrl(isbn) + '&page=2';
  assert.equal(parseSearch(search([], `<a rel="next" href="${next}">Next</a>`), searchUrl(isbn)).nextUrl, next);
  assert.equal(parseSearch(search([], '<a rel="next" href="https://evil.example/search">Next</a>'), searchUrl(isbn)).nextUrl, null);
  assert.equal(parseSearch(search([], `<a rel="next" href="${searchUrl('9780306406157')}">Next</a>`), searchUrl(isbn)).nextUrl, null);
});
test('blocks, explicit empty results and extraction errors are distinct; no retry on robot challenge', async () => {
  const empty = await scrapeWalmart(fakePage({ [searchUrl(isbn)]: '<main>No results found</main>' }), null, isbn); assert.equal(empty.stock_status, 'Not Listed');
  const blank = await scrapeWalmart(fakePage({ [searchUrl(isbn)]: '<main></main>' }), null, isbn); assert.equal(blank.error_code, 'extraction_error');
  const page = fakePage({ [searchUrl(isbn)]: '<body>Robot or human? Activate and hold the button</body>' });
  const blocked = await scrapeWalmart(page, null, isbn); assert.equal(blocked.stock_status, 'Blocked'); assert.equal(page.visits.length, 1);
  await scrapeWalmart(page, null, isbn); assert.equal(page.visits.length, 1);
  assert.equal(pageFailure('', 429).code, 'blocked'); assert.equal(pageFailure('', 200, 'https://www.walmart.com/blocked?url=xxx').code, 'blocked');
});
test('lookalike domains, credential URLs, script schemes and invalid ISBNs never navigate', async () => {
  for (const value of ['https://walmart.com.evil.example/ip/Book/123', 'javascript:alert(1)', 'http://walmart.com/ip/Book/123', 'https://a:b@walmart.com/ip/Book/123']) assert.equal(walmartUrl(value), null);
  assert.equal(productUrl('https://www.walmart.com/help/123'), null);
  const page = fakePage({});
  assert.equal((await scrapeWalmart(page, null, 'invalid')).error_code, 'invalid_isbn'); assert.equal(page.visits.length, 0);
});
test('all supplied test ISBNs pass checksum validation and are retained as separate inputs', () => {
  const inputs = fs.readFileSync(path.join(__dirname, 'data/walmart-scraper/input.txt'), 'utf8').trim().split(/\s+/);
  assert.equal(inputs.length, 20); assert.ok(inputs.every(isValidIsbn));
});
test('resume preserves completed rows and retries failed records only when explicitly requested', () => fixture(async output => {
  const items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }]; let calls = [];
  const scrape = async (_, direct, target) => { calls.push(target); return { searched_isbn: target, found: target === isbn, isbn_matched: target === isbn, stock_status: 'Unknown' }; };
  await runBatch({ items, output, page: {}, scrape, delay: async () => {} }); calls = [];
  await runBatch({ items, output, page: {}, scrape, delay: async () => {} }); assert.equal(calls.length, 0);
  const retry = await runBatch({ retryFailed: true, items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { calls.push(target); return { searched_isbn: target, found: true, isbn_matched: true }; } });
  assert.deepEqual(calls, ['9780306406157']); assert.equal(retry.report.matched_count, 2);
}));
test('blocking stops the batch, reports every pending input, and resumes from the unsaved ISBN', () => fixture(async output => {
  const items = [isbn,'9780306406157','9780816069613'].map(searched_isbn => ({ searched_isbn })); let calls = [];
  const blocked = await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => {
    calls.push(target); return target === isbn ? { found: true, isbn_matched: true } : { stock_status: 'Blocked', error_code: 'blocked', error: 'Robot challenge' };
  } });
  assert.equal(blocked.stopped, true); assert.equal(calls.length, 2); assert.equal(blocked.report.matched_count, 1);
  assert.deepEqual(blocked.report.results.map(row => row.stock_status), ['Unknown','Blocked','Pending']);
  assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 1);
  calls = []; await runBatch({ items, output, page: {}, scrape: async () => { throw Error('must not request during cooldown'); } });
  const checkpoint = JSON.parse(fs.readFileSync(output + '.pause.json')); checkpoint.resume_after = new Date(0).toISOString(); fs.writeFileSync(output + '.pause.json', JSON.stringify(checkpoint));
  await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { calls.push(target); return { found: true, isbn_matched: true }; } });
  assert.deepEqual(calls, items.slice(1).map(item => item.searched_isbn));
}));
test('duplicate ISBN occurrences retain distinct output positions on resume', () => fixture(async output => {
  const items = [{ searched_isbn: isbn }, { searched_isbn: isbn }];
  let calls = 0;
  const options = { items, output, page: {}, delay: async () => {}, scrape: async () => { calls++; if (calls === 2) throw Error('interrupted'); return { found: true, isbn_matched: true }; } };
  await assert.rejects(runBatch(options), /interrupted/);
  await runBatch(options); assert.equal(calls, 3);
  const rows = fs.readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse); assert.deepEqual(rows.map(row => row.input_index), [0,1]);
}));
test('dashboard imports Walmart JSON Lines and preserves USD, seller, ISBN match and stock', async () => {
  const { parseOutput, normalizeRecords } = await import('../dashboard/src/lib/output.js');
  const data = { searched_isbn: isbn, store: 'Walmart', found: true, ...parseProduct(reference, url), ...verifyIsbn(isbn, parseProduct(reference, url)) };
  const { books, offers } = normalizeRecords(parseOutput(JSON.stringify(data) + '\n'));
  assert.equal(books[0].store, 'Walmart'); assert.equal(books[0].currency, 'USD'); assert.equal(books[0].status, 'In stock'); assert.equal(books[0].match, 'Matched'); assert.equal(offers[0].price, 17.99);
});

for (const event of ['window close', 'Ctrl+C', 'SIGTERM']) {
  test(`headed block inspection waits until ${event} and removes its listeners`, async () => {
    const { EventEmitter } = require('node:events');
    const { waitForInspection } = require('../scrapers/walmart/runner');
    const context = new EventEmitter(), page = new EventEmitter(), signals = new EventEmitter();
    page.isClosed = () => false;
    let finished = false;
    const waiting = waitForInspection(context, page, { signals, logger: () => {} }).then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false);
    if (event === 'window close') page.emit('close');
    else signals.emit(event === 'Ctrl+C' ? 'SIGINT' : 'SIGTERM');
    await waiting;
    assert.equal(finished, true);
    assert.equal(context.listenerCount('close'), 0); assert.equal(page.listenerCount('close'), 0);
    assert.equal(signals.listenerCount('SIGINT'), 0); assert.equal(signals.listenerCount('SIGTERM'), 0);
  });
}
test('already-closed inspection window does not leave the runner waiting', async () => {
  const { waitForInspection } = require('../scrapers/walmart/runner');
  await waitForInspection({}, { isClosed: () => true });
});

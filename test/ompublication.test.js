const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseSearch, searchUrl, omUrl, pageFailure } = require('../scrapers/ompublication/core/search');
const { parseProduct } = require('../scrapers/ompublication/core/productExtractor');
const { verifyIsbn, sameIsbn } = require('../scrapers/ompublication/core/isbn');
const { scrapeOmPublication } = require('../scrapers/ompublication/ompublication-isbn');
const { runBatch } = require('../scrapers/ompublication/runner');
const isbn = '9789326352000', url = 'https://www.ompublications.in/product/books/OM20422';
const reference = fs.readFileSync(path.join(__dirname, '../references/ompublication-reference.md'), 'utf8');
function details(identifier = isbn, body = '<button>Add to Cart</button>') {
  return `<section><h2>Complete book title</h2><div>Author</div><div><span>₹199</span><span class="line-through">₹300</span></div><div><div><div>ISBN 13</div><div><img></div><div>${identifier}</div></div></div>${body}</section>`;
}
function results(links = [url], extra = '') {
  return `<section><h2>Search results for "${isbn}"</h2>${links.map(link => `<a href="${link}"><div>Image</div><div>Title</div></a>`).join('')}${extra}</section>`;
}
function fakePage(pages, status = 200) {
  let current;
  return { visits: 0, async goto(target) { this.visits++; current = target; if (!pages[target]) throw Error(`Unexpected URL ${target}`); return { status: () => status }; },
    url: () => current, content: async () => pages[current], waitForSelector: async () => {}, waitForTimeout: async () => {} };
}

test('reference search yields discovered product URLs, excluding unrelated navigation', () => {
  assert.equal(searchUrl(isbn), `https://www.ompublications.in/products/search?q=${isbn}`);
  const search = parseSearch(reference, searchUrl(isbn));
  assert.equal(search.candidates.length, 1); assert.equal(search.candidates[0].url, url);
  assert.equal(parseSearch(`<a href="${url}">Unrelated</a>`, searchUrl(isbn)).candidates.length, 0);
});
test('reference product extracts independent ISBN badge, full title, price and stock', () => {
  const data = parseProduct(reference, url);
  assert.equal(data.title, 'Jain Pratik Darshan (Hindi)'); assert.equal(data.author, 'Dr. Jaya Jain');
  assert.equal(data.price, 550); assert.equal(data.mrp, 550); assert.equal(data.publication_year, '2015');
  assert.equal(data.publisher, null); assert.equal(data.in_stock, true);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_specifications');
});
test('wrong product ISBN is rejected even when the query contains the target ISBN', () => {
  const data = parseProduct(details('9780306406157'), `${url}?q=${isbn}`);
  assert.equal(verifyIsbn(isbn, data).isbn_matched, false);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_isbn_conflict');
});
test('a later exact candidate is selected after rejecting an unrelated first result', async () => {
  const other = 'https://www.ompublications.in/product/books/OTHER';
  const page = fakePage({ [searchUrl(isbn)]: results([other, url]), [other]: details('9780306406157'), [url]: details() });
  const data = await scrapeOmPublication(page, null, isbn);
  assert.equal(data.found, true); assert.equal(data.url, url); assert.equal(data.isbn_matched, true); assert.equal(page.visits, 3);
});
test('matching unavailable book is found separately from its retained price', async () => {
  const data = await scrapeOmPublication(fakePage({ [url]: details(isbn, '<button disabled>Out of Stock</button>') }), url, isbn);
  assert.equal(data.found, true); assert.equal(data.in_stock, false); assert.equal(data.price, 199);
});
test('hidden notification controls and recommendation prices do not contaminate the product', () => {
  const data = parseProduct(details(isbn, '<button>Add to Cart</button><div style="display:none"><button>Notify Me</button></div>') + '<aside>Out of stock ₹1</aside>', url);
  assert.equal(data.in_stock, true); assert.equal(data.price, 199); assert.equal(data.mrp, 300);
});
test('missing price and disabled purchase controls remain unknown without invented values', () => {
  const data = parseProduct(details(isbn, '<button disabled>Add to Cart</button>').replace('<span>₹199</span><span class="line-through">₹300</span>', ''), url);
  assert.equal(data.price, null); assert.equal(data.mrp, null); assert.equal(data.in_stock, null);
});
test('ISBN-10 equivalent matches and product URL alone never establishes an ISBN', () => {
  assert.equal(sameIsbn('0-306-40615-2', '9780306406157'), true);
  assert.equal(verifyIsbn(isbn, { title: 'Book', url, isbn_evidence: [] }).isbn_matched, false);
});
test('pagination follows only same-site search links for the same ISBN', () => {
  const next = `${searchUrl(isbn)}&page=2`;
  assert.equal(parseSearch(results([], `<a href="${next}">Next</a>`), searchUrl(isbn)).nextUrl, next);
  assert.equal(parseSearch(results([], '<a href="https://evil.example/search">Next</a>'), searchUrl(isbn)).nextUrl, null);
  assert.equal(parseSearch(results([], `<a href="${searchUrl('9780306406157')}">Next</a>`), searchUrl(isbn)).nextUrl, null);
});
test('explicit empty search, blank extraction and blocking are distinct with bounded retries', async () => {
  const empty = await scrapeOmPublication(fakePage({ [searchUrl(isbn)]: results([], 'No books found') }), null, isbn);
  assert.equal(empty.stock_status, 'Not Listed');
  const blank = await scrapeOmPublication(fakePage({ [searchUrl(isbn)]: '<body></body>' }), null, isbn);
  assert.equal(blank.error_code, 'extraction_error');
  const page = fakePage({ [searchUrl(isbn)]: 'Access denied' }, 403);
  const blocked = await scrapeOmPublication(page, null, isbn);
  assert.equal(blocked.stock_status, 'Blocked'); assert.equal(page.visits, 3);
  assert.equal(pageFailure('Too many requests', 429).code, 'blocked');
});
test('lookalike domains and script URLs are rejected', () => {
  assert.equal(omUrl('https://ompublications.in.evil.example/product/books/OM1'), null);
  assert.equal(omUrl('javascript:alert(1)'), null);
});
test('all wrong candidates produce an explicit mismatch with their evidence', async () => {
  const data = await scrapeOmPublication(fakePage({ [searchUrl(isbn)]: results(), [url]: details('9780306406157') }), null, isbn);
  assert.equal(data.found, false); assert.equal(data.stock_status, 'ISBN mismatch');
  assert.equal(data.rejected_candidates[0].found_isbn, '9780306406157');
});
test('resume preserves verified results while retrying failures by input identity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ompublication-resume-')), output = path.join(dir, 'results.jsonl');
  const items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }]; let calls = [];
  try {
    await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { calls.push(target); return { searched_isbn: target, found: target === isbn, isbn_matched: target === isbn }; } });
    assert.equal(calls.length, 2); calls = [];
    const { report } = await runBatch({ retryFailed: true, items: [...items].reverse(), output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { calls.push(target); return { searched_isbn: target, found: true, isbn_matched: true }; } });
    assert.deepEqual(calls, ['9780306406157']); assert.equal(report.matched_count, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

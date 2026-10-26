const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseSearch, searchUrl, flipkartUrl, pageFailure } = require('../scrapers/flipkart/core/search');
const { parseProduct } = require('../scrapers/flipkart/core/productExtractor');
const { sameIsbn, isValidIsbn, verifyIsbn } = require('../scrapers/flipkart/core/isbn');
const { scrapeFlipkart } = require('../scrapers/flipkart/flipkart-isbn');
const { identity, runBatch, latestRecords } = require('../scrapers/flipkart/runner');

const isbn = '9788175102804';
const productUrl = `https://www.flipkart.com/reference-book/p/itm123?pid=${isbn}`;
const reference = fs.readFileSync(path.join(__dirname, '../references/flipkart-reference.md'), 'utf8');
const row = (key, value) => `<div class="grid-formation-dynamic"><div><div>${key}</div><div>${value}</div></div></div>`;
const html = content => `<html><body>${content}</body></html>`;

test('books-only search URL and exact candidate selection ignore unrelated cards and duplicate links', () => {
  assert.equal(new URL(searchUrl(isbn)).searchParams.get('sid'), 'bks');
  assert.equal(new URL(searchUrl(isbn, 3)).searchParams.get('page'), '3');
  const search = parseSearch(reference, isbn, searchUrl(isbn));
  assert.equal(search.candidates.length, 1);
  assert.equal(search.candidates[0].pid, isbn);
  assert.equal(search.candidates[0].id, isbn);
  assert.match(search.candidates[0].author, /Dipin Mathur/);
  assert.match(search.candidates[0].title, /RESHAPING/);
  assert.equal(search.hasNext, false);
  assert.equal(parseSearch(reference, '9780306406157', searchUrl(isbn)).candidates.length, 0);
});

test('pagination and explicit empty state are recognized', () => {
  assert.equal(parseSearch(html('Showing 1 – 40 of 81 results'), isbn, searchUrl(isbn)).hasNext, true);
  assert.equal(parseSearch(html('Sorry, no results found!'), isbn, searchUrl(isbn)).empty, true);
});

test('new layout reference extracts actual price, complete metadata and ISBNs', () => {
  const data = parseProduct(reference, productUrl);
  assert.equal(data.price, 398);
  assert.equal(data.mrp, 500);
  assert.equal(data.discount, '20%');
  assert.equal(data.title, 'RESHAPING BUSINESS & MANAGEMENT PRACTICES IN THE DIGITAL ERA');
  assert.equal(data.author, 'DR.NARENDRA SINGH CHAWDA');
  assert.equal(data.seller, 'RELIANCEBOOKS');
  assert.equal(data.binding, 'Hardcover');
  assert.equal(data.pages, '196');
  assert.equal(data.language, 'English');
  assert.equal(data.isbn13, isbn);
  assert.equal(data.isbn10, '8175102804');
  assert.equal(data.in_stock, true);
  assert.match(data.delivery, /Friday, 30 Oct/);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_specifications');
});

test('old layout excludes an earlier advertisement and uses scoped numeric prices', () => {
  const data = parseProduct(html(`<a href="/ad/p/itm"><div>₹5</div>Sold out</a><main><h1>Real book</h1><div class="_30jeq3">₹1,234.50</div><div class="_3I9_wc">₹2,000</div><table><tr><td>ISBN-13</td><td>${isbn}</td></tr><tr><td>Author</td><td>Example Author</td></tr></table><div id="sellerName"><a>Actual seller</a></div><button>Add to cart</button></main>`), productUrl);
  assert.equal(data.price, 1234.5);
  assert.equal(data.mrp, 2000);
  assert.equal(data.author, 'Example Author');
  assert.equal(data.seller, 'Actual seller');
  assert.equal(data.in_stock, true);
  assert.equal(data.isbn13, isbn);
});

test('conditional prices, animated purchase digits and unrelated JSON-LD are excluded', () => {
  const data = parseProduct(html(`<main><h1>Target book</h1><div>₹500</div><div>Buy at <span>₹450</span> with offers</div>${row('ISBN13', isbn)}</main><aside><div>₹20</div></aside><script type="application/ld+json">{"@type":"Product","name":"Other book","isbn":"9780306406157","offers":{"price":1}}</script><button>Buy at ₹0123456789</button>`), productUrl);
  assert.equal(data.price, 500);
  assert.deepEqual(data.structured_isbns, []);
  assert.equal(data.in_stock, null);
});

test('unknown price does not become stock or a guessed MRP; unavailable stays found with a match', async () => {
  const content = html(`<main><h1>Unavailable book</h1><div>Out of stock</div>${row('ISBN13', isbn)}</main>`);
  const data = parseProduct(content, productUrl);
  assert.equal(data.price, null);
  assert.equal(data.mrp, null);
  assert.equal(data.in_stock, false);
  const page = fakePage({ [productUrl]: content });
  const result = await scrapeFlipkart(page, productUrl, isbn);
  assert.equal(result.found, true);
  assert.equal(result.isbn_matched, true);
  assert.equal(result.in_stock, false);
});

test('ISBN equivalence handles hyphens, ISBN-10 X, and invalid checksums', () => {
  assert.equal(sameIsbn('0-306-40615-2', '9780306406157'), true);
  assert.equal(isValidIsbn('080442957X'), true);
  assert.equal(isValidIsbn('9780306406158'), false);
  assert.equal(sameIsbn(null, null), false);
});

test('conflicting product ISBN overrides matching search and URL identifiers', () => {
  const verification = verifyIsbn(isbn, { isbn13: '9780306406157', structured_isbns: [], url: productUrl }, { id: isbn, pid: isbn });
  assert.equal(verification.isbn_matched, false);
  assert.equal(verification.isbn_match_source, 'product_isbn_conflict');
});

test('only independent search-card and product-pid evidence permits fallback matching', () => {
  const data = { url: productUrl, structured_isbns: [] };
  assert.equal(verifyIsbn(isbn, data).isbn_matched, false);
  assert.equal(verifyIsbn(isbn, data, { id: isbn, pid: isbn }).isbn_matched, true);
  assert.equal(verifyIsbn(isbn, { ...data, url: productUrl.replace(isbn, 'OTHER') }, { id: isbn, pid: isbn }).isbn_matched, false);
  assert.equal(verifyIsbn(isbn, { ...data, url: `https://www.flipkart.com/other/p/id?q=${isbn}` }).isbn_matched, false);
});

test('structured product data requires product identity and can provide ISBN evidence', () => {
  const data = parseProduct(html(`<h1>Book</h1><script type="application/ld+json">{"@type":"Product","name":"Book","url":"${productUrl}","gtin13":"${isbn}","offers":{"price":123,"availability":"https://schema.org/InStock"}}</script>`), productUrl);
  assert.equal(data.price, 123);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'structured_product_data');
});

test('URL validation rejects lookalike hosts and non-HTTPS destinations', () => {
  assert.equal(flipkartUrl('https://flipkart.com.evil.example/p/a'), null);
  assert.equal(flipkartUrl('javascript:alert(1)'), null);
  assert.equal(flipkartUrl('http://www.flipkart.com/p/a'), null);
});

test('product metadata provides author and disabled purchase buttons do not imply stock', () => {
  const data = parseProduct(`<html><head><meta property="og:title" content="Book: Buy Book by Example Author at Low Price in India | Flipkart.com"></head><body><main><h1>Book</h1><div>₹150</div><button disabled>Add to cart</button></main></body></html>`, productUrl);
  assert.equal(data.author, 'Example Author');
  assert.equal(data.in_stock, null);
  const nested = parseProduct(html('<main><h1>Book</h1><div>₹150</div><button disabled><span>Add to cart</span></button></main>'), productUrl);
  assert.equal(nested.in_stock, null);
});

test('rejected first candidate does not prevent a later verified candidate', async () => {
  const secondUrl = productUrl.replace('itm123', 'itm456');
  const search = html(`<div data-id="${isbn}"><a href="${productUrl}">First</a></div><div data-id="${isbn}"><a href="${secondUrl}">Second</a></div>`);
  const first = html(`<h1>Wrong product</h1>${row('ISBN13', '9780306406157')}`);
  const second = html(`<h1>Correct product</h1>${row('ISBN13', isbn)}`);
  const result = await scrapeFlipkart(fakePage({ [searchUrl(isbn)]: search, [productUrl]: first, [secondUrl]: second }), null, isbn);
  assert.equal(result.found, true);
  assert.equal(result.url, secondUrl);
});

test('search proceeds to next results page when the first page has no exact candidate', async () => {
  const search = html(`<div data-id="${isbn}"><a href="${productUrl}">Book</a></div>`);
  const product = html(`<h1>Correct product</h1>${row('ISBN13', isbn)}`);
  const page = fakePage({ [searchUrl(isbn)]: html('Showing 1 – 40 of 41 results'), [searchUrl(isbn, 2)]: search, [productUrl]: product });
  assert.equal((await scrapeFlipkart(page, null, isbn)).found, true);
  assert.equal(page.visits, 3);
});

test('blocked pages are not treated as empty results or unavailable books', async () => {
  assert.equal(pageFailure(html('Access Denied'), 403).code, 'blocked');
  const page = fakePage({ [searchUrl(isbn)]: html('Verify you are human') }, 429);
  const result = await scrapeFlipkart(page, null, isbn);
  assert.equal(result.found, false);
  assert.equal(result.stock_status, 'Blocked');
  assert.equal(result.error_code, 'blocked');
  assert.equal(page.visits, 3);
});

test('blank successful HTTP response is an extraction error, not not-found', async () => {
  const result = await scrapeFlipkart(fakePage({ [searchUrl(isbn)]: html('') }), null, isbn);
  assert.equal(result.stock_status, 'Error');
  assert.equal(result.error_code, 'extraction_error');
});

function fakePage(pages, status = 200) {
  let current;
  return {
    visits: 0,
    async goto(url) { this.visits++; current = url; if (!pages[url]) throw new Error(`Unexpected URL ${url}`); return { status: () => status }; },
    url: () => current,
    content: async () => pages[current],
    waitForSelector: async () => {}, waitForTimeout: async () => {},
    getByText: () => ({ first: () => ({ isVisible: async () => false }) }),
  };
}

test('resume uses identity across reordering and retries failures while preserving successes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flipkart-test-'));
  const output = path.join(dir, 'results.jsonl');
  const good = { searched_isbn: isbn, found: true, isbn_matched: true };
  const bad = { searched_isbn: '9780306406157', found: false, error: 'Timeout' };
  fs.writeFileSync(output, [good, bad].map(JSON.stringify).join('\n') + '\n');
  const called = [];
  try {
    const { report } = await runBatch({ items: [{ searched_isbn: bad.searched_isbn }, { searched_isbn: isbn }], output, page: {}, delay: async () => {}, scrape: async (_, url, value) => { called.push(value); return { searched_isbn: value, found: true, isbn_matched: true }; } });
    assert.deepEqual(called, [bad.searched_isbn]);
    assert.equal(report.matched_count, 2);
    assert.equal(latestRecords(output).size, 2);
    assert.equal(identity({ searched_isbn: isbn }), identity({ ...good, url: productUrl, input_url: null }));
    assert.equal(identity({ searched_isbn: isbn, url: productUrl }), identity({ ...good, url: productUrl, input_url: productUrl }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

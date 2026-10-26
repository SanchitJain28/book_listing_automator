const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseSearch, searchUrl, bookchorUrl, pageFailure } = require('../scrapers/bookchor/core/search');
const { parseProduct } = require('../scrapers/bookchor/core/productExtractor');
const { verifyIsbn, sameIsbn, isValidIsbn } = require('../scrapers/bookchor/core/isbn');
const { scrapeBookChor } = require('../scrapers/bookchor/bookchor-isbn');
const { runBatch, identity } = require('../scrapers/bookchor/runner');

const isbn = '9788170770114';
const reference = fs.readFileSync(path.join(__dirname, '../references/bookchor-reference.md'), 'utf8');
const url = `https://www.bookchor.com/book/${isbn}/example-book`;
const html = content => `<html><body>${content}</body></html>`;
const details = (body = '', highlight = isbn) => html(`<div class="Products-details-info"><h1>Example book</h1><div class="Products-price"><p id="sellingPWeb">₹ 199</p><del id="mrp_desktop">₹ 300</del></div><div class="Highlights"><ul><li><p>${highlight}</p><span>ISBN</span></li></ul></div>${body}</div>`);

test('search URL uses query ISBN and parser scopes candidates to matching result cards', () => {
  assert.equal(searchUrl(isbn), `https://www.bookchor.com/search/?query=${isbn}`);
  const result = parseSearch(reference, isbn);
  assert.equal(result.candidates.length, 1);
  assert.match(result.candidates[0].title, /Brahmagupta/);
  assert.equal(result.hasNext, false);
  assert.equal(parseSearch(reference, '9780306406157').candidates.length, 0);
  const unrelated = html(`<a href="${url}">Navigation</a><div class="product-listing"><div class="product-item"><a href="https://evil.example/book/${isbn}/fake">Bad host</a></div></div>`);
  assert.equal(parseSearch(unrelated, isbn).candidates.length, 0);
});

test('reference product yields product price, MRP, active condition and independent highlight ISBN', () => {
  const data = parseProduct(reference, url);
  assert.match(data.title, /Brahmagupta/);
  assert.equal(data.author, 'Prakash/Satya');
  assert.equal(data.price, 1583);
  assert.equal(data.mrp, 2045);
  assert.equal(data.discount, '23% OFF');
  assert.equal(data.condition, 'New');
  assert.equal(data.binding, null);
  assert.equal(data.in_stock, true);
  assert.match(data.delivery, /2 - 3 days/);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_highlights');
});

test('unavailable buttons override a retained selling price', () => {
  const data = parseProduct(details('<div class="buynow"><button disabled>OUT OF STOCK</button></div>'), url);
  assert.equal(data.price, 199);
  assert.equal(data.in_stock, false);
});

test('full product panel takes precedence over the earlier mobile title-only panel', () => {
  const content = '<div class="Products-details-info"><h1>Short mobile title</h1><p id="sellingPWeb">₹ 199</p></div>' + details('<div class="buynow"><button>Add to Cart</button></div>');
  const data = parseProduct(content, url);
  assert.equal(data.title, 'Example book');
  assert.equal(data.in_stock, true);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_highlights');
});

test('hidden notification modal and unrelated unavailable recommendations do not override stock', () => {
  const content = details('<div class="buynow"><button>Add to Cart</button></div><div style="display:none"><button id="notifiy">Notify me</button></div>') + '<section>Out of stock <p>₹ 1</p></section>';
  const data = parseProduct(content, url);
  assert.equal(data.in_stock, true);
  assert.equal(data.price, 199);
});

test('price alone and disabled purchase controls do not prove availability', () => {
  assert.equal(parseProduct(details(), url).in_stock, null);
  assert.equal(parseProduct(details('<div class="buynow"><button disabled><span>Add to Cart</span></button></div>'), url).in_stock, null);
});

test('missing prices are null and header coupons never supply item prices', () => {
  const data = parseProduct(html('<header>₹ 50 off</header><div class="Products-details-info"><h1>Unavailable title</h1><div class="buynow"><button>Out of stock</button></div></div>'), url);
  assert.equal(data.price, null);
  assert.equal(data.mrp, null);
  assert.equal(data.in_stock, false);
});

test('conflicting product ISBN rejects a matching URL and equivalent ISBN-10 is supported', () => {
  const data = parseProduct(details('', '9780306406157'), url);
  assert.equal(verifyIsbn(isbn, data).isbn_matched, false);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'product_isbn_conflict');
  assert.equal(sameIsbn('0-306-40615-2', '9780306406157'), true);
  assert.equal(isValidIsbn('9780306406158'), false);
});

test('product path evidence is independent of search query text', () => {
  assert.equal(verifyIsbn(isbn, { title: 'Book', url, isbn_evidence: [] }).isbn_match_source, 'product_url_isbn');
  assert.equal(verifyIsbn(isbn, { title: 'Book', url: `https://www.bookchor.com/book/other/title?query=${isbn}`, isbn_evidence: [] }).isbn_matched, false);
});

test('matching structured product data can establish ISBN; unrelated products cannot', () => {
  const product = { '@type': 'Book', url, isbn };
  const data = parseProduct(details('', '') + `<script type="application/ld+json">${JSON.stringify(product)}</script>`, url);
  assert.equal(verifyIsbn(isbn, data).isbn_match_source, 'structured_product_data');
  const other = parseProduct(details('', '') + `<script type="application/ld+json">${JSON.stringify({ ...product, url: '/book/other/title' })}</script>`, url);
  assert.deepEqual(other.isbn_evidence, []);
});

test('URL validation rejects lookalike domains and script schemes', () => {
  assert.equal(bookchorUrl('https://bookchor.com.evil.example/book/test'), null);
  assert.equal(bookchorUrl('javascript:alert(1)'), null);
});

function fakePage(pages, status = 200) {
  let current;
  return { visits: 0, async goto(target) { this.visits++; current = target; if (!pages[target]) throw new Error(`Unexpected URL ${target}`); return { status: () => status }; }, url: () => current, content: async () => pages[current], waitForSelector: async () => {}, waitForFunction: async () => {}, waitForTimeout: async () => {} };
}

test('matching out-of-stock product is found and verified', async () => {
  const result = await scrapeBookChor(fakePage({ [url]: details('<div class="buynow"><button>Out of stock</button></div>') }), url, isbn);
  assert.equal(result.found, true);
  assert.equal(result.isbn_matched, true);
  assert.equal(result.in_stock, false);
});

test('explicit no results differs from blank or blocked responses', async () => {
  const empty = html('<div class="product-listing"><span class="total_item">0</span></div>');
  const result = await scrapeBookChor(fakePage({ [searchUrl(isbn)]: empty }), null, isbn);
  assert.equal(result.stock_status, 'Not Listed');
  const blank = await scrapeBookChor(fakePage({ [searchUrl(isbn)]: html('') }), null, isbn);
  assert.equal(blank.error_code, 'extraction_error');
  const blockedPage = fakePage({ [searchUrl(isbn)]: html('Access denied') }, 403);
  const blocked = await scrapeBookChor(blockedPage, null, isbn);
  assert.equal(blocked.stock_status, 'Blocked');
  assert.equal(blockedPage.visits, 3);
  assert.equal(pageFailure(html('Too many requests'), 429).code, 'blocked');
});

test('fresh batch skips no inputs and resume skips verified successes while retrying failures', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bookchor-resume-'));
  const output = path.join(directory, 'results.jsonl');
  const items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }];
  const called = [];
  try {
    await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { called.push(target); return { searched_isbn: target, found: target === isbn, isbn_matched: target === isbn }; } });
    assert.deepEqual(called, items.map(item => item.searched_isbn));
    called.length = 0;
    const { report } = await runBatch({ items: [...items].reverse(), output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { called.push(target); return { searched_isbn: target, found: true, isbn_matched: true }; } });
    assert.deepEqual(called, ['9780306406157']);
    assert.equal(report.matched_count, 2);
    assert.equal(identity({ searched_isbn: isbn, url }), identity({ searched_isbn: isbn, input_url: url }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { parseProduct, parseSearch, searchUrl, amazonUrl, pageFailure, scrapeInternationalAmazon } = require('../scrapers/amazon-isbn/core/international');
const { validateIsbnMatch } = require('../scrapers/amazon-isbn/core/validator');
const { scrapeAmazonBook } = require('../scrapers/amazon-isbn/scraper');
const { runBatch } = require('../scrapers/amazon-isbn/internationalRunner');
const reference = fs.readFileSync(path.join(__dirname, '../references/amazon-com-reference.md'), 'utf8');
const isbn = '9780816069613', url = 'https://www.amazon.com/dp/0816069611';
function product({ identifier = isbn, currency = '$', availability = 'In Stock', price = '236', cents = '07', body = '' } = {}) {
 return `<h1 id="productTitle">Book title</h1><div id="detailBullets_feature_div"><li><span class="a-text-bold">ISBN-13:</span> ${identifier}</li></div><div id="desktop_buybox"><div id="corePriceDisplay_desktop_feature_div"><span class="a-price priceToPay"><span class="a-offscreen"></span><span class="a-price-symbol">${currency}</span><span class="a-price-whole">${price}.</span><span class="a-price-fraction">${cents}</span></span></div><div id="availability">${availability}</div>${body}</div>`;
}
function row(asin, label = '', title = 'Book') { return `<div data-component-type="s-search-result" data-asin="${asin}">${label}<a class="a-link-normal" href="/title/dp/${asin}/ref=search"><h2>${title}</h2></a></div>`; }
function fakePage(pages, status = 200) { let current; return { visits: [], async goto(target) { this.visits.push(target); current = target; if (!pages[target]) throw Error(`Unexpected URL ${target}`); return { status: () => status }; }, url: () => current, content: async () => pages[current], waitForSelector: async () => {}, waitForTimeout: async () => {} }; }

test('reference preserves cents, USD currency, list price and seller', () => {
 const data = parseProduct(reference, url, 'amazon.com');
 assert.equal(data.price, 236.07); assert.equal(data.mrp, 270); assert.equal(data.currency, 'USD'); assert.equal(data.seller, 'Amazon.com'); assert.equal(data.shipping_cost, 13); assert.equal(data.publisher, 'Facts on File');
});
test('reference temporary out-of-stock overrides price and active purchasing controls', () => {
 const data = parseProduct(reference, url, 'amazon.com'); assert.equal(data.in_stock, false); assert.equal(data.stock_status, 'Out of Stock');
});
test('UK uses the same extraction code with GBP and decimal precision', () => {
 const data = parseProduct(product({ currency: '£', price: '19', cents: '95' }), 'https://www.amazon.co.uk/dp/0816069611', 'amazon.co.uk');
 assert.equal(data.price, 19.95); assert.equal(data.currency, 'GBP'); assert.equal(data.in_stock, true);
});
test('missing prices and unknown availability remain null', () => {
 const data = parseProduct('<h1 id="productTitle">Book</h1><div id="desktop_buybox"></div><aside class="priceToPay"><span class="a-price-whole">1</span></aside>', url, 'amazon.com');
 assert.equal(data.price, null); assert.equal(data.mrp, null); assert.equal(data.in_stock, null);
});
test('recommendation stock, coupon prices and other formats do not override primary product', () => {
 const html = product({ availability: 'Temporarily out of stock.', body: '<input id="add-to-cart-button">' }) + '<aside>In Stock $1.00</aside><div id="tmmSwatches">Paperback $5.00</div>';
 const data = parseProduct(html, url, 'amazon.com'); assert.equal(data.price, 236.07); assert.equal(data.in_stock, false);
});
test('ISBN validation supports equivalents and rejects conflicting or invalid identifiers', () => {
 assert.equal(validateIsbnMatch('0816069611', isbn), true); assert.equal(validateIsbnMatch('978-0816069613', isbn), true); assert.equal(validateIsbnMatch('9780306406157', isbn), false); assert.equal(validateIsbnMatch('N/A', isbn), false);
});
test('international search URLs use the requested marketplace', () => {
 assert.equal(searchUrl(isbn, 'amazon.com'), `https://www.amazon.com/s?k=${isbn}`); assert.equal(searchUrl(isbn, 'amazon.co.uk'), `https://www.amazon.co.uk/s?k=${isbn}`);
});
test('first organic listing excludes sponsored rows and unrelated navigation links', () => {
 const html = `<a href="/dp/0306406152">Unrelated</a><div class="s-search-results">${row('0306406152', '<span class="puis-sponsored-label-text">Sponsored</span>')}${row('0816069611')}${row('0306406152')}</div>`;
 const result = parseSearch(html, 'amazon.com'); assert.equal(result.candidate.url, url); assert.equal(result.candidate.asin, '0816069611');
});
test('lookalike domains, cross-market links and script schemes are rejected', () => {
 assert.equal(amazonUrl('https://amazon.com.evil.example/dp/0816069611', 'amazon.com'), null); assert.equal(amazonUrl('https://www.amazon.in/dp/0816069611', 'amazon.com'), null); assert.equal(amazonUrl('javascript:alert(1)', 'amazon.com'), null);
});
test('first listing is retained without switching format and product ISBN independently verifies it', async () => {
 const search = searchUrl(isbn, 'amazon.com'); const page = fakePage({ [search]: `<div class="s-search-results">${row('0816069611')}</div>`, [url]: product() + '<div id="tmmSwatches"><a href="/dp/0306406152">Paperback $1.00</a></div>' });
 const data = await scrapeAmazonBook(page, { isbn, domain: 'amazon.com' }); assert.equal(data.found, true); assert.equal(data.isbn_matched, true); assert.equal(data.price, 236.07); assert.deepEqual(page.visits, [search, url]);
});
test('mismatching first listing is reported, not replaced by a second listing', async () => {
 const search = searchUrl(isbn, 'amazon.com'); const page = fakePage({ [search]: `<div class="s-search-results">${row('0816069611')}${row('0306406152')}</div>`, [url]: product({ identifier: '9780306406157' }) });
 const data = await scrapeInternationalAmazon(page, { isbn, domain: 'amazon.com' }); assert.equal(data.found, false); assert.equal(data.stock_status, 'ISBN mismatch'); assert.equal(page.visits.length, 2);
});
test('shared scraper infers marketplace from a direct US or UK product URL', async () => {
 const page = fakePage({ [url]: product() }); const data = await scrapeAmazonBook(page, { directUrl: url, isbn }); assert.equal(data.store, 'Amazon.com'); assert.equal(data.found, true);
});
test('blocked pages never count as empty results; navigation retries are bounded', async () => {
 const search = searchUrl(isbn, 'amazon.com'); const page = fakePage({ [search]: '<title>Robot Check</title><form action="/errors/validateCaptcha"></form>' });
 const data = await scrapeInternationalAmazon(page, { isbn, domain: 'amazon.com' }); assert.equal(data.stock_status, 'Blocked'); assert.equal(page.visits.length, 2); assert.equal(pageFailure('', 503).code, 'blocked');
 const empty = await scrapeInternationalAmazon(fakePage({ [search]: '<body>No results for this ISBN</body>' }), { isbn, domain: 'amazon.com' }); assert.equal(empty.stock_status, 'Not Found');
});
test('resume preserves verified results and retries failures by identity', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-international-')), output = path.join(dir, 'results.jsonl'), items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }]; let calls = [];
 try { await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, params) => { calls.push(params.isbn); return { searched_isbn: params.isbn, found: params.isbn === isbn, isbn_matched: params.isbn === isbn }; } }); assert.equal(calls.length, 2); calls = [];
 const { report } = await runBatch({ items: [...items].reverse(), output, page: {}, delay: async () => {}, scrape: async (_, params) => { calls.push(params.isbn); return { searched_isbn: params.isbn, found: true, isbn_matched: true }; } }); assert.deepEqual(calls, ['9780306406157']); assert.equal(report.matched_count, 2);
 } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('displayed INR currency on an international site is preserved rather than labeled USD', () => {
 const html = product({ currency: 'INR', price: '22,412', cents: '25', body: '<div id="deliveryBlockMessage">INR 1,234.21 delivery</div>' });
 const data = parseProduct(html, url, 'amazon.com'); assert.equal(data.price, 22412.25); assert.equal(data.currency, 'INR'); assert.equal(data.shipping_cost, 1234.21);
});

test('a first listing without product ISBN evidence stays unverified rather than a proven mismatch', async () => {
 const html = product().replace(/<div id="detailBullets_feature_div">.*?<\/div>/, '');
 const data = await scrapeInternationalAmazon(fakePage({ [url]: html }), { directUrl: url, isbn, domain: 'amazon.com' });
 assert.equal(data.found, false); assert.equal(data.stock_status, 'ISBN unverified'); assert.equal(data.found_isbn, null);
});

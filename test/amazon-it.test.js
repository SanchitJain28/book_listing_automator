const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { amount, money, formats, canonical, parseProduct, parseOffers } = require('../scrapers/amazon-isbn/core/italy');
const { scrapeAmazonBook } = require('../scrapers/amazon-it-isbn/amazon-it-isbn');
const { searchUrl } = require('../scrapers/amazon-isbn/core/international');
const { setPolicyForPage } = require('../scrapers/amazon-isbn/core/requestPolicy');
const { runBatch } = require('../scrapers/amazon-isbn/internationalRunner');
const os = require('node:os');
const path = require('node:path');
const isbn = '9780816069613', url = 'https://www.amazon.it/dp/0816069611';
const reference = fs.readFileSync(path.join(__dirname, '../references/amazon-it-reference.md'), 'utf8');
const product = ({ identifier = isbn, format = 'Copertina flessibile', price = '19,95', stock = 'Disponibilità immediata.', extra = '' } = {}) => `<h1 id="productTitle">Test book</h1><div id="productSubtitle">${format}</div><div id="bylineInfo"><span class="author"><a>Author</a></span></div><div id="detailBullets_feature_div"><li><b class="a-text-bold">ISBN-13:</b> ${identifier}</li><li><b class="a-text-bold">Editore:</b> Publisher</li><li><b class="a-text-bold">Lingua:</b> Inglese</li></div><div id="desktop_buybox"><div id="corePriceDisplay_desktop_feature_div"><span class="a-price"><span class="a-offscreen">€${price}</span></span><span class="a-price a-text-price"><span class="a-offscreen">€30,00</span></span></div><div id="availability">${stock}</div><a id="sellerProfileTriggerId">Seller</a></div>${extra}`;
function fake(pages) {
  let current;
  const page = { visits: [], goto: async u => { page.visits.push(u); current = u; assert.ok(pages[u], `Unexpected URL ${u}`); return { status: () => 200 }; }, content: async () => pages[current], url: () => current, waitForTimeout: async () => {}, waitForSelector: async () => {} };
  setPolicyForPage(page, { minDelayMs: 0, maxDelayMs: 0, backoffBaseMs: 0 });
  return page;
}
const search = (asin = '0816069611') => `<div class="s-search-results"><div data-component-type="s-search-result" data-asin="${asin}"><a href="/title/dp/${asin}"><h2>Test book</h2></a></div></div>`;
test('Euro prices preserve decimal commas, English decimals and thousands', () => {
  for (const [text, expected] of [['€19,95', 19.95], ['19,95 €', 19.95], ['€1.234,56', 1234.56], ['EUR 1,234.56', 1234.56], ['€78.31', 78.31], ['€1 234,56', 1234.56]]) assert.equal(money(text), expected, text);
  assert.equal(amount('1.234'), 1234); assert.equal(money('20% coupon'), null); assert.equal(money('$12.00'), null);
});
test('supplied reference excludes Kindle from physical formats and resolves Italy links', () => {
  const options = formats(reference, 'https://www.amazon.it/dp/B00OD4WEP8');
  assert.equal(options.length, 1); assert.equal(options[0].url, 'https://www.amazon.it/dp/1584886439'); assert.equal(options[0].advertised_price, 117.46);
  const data = parseProduct(reference, 'https://www.amazon.it/dp/B00OD4WEP8');
  assert.equal(data.binding, 'Kindle Edition'); assert.equal(data.price, 78.31); assert.equal(data.isbn_evidence[0].value, '9781420011449');
});
test('Italian product metadata, buybox price, currency and seller are scoped to the product', () => {
  const data = parseProduct(product() + '<aside>In stock €1.00</aside>', url);
  assert.equal(data.price, 19.95); assert.equal(data.mrp, 30); assert.equal(data.currency, 'EUR'); assert.equal(data.seller, 'Seller'); assert.equal(data.publisher, 'Publisher'); assert.equal(data.language, 'Inglese'); assert.equal(data.in_stock, true);
});
test('temporary unavailability overrides price and retained order controls', () => {
  const data = parseProduct(product({ stock: 'Attualmente non disponibile.' }).replace('</div></div>', '<input id="add-to-cart-button"></div></div>'), url);
  assert.equal(data.in_stock, false);
});
test('split whole/fraction prices and missing prices are preserved correctly', () => {
  const html = product().replace('<span class="a-offscreen">€19,95</span>', '<span class="a-price-whole">19,</span><span class="a-price-fraction">95</span>');
  assert.equal(parseProduct(html, url).price, 19.95);
  assert.equal(parseProduct('<h1 id="productTitle">Book</h1><aside class="a-price">€1</aside>', url).price, null);
});
test('empty offer-display placeholders cannot hide the rendered primary price', () => {
  const html = product().replace('<div id="desktop_buybox">', '<div id="desktop_buybox"><div id="apex_offerDisplay_desktop"></div><div id="corePrice_feature_div"></div>');
  assert.equal(parseProduct(html, url).price, 19.95);
});
test('buying options keep price, seller, delivery and condition from the same offer', () => {
  const offers = parseOffers('<div id="aod-offer-list"><div id="aod-offer"><h5>Usato - Buone condizioni</h5><span class="a-price"><span class="a-offscreen">€8,50</span></span><div id="aod-offer-soldBy"><a>Used Seller</a></div><div id="delivery">Consegna €3,00</div></div><div id="aod-offer"><h5>Nuovo</h5><span class="a-price"><span class="a-offscreen">€12,90</span></span><div id="aod-offer-soldBy"><a>New Seller</a></div></div></div><aside class="a-price">€0,50</aside>');
  assert.equal(offers.length, 2); assert.equal(offers[0].price, 8.5); assert.equal(offers[0].seller, 'Used Seller'); assert.equal(offers[0].shipping_cost, 3); assert.match(offers[0].condition, /Usato/);
});
test('visible buying drawer can select a cheaper used offer without mixing seller or condition', async () => {
  const page = fake({ [url]: product() });
  const baseContent = page.content;
  let opened = false;
  page.locator = () => ({ count: async () => 1, nth: () => ({ isVisible: async () => true, click: async () => { opened = true; } }) });
  page.content = async () => await baseContent() + (opened ? '<div id="aod-offer-list"><div id="aod-offer"><h5>Usato - Buono</h5><span class="a-price"><span class="a-offscreen">8,50 €</span></span><div id="aod-offer-soldBy"><a>Used Seller</a></div><div id="delivery">Consegna 3,00 €</div></div></div>' : '');
  const row = await scrapeAmazonBook(page, { directUrl: url, isbn });
  assert.equal(row.price, 8.5); assert.equal(row.seller, 'Used Seller'); assert.equal(row.condition, 'Usato - Buono'); assert.equal(row.used_available, 8.5); assert.equal(row.shipping_cost, 3); assert.equal(row.price_source, 'buying_options'); assert.equal(row.isbn_matched, true);
});
test('Italy media-matrix popover requires its second click before offers can be read', async () => {
  const page = fake({ [url]: product() });
  const originalContent = page.content; let popover = false, drawer = false;
  page.locator = selector => selector.startsWith('.mm-grid')
    ? { count: async () => popover ? 1 : 0, nth: () => ({ isVisible: async () => popover, click: async () => { drawer = true; } }) }
    : { count: async () => 1, nth: () => ({ isVisible: async () => true, click: async () => { popover = true; } }) };
  page.content = async () => await originalContent() + (drawer ? '<div id="aod-offer-list"><div id="aod-offer"><h5>Nuovo</h5><span class="a-price"><span class="a-offscreen">€12,00</span></span></div></div>' : '');
  const row = await scrapeAmazonBook(page, { directUrl: url, isbn });
  assert.equal(drawer, true); assert.equal(row.price, 12); assert.equal(row.buying_options_inspected, true);
});
test('search opens first listing and compares physical formats without using a Kindle price', async () => {
  const paperback = 'https://www.amazon.it/dp/0306406152';
  const first = product({ format: 'Kindle Edition', price: '1,00', extra: '<div id="tmmSwatches"><div class="swatchElement"><a class="a-button-text" href="/dp/0306406152">Paperback €8,90</a></div><div class="swatchElement"><a class="a-button-text" href="/dp/0816069611">Hardcover €19,95</a></div></div>' });
  const page = fake({ [searchUrl(isbn, 'amazon.it')]: search('B00OD4WEP8'), 'https://www.amazon.it/dp/B00OD4WEP8': first, [url]: product({ format: 'Hardcover' }), [paperback]: product({ price: '8,90', identifier: '9780306406157' }) });
  const row = await scrapeAmazonBook(page, { isbn });
  assert.equal(row.price, 8.9); assert.equal(row.url, paperback); assert.equal(row.formats_inspected, 2); assert.equal(row.found, true); assert.equal(row.isbn_matched, false); assert.equal(row.stock_status, 'ISBN mismatch');
});
test('product specifications verify equivalents and reject conflicts independently of URL/search ISBN', async () => {
  const page = fake({ [url]: product({ identifier: '0816069611' }) });
  assert.equal((await scrapeAmazonBook(page, { directUrl: url, isbn })).isbn_matched, true);
  const bad = fake({ [url]: product({ identifier: '9780306406157' }) });
  assert.equal((await scrapeAmazonBook(bad, { directUrl: url, isbn })).isbn_matched, false);
});
test('cheapest available physical offer wins over an unavailable lower price', async () => {
  const other = 'https://www.amazon.it/dp/0306406152';
  const page = fake({ [url]: product({ extra: `<div id="tmmSwatches"><div class="swatchElement"><a class="a-button-text" href="${other}">Hardcover €1,00</a></div></div>` }), [other]: product({ price: '1,00', stock: 'Attualmente non disponibile.' }) });
  const row = await scrapeAmazonBook(page, { directUrl: url, isbn }); assert.equal(row.price, 19.95); assert.equal(row.url, url);
});
test('explicit Italian empty results differ from CAPTCHA blocks and bad domains', async () => {
  const empty = fake({ [searchUrl(isbn, 'amazon.it')]: '<body>Nessun risultato per questo ISBN</body>' });
  assert.equal((await scrapeAmazonBook(empty, { isbn })).stock_status, 'Not Found');
  const blocked = fake({ [searchUrl(isbn, 'amazon.it')]: '<title>Robot Check</title><form action="/errors/validateCaptcha"></form>' });
  assert.equal((await scrapeAmazonBook(blocked, { isbn })).stock_status, 'Blocked'); assert.equal(blocked.visits.length, 1);
  assert.equal(canonical('https://amazon.it.evil.example/dp/0816069611'), null); assert.equal(canonical('https://www.amazon.com/dp/0816069611'), null);
});
test('Italy uses existing JSONL resume and preserves the pending ISBN after a block', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amazon-it-test-')), output = path.join(dir, 'results.jsonl');
  try {
    const items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }]; let count = 0;
    const scrape = async () => ++count === 1 ? { found: true, isbn_matched: true, title: 'Book', price: 19.95, currency: 'EUR' } : { stock_status: 'Blocked', error_code: 'blocked' };
    const first = await runBatch({ items, output, page: {}, domain: 'amazon.it', scrape, delay: async () => {} });
    assert.equal(first.stopped, true); assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 1);
    fs.unlinkSync(output + '.pause.json'); const calls = [];
    await runBatch({ items, output, page: {}, domain: 'amazon.it', scrape: async (_, p) => { calls.push(p.isbn); return { found: true, isbn_matched: true }; }, delay: async () => {} });
    assert.deepEqual(calls, ['9780306406157']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

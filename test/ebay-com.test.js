const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { searchResults, parseListing, scrapeEbayBook } = require('../scrapers/ebay-com/scraper');

const isbn = '9781604944334';
const itemUrl = 'https://www.ebay.com/itm/142714558042';
const [search, listing] = fs.readFileSync(path.join(__dirname, '../references/ebay-com-reference.md'), 'utf8')
  .split('## Product page right panel reference');
const specifics = value => `<div class="ux-labels-values">
  <div class="ux-labels-values__labels">ISBN:</div>
  <div class="ux-labels-values__values"><span class="ux-textspans">${value}</span></div>
</div>`;

test('reference search excludes placeholders and recommendations', () => {
  assert.deepEqual(searchResults(search), { urls: [itemUrl], empty: false });
});

test('listing prices and delivery can be read without assuming an ISBN match', () => {
  const row = parseListing(listing, isbn);
  assert.match(row.title, /Second Thoughts on Marriage and Divorce/);
  assert.equal(row.price, 34.99);
  assert.equal(row.shipping_cost, 24.96);
  assert.equal(row.total_amount, 59.95);
  assert.match(row.delivery, /Dec 14.*Jan 5/);
  assert.equal(row.isbn_matched, false);
});

test('item page verifies ISBN evidence and rejects conflicting evidence', async () => {
  let current;
  const page = {
    goto: async url => {
      current = url;
      return { status: () => 200 };
    },
    url: () => current,
    content: async () => current === itemUrl ? listing + specifics(isbn) : search,
  };
  const row = await scrapeEbayBook(page, { isbn });
  assert.equal(row.url, itemUrl);
  assert.equal(row.found_isbn, isbn);
  assert.equal(row.isbn_matched, true);
  assert.equal(row.isbn_match_source, 'item_specifics');

  const conflict = parseListing(listing + specifics(isbn) + specifics('9781429600378'), isbn);
  assert.equal(conflict.isbn_matched, false);
  assert.equal(conflict.stock_status, 'ISBN mismatch');
});

test('HTTP 403 is a block rather than a missing listing', async () => {
  const page = {
    goto: async () => ({ status: () => 403 }),
    content: async () => '<title>Error Page | eBay</title>',
  };
  await assert.rejects(scrapeEbayBook(page, { isbn }), { code: 'blocked' });
});

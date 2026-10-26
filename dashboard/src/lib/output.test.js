import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { clean, formatMoney, normalizeRecords, parseOutput, parsePrice, safeUrl } from './output.js';

test('imports JSONL with BOM, CRLF, blank lines and .json contents', () => {
  assert.deepEqual(parseOutput('\uFEFF{"isbn":"1"}\r\n\r\n{"isbn":"2"}\r\n'), [{ isbn: '1' }, { isbn: '2' }]);
});
test('imports pretty JSON arrays and single objects', () => {
  assert.equal(parseOutput('[\n{"title":"One"},\n{"title":"Two"}\n]').length, 2);
  assert.equal(parseOutput('{\n"searched_isbn":"123"\n}')[0].searched_isbn, '123');
});
test('rejects malformed records atomically with a physical line number', () => {
  assert.throws(() => parseOutput('{"isbn":"1"}\n\n{"isbn":'), /line 3/);
  for (const text of ['', '[]', 'null', '[1]', '{"foo":"bar"}', '{"listings":[null]}', '{"listings":{}}', '[{"isbn":"1"},]']) {
    assert.throws(() => parseOutput(text));
  }
});
test('normalizes nested seller offers without substituting parent price or ISBN match', () => {
  const data = normalizeRecords([{
    searched_isbn: '9780835212120', title: 'Parent title', currency: 'USD', price: 40,
    isbn_matched: true, listings: [
      { seller: 'One', price_num: 12.5, is_out_of_stock: false, isbn_match: false },
      { seller: 'Two', price: 'N/A', is_out_of_stock: true },
    ],
  }]);
  assert.equal(data.books.length, 1);
  assert.equal(data.offers.length, 2);
  assert.equal(data.offers[0].title, 'Parent title');
  assert.equal(data.offers[0].currency, 'USD');
  assert.equal(data.offers[0].match, 'Mismatch');
  assert.equal(data.offers[1].match, 'Unverified');
  assert.equal(data.offers[1].price, null);
  assert.equal(data.offers[1].status, 'Out of stock');
});
test('handles legacy nested Error rows, not-found records, and blocked results', () => {
  const data = normalizeRecords([
    { searched_isbn: '1', listings: [{ price: 'Error', found_isbn: 'Error' }] },
    { searched_isbn: '2', found: false, in_stock: false },
    { searched_isbn: '3', found: false, stock_status: 'Rate Limited (429)' },
  ]);
  assert.deepEqual(data.books.map(row => row.status), ['Error', 'Not found', 'Blocked']);
  assert.equal(data.offers[0].price, null);
});
test('does not infer stock, match or ambiguous dollar currency from a price', () => {
  const { books } = normalizeRecords([{ title: 'Uncertain', price: '$15.00' }]);
  assert.equal(books[0].currency, null);
  assert.equal(books[0].status, 'Unknown');
  assert.equal(books[0].match, 'Unverified');
});
test('retains duplicate ISBN records with unique grid IDs', () => {
  const { books } = normalizeRecords([{ isbn: 'same' }, { isbn: 'same' }]);
  assert.equal(new Set(books.map(row => row.id)).size, 2);
});
test('handles numbers, currency strings, European decimals and missing sentinels', () => {
  assert.equal(parsePrice(0), 0);
  assert.equal(parsePrice('US$ 1,234.56'), 1234.56);
  assert.equal(parsePrice('EUR 1.234,56'), 1234.56);
  assert.equal(parsePrice('12,95 €'), 12.95);
  assert.equal(parsePrice('₹1,234'), 1234);
  for (const value of [null, 'N/A', 'Error', Infinity]) assert.equal(parsePrice(value), null);
  assert.equal(clean(' N/A '), null);
  assert.equal(formatMoney(null, 'USD'), '—');
  assert.match(formatMoney(12.5, 'USD'), /12\.50/);
});
test('limits links to HTTP(S) and derives currency from supported AbeBooks hosts', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('file:///etc/passwd'), null);
  const { books } = normalizeRecords([
    { title: 'UK', url: 'https://www.abebooks.co.uk/example' },
    { title: 'Spain', url: 'https://www.iberlibro.com/example' },
    { title: 'Imposter', url: 'https://abebooks.com.example.org/example' },
  ]);
  assert.deepEqual(books.map(row => row.currency), ['GBP', 'EUR', null]);
});

const actual = new URL('../../../output/abebooks/isbns/2026-09-12/input.json', import.meta.url);
// This fixture is ignored by Git; local smoke coverage is available when present.
test('imports the existing local AbeBooks output without dropping listings', { skip: !existsSync(actual) }, () => {
  const records = parseOutput(readFileSync(actual, 'utf8'));
  const { books, offers } = normalizeRecords(records);
  assert.equal(books.length, records.length);
  assert.equal(offers.length, records.reduce((count, row) => count + (row.listings?.length || (parsePrice(row.price) !== null || clean(row.seller) ? 1 : 0)), 0));
});

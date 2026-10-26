const missing = /^(?:n\/?a|error|unknown|null|undefined|not explicitly listed)$/i;

export function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return !text || missing.test(text) ? null : text;
}

// JSONL is intentionally supported even when the filename ends in .json.
export function parseOutput(text) {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) throw new Error('This file is empty. Choose a scraper output containing JSON records.');
  let records;
  try {
    const parsed = JSON.parse(source);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    if (source.startsWith('[')) throw new Error('Invalid JSON array. Check the file for missing commas or a truncated record.');
    records = text.replace(/^\uFEFF/, '').split(/\r?\n/).flatMap((line, index) => {
      if (!line.trim()) return [];
      try { return [JSON.parse(line)]; }
      catch { throw new Error(`Invalid JSON on line ${index + 1}. The file was not imported; check that record and try again.`); }
    });
  }
  if (!records.length) throw new Error('This file contains no records.');
  records.forEach((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new Error(`Record ${index + 1} must be a JSON object.`);
    }
    if (!['isbn', 'searched_isbn', 'asin', 'title', 'url', 'buy_url', 'listings', 'found', 'error', 'price'].some(key => key in record)) {
      throw new Error(`Record ${index + 1} does not look like a scraper result.`);
    }
    if (record.listings !== undefined && (!Array.isArray(record.listings) || record.listings.some(item => !item || typeof item !== 'object' || Array.isArray(item)))) {
      throw new Error(`Record ${index + 1} has an invalid listings array.`);
    }
  });
  return records;
}

export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = clean(value);
  if (!text) return null;
  let number = text.replace(/[^\d.,]/g, '');
  if (!number) return null;
  // Both 1,234.56 and 1.234,56 occur in this scraper family.
  const comma = number.lastIndexOf(',');
  const dot = number.lastIndexOf('.');
  if (comma > dot && /,\d{1,2}$/.test(number)) number = number.replace(/\./g, '').replace(',', '.');
  else number = number.replace(/,/g, '');
  const result = Number(number);
  return Number.isFinite(result) ? result : null;
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function storeOf(record) {
  if (clean(record.store || record.platform)) return clean(record.store || record.platform);
  try { return new URL(record.url || record.buy_url).hostname.replace(/^www\./, ''); }
  catch { return 'Unspecified'; }
}

function currencyOf(record, parent) {
  const explicit = clean(record.currency || parent.currency);
  if (explicit) return explicit.toUpperCase();
  const text = String(record.price ?? parent.price ?? '');
  if (/₹|INR/i.test(text)) return 'INR';
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/US\$|USD/i.test(text)) return 'USD';
  const url = safeUrl(record.url || parent.url || parent.buy_url);
  const host = url ? new URL(url).hostname : '';
  if (/(?:^|\.)abebooks\.co\.uk$/.test(host)) return 'GBP';
  if (/(?:^|\.)abebooks\.com$/.test(host)) return 'USD';
  if (/(?:^|\.)iberlibro\.com$/.test(host)) return 'EUR';
  // A bare $ is ambiguous: keep the currency unknown rather than invent one.
  return null;
}

function statusOf(record, price) {
  if (record.error || ['price', 'title', 'found_isbn'].some(key => /^error$/i.test(String(record[key])))) return 'Error';
  if (/rate.limit|captcha|blocked|robot/i.test(record.stock_status || '')) return 'Blocked';
  if (record.found === false) return 'Not found';
  if (record.is_out_of_stock === true || record.in_stock === false || /out.of.stock|unavailable|sold.out/i.test(record.stock_status || '')) return 'Out of stock';
  if (record.in_stock === true || record.is_out_of_stock === false && price !== null) return 'In stock';
  return 'Unknown';
}

function makeRow(record, parent, id, recordIndex, offerIndex, offerCount) {
  const price = parsePrice(record.price_num ?? record.price);
  const match = record.isbn_matched ?? record.isbn_match ?? record.isbn_verified;
  return {
    id, recordIndex, offerIndex, offerCount,
    isbn: clean(parent.searched_isbn || parent.isbn || record.searched_isbn || record.isbn || parent.asin),
    foundIsbn: clean(record.found_isbn || record.isbn),
    title: clean(record.title) || clean(parent.title) || 'Untitled result',
    author: clean(record.author) || clean(parent.author),
    store: storeOf({ ...parent, ...record }),
    price,
    currency: currencyOf(record, parent),
    status: statusOf(record, price),
    match: match === true ? 'Matched' : match === false ? 'Mismatch' : 'Unverified',
    seller: clean(record.seller),
    shipping: clean(record.shipping),
    sellerAddress: clean(record.seller_address),
    binding: clean(record.binding) || clean(parent.binding),
    publisher: clean(record.publisher) || clean(parent.publisher),
    date: clean(parent.scraped_at),
    url: safeUrl(record.url || record.buy_url || parent.url || parent.buy_url),
    error: clean(record.error || parent.error),
    raw: record,
    parent,
  };
}

export function normalizeRecords(records) {
  const books = [];
  const offers = [];
  records.forEach((record, index) => {
    const listings = record.listings || [];
    const book = makeRow(record, record, `book-${index}`, index, null, listings.length);
    if (listings.some(item => statusOf(item, parsePrice(item.price_num ?? item.price)) === 'Error')) book.status = 'Error';
    books.push(book);
    listings.forEach((listing, offerIndex) => {
      offers.push(makeRow(listing, record, `offer-${index}-${offerIndex}`, index, offerIndex, listings.length));
    });
    if (!listings.length && (book.price !== null || book.seller)) {
      offers.push(makeRow(record, record, `offer-${index}-0`, index, 0, 1));
    }
  });
  return { books, offers };
}

export function formatMoney(value, currency) {
  if (value === null || value === undefined) return '—';
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return `${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}${currency ? ` ${currency}` : ' · currency unknown'}`;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code' }).format(value); }
  catch { return `${value} ${currency}`; }
}

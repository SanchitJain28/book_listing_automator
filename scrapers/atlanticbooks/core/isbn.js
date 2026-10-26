function normalizeIsbn(value) {
  const isbn = String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
  return /^(?:\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : null;
}

function toIsbn13(value) {
  const isbn = normalizeIsbn(value);
  if (!isbn || isbn.length === 13) return isbn;
  const body = '978' + isbn.slice(0, 9);
  const sum = [...body].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - sum % 10) % 10);
}

function isValidIsbn(value) {
  const isbn = normalizeIsbn(value);
  if (!isbn) return false;
  return isbn.length === 13
    ? [...isbn].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0
    : [...isbn].reduce((sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0;
}

function sameIsbn(a, b) {
  return !!normalizeIsbn(a) && !!normalizeIsbn(b) && toIsbn13(a) === toIsbn13(b);
}

function verifyIsbn(target, data) {
  const explicit = data.isbn_evidence.filter(item => normalizeIsbn(item.value));
  const conflicting = explicit.find(item => !sameIsbn(item.value, target));
  if (conflicting) return { found_isbn: normalizeIsbn(conflicting.value), isbn_matched: false, isbn_match_source: 'product_isbn_conflict' };
  if (explicit.length) return { found_isbn: normalizeIsbn(explicit[0].value), isbn_matched: true, isbn_match_source: explicit[0].source };
  const pathIsbn = new URL(data.url).pathname.match(/^\/products\/[^/]*-(\d{13}|\d{9}[\dX])\/?$/i)?.[1];
  if (data.title && sameIsbn(pathIsbn, target)) return { found_isbn: normalizeIsbn(pathIsbn), isbn_matched: true, isbn_match_source: 'product_url_isbn' };
  return { found_isbn: null, isbn_matched: false, isbn_match_source: null };
}

module.exports = { normalizeIsbn, toIsbn13, sameIsbn, isValidIsbn, verifyIsbn };

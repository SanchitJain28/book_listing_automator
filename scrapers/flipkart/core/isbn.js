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
  if (isbn.length === 13) return [...isbn].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0;
  return [...isbn].reduce((sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0) % 11 === 0;
}

function sameIsbn(a, b) {
  return !!normalizeIsbn(a) && !!normalizeIsbn(b) && toIsbn13(a) === toIsbn13(b);
}

function verifyIsbn(target, data, candidate = null) {
  const specifications = [...new Set([data.isbn13, data.isbn10, ...(data.structured_isbns || [])].map(normalizeIsbn).filter(Boolean))];
  const conflict = specifications.some(isbn => !sameIsbn(isbn, target));
  if (conflict) return { found_isbn: specifications.find(isbn => !sameIsbn(isbn, target)), isbn_matched: false, isbn_match_source: 'product_isbn_conflict' };
  if (specifications.length) return { found_isbn: specifications[0], isbn_matched: true, isbn_match_source: data.isbn13 || data.isbn10 ? 'product_specifications' : 'structured_product_data' };
  const pid = new URL(data.url).searchParams.get('pid');
  if (candidate && sameIsbn(candidate.id, target) && sameIsbn(candidate.pid, target) && sameIsbn(pid, target)) {
    return { found_isbn: normalizeIsbn(candidate.id), isbn_matched: true, isbn_match_source: 'search_card_data_id_and_product_pid' };
  }
  return { found_isbn: null, isbn_matched: false, isbn_match_source: null };
}

module.exports = { normalizeIsbn, toIsbn13, isValidIsbn, sameIsbn, verifyIsbn };

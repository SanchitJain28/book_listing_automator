function normalize(value) {
  const isbn = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  return /^(?:\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : null;
}
function canonical(value) {
  const isbn = normalize(value);
  if (!isbn || isbn.length === 13) return isbn;
  const body = '978' + isbn.slice(0, 9);
  const sum = [...body].reduce((n, digit, i) => n + Number(digit) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - sum % 10) % 10);
}
function sameIsbn(a, b) { return !!normalize(a) && !!normalize(b) && canonical(a) === canonical(b); }
module.exports = { normalize, sameIsbn };

const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./core/isbn');
const { bookchorUrl, searchUrl, parseSearch, navigate } = require('./core/search');
const { parseProduct } = require('./core/productExtractor');

function emptyResult(isbn, url, status, code = null, error = null) {
  return { store: 'BookChor', searched_isbn: isbn, found: false, title: null, author: null,
    price: null, mrp: null, discount: null, currency: 'INR', in_stock: null, stock_status: status,
    seller: 'BookChor', binding: null, publisher: null, pages: null, language: null, delivery: null,
    condition: null, found_isbn: null, isbn_matched: false, isbn_match_source: null, url,
    ...(code ? { error_code: code, error } : {}) };
}

/** Public interface retained for the master scraper. */
async function scrapeBookChor(page, directUrl, targetIsbn) {
  const direct = directUrl ? bookchorUrl(directUrl) : null;
  const isbn = normalizeIsbn(targetIsbn || direct?.pathname.match(/^\/book\/([^/]+)/)?.[1] || direct?.searchParams.get('query'));
  let targetUrl = direct?.href || (isbn ? searchUrl(isbn) : null);
  const rejected = [];
  try {
    if (directUrl && !direct) return emptyResult(isbn, null, 'Error', 'invalid_url', 'Expected an HTTPS BookChor URL.');
    if (!isValidIsbn(isbn)) return emptyResult(isbn || String(targetIsbn || ''), targetUrl, 'Invalid ISBN', 'invalid_isbn', 'A valid ISBN-10 or ISBN-13 is required.');
    async function product(url) {
      targetUrl = url;
      const html = await navigate(page, url);
      const data = parseProduct(html, page.url());
      if (!data.product_page) throw Object.assign(new Error('BookChor product details did not load.'), { code: 'extraction_error' });
      const validation = verifyIsbn(isbn, data);
      if (!validation.isbn_matched) { rejected.push({ url: data.url, ...validation }); return null; }
      const { product_page, ...fields } = data;
      return { store: 'BookChor', searched_isbn: isbn, found: true, seller: 'BookChor', ...fields, ...validation };
    }
    if (direct?.pathname.startsWith('/book/')) {
      const result = await product(direct.href);
      if (result) return result;
    }
    const seen = new Set();
    for (let number = 1; number <= 3; number++) {
      targetUrl = number === 1 && direct?.pathname.startsWith('/search') ? direct.href : searchUrl(isbn, number);
      const html = await navigate(page, targetUrl);
      const search = parseSearch(html, isbn);
      if (!search.hasResults && !search.empty) throw Object.assign(new Error('Search exposed neither product cards nor an explicit empty result.'), { code: 'extraction_error' });
      for (const candidate of search.candidates) {
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        const result = await product(candidate.url);
        if (result) return result;
      }
      if (!search.hasNext) break;
    }
    return { ...emptyResult(isbn, targetUrl, rejected.length ? 'ISBN mismatch' : 'Not Listed'), ...(rejected.length ? { rejected_candidates: rejected } : {}) };
  } catch (error) {
    return emptyResult(isbn, targetUrl, error.code === 'blocked' ? 'Blocked' : 'Error', error.code || 'navigation_error', error.message);
  }
}

module.exports = { scrapeBookChor };

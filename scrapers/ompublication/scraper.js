const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./core/isbn');
const { omUrl, searchUrl, parseSearch, navigate } = require('./core/search');
const { parseProduct } = require('./core/productExtractor');

function emptyResult(isbn, url, status, code = null, error = null) {
  return { store: 'Om Publications', searched_isbn: isbn, found: false, title: null, author: null,
    publisher: null, binding: null, language: null, pages: null, price: null, mrp: null, currency: 'INR',
    seller: 'Om Publications', in_stock: null, stock_status: status, found_isbn: null, isbn_matched: false,
    isbn_match_source: null, url, ...(code ? { error_code: code, error } : {}) };
}

async function scrapeOmPublication(page, directUrl, targetIsbn) {
  const direct = directUrl ? omUrl(directUrl) : null;
  const isbn = normalizeIsbn(targetIsbn || direct?.searchParams.get('q'));
  let url = direct?.href || (isbn ? searchUrl(isbn) : null);
  const rejected = [];
  try {
    if (directUrl && !direct) return emptyResult(isbn, null, 'Error', 'invalid_url', 'Expected an HTTPS Om Publications URL.');
    if (!isValidIsbn(isbn)) return emptyResult(isbn || String(targetIsbn || ''), url, 'Invalid ISBN', 'invalid_isbn', 'A valid ISBN-10 or ISBN-13 is required.');
    async function product(target) {
      url = target;
      const data = parseProduct(await navigate(page, target), page.url());
      if (!data.product_page) throw Object.assign(new Error('Om Publications product details did not load.'), { code: 'extraction_error' });
      const validation = verifyIsbn(isbn, data);
      if (!validation.isbn_matched) { rejected.push({ url: data.url, title: data.title, ...validation, isbn_evidence: data.isbn_evidence }); return null; }
      const { product_page, ...fields } = data;
      return { store: 'Om Publications', searched_isbn: isbn, found: true, seller: 'Om Publications', ...fields, ...validation };
    }
    if (direct?.pathname.startsWith('/product/books/')) {
      const result = await product(direct.href);
      if (result) return result;
    }
    let next = direct?.pathname === '/products/search' ? direct.href : searchUrl(isbn);
    const seen = new Set(), visited = new Set();
    for (let number = 0; next && number < 3; number++) {
      if (visited.has(next)) break;
      visited.add(next); url = next;
      const search = parseSearch(await navigate(page, next), next);
      if (!search.candidates.length && !search.empty) throw Object.assign(new Error('Search exposed neither product cards nor an explicit empty result.'), { code: 'extraction_error' });
      for (const candidate of search.candidates) {
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        const result = await product(candidate.url);
        if (result) return result;
        if (seen.size >= 20) break;
      }
      if (seen.size >= 20) break;
      next = search.nextUrl;
    }
    return { ...emptyResult(isbn, url, rejected.length ? 'ISBN mismatch' : 'Not Listed'), ...(rejected.length ? { rejected_candidates: rejected } : {}) };
  } catch (error) {
    return emptyResult(isbn, url, error.code === 'blocked' ? 'Blocked' : 'Error', error.code || 'navigation_error', error.message);
  }
}
module.exports = { scrapeOmPublication };

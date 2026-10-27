const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./core/isbn');
const { walmartUrl, productUrl, searchUrl, parseSearch, pageFailure, navigate } = require('./core/search');
const { parseProduct } = require('./core/productExtractor');

async function scrapeWalmart(page, directUrl, targetIsbn) {
  const direct = directUrl ? walmartUrl(directUrl) : null;
  const isbn = normalizeIsbn(targetIsbn || direct?.searchParams.get('q'));
  let url = direct?.href || searchUrl(isbn || String(targetIsbn || ''));
  const rejected = [];
  const empty = (status, code, error) => ({ store: 'Walmart', searched_isbn: isbn || targetIsbn, found: false, title: null, author: null,
    publisher: null, binding: null, pages: null, language: null, price: null, mrp: null, currency: 'USD', seller: null,
    in_stock: null, stock_status: status, found_isbn: null, isbn_matched: false, isbn_match_source: null, isbn_evidence: [], url,
    ...(code ? { error_code: code, error } : {}) });
  async function inspect(target) {
    url = target;
    await navigate(page, target);
    const specs = page.getByRole?.('button', { name: /^Specs$|^Specifications$/i });
    if (specs && await specs.count() && await specs.first().getAttribute('aria-expanded') === 'false') await specs.first().click({ timeout: 3000 }).catch(() => {});
    const details = page.getByRole?.('button', { name: 'View all item details', exact: true });
    if (details && await details.count()) {
      await details.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForSelector('[role="dialog"]', { timeout: 2000 }).catch(() => {});
    }
    const html = await page.content(), failure = pageFailure(html, 200, page.url());
    if (failure) throw Object.assign(new Error(failure.message), { code: failure.code });
    const data = parseProduct(html, page.url());
    if (!data.product_page) throw Object.assign(new Error('Walmart product title did not load.'), { code: 'extraction_error' });
    const validation = verifyIsbn(isbn, data);
    if (!validation.isbn_matched) { rejected.push({ url: data.url, title: data.title, ...validation, isbn_evidence: data.isbn_evidence }); return null; }
    const { product_page, ...fields } = data;
    return { store: 'Walmart', searched_isbn: isbn, found: true, ...fields, ...validation };
  }
  try {
    if (directUrl && (!direct || !(productUrl(direct.href) || direct.pathname === '/search'))) return empty('Error', 'invalid_url', 'Expected a Walmart search or product URL.');
    if (!isValidIsbn(isbn)) return empty('Invalid ISBN', 'invalid_isbn', 'A valid ISBN-10 or ISBN-13 is required.');
    if (direct && productUrl(direct.href)) {
      const matched = await inspect(direct.href);
      return matched || { ...empty(rejected[0].found_isbn ? 'ISBN mismatch' : 'ISBN unverified'), rejected_candidates: rejected };
    }
    let next = direct?.href || searchUrl(isbn);
    const visited = new Set(), seen = new Set();
    for (let number = 0; next && number < 3; number++) {
      if (visited.has(next)) break;
      visited.add(next); url = next;
      const search = parseSearch(await navigate(page, next), next);
      if (!search.candidates.length && !search.empty) throw Object.assign(new Error('Search exposed neither product cards nor an explicit empty result.'), { code: 'extraction_error' });
      for (const candidate of search.candidates) {
        if (seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        const matched = await inspect(candidate.url);
        if (matched) return matched;
        if (seen.size >= 20) break;
      }
      if (seen.size >= 20) break;
      next = search.nextUrl;
    }
    return { ...empty(rejected.length ? (rejected.some(item => item.found_isbn) ? 'ISBN mismatch' : 'ISBN unverified') : 'Not Listed'), ...(rejected.length ? { rejected_candidates: rejected } : {}) };
  } catch (error) {
    return { ...empty(error.code === 'blocked' ? 'Blocked' : 'Error', error.code || 'navigation_error', error.message),
      ...(error.resume_after ? { resume_after: error.resume_after } : {}) };
  }
}
module.exports = { scrapeWalmart };

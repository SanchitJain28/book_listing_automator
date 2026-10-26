const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./core/isbn');
const { flipkartUrl, searchUrl, parseSearch, navigate } = require('./core/search');
const { extractProduct } = require('./core/productExtractor');

function emptyResult(isbn, url, status, code = null, error = null) {
  return {
    store: 'Flipkart', searched_isbn: isbn, found: false, title: null, author: null,
    price: null, mrp: null, discount: null, currency: 'INR', in_stock: null,
    stock_status: status, seller: null, publisher: null, binding: null, pages: null,
    language: null, delivery: null, found_isbn: null, isbn_matched: false,
    isbn_match_source: null, url, ...(code ? { error_code: code, error } : {}),
  };
}

/** Existing public interface used by the master scraper. */
async function scrapeFlipkart(page, directUrl, targetIsbn) {
  const isbn = normalizeIsbn(targetIsbn);
  let targetUrl = isbn ? searchUrl(isbn) : null;
  const attempts = [];
  try {
    if (targetIsbn && !isValidIsbn(isbn)) return emptyResult(isbn || String(targetIsbn), null, 'Invalid ISBN', 'invalid_isbn', 'A valid ISBN-10 or ISBN-13 is required.');
    const direct = directUrl ? flipkartUrl(directUrl) : null;
    if (directUrl && !direct) return emptyResult(isbn, null, 'Error', 'invalid_url', 'Expected an HTTPS Flipkart URL.');
    if (!isbn && !direct) return emptyResult(null, null, 'Error', 'invalid_input', 'An ISBN or Flipkart product URL is required.');

    async function productResult(url, candidate = null) {
      targetUrl = url;
      await navigate(page, url);
      const data = await extractProduct(page);
      if (!data.author && candidate?.author) data.author = candidate.author;
      if (!data.binding && candidate?.binding) data.binding = candidate.binding;
      if (!data.product_page || !data.title) throw Object.assign(new Error('Product page did not expose a title after loading.'), { code: 'extraction_error' });
      const validation = isbn ? verifyIsbn(isbn, data, candidate) : { found_isbn: normalizeIsbn(data.isbn13 || data.isbn10), isbn_matched: false, isbn_match_source: null };
      const { page_text, product_page, isbn13, isbn10, structured_isbns, ...fields } = data;
      if (isbn && !validation.isbn_matched) {
        attempts.push({ url: data.url, ...validation });
        return null;
      }
      return { store: 'Flipkart', searched_isbn: isbn, found: true, ...fields, ...validation,
        isbn_evidence: { specification_isbn13: isbn13, specification_isbn10: isbn10, structured_isbns,
          search_card_id: candidate?.id || null, product_pid: new URL(data.url).searchParams.get('pid') },
      };
    }

    if (direct?.pathname.includes('/p/')) {
      const result = await productResult(direct.href);
      if (result) return result;
      if (!isbn) return emptyResult(null, direct.href, 'Unverified');
    }

    for (let number = 1; number <= 3; number++) {
      targetUrl = number === 1 && direct && !direct.pathname.includes('/p/') ? direct.href : searchUrl(isbn, number);
      const html = await navigate(page, targetUrl);
      const search = parseSearch(html, isbn, page.url());
      if (!search.candidates.length && !search.empty && !search.hasResults) throw Object.assign(new Error('Search page did not expose results or an explicit empty state.'), { code: 'extraction_error' });
      for (const candidate of search.candidates) {
        const result = await productResult(candidate.url, candidate);
        if (result) return result;
      }
      if (!search.hasNext) break;
    }
    return { ...emptyResult(isbn, targetUrl, attempts.length ? 'ISBN mismatch' : 'Not Listed'), ...(attempts.length ? { rejected_candidates: attempts } : {}) };
  } catch (error) {
    return emptyResult(isbn, targetUrl, error.code === 'blocked' ? 'Blocked' : 'Error', error.code || 'navigation_error', error.message);
  }
}

module.exports = { scrapeFlipkart, emptyResult };

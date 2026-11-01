const { extractSearch, ORIGIN } = require('./core/extract');
const { normalize } = require('./core/isbn');
const base = isbn => ({ store: 'AbeBooks UK', searched_isbn: isbn, currency: 'GBP', found: false, isbn_matched: false, found_isbn: null, isbn_match_source: null, match_type: null, in_stock: null, price: null, listings: [] });
class BlockedError extends Error {
  constructor(message, retryAfter = 0) { super(message); this.retryAfter = retryAfter; }
}
function retryAfterMs(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, (Date.parse(value) || now) - now);
}
async function checkResponse(page, response) {
  const status = response?.status() || 200;
  if ([403, 429].includes(status)) throw new BlockedError(`AbeBooks UK blocked the request (HTTP ${status}).`, retryAfterMs(response.headers()['retry-after']));
  const html = await page.content();
  if (extractSearch(html).blocked) throw new BlockedError('AbeBooks UK returned a human-verification or access-denied page.');
  if (status >= 400) throw new Error(`AbeBooks UK returned HTTP ${status}.`);
}
async function scrapeAbeBooksUk(page, { isbn, directUrl } = {}) {
  const target = normalize(isbn);
  if (!target) return { ...base(isbn), stock_status: 'Error', error_code: 'invalid_input', error: 'A valid ISBN-10 or ISBN-13 identifier is required.' };
  if (directUrl) return { ...base(target), stock_status: 'Error', error_code: 'invalid_input', error: 'This scraper uses the UK advanced ISBN search; supply ISBN input.' };
  try {
    let response = await page.goto(ORIGIN + '/servlet/SearchEntry', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await checkResponse(page, response);
    await page.locator('#isbn').fill(target, { timeout: 15000 });
    // Use the real advanced-search form, including its GBP and relevance defaults.
    await page.waitForTimeout(2000 + Math.floor(Math.random() * 2001));
    [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
      page.locator('#search-button').click(),
    ]);
    await checkResponse(page, response);
    await page.locator('[data-srp-item-role="listing"], [data-test-id="closest-match-item"], .result-data, main').first().waitFor({ timeout: 15000 });
    const data = extractSearch(await page.content(), target, page.url());
    if (data.blocked) throw new BlockedError(data.error);
    const top = data.listings.find(row => row.isbn_matched) || data.listings[0];
    if (!top) return { ...base(target), search_url: page.url(), url: page.url(), stock_status: data.no_results ? 'Not Found' : 'Error', error_code: data.no_results ? 'not_found' : 'extraction_error', error: data.no_results ? null : 'Search exposed neither listing cards nor an explicit empty result.' };
    return { ...base(target), ...top, found: true, listings: data.listings, total_sellers_found: data.listings.length, search_url: page.url() };
  } catch (error) {
    const blocked = error instanceof BlockedError;
    return { ...base(target), url: page.url(), stock_status: blocked ? 'Blocked' : 'Error', error_code: blocked ? 'blocked' : 'extraction_error', error: error.message,
      ...(blocked ? { resume_after: new Date(Date.now() + Math.max(30 * 60000, error.retryAfter)).toISOString() } : {}) };
  }
}
module.exports = { scrapeAbeBooksUk, retryAfterMs };

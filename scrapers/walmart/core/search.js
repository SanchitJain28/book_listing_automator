const cheerio = require('cheerio');

function walmartUrl(value, base = 'https://www.walmart.com') {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || !['www.walmart.com', 'walmart.com'].includes(url.hostname) || url.username || url.password) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}
const searchUrl = isbn => `https://www.walmart.com/search?q=${encodeURIComponent(isbn)}`;
function productUrl(value) {
  const url = walmartUrl(value);
  if (!url || !/^\/ip\/(?:[^/]+\/)?\d+\/?$/.test(url.pathname)) return null;
  url.search = '';
  return url.href;
}
function nextData($) {
  try { return JSON.parse($('#__NEXT_DATA__').text()).props?.pageProps?.initialData?.data || {}; }
  catch { return {}; }
}
function parseSearch(html, baseUrl) {
  const $ = cheerio.load(html), candidates = [], seen = new Set();
  const stack = $('[data-testid="item-stack"]').first();
  const scope = stack.length ? stack : $('#results-container');
  scope.find('[data-item-id], [data-dca-ctx="itemTile"]').each((_, el) => {
    const card = $(el);
    const text = card.find('*').addBack().contents().filter((_, node) => node.type === 'text').map((_, node) => node.data).get().join(' ');
    if (/\bsponsored\b/i.test(text) || card.find('[data-testid*="sponsor"], [data-dca-ctx*="sponsor"]').length) return;
    const link = card.find('a[link-identifier][href*="/ip/"], a[href*="/ip/"]').first();
    const url = productUrl(link.attr('href'));
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, id: card.attr('data-dca-id') || link.attr('link-identifier') || null,
      title: card.find('[data-automation-id="product-title"]').first().text().trim() || link.text().trim() || null });
  });
  // Only the first search-results stack: later stacks can contain recommendations.
  const result = nextData($).search?.searchResult;
  if (!candidates.length) for (const item of result?.itemStacks?.[0]?.items || []) {
    if (item.isSponsored || item.sponsoredProduct || item.adUid) continue;
    const url = productUrl(item.canonicalUrl);
    if (url && !seen.has(url)) { seen.add(url); candidates.push({ url, id: item.usItemId || null, title: item.name || null }); }
  }
  let nextUrl = null;
  $('a[aria-label="Next Page"], a[aria-label="Next page"], a[rel="next"]').each((_, el) => {
    const url = walmartUrl($(el).attr('href'), baseUrl);
    if (url?.pathname === '/search' && url.searchParams.get('q') === new URL(baseUrl).searchParams.get('q') && url.href !== baseUrl) nextUrl = url.href;
  });
  $('script,style,header,footer').remove();
  const text = $('main').length ? $('main').text() : $('body').text();
  const empty = /no (?:exact )?(?:results|items|products)(?: were)? found|couldn.t find any results|0 results/i.test(text) || result?.totalItemCount === 0;
  return { candidates, nextUrl, empty };
}
function pageFailure(html, status = 200, url = '') {
  const $ = cheerio.load(html); $('script,style').remove();
  const text = $('body').text() || $.root().text();
  if ([401,403,429,503].includes(status) || /\/blocked(?:\?|$)/.test(url) ||
      /robot or human|activate and hold the button|press (?:and|&) hold|verify (?:that )?you are human|access denied|captcha challenge/i.test(text)) {
    return { code: 'blocked', message: `Walmart blocked the request (HTTP ${status}).` };
  }
  return status >= 400 ? { code: 'http_error', message: `Walmart returned HTTP ${status}.` } : null;
}
const requestStates = new WeakMap();
async function navigate(page, url) {
  const state = requestStates.get(page) || { used: false, retryAt: 0, blocked: null };
  requestStates.set(page, state);
  if (state.blocked) throw state.blocked;
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = Math.max(state.used ? 2000 + Math.floor(Math.random() * 3001) : 0, state.retryAt - Date.now());
    if (wait > 0) await page.waitForTimeout(wait);
    state.used = true;
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (!walmartUrl(page.url())) throw Object.assign(new Error('Walmart redirected outside the expected marketplace.'), { code: 'invalid_redirect' });
      let html = await page.content(), status = response?.status() || 200;
      let failure = pageFailure(html, status, page.url());
      if (failure) throw Object.assign(new Error(failure.message), { code: failure.code });
      await page.waitForSelector('#main-title, [data-testid="item-stack"], [data-testid="no-results"], [data-testid="no-results-message"]', { timeout: 15000 }).catch(() => {});
      html = await page.content(); failure = pageFailure(html, status, page.url());
      if (failure) throw Object.assign(new Error(failure.message), { code: failure.code });
      state.retryAt = 0;
      return html;
    } catch (error) {
      last = error;
      const headers = response?.headers ? await response.headers() : {};
      const retryAfter = headers['retry-after'];
      const deadline = /^\d+$/.test(retryAfter || '') ? Date.now() + Number(retryAfter) * 1000 : Date.parse(retryAfter);
      state.retryAt = Math.max(Date.now() + 30000 * 2 ** attempt, deadline || 0);
      if (last.code === 'blocked') {
        last.resume_after = new Date(Math.max(state.retryAt, Date.now() + 300000)).toISOString();
        state.blocked = last;
        throw last;
      }
      if (last.code === 'http_error' && response.status() < 500) throw last;
      if (last.code === 'invalid_redirect') throw last;
    }
  }
  throw last;
}
module.exports = { walmartUrl, productUrl, searchUrl, nextData, parseSearch, pageFailure, navigate };

const cheerio = require('cheerio');
const { sameIsbn } = require('./isbn');

function bookchorUrl(value) {
  try {
    const url = new URL(value, 'https://www.bookchor.com');
    if (url.protocol !== 'https:' || !/^(?:www\.)?bookchor\.com$/.test(url.hostname)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

function searchUrl(isbn, page = 1) {
  const url = new URL('https://www.bookchor.com/search/');
  url.search = new URLSearchParams({ query: isbn, ...(page > 1 ? { page } : {}) }).toString();
  return url.href;
}

function parseSearch(html, target) {
  const $ = cheerio.load(html);
  const scope = $('.product-listing');
  const seen = new Set(), candidates = [];
  scope.find('.product-item a[href*="/book/"]').each((_, el) => {
    const url = bookchorUrl($(el).attr('href'));
    const identifier = url?.pathname.match(/^\/book\/([^/]+)(?:\/|$)/)?.[1];
    if (!url || !sameIsbn(identifier, target)) return;
    url.search = '';
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const card = $(el).closest('.product-item');
    candidates.push({ url: url.href, isbn: identifier, title: card.find('h3 a, h3, h2').first().text().trim() || card.find('img[alt]').attr('alt') || null });
  });
  const text = scope.text().replace(/\s+/g, ' ');
  const total = Number(scope.find('.total_item').first().text().replace(/[^\d]/g, ''));
  const rangeEnd = Number(scope.find('.range').first().text().match(/[–-]\s*(\d+)/)?.[1] || 0);
  return { candidates, hasResults: scope.find('.product-item').length > 0, empty: /no (?:books|products|results)(?:\s+(?:found|available))?|could not find|couldn't find/i.test(text) || !!scope.find('.total_item').length && total === 0,
    hasNext: total > rangeEnd && rangeEnd > 0 };
}

function pageFailure(html, status = 200) {
  const $ = cheerio.load(html);
  $('script,style,header,footer').remove();
  const text = $('body').text().replace(/\s+/g, ' ');
  if ([403, 429, 503].includes(status) || /verify (?:that )?you are human|unusual traffic|access denied|too many requests|robot check|checking your browser/i.test(text)) return { code: 'blocked', message: `BookChor blocked the request (HTTP ${status}).` };
  if (status >= 400) return { code: 'http_error', message: `BookChor returned HTTP ${status}.` };
  return null;
}

async function navigate(page, url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      const status = response?.status() || 200;
      if (status < 400) await page.waitForSelector('.Products-details-info h1, .product-listing-row, .totalno-product', { timeout: 8000 }).catch(() => {});
      if (status < 400 && new URL(page.url()).pathname.startsWith('/book/')) {
        // BookChor initially hides both cart states; its startup script reveals
        // the current state after the static product details are already ready.
        await page.waitForFunction(() => Array.from(document.querySelectorAll('.Products-details-info .buynow button, .Products-details-info #notifiy')).some(el => el.getClientRects().length > 0), null, { timeout: 6000 }).catch(() => {});
      }
      const html = await page.content();
      const failure = pageFailure(html, status);
      if (!failure) return html;
      last = Object.assign(new Error(failure.message), { code: failure.code });
      if (failure.code === 'http_error' && status < 500) throw last;
    } catch (error) { last = error; }
    if (attempt < 2) await page.waitForTimeout(2500 * (attempt + 1));
  }
  throw last;
}

module.exports = { bookchorUrl, searchUrl, parseSearch, pageFailure, navigate };

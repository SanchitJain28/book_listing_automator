const cheerio = require('cheerio');
const { sameIsbn } = require('./isbn');

function flipkartUrl(value) {
  try {
    const url = new URL(value, 'https://www.flipkart.com');
    if (url.protocol !== 'https:' || !/^(?:www\.)?flipkart\.com$/.test(url.hostname)) return null;
    return url;
  } catch { return null; }
}

function searchUrl(isbn, page = 1) {
  const url = new URL('https://www.flipkart.com/books/pr');
  url.search = new URLSearchParams({ sid: 'bks', q: isbn, otracker: 'categorytree', ...(page > 1 ? { page } : {}) }).toString();
  return url.href;
}

function parseSearch(html, target, baseUrl) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const candidates = [];
  $('[data-id]').each((_, el) => {
    const card = $(el);
    const id = card.attr('data-id');
    if (!sameIsbn(id, target)) return;
    card.find('a[href*="/p/"]').each((_, a) => {
      const url = flipkartUrl($(a).attr('href'));
      if (!url || !sameIsbn(url.searchParams.get('pid'), target)) return;
      const pid = url.searchParams.get('pid');
      url.search = new URLSearchParams({ pid }).toString();
      if (seen.has(url.href)) return;
      seen.add(url.href);
      const subtitle = card.find('.U_GKRr, .Wphh3N, ._3Djpdu').first().text().trim();
      const parts = subtitle.split(',').map(value => value.trim());
      const binding = parts.find(value => /^(?:hardcover|paperback|hardback|softcover|board book)$/i.test(value)) || null;
      const author = binding ? parts.filter(value => value !== binding && !/^(?:english|hindi|tamil|telugu|marathi|bengali|kannada|malayalam|gujarati)$/i.test(value)).join(', ') || null : null;
      candidates.push({ id, pid, url: url.href, title: card.find('a[title]').attr('title') || card.find('img[alt]').attr('alt') || null, author, binding });
    });
  });
  const text = $('body').text().replace(/\s+/g, ' ');
  const count = text.match(/Showing\s+[\d,]+\s*[–-]\s*([\d,]+)\s+of\s+([\d,]+)/i);
  return { candidates, hasResults: $('[data-id]').length > 0 || !!count, hasNext: !!count && Number(count[1].replace(/,/g, '')) < Number(count[2].replace(/,/g, '')), empty: /sorry.{0,50}no results|no results found|did not match any products/i.test(text) };
}

function pageFailure(html, status = 200) {
  const $ = cheerio.load(html);
  $('script,style').remove();
  const text = $('body').text().replace(/\s+/g, ' ');
  if ([403, 429, 503].includes(status) || /captcha|verify (?:that )?you are human|unusual traffic|access denied|too many requests|robot check/i.test(text)) return { code: 'blocked', message: `Flipkart blocked the request (HTTP ${status}).` };
  if (status >= 400) return { code: 'http_error', message: `Flipkart returned HTTP ${status}.` };
  return null;
}

async function navigate(page, url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForSelector('h1, [data-id], [data-testid="product-title"]', { timeout: 8000 }).catch(() => {});
      const html = await page.content();
      const failure = pageFailure(html, response?.status() || 200);
      if (!failure) return html;
      last = Object.assign(new Error(failure.message), { code: failure.code });
      if (failure.code !== 'blocked') throw last;
    } catch (error) { last = error; }
    if (attempt < 2) await page.waitForTimeout(3000 * (attempt + 1));
  }
  throw last;
}

module.exports = { flipkartUrl, searchUrl, parseSearch, pageFailure, navigate };

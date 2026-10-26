const cheerio = require('cheerio');

function omUrl(value) {
  try {
    const url = new URL(value, 'https://www.ompublications.in');
    if (url.protocol !== 'https:' || !/^(?:www\.)?ompublications\.in$/.test(url.hostname)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

function searchUrl(isbn) {
  return `https://www.ompublications.in/products/search?q=${encodeURIComponent(isbn)}`;
}

function parseSearch(html, baseUrl) {
  const $ = cheerio.load(html);
  const scope = $('section').filter((_, el) => /^Search results for/i.test($(el).children('h2').first().text().trim())).first();
  const candidates = [], seen = new Set();
  scope.find('a[href*="/product/books/"]').each((_, el) => {
    const url = omUrl($(el).attr('href'));
    if (!url || !/^\/product\/books\/[^/]+\/?$/.test(url.pathname) || seen.has(url.href)) return;
    seen.add(url.href);
    candidates.push({ url: url.href, title: $(el).children('div').eq(1).text().trim() || null });
  });
  let nextUrl = null;
  scope.find('a[href]').each((_, el) => {
    if (!/^next$/i.test($(el).text().trim())) return;
    const url = omUrl(new URL($(el).attr('href'), baseUrl || searchUrl('')));
    if (url?.pathname === '/products/search' && url.href !== baseUrl && url.searchParams.get('q') === new URL(baseUrl || searchUrl('')).searchParams.get('q')) nextUrl = url.href;
  });
  const text = scope.text().replace(/\s+/g, ' ');
  return { candidates, nextUrl, empty: /no (?:books|products|results)(?: were)? found|0 results|no items|nothing found/i.test(text), search_page: !!scope.length };
}

function pageFailure(html, status = 200) {
  const $ = cheerio.load(html);
  $('script,style').remove();
  const text = $('body').text();
  if ([401,403,429,503].includes(status) || /access denied|verify (?:that )?you are human|checking your browser|unusual traffic|captcha challenge|just a moment/i.test(text)) return { code: 'blocked', message: `Om Publications blocked the request (HTTP ${status}).` };
  return status >= 400 ? { code: 'http_error', message: `Om Publications returned HTTP ${status}.` } : null;
}

async function navigate(page, url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = response?.status() || 200;
      if (status < 400) await page.waitForSelector('section h2', { timeout: 10000 }).catch(() => {});
      const html = await page.content(), failure = pageFailure(html, status);
      if (!failure) return html;
      last = Object.assign(new Error(failure.message), { code: failure.code });
    } catch (error) { last = error; }
    if (attempt < 2) await page.waitForTimeout(2500 * (attempt + 1));
  }
  throw last;
}

module.exports = { omUrl, searchUrl, parseSearch, pageFailure, navigate };

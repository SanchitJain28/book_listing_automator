const cheerio = require('cheerio');
const { normalizeIsbn, isValidIsbn, sameIsbn } = require('../atlanticbooks/core/isbn');

const origin = 'https://www.ebay.com';

function itemUrl(href) {
  try {
    const url = new URL(href, origin);
    if (url.protocol !== 'https:' || !['www.ebay.com', 'ebay.com'].includes(url.hostname)) return null;
    const id = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{9,15})\/?$/)?.[1];
    return id ? origin + '/itm/' + id : null;
  } catch {
    return null;
  }
}

function searchResults(html) {
  const $ = cheerio.load(html);
  const urls = new Set();
  $('.srp-results > .s-card, .srp-results > .s-item').each((_, card) => {
    const title = $(card).find('.s-card__title, .s-item__title').first().text().trim();
    if (!title || /^Shop on eBay$/i.test(title)) return;
    const link = $(card).find('a.s-card__link, a.s-item__link').first().attr('href');
    const url = link && itemUrl(link);
    if (url) urls.add(url);
  });
  const empty = /\b(?:0 results?\b|no (?:exact )?matches found\b)/i.test(
    $('#srp-results-heading, .srp-controls__count-heading, .srp-save-null-search').text()
  );
  return { urls: empty ? [] : [...urls], empty };
}

function usd(text) {
  const amount = text.trim().match(/^(?:US\s*)?\$\s*([\d,]+(?:\.\d{2})?)(?![\d.])/i);
  return amount ? Number(amount[1].replace(/,/g, '')) : null;
}

function parseListing(html, isbn) {
  const $ = cheerio.load(html);
  const field = selector => $(selector).first().text().replace(/\s+/g, ' ').trim() || null;
  const evidence = [];
  function add(value, source) {
    const code = normalizeIsbn(value);
    if (code && isValidIsbn(code)) evidence.push({ value: code, source });
  }

  $('.ux-labels-values').each((_, row) => {
    const label = $(row).find('.ux-labels-values__labels').first().text().trim().replace(/:$/, '');
    if (/^(?:ISBN(?:[- ]?(?:10|13))?|EAN|GTIN)$/i.test(label)) {
      add($(row).find('.ux-labels-values__values .ux-textspans').first().text(), 'item_specifics');
    }
  });

  $('script[type="application/ld+json"]').each((_, script) => {
    let data;
    try { data = JSON.parse($(script).text()); } catch { return; }
    for (const product of Array.isArray(data) ? data : data?.['@graph'] || [data]) {
      const types = [product?.['@type']].flat();
      if (!types.some(type => /^(?:https?:\/\/schema\.org\/)?(?:Product|Book)$/.test(type))) continue;
      for (const key of ['isbn', 'gtin13', 'gtin']) {
        for (const value of [product[key]].flat()) add(value, 'structured_' + key);
      }
    }
  });

  const title = field('.x-item-title__mainTitle, h1[itemprop="name"]');
  const match = evidence.find(item => sameIsbn(item.value, isbn));
  const conflict = evidence.find(item => !sameIsbn(item.value, isbn));
  const verified = Boolean(title && match && !conflict);
  const priceText = field('.x-price-primary__price, .x-price-primary');
  const shippingText = field('.ux-labels-values--shipping .ux-labels-values__values .ux-textspans');
  const shippingCost = /^free\b/i.test(shippingText || '') ? 0 : usd(shippingText || '');
  const price = usd(priceText || '');
  const buyButton = $('#binBtn_btn, #atcBtn_btn, [data-testid="x-bin-action"] a, [data-testid="x-bin-action"] button')
    .filter((_, el) => !$(el).is('[disabled], [aria-disabled="true"]')).length > 0;

  return {
    found: Boolean(title),
    title,
    found_isbn: (conflict || match)?.value ?? null,
    isbn_matched: verified,
    isbn_match_source: conflict ? 'product_isbn_conflict' : verified ? match.source : null,
    isbn_evidence: evidence,
    condition: field('.x-item-condition-text .ux-textspans'),
    seller: field('.x-sellercard-atf__info__about-seller a, .x-sellercard-atf__info__about-seller'),
    price,
    currency: price === null ? null : 'USD',
    shipping_cost: shippingCost,
    total_amount: price === null || shippingCost === null ? null : Math.round((price + shippingCost) * 100) / 100,
    delivery: $('.ux-labels-values--deliverto .ux-labels-values__values-content > div:first-child > .ux-textspans:not(.ux-textspans__custom-view)')
      .text().replace(/\s+/g, ' ').trim() || null,
    in_stock: buyButton ? true : null,
    stock_status: conflict ? 'ISBN mismatch' : !verified ? 'ISBN unverified' : buyButton ? 'In Stock' : 'Unknown',
  };
}

async function loadPage(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const status = response?.status();
  const html = await page.content();
  const $ = cheerio.load(html);
  if ([401, 403, 429, 503].includes(status) || /\/(?:splashui\/captcha|challenge)(?:\/|\?|$)/i.test(page.url())
      || /(?:pardon our interruption|security measure|verify you are human)/i.test($('title').text())) {
    throw Object.assign(new Error('eBay access blocked' + (status ? ' (HTTP ' + status + ')' : '')), { code: 'blocked' });
  }
  if (status && status >= 400) throw new Error('eBay returned HTTP ' + status);
  return html;
}

async function scrapeEbayBook(page, { isbn }) {
  const searched = normalizeIsbn(isbn);
  const base = { searched_isbn: isbn, store: 'eBay US', found: false, found_isbn: null, isbn_matched: false, price: null };
  if (!searched || !isValidIsbn(searched)) return { ...base, stock_status: 'Error', error: 'Invalid ISBN' };

  const searchUrl = origin + '/sch/i.html?' + new URLSearchParams({ _nkw: searched, _sacat: '267' });
  const search = searchResults(await loadPage(page, searchUrl));
  if (search.empty) return { ...base, url: searchUrl, stock_status: 'Not Found' };
  if (!search.urls.length) throw new Error('eBay search results layout was not recognized');

  let fallback;
  for (const url of search.urls.slice(0, 5)) {
    const listing = parseListing(await loadPage(page, url), searched);
    if (!listing.found) continue;
    const result = { ...base, ...listing, url };
    if (result.isbn_matched) return result;
    fallback ??= result;
  }
  if (fallback) return fallback;
  throw new Error('Could not read a listing from the first five eBay results');
}

module.exports = { searchResults, parseListing, scrapeEbayBook };

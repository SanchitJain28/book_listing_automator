const cheerio = require('cheerio');
const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./isbn');
const clean = value => String(value ?? '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim() || null;
const markets = { 'amazon.com': { currency: 'USD', store: 'Amazon.com' }, 'amazon.co.uk': { currency: 'GBP', store: 'Amazon.co.uk' } };
function amazonUrl(value, domain) {
  try { const url = new URL(value, `https://www.${domain}`); if (url.protocol !== 'https:' || ![domain, `www.${domain}`].includes(url.hostname)) return null; url.hash = ''; return url; } catch { return null; }
}
function searchUrl(isbn, domain) { if (!markets[domain]) throw Error('Unsupported Amazon marketplace.'); return `https://www.${domain}/s?k=${encodeURIComponent(isbn)}`; }
function parseSearch(html, domain) {
  const $ = cheerio.load(html);
  // A product title link avoids sponsored banners, carousels and unrelated nav.
  const rows = $('.s-search-results [data-component-type="s-search-result"][data-asin]').filter((_, el) => !$(el).find('.puis-sponsored-label-text, [aria-label="Sponsored"]').length);
  let candidate = null;
  rows.each((_, el) => {
    if (candidate) return;
    const row = $(el);
    const link = row.find('a[href*="/dp/"]').filter((_, a) => $(a).find('h2').length || $(a).closest('h2').length).first();
    const fallback = row.find('h2 a[href*="/dp/"], a.a-link-normal[href*="/dp/"]').first();
    const selected = link.length ? link : fallback;
    const url = amazonUrl(selected.attr('href'), domain);
    const asin = url?.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
    if (url && asin) candidate = { url: `https://www.${domain}/dp/${asin}`, asin, title: clean(row.find('h2').first().text()) };
  });
  return { candidate, empty: /no results for|did not match any products|no results matching/i.test($('body').text()) };
}
function money(text) {
  const match = String(text ?? '').match(/(?:INR|USD|GBP|US\$|\$|£|₹)\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}
function readPrice($, node) {
  if (!node?.length) return null;
  const full = money(node.find('.a-offscreen').first().text());
  if (full !== null) return full;
  const whole = clean(node.find('.a-price-whole').first().text())?.replace(/[^\d]/g, '');
  const fraction = clean(node.find('.a-price-fraction').first().text())?.replace(/[^\d]/g, '');
  return whole ? Number(`${whole}.${fraction || '00'}`) : money(node.text());
}
function parseProduct(html, url, domain) {
  const $ = cheerio.load(html), title = clean($('#productTitle').first().text()), evidence = [], metadata = {};
  $('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr').each((_, el) => {
    const text = clean($(el).text()) || '';
    let label = clean($(el).find('th, .a-text-bold').first().text());
    let value = clean($(el).find('td').first().text());
    if (!value) { const parts = text.split(':'); label = parts.shift(); value = clean(parts.join(':')); }
    const key = label?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key && value) metadata[key] = value;
    if (/^isbn(?:10|13)?$/.test(key || '') && normalizeIsbn(value)) evidence.push({ source: 'product_specifications', value });
  });
  for (const [key, id] of [['isbn13','book_details-isbn13'], ['isbn10','book_details-isbn10']]) {
    const value = clean($(`#rpi-attribute-${id} .rpi-attribute-value`).first().text());
    if (normalizeIsbn(value)) evidence.push({ source: 'product_specifications', value });
  }
  const box = $('#desktop_buybox').first().length ? $('#desktop_buybox').first() : $('#buybox').first();
  const priceArea = box.find('#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop').filter((_, el) => $(el).find('.a-price:not(.a-text-price)').length).first();
  const primaryPrice = priceArea.find('.priceToPay, .a-price:not(.a-text-price)').first();
  const price = readPrice($, primaryPrice);
  const priceSymbol = clean(primaryPrice.find('.a-price-symbol').first().text()) || clean(primaryPrice.find('.a-offscreen').first().text());
  const currency = /INR|₹/.test(priceSymbol || '') ? 'INR' : /GBP|£/.test(priceSymbol || '') ? 'GBP' : /USD|\$/.test(priceSymbol || '') ? 'USD' : markets[domain].currency;
  const mrp = readPrice($, priceArea.find('.a-text-price').first());
  const availability = clean(box.find('#availability, #outOfStock').first().text());
  const unavailable = /out of stock|currently unavailable|temporarily unavailable|unavailable for purchase/i.test(availability || '');
  const available = /\bin stock\b|only \d+ left/i.test(availability || '') || box.find('#add-to-cart-button:not([disabled]), #buy-now-button:not([disabled])').length > 0;
  const stock = unavailable ? false : available ? true : null;
  const seller = clean(box.find('#sellerProfileTriggerId').first().text()) || clean(box.find('#merchantInfoFeature_feature_div .offer-display-feature-text-message').first().text()) || clean(box.find('#merchant-info a').first().text());
  const delivery = clean(box.find('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE, #deliveryBlockMessage, #mir-layout-DELIVERY_BLOCK').first().text());
  const subtitle = clean($('#productSubtitle').first().text()) || '';
  const format = subtitle.match(/Hardcover|Paperback|Audio CD|Audio Cassette|MP3 CD|Spiral.bound|Mass Market Paperback/i)?.[0] || null;
  const rpi = id => clean($(`#rpi-attribute-${id} .rpi-attribute-value`).first().text());
  return { title, author: clean($('#bylineInfo .author a, #bylineInfo a').first().text()),
    publisher: metadata.publisher || rpi('book_details-publisher'), publication_date: metadata.publicationdate || rpi('book_details-publication_date'),
    language: metadata.language || rpi('language'), binding: format || (metadata.hardcover ? 'Hardcover' : metadata.paperback ? 'Paperback' : null),
    pages: metadata.printlength || metadata.hardcover || metadata.paperback || rpi('book_details-print_length'),
    price, mrp, discount: mrp && price !== null && mrp > price ? `${Math.round((mrp-price)/mrp*100)}%` : null,
    currency, seller, delivery, shipping_cost: money(delivery),
    availability_text: availability, in_stock: stock, stock_status: stock === true ? 'In Stock' : stock === false ? 'Out of Stock' : 'Unknown',
    reviews_count: clean($('#acrCustomerReviewText').first().text())?.replace(/[^\d]/g, '') || null,
    used_available: null, isbn_evidence: evidence, url };
}
function pageFailure(html, status = 200) {
  const $ = cheerio.load(html); $('script,style').remove(); const text = $('body').text(), title = $('title').text();
  if ([403,429,503].includes(status) || $('form[action*="validateCaptcha"], #captchacharacters').length || /robot check|sorry! something went wrong/i.test(title) || /enter the characters you see below|something went wrong on our end|sorry, we just need to make sure/i.test(text)) return { code: 'blocked', message: `Amazon blocked the request (HTTP ${status}).` };
  return status >= 400 ? { code: 'http_error', message: `Amazon returned HTTP ${status}.` } : null;
}
async function navigate(page, url) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = response?.status() || 200;
      if (status < 400) await page.waitForSelector(/\/(?:dp|gp\/product)\//.test(new URL(url).pathname) ? '#productTitle' : '.s-search-results [data-component-type="s-search-result"], .s-no-results-result, #captchacharacters', { timeout: 12000 }).catch(() => {});
      const html = await page.content(), failure = pageFailure(html, status);
      if (!failure) return html;
      last = Object.assign(new Error(failure.message), { code: failure.code });
    } catch (error) { last = error; }
    if (attempt < 1) await page.waitForTimeout(3000);
  }
  throw last;
}
async function scrapeInternationalAmazon(page, { isbn: target, directUrl, domain }) {
  if (!markets[domain]) throw Error('Unsupported Amazon marketplace.');
  const isbn = normalizeIsbn(target), direct = directUrl ? amazonUrl(directUrl, domain) : null;
  let url = direct?.href || searchUrl(isbn || String(target || ''), domain);
  const empty = (status, error_code, error) => ({ store: markets[domain].store, searched_isbn: isbn || target, found: false, found_isbn: null, isbn_matched: false, isbn_match_source: null, price: null, mrp: null, currency: markets[domain].currency, in_stock: null, stock_status: status, url, ...(error_code ? { error_code, error } : {}) });
  try {
    if (directUrl && !direct) return empty('Error', 'invalid_url', 'Expected a URL on the selected Amazon marketplace.');
    if (!isValidIsbn(isbn)) return empty('Error', 'invalid_isbn', 'A valid target ISBN is required.');
    if (!direct || !/\/(?:dp|gp\/product)\//.test(direct.pathname)) {
      const search = parseSearch(await navigate(page, direct?.href || searchUrl(isbn,domain)), domain);
      if (!search.candidate) return search.empty ? empty('Not Found') : empty('Error','extraction_error','Search exposed neither a first listing nor an explicit empty result.');
      url = search.candidate.url;
    }
    const data = parseProduct(await navigate(page,url), page.url(), domain);
    if (!data.title) return empty('Error','extraction_error','Amazon product title did not load.');
    const validation = verifyIsbn(isbn,data);
    return { store: markets[domain].store, searched_isbn: isbn, found: validation.isbn_matched, ...data, ...validation,
      ...(!validation.isbn_matched ? { listing_stock_status: data.stock_status, stock_status: validation.found_isbn ? 'ISBN mismatch' : 'ISBN unverified' } : {}) };
  } catch (error) { return empty(error.code === 'blocked' ? 'Blocked' : 'Error',error.code || 'navigation_error',error.message); }
}
module.exports = { markets, amazonUrl, searchUrl, parseSearch, parseProduct, readPrice, pageFailure, scrapeInternationalAmazon };

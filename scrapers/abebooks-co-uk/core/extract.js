const cheerio = require('cheerio');
const { sameIsbn } = require('./isbn');
const ORIGIN = 'https://www.abebooks.co.uk';
const clean = value => String(value || '').replace(/\s+/g, ' ').trim() || null;
function money(value) {
  const match = clean(value)?.match(/(?:£|GBP)\s*([\d,]+(?:\.\d{1,2})?)/i);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}
function ukUrl(href) {
  try { const url = new URL(href, ORIGIN); return url.origin === ORIGIN && /\/\d+\/bd(?:\/|$)/.test(url.pathname) ? url.href : null; } catch { return null; }
}
function extractSearch(html, target, searchUrl = ORIGIN) {
  const $ = cheerio.load(html);
  const text = clean($('body').text()) || '';
  if (/captcha|robot check|verify (?:that )?you are human|access denied|too many requests|automated access|unusual traffic/i.test($('title, h1').text()) || /validateCaptcha|captcha-container|cf-chl-/.test(html)) {
    return { blocked: true, listings: [], error: 'AbeBooks UK returned a challenge or access-denied page.' };
  }
  const regular = $('[data-srp-item-role="listing"], .result-data');
  const closest = $('[data-test-id="closest-match-item"]');
  const isClosest = !regular.length && closest.length > 0;
  const listings = [];
  (isClosest ? closest : regular).each((index, element) => {
    const card = $(element);
    const pick = selector => clean(card.find(selector).first().text());
    const link = card.find('[data-test-id="listing-title-link"], a[href*="/bd"], .title a').first();
    const url = ukUrl(link.attr('href'));
    const title = pick('[data-test-id="listing-title"], [data-cy="listing-title"], .title, h2, h3');
    if (!url || !title) return;
    const explicit = pick('[data-test-id="listing-isbn-link"], [data-test-id="listing-isbn-13"], [data-test-id^="isbn-"]');
    const identifiers = explicit?.match(/\b(?:97[89]\d{10}|\d{9}[\dX])\b/gi) || [];
    const imageIsbn = card.find('img[src*="/isbn/"]').attr('src')?.match(/\/isbn\/(\d{13}|\d{9}[\dX])\b/i)?.[1];
    const foundIsbn = identifiers.find(x => x.length === 13) || identifiers[0] || imageIsbn || null;
    // Search parameters and page-wide ISBN banners are never match evidence.
    const isbnMatched = identifiers.length > 0 && identifiers.every(x => sameIsbn(x, target));
    const priceText = pick('[data-test-id="listing-price"], [data-test-id^="item-price"], .item-price');
    const price = money(priceText);
    const shipping = pick('[data-test-id="listing-shipping"], [data-test-id^="item-shipping-price"], [data-test-id="shipping-detail"]');
    const sellerFromLabel = link.attr('aria-label')?.match(/ for sale by (.+)$/)?.[1];
    const seller = pick('[data-test-id="listing-seller-link"], [data-test-id="listing-seller-name"]') || clean(sellerFromLabel);
    const attrs = card.find('[aria-label="Attributes"] [aria-label]').map((i, e) => $(e).attr('aria-label')).get();
    const binding = attrs.find(x => /hardcover|softcover|paperback|binding/i.test(x)) || null;
    const condition = pick('[data-test-id="listing-condition"]') || attrs.find(x => /^(?:new|used|very good|good|fine|as new)$/i.test(x)) || null;
    const unavailable = /currently not available|out of stock|no available copies|sold out/i.test(card.text());
    const inStock = unavailable ? false : price !== null ? true : null;
    listings.push({ title, author: pick('[data-test-id="listing-author"], [data-cy="listing-author"], .author'), url,
      listing_id: card.attr('data-csa-c-item-id') || url.match(/\/(\d+)\/bd/)?.[1] || null,
      price, price_num: price, price_text: priceText, currency: 'GBP', shipping,
      shipping_price: /free shipping/i.test(shipping || '') ? 0 : money(shipping),
      seller, seller_address: pick('[data-test-id="seller-info"] [aria-hidden="true"], [data-test-id="listing-seller-location"]')?.replace(/^,\s*/, '') || null,
      publisher: pick('[data-test-id^="publisher-"]')?.replace(/^Published by\s*/i, '') || null,
      language: pick('[data-test-id^="language-"]')?.replace(/^Language:\s*/i, '') || null,
      binding, condition, found_isbn: foundIsbn, isbn_matched: isbnMatched, isbn_match: isbnMatched,
      isbn_match_source: identifiers.length ? 'search_card_isbn' : imageIsbn ? 'search_card_stock_image_unverified' : null,
      isbn_evidence: identifiers.map(value => ({ source: 'search_card_isbn', value })),
      stock_image_isbn: imageIsbn || null, match_type: isClosest ? 'closest_match' : isbnMatched ? 'exact' : identifiers.length ? 'isbn_mismatch' : 'unverified',
      is_closest_match: !!isClosest, search_rank: index + 1,
      match_basis: isClosest ? 'abebooks_closest_match_section' : isbnMatched ? 'search_card_isbn' : null,
      in_stock: inStock, stock_status: inStock === true ? 'In Stock' : inStock === false ? 'Out of Stock' : 'Unknown',
      search_url: searchUrl });
  });
  return { blocked: false, listings, no_results: /unable to find|no (?:books|results|items|matches)(?: were)? found|0 results|did not match any/i.test(text),
    closest_match_available: !!closest.length };
}
module.exports = { extractSearch, money, ORIGIN };

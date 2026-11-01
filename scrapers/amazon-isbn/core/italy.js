const cheerio = require('cheerio');
const { amazonUrl, searchUrl, parseSearch, navigate, pageFailure } = require('./international');
const { normalizeIsbn, isValidIsbn, verifyIsbn } = require('./isbn');
const { policyForPage } = require('./requestPolicy');
const domain = 'amazon.it';
const clean = value => String(value ?? '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').replace(/\s+/g, ' ').trim() || null;
const physical = /hardcover|paperback|copertina (?:rigida|flessibile|morbida)|brossura|rilegato|spiral.bound|spirale|mass market/i;
const digital = /kindle|e-?book|audiobook|audible|audio (?:cd|cassette)|mp3/i;
const unavailable = /out of stock|currently unavailable|temporarily unavailable|non disponibile|non è disponibile|esaurit[oa]|non acquistabile/i;

function amount(value) {
  let text = String(value ?? '').replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const decimal = text.match(/[.,](\d{1,2})$/);
  if (decimal) text = text.slice(0, decimal.index).replace(/[.,]/g, '') + '.' + decimal[1];
  else text = text.replace(/[.,]/g, '');
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function money(value) {
  const text = clean(value) || '';
  const match = text.match(/(?:€|EUR)\s*([\d][\d.,\s\u00a0\u202f]*)|([\d][\d.,\s\u00a0\u202f]*)\s*(?:€|EUR)/i);
  return match ? amount((match[1] || match[2]).trim()) : null;
}
function priceOf(node) {
  if (!node?.length) return null;
  const full = money(node.find('.a-offscreen').first().text());
  if (full !== null) return full;
  const whole = clean(node.find('.a-price-whole').first().text());
  const fraction = clean(node.find('.a-price-fraction').first().text());
  if (whole) return fraction ? amount(whole.replace(/[^\d]/g, '') + ',' + fraction.replace(/\D/g, '')) : amount(whole.replace(/[.,]$/, ''));
  return money(node.text());
}
function canonical(value) {
  const url = amazonUrl(value, domain);
  const asin = url?.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
  return asin ? `https://www.${domain}/dp/${asin.toUpperCase()}` : null;
}
function formats(html, currentUrl) {
  const $ = cheerio.load(html), result = [], seen = new Set();
  $('#tmmSwatches .swatchElement, #tmmSwatches .a-button, #mediaMatrix_feature_div .a-button').each((_, element) => {
    const node = $(element), label = clean(node.find('.slot-title, .a-button-text').first().text()) || clean(node.text()) || '';
    if (!physical.test(label) || digital.test(label)) return;
    const selected = node.hasClass('selected') || node.hasClass('a-button-selected') || node.find('.a-button-selected').length;
    const url = canonical(selected ? currentUrl : node.find('a[href]').first().attr('href'));
    if (!url || seen.has(url)) return;
    seen.add(url); result.push({ url, label, advertised_price: money(node.text()) });
  });
  return result.sort((a, b) => (a.advertised_price ?? Infinity) - (b.advertised_price ?? Infinity)).slice(0, 4);
}
function parseProduct(html, url) {
  const $ = cheerio.load(html), metadata = {}, evidence = [];
  $('#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li, #productDetails_detailBullets_sections1 tr, #productDetails_techSpec_section_1 tr').each((_, element) => {
    const node = $(element), text = clean(node.text()) || '';
    const label = clean(node.find('th, .a-text-bold').first().text()) || text.split(':')[0];
    const value = clean(node.find('td').first().text()) || clean(text.slice(text.indexOf(':') + 1));
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (value) metadata[key] = value;
    if (/^isbn(?:10|13)?$/.test(key) && isValidIsbn(value)) evidence.push({ source: 'product_specifications', value: normalizeIsbn(value) });
  });
  const rpi = id => clean($(`#rpi-attribute-${id} .rpi-attribute-value`).first().text());
  for (const id of ['book_details-isbn13', 'book_details-isbn10']) {
    const value = rpi(id); if (isValidIsbn(value)) evidence.push({ source: 'product_specifications', value: normalizeIsbn(value) });
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const visit = data => {
        if (Array.isArray(data)) return data.forEach(visit);
        if (!data || typeof data !== 'object') return;
        if (/^(?:Product|Book)$/.test(data['@type']) && isValidIsbn(data.isbn)) evidence.push({ source: 'structured_product_data', value: normalizeIsbn(data.isbn) });
        if (data['@graph']) visit(data['@graph']);
      }; visit(JSON.parse($(el).text()));
    } catch { /* malformed structured data is not ISBN evidence */ }
  });
  const box = $('#desktop_buybox').first().length ? $('#desktop_buybox').first() : $('#buybox').first();
  const priceArea = box.find('#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #apex_offerDisplay_desktop, #price_inside_buybox, #priceBlock-outsideOfForm_feature_div').filter((_, el) => $(el).find('.a-price:not(.a-text-price)').length).first();
  const scope = priceArea.length ? priceArea : box;
  const price = priceOf(scope.find('.priceToPay, .apexPriceToPay, .a-price:not(.a-text-price):not([data-a-strike="true"])').first())
    ?? money(box.find('#priceblock_ourprice, #priceblock_dealprice, #newBuyBoxPrice').first().text());
  const mrp = priceOf(scope.find('.a-text-price').first());
  const availability = clean(box.find('#availability, #outOfStock').first().text());
  const inStock = unavailable.test(availability || '') ? false : /\bin stock\b|disponibil[eità]|rimast[io]|only \d+ left/i.test(availability || '') || box.find('#add-to-cart-button:not([disabled]), #buy-now-button:not([disabled]), #submit\.add-to-cart:not([disabled])').length > 0 ? true : null;
  const selectedFormat = clean($('#tmmSwatches .selected .slot-title, #tmmSwatches .a-button-selected .slot-title').first().text()) || clean($('#productSubtitle').text()) || '';
  const format = selectedFormat.match(/Kindle(?: Edition)?|Copertina (?:rigida|flessibile|morbida)|Hardcover|Paperback|Brossura|Rilegato/i)?.[0]
    || (metadata.copertinarigida || metadata.hardcover ? 'Hardcover' : metadata.copertinaflessibile || metadata.paperback ? 'Paperback' : null);
  const delivery = clean(box.find('#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE, #deliveryBlockMessage, #mir-layout-DELIVERY_BLOCK').first().text());
  const seller = clean(box.find('#sellerProfileTriggerId').first().text()) || clean(box.find('#merchantInfoFeature_feature_div .offer-display-feature-text-message, #merchant-info a, #tabular-buybox .tabular-buybox-text[tabular-attribute-name="Venduto da"] a').first().text());
  return { store: 'Amazon.it', title: clean($('#productTitle').first().text()), author: clean($('#bylineInfo .author a, #bylineInfo a').first().text()),
    publisher: metadata.editore || metadata.publisher || rpi('book_details-publisher'), publication_date: metadata.datadipubblicazione || metadata.publicationdate || rpi('book_details-publication_date'),
    binding: format, language: metadata.lingua || metadata.language || rpi('language'), pages: metadata.lunghezzastampa || metadata.printlength || metadata.copertinarigida || metadata.copertinaflessibile || metadata.hardcover || metadata.paperback || rpi('book_details-print_length'),
    isbn_evidence: evidence, price, mrp: mrp !== null && price !== null && mrp >= price ? mrp : null, currency: 'EUR',
    seller, delivery, shipping_cost: money(delivery), condition: 'New', price_source: price !== null ? 'product_buy_box' : null,
    in_stock: inStock, stock_status: inStock === true ? 'In Stock' : inStock === false ? 'Out of Stock' : 'Unknown', availability_text: availability,
    reviews_count: clean($('#acrCustomerReviewText').text())?.replace(/\D/g, '') || null, url: canonical(url) || url };
}
function parseOffers(html) {
  const $ = cheerio.load(html), offers = [];
  $('#aod-offer-list #aod-offer, #aod-pinned-offer').slice(0, 30).each((_, element) => {
    const node = $(element), condition = clean(node.find('#aod-offer-heading').first().text()) || clean(node.find('h5').first().text()) || 'New';
    const price = priceOf(node.find('.a-price:not(.a-text-price)').first());
    if (price === null || unavailable.test(node.find('#availability, #outOfStock').text())) return;
    offers.push({ price, condition, seller: clean(node.find('#aod-offer-soldBy a, #aod-offer-soldBy .a-col-right').first().text()),
      delivery: clean(node.find('[id*="delivery"], [id*="DELIVERY"]').first().text()), shipping_cost: money(node.find('[id*="delivery"], [id*="DELIVERY"]').first().text()),
      in_stock: true, stock_status: 'In Stock', price_source: 'buying_options' });
  });
  return offers;
}
async function buyingOptions(page) {
  if (!page.locator) return { offers: [], inspected: false };
  const selector = '#buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, #mediaMatrixGridAODPopover a, #aod-ingress-link, #buybox a[href*="/gp/offer-listing/"], #desktop_buybox a[data-action="show-all-offers-display"]';
  const links = page.locator(selector);
  for (let index = 0; index < Math.min(await links.count(), 5); index++) {
    const link = links.nth(index);
    if (!await link.isVisible().catch(() => false)) continue;
    await policyForPage(page).beforeRequest();
    try {
      await link.click({ timeout: 5000 });
      // The media matrix opens a format popover first; its entry opens AOD.
      await page.waitForTimeout(500);
      const entries = page.locator('.mm-grid-aod-popover-format-entry, #mediaMatrixGridAODPopoverEntries a');
      for (let i = 0; i < Math.min(await entries.count(), 4); i++) {
        const entry = entries.nth(i);
        if (!await entry.isVisible().catch(() => false)) continue;
        await policyForPage(page).beforeRequest();
        await entry.click({ timeout: 5000 });
        break;
      }
      await page.waitForSelector('#aod-offer-list #aod-offer, #aod-pinned-offer', { timeout: 8000 });
    } catch { /* a missing drawer does not invent an offer */ }
    const html = await page.content(), failure = pageFailure(html);
    if (failure) throw Object.assign(new Error(failure.message), { code: failure.code });
    const offers = parseOffers(html);
    if (offers.length) return { offers, inspected: true };
  }
  return { offers: parseOffers(await page.content()), inspected: false };
}
async function scrapeItaly(page, { isbn: target, directUrl } = {}) {
  const isbn = normalizeIsbn(target), direct = directUrl ? amazonUrl(directUrl, domain) : null;
  let url = direct?.href || searchUrl(isbn || String(target || ''), domain);
  const empty = (status, code, message) => ({ store: 'Amazon.it', searched_isbn: isbn || target, found: false, found_isbn: null, isbn_matched: false, isbn_match_source: null, title: null, price: null, mrp: null, currency: 'EUR', in_stock: null, stock_status: status, url, ...(code ? { error_code: code, error: message } : {}) });
  try {
    if (!isValidIsbn(isbn)) return empty('Error', 'invalid_isbn', 'A valid target ISBN is required.');
    if (directUrl && !direct) return empty('Error', 'invalid_url', 'Expected an HTTPS Amazon.it URL.');
    if (!direct || !canonical(direct.href)) {
      const html = await navigate(page, url), search = parseSearch(html, domain);
      if (!search.candidate) return /nessun risultato|non ha prodotto risultati|non corrisponde ad alcun prodotto/i.test(cheerio.load(html)('body').text()) || search.empty ? empty('Not Found') : empty('Error', 'extraction_error', 'Search exposed neither a first listing nor an explicit empty result.');
      url = search.candidate.url;
    }
    const firstUrl = canonical(url), firstHtml = await navigate(page, url), first = parseProduct(firstHtml, page.url());
    if (!first.title) return empty('Error', 'extraction_error', 'Amazon.it product title did not load.');
    const candidates = formats(firstHtml, firstUrl), observations = [];
    if (!digital.test(first.binding || '') && (physical.test(first.binding || '') || !candidates.length)) candidates.unshift({ url: firstUrl, label: first.binding });
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.url)) continue; seen.add(candidate.url);
      url = candidate.url;
      const data = candidate.url === firstUrl ? first : parseProduct(await navigate(page, url), page.url());
      if (!data.title || digital.test(data.binding || '')) continue;
      if (!data.binding) data.binding = candidate.label;
      const panel = await buyingOptions(page), available = [...panel.offers];
      if (data.price !== null && data.in_stock !== false) available.push({ price: data.price, seller: data.seller, delivery: data.delivery, shipping_cost: data.shipping_cost, condition: data.condition, in_stock: data.in_stock, stock_status: data.stock_status, price_source: data.price_source });
      available.sort((a, b) => a.price - b.price || (a.shipping_cost ?? Infinity) - (b.shipping_cost ?? Infinity));
      const selected = available[0];
      const used = panel.offers.filter(o => /used|usat[oa]/i.test(o.condition)).sort((a, b) => a.price - b.price)[0];
      observations.push({ ...data, ...(selected || {}), mrp: selected && data.mrp !== null && data.mrp < selected.price ? null : data.mrp, ...verifyIsbn(isbn, data), offers_inspected: panel.offers.length, buying_options_inspected: panel.inspected, used_available: used?.price ?? null });
    }
    if (!observations.length) return { ...empty('No physical format', 'no_physical_format', 'The first listing exposes no readable physical book format.'), first_listing_url: firstUrl, title: first.title };
    const priced = observations.filter(o => o.price !== null && o.in_stock !== false).sort((a, b) => a.price - b.price);
    const selected = priced[0] || observations[0];
    return { ...selected, searched_isbn: isbn, found: true, first_listing_url: firstUrl, cheapest_scope: 'observed_physical_formats_and_visible_offers', formats_inspected: observations.length,
      format_observations: observations.map(o => ({ url: o.url, title: o.title, binding: o.binding, price: o.price, currency: o.currency, in_stock: o.in_stock, found_isbn: o.found_isbn, isbn_matched: o.isbn_matched, price_source: o.price_source, condition: o.condition })),
      ...(!selected.isbn_matched ? { listing_stock_status: selected.stock_status, stock_status: selected.found_isbn ? 'ISBN mismatch' : 'ISBN unverified' } : {}) };
  } catch (error) {
    return { ...empty(error.code === 'blocked' ? 'Blocked' : 'Error', error.code || 'navigation_error', error.message), ...(error.resume_after ? { resume_after: error.resume_after, circuit_open: !!error.circuit_open, consecutive_blocks: error.consecutive_blocks } : {}) };
  }
}
module.exports = { amount, money, priceOf, canonical, formats, parseProduct, parseOffers, scrapeItaly };

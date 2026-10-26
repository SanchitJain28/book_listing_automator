const cheerio = require('cheerio');
const { normalizeIsbn } = require('./isbn');
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim() || null;
function money(value) {
  const match = String(value ?? '').match(/(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const panels = $('.Products-details-info');
  // The live page includes a short mobile title panel before the full desktop
  // panel. Prefer the panel that actually owns the ISBN and purchase area.
  const complete = panels.filter((_, el) => $(el).find('.Highlights, .buynow').length > 0);
  const scope = complete.length ? complete.first() : panels.first();
  const title = clean(scope.find('h1.for-desktop, h1').first().text());
  const metadata = {};
  scope.find('ul.Author li, table tr').each((_, el) => {
    const item = $(el);
    const label = clean(item.find('span,th,td').first().text())?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const value = clean(item.find('strong').first().text()) || clean(item.find('td').eq(1).text());
    if (label && value) metadata[label] = value;
  });
  const evidence = [];
  scope.find('.Highlights li').each((_, el) => {
    if (/^isbn(?:[ -]?(?:10|13))?$/i.test(clean($(el).find('span').text()) || '')) {
      const value = normalizeIsbn($(el).find('p').text());
      if (value) evidence.push({ source: 'product_highlights', value });
    }
  });
  for (const key of ['isbn', 'isbn13', 'isbn10']) if (normalizeIsbn(metadata[key])) evidence.push({ source: 'product_specifications', value: metadata[key] });
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(collect);
    if ([value['@type']].flat().some(type => /^(?:Product|Book)$/.test(type))) {
      let sameProduct = false;
      try { sameProduct = new URL(value.url || value['@id'], url).pathname === new URL(url).pathname; } catch {}
      if (sameProduct) for (const isbn of [value.isbn, value.gtin13, value.gtin]) if (normalizeIsbn(isbn)) evidence.push({ source: 'structured_product_data', value: isbn });
    }
    if (value['@graph']) collect(value['@graph']);
    if (value.mainEntity) collect(value.mainEntity);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { collect(JSON.parse($(el).text())); } catch {} });
  const price = money(scope.find('#sellingPWeb, .Products-price p').first().text());
  const mrp = money(scope.find('#mrp_desktop, .Products-price del').first().text());
  const discount = clean(scope.find('#off_desktop').first().text()) || (mrp && price !== null && mrp > price ? `${Math.round((mrp - price) / mrp * 100)}%` : null);
  function visible(el) {
    return !$(el).parents().addBack().toArray().some(ancestor => Object.hasOwn(ancestor.attribs || {}, 'hidden') || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test($(ancestor).attr('style') || '') || /(?:^|\s)(?:dnone|d-none|hidden)(?:\s|$)/.test($(ancestor).attr('class') || ''));
  }
  const buttons = scope.find('.buynow button, #cartNotActive button, button#notifiy').toArray().filter(visible);
  const unavailable = buttons.some(el => /out\s*of\s*stock|sold\s*out|notify\s*me/i.test($(el).text()));
  const available = buttons.some(el => /^(?:add to cart|buy now|go to cart)$/i.test(clean($(el).text()) || '') && !$(el).closest('[disabled], [aria-disabled="true"]').length);
  const inStock = unavailable ? false : available ? true : null;
  const conditions = scope.find('.radio-tabs .tab').toArray().map(el => {
    const tab = $(el);
    const label = tab.find('label p').first();
    return { condition: clean(label.clone().children().remove().end().text()), price: money(label.find('span').first().text()), selected: tab.find('input:checked').length > 0 };
  }).filter(item => item.condition);
  return {
    title, author: metadata.author || clean(scope.find('ul.Author a[href*="/author/"]').first().text()),
    price, mrp, discount, currency: 'INR', in_stock: inStock,
    stock_status: inStock === true ? 'In Stock' : inStock === false ? 'Out of Stock' : 'Unknown',
    binding: metadata.binding || null, publisher: metadata.publisher || null,
    pages: metadata.pages || metadata.numberofpages || null, language: metadata.language || null,
    delivery: clean(scope.find('#item_sla, .delivery-box .delivery-title').first().text()),
    condition: conditions.find(item => item.selected)?.condition || null, conditions,
    isbn_evidence: evidence, product_page: !!scope.length && !!title, url,
  };
}

module.exports = { parseProduct, money };

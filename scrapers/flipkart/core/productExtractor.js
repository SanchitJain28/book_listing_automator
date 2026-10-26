const cheerio = require('cheerio');

const text = value => String(value ?? '').replace(/\s+/g, ' ').trim() || null;
const money = value => {
  const match = String(value ?? '').match(/(?:₹|Rs\.?\s*)?\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
};
const labels = new Set(['title', 'author', 'primaryauthor', 'writtenby', 'publisher', 'binding', 'productform', 'pages', 'numberofpages', 'language', 'isbn', 'isbn13', 'isbn10', 'publicationyear']);
const keyOf = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const metaTitle = text($('meta[property="og:title"]').attr('content'));
  const structured = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(collect);
    if ([value['@type']].flat().some(type => /^(?:Product|Book)$/.test(type))) structured.push(value);
    if (value['@graph']) collect(value['@graph']);
    if (value.mainEntity) collect(value.mainEntity);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { collect(JSON.parse($(el).text())); } catch {} });
  $('script, style, nav, footer, header, aside').remove();
  // Recommendations and advertisements link to other product pages. Never use
  // their prices, titles, ISBNs, or availability for the current product.
  $('a[href*="/p/"]').remove();
  const specs = {};
  $('*').each((_, el) => {
    const leaf = $(el);
    if (leaf.children().length) return;
    const key = keyOf(leaf.text());
    if (!labels.has(key)) return;
    let next = leaf.next();
    if (!next.length) next = leaf.parent().next();
    const value = text(next.text());
    if (value && !labels.has(keyOf(value))) specs[key] = value;
  });
  const heading = $('h1, [data-testid="product-title"]').first();
  let scope = heading;
  while (scope.length && !scope.is('body,html') && !scope.text().includes('₹')) scope = scope.parent();
  if (!scope.length) scope = $('body');
  // Legacy price classes are confined to the product's title/buybox region.
  const legacyPrice = scope.find('._30jeq3, .Nx9bqj, [itemprop="price"]').first();
  let price = legacyPrice.length ? money(legacyPrice.attr('content') || legacyPrice.text()) : null;
  const legacyMrp = scope.find('._3I9_wc, .yRaY8j, .kRYCnD').first();
  let mrp = legacyMrp.length ? money(legacyMrp.text()) : null;
  // The current React Native web layout puts the ordinary price in a leaf
  // directly below the h1 section. Only accept a standalone rupee amount.
  if (price === null) {
    scope.find('*').each((_, el) => {
      const leaf = $(el);
      if (leaf.children().length || price !== null) return;
      const value = text(leaf.text());
      if (!/^₹\s*[\d,]+(?:\.\d{1,2})?$/.test(value || '')) return;
      if (!leaf.parent().find('h1').length && /buy at|cashback|coupon|delivery|savings|apply offers/i.test(leaf.parent().text())) return;
      price = money(value);
    });
  }
  if (mrp === null) {
    scope.find('[style*="line-through"]').each((_, el) => { if (mrp === null) mrp = money($(el).text()); });
  }
  // Structured data is used only if it describes this product rather than a
  // carousel: canonical URL or a matching specification ISBN is required.
  const pid = new URL(url).searchParams.get('pid');
  const product = structured.find(item => {
    const itemUrl = item.url || item['@id'];
    let sameUrl = false;
    try { sameUrl = new URL(itemUrl, url).pathname === new URL(url).pathname; } catch {}
    return sameUrl || [item.isbn, item.gtin13, item.gtin, item.sku].some(value => value && [specs.isbn13, specs.isbn10, pid].includes(String(value)));
  });
  const offer = [product?.offers].flat().find(item => item && !Array.isArray(item));
  if (price === null && offer?.price !== undefined) price = money(offer.price);
  const fullText = text($('body').text()) || '';
  const scopeText = text(scope.text()) || '';
  const sellerLeaf = $('*').filter((_, el) => !$(el).children().length && /^Seller\s*:/i.test(text($(el).text()) || '')).first();
  const seller = text(sellerLeaf.text().replace(/^Seller\s*:\s*/i, '')) || text($('#sellerName a, #sellerName span').first().text()) || text(offer?.seller?.name);
  const unavailable = /currently\s+(?:out of stock|unavailable)|sold\s*out|out\s*of\s*stock|notify\s*me/i.test(scopeText) || /OutOfStock|Discontinued|SoldOut/i.test(offer?.availability || '');
  const purchasable = $('button, [role="button"], div, span').toArray().some(el => !$(el).children().length && /^add to cart$/i.test(text($(el).text()) || '') && !$(el).closest('[disabled], [aria-disabled="true"]').length) || /InStock|LimitedAvailability/i.test(offer?.availability || '');
  const inStock = unavailable ? false : purchasable ? true : null;
  const deliveryLeaf = $('*').filter((_, el) => !$(el).children().length && /^Delivery by\b/i.test(text($(el).text()) || '')).first();
  const delivery = deliveryLeaf.length ? text(deliveryLeaf.parent().find('*').filter((_, el) => !$(el).children().length).map((_, el) => $(el).text()).get().join(' ')) : text($('#deliveryBlockMessage, #promise-shipping-tip').first().text());
  const title = specs.title || text(product?.name) || text(heading.clone().children().remove().end().text()) || null;
  const author = specs.author || specs.primaryauthor || specs.writtenby || text(typeof product?.author === 'string' ? product.author : product?.author?.name) || text(metaTitle?.match(/.*\sby\s(.+?)\sat\s(?:Low|Best)\sPrice\sin\sIndia(?:\s|\|)/i)?.[1]);
  return {
    title, author, price, mrp, discount: mrp && price !== null && mrp > price ? `${Math.round((mrp - price) / mrp * 100)}%` : null,
    currency: 'INR', in_stock: inStock, stock_status: inStock === true ? 'In Stock' : inStock === false ? 'Out of Stock' : 'Unknown',
    seller, publisher: specs.publisher || null, binding: specs.binding || specs.productform || null,
    pages: specs.pages || specs.numberofpages || null, language: specs.language || null, publication_date: specs.publicationyear || null,
    delivery, isbn13: specs.isbn13 || (specs.isbn?.length === 13 ? specs.isbn : null), isbn10: specs.isbn10 || (specs.isbn?.length === 10 ? specs.isbn : null),
    structured_isbns: [product?.isbn, product?.gtin13, product?.gtin].filter(Boolean).map(String),
    product_page: !!heading.length || !!product, url, page_text: fullText,
  };
}

async function extractProduct(page) {
  // Expanding these controls is read-only. Do not touch purchase controls.
  for (const label of ['All details', 'Show More']) {
    const control = page.getByText(label, { exact: true }).first();
    if (await control.isVisible().catch(() => false)) {
      await control.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  return parseProduct(await page.content(), page.url());
}

module.exports = { parseProduct, extractProduct, money };

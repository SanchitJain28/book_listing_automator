const cheerio = require('cheerio');
const { nextData, productUrl } = require('./search');
const { normalizeIsbn, isValidIsbn } = require('./isbn');
const clean = value => typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() || null : null;
const names = value => [].concat(value || []).map(item => clean(item?.name || item)).filter(Boolean).join(', ') || null;
function money(value) {
  const text = clean(value)?.replace(/,/g, '');
  if (!text || !/^(?:US\s*)?\$?\s*\d+(?:\.\d{1,2})?(?:\s*USD)?$/i.test(text)) return null;
  const price = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(price) && price >= 0 ? price : null;
}
function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const currentId = productUrl(url)?.split('/').pop();
  let product = nextData($).product || {};
  if (product.usItemId && String(product.usItemId) !== currentId) product = {};
  const title = clean($('#main-title').first().text()) || clean(product.name);
  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const visit = node => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        const types = [].concat(node['@type'] || []);
        if (types.some(type => /^(?:Product|Book)$/.test(type))) {
          const candidate = node.url ? productUrl(node.url) : null;
          if (node.url ? candidate === productUrl(url) : clean(node.name) === title) schemas.push(node);
        }
        if (node['@graph']) visit(node['@graph']);
      };
      visit(JSON.parse($(el).text()));
    } catch { /* Ignore malformed optional structured data. */ }
  });
  const schema = schemas[0] || {};
  const originalCurrency = clean($('.buy-box-container [itemprop="priceCurrency"], [data-testid="buy-box"] [itemprop="priceCurrency"]').first().attr('content')) ||
    clean($('.buy-box-container [itemprop="priceCurrency"], [data-testid="buy-box"] [itemprop="priceCurrency"]').first().text());
  // Remove unrelated and hidden content before reading visible specifications or offers.
  $('script,style,aside,[hidden],[aria-hidden="true"],[data-testid*="recommend"],[data-testid*="carousel"],[data-dca-ctx="recommendations"]').remove();
  $('[style]').filter((_, el) => /display\s*:\s*none|visibility\s*:\s*hidden/i.test($(el).attr('style'))).remove();
  const pairs = new Map(), isbn_evidence = [];
  function evidence(value, source) {
    const isbn = normalizeIsbn(value);
    if (isbn && isValidIsbn(isbn) && !isbn_evidence.some(item => item.value === isbn && item.source === source)) isbn_evidence.push({ value: isbn, source });
  }
  function pair(name, value, source = 'product_specifications') {
    const label = clean(name)?.toLowerCase().replace(/[^a-z0-9]/g, ''), text = clean(value);
    if (!label || !text) return;
    if (!pairs.has(label)) pairs.set(label, text);
    if (/^isbn(?:10|13)?$/.test(label)) {
      for (const match of text.matchAll(/(?:\d[\s-]*){12}\d|(?:\d[\s-]*){9}[\dXx]/g)) evidence(match[0], source);
    }
  }
  const specs = $('#top-highlights-module, [data-testid*="specification"], [data-testid="product-details"]')
    .add($('section').filter((_, el) => /^(?:specs|specifications|book details|product details)$/i.test($(el).find('h2,h3').first().text().trim())));
  specs.find('li').each((_, el) => {
    const match = $(el).text().trim().match(/^([^:]{1,45}):\s*(.+)$/s);
    if (match) pair(match[1], match[2]);
  });
  specs.find('tr').each((_, el) => { const cells = $(el).children('th,td'); if (cells.length >= 2) pair(cells.eq(0).text(), cells.eq(1).text()); });
  specs.find('dt').each((_, el) => pair($(el).text(), $(el).next('dd').text()));
  specs.find('div').each((_, el) => {
    const children = $(el).children();
    if (children.length === 2 && children.eq(0).text().trim().length < 45) pair(children.eq(0).text(), children.eq(1).text());
  });
  specs.each((_, el) => {
    const text = $(el).text();
    for (const match of text.matchAll(/\bISBN(?:[\s-]*(?:10|13))?\s*:?\s*((?:\d[\s-]*){12}\d|(?:\d[\s-]*){9}[\dXx])\b/gi)) evidence(match[1], 'product_specifications');
  });
  function structuredPairs(list) {
    if (Array.isArray(list)) for (const item of list) {
      if (item && typeof item === 'object') pair(item.name || item.displayName || item.key, item.value || item.values?.join(', '), 'product_structured_data');
    }
  }
  structuredPairs(product.specificationHighlights);
  structuredPairs(product.specifications);
  structuredPairs(product.productDetails?.specifications);
  structuredPairs(product.productDetails?.productSpecifications);
  for (const item of schemas) {
    for (const key of ['isbn', 'gtin13', 'gtin']) if (item[key]) {
      for (const value of [].concat(item[key])) if (key === 'isbn' || /^(978|979)/.test(String(value))) evidence(value, 'product_structured_data');
    }
    structuredPairs(item.additionalProperty);
  }
  for (const key of ['isbn', 'isbn10', 'isbn13']) if (product[key]) evidence(product[key], 'product_structured_data');
  const field = (...names) => names.map(name => pairs.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''))).find(Boolean) || null;
  const buybox = $('.buy-box-container').first().length ? $('.buy-box-container').first() : $('[data-testid="buy-box"]').first();
  const offers = [].concat(schema.offers || []).find(offer => !offer.url || productUrl(offer.url) === productUrl(url)) || {};
  const currentPrice = product.priceInfo?.currentPrice || {};
  const price = money(buybox.find('[itemprop="price"]').first().attr('content')) ?? money(buybox.find('[itemprop="price"]').first().text()) ?? money(currentPrice.price ?? currentPrice.priceString) ?? money(offers.price);
  const mrp = money(buybox.find('[data-testid="was-price"], [data-testid="strike-through-price"]').first().text().replace(/^Was\s*/i, '')) ?? money(product.priceInfo?.wasPrice?.price);
  const currency = originalCurrency || clean(currentPrice.currencyUnit) || clean(offers.priceCurrency) || 'USD';
  const stockText = buybox.text().replace(/\s+/g, ' ');
  const availability = String(product.availabilityStatus || offers.availability || '');
  const explicitOut = /out of stock|sold out|currently unavailable/i.test(stockText) || /OUT_OF_STOCK|OutOfStock|Discontinued/i.test(availability);
  const atc = buybox.find('button[data-automation-id="atc"], button[data-automation-id="add-to-cart"]');
  const activeCart = atc.filter((_, el) => !$(el).is('[disabled], [aria-disabled="true"]')).length > 0;
  const in_stock = explicitOut ? false : activeCart || /IN_STOCK|InStock|LimitedAvailability/i.test(availability) ? true : null;
  const sellerText = clean(buybox.find('[data-testid="product-seller-info"]').first().attr('aria-label')) || clean(buybox.find('[data-testid="sold-and-shipped-by"]').first().text());
  const seller = clean(sellerText?.replace(/^Sold (?:and shipped )?by\s*/i, '').replace(/\s+and shipped by.+$/i, '')) || clean(product.sellerDisplayName) || clean(offers.seller?.name);
  const delivery_info = clean(buybox.find('[data-testid="fulfillment-zone-2"]').text()) || clean(buybox.find('[data-seo-id="fulfillment-shipping-intent"]').text());
  const author = field('Author', 'Authors') || names(product.author) || names(schema.author);
  const pagesText = field('Page Count', 'Number of Pages', 'Pages') || clean(product.numberOfPages) || clean(schema.numberOfPages);
  return { title: title || clean(schema.name), author, publisher: field('Publisher') || clean(product.publisher) || clean(schema.publisher?.name || schema.publisher),
    binding: field('Book Format', 'Format', 'Binding') || clean(product.bookFormat) || clean(schema.bookFormat)?.replace(/^https?:\/\/schema.org\//, '') || null,
    pages: pagesText && /^\d+$/.test(pagesText) ? Number(pagesText) : null,
    language: field('Language', 'Written Language') || clean(product.language) || clean(schema.inLanguage),
    publication_date: field('Publication Date', 'Published Date') || clean(schema.datePublished), condition: field('Condition') || clean(product.condition),
    price, mrp, discount: price !== null && mrp > price ? Math.round((1 - price / mrp) * 100) : null, currency, seller,
    shipping: clean(buybox.find('[data-testid="shipping-price"], [data-testid="shipping-fee"]').first().text()), delivery_info,
    in_stock, stock_status: in_stock === true ? 'In Stock' : in_stock === false ? 'Out of Stock' : 'Unknown',
    isbn_evidence, url: productUrl(url) || url, product_page: !!(title || schema.name) };
}
module.exports = { parseProduct, money };

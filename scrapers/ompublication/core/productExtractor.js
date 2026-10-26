const cheerio = require('cheerio');
const { normalizeIsbn } = require('./isbn');
const clean = value => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return !text || /^(?:N\/A|NA|none)$/i.test(text) ? null : text;
};
function money(value) {
  const match = String(value ?? '').match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function parseProduct(html, url) {
  const $ = cheerio.load(html);
  const scope = $('section').filter((_, el) => {
    const section = $(el);
    return section.children('h2').length && section.find('div').toArray().some(node => !$(node).children().length && /^ISBN[ -]?(?:10|13)?$/i.test($(node).text().trim()));
  }).first();
  const meta = {}, evidence = [];
  const labels = /^(?:ISBN[ -]?(?:10|13)?|Year|Binding|Language|Pages|Publisher|Publication|Edition)$/i;
  scope.find('div').each((_, el) => {
    const node = $(el), label = clean(node.text());
    if (node.children().length || !labels.test(label || '')) return;
    const value = clean(node.parent().children('div').last().text());
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (value && value !== label) meta[key] = value;
    if (key.startsWith('isbn') && normalizeIsbn(value)) evidence.push({ source: 'product_specifications', value });
  });
  const priceBlock = scope.children('div').filter((_, el) => $(el).children('span').length && /₹/.test($(el).text())).first();
  const price = money(priceBlock.children('span').first().text());
  const mrp = money(priceBlock.children('span.line-through').first().text());
  function visible(el) {
    return !$(el).parents().addBack().toArray().some(node => Object.hasOwn(node.attribs || {}, 'hidden') || /display\s*:\s*none|visibility\s*:\s*hidden/.test($(node).attr('style') || ''));
  }
  const buttons = scope.find('button').toArray().filter(visible);
  const unavailable = buttons.some(el => /^(?:out of stock|sold out|notify me|currently unavailable)$/i.test(clean($(el).text()) || ''));
  const available = buttons.some(el => /^add to cart$/i.test(clean($(el).text()) || '') && !$(el).is('[disabled],[aria-disabled="true"]'));
  const stock = unavailable ? false : available ? true : null;
  const title = clean(scope.children('h2').first().text());
  return {
    product_page: !!scope.length && !!title, title, author: clean(scope.children('div').first().text()),
    publisher: meta.publisher || meta.publication || null, binding: meta.binding || null,
    language: meta.language || null, pages: meta.pages || null, publication_year: meta.year || null, edition: meta.edition || null,
    price, mrp, discount: mrp && price !== null && mrp > price ? `${Math.round((mrp - price) / mrp * 100)}%` : null,
    currency: 'INR', in_stock: stock, stock_status: stock === true ? 'In Stock' : stock === false ? 'Out of Stock' : 'Unknown',
    delivery: null, isbn_evidence: evidence, url, source: 'browser_dom',
  };
}
module.exports = { parseProduct, money };

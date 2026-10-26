const cheerio = require('cheerio');
const { normalizeIsbn } = require('./isbn');
const clean = value => String(value ?? '').replace(/\s+/g,' ').trim() || null;
function money(value) { const match=String(value ?? '').match(/(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/);return match?Number(match[1].replace(/,/g,'')):null; }
function parseProduct(html,url) {
  const $=cheerio.load(html), scope=$('[class*="ProductImageDetailCard__CardBox"]').first();
  const title=clean(scope.find('h1').first().text());
  const meta={}, evidence=[];
  $('[class*="ProductDetailBlock__OfferText"]').each((_,el)=>{
    const key=clean($(el).find('.title').text())?.toLowerCase().replace(/[^a-z0-9]/g,'');
    const value=clean($(el).find('.shortdescription').text());
    if(key && value) meta[key]=value;
    if(/^isbn(?:10|13)?$/.test(key||'') && normalizeIsbn(value)) evidence.push({source:'product_specifications',value});
  });
  const price=money(scope.find('[class*="AmountBlock__PriceText"]').first().text());
  const mrp=money(scope.find('[class*="AmountBlock__OldPriceText"], [class*="AmountBlock__OldPrcieText"], [class*="AmountBlock__ActualPrice"]').first().text());
  function visible(el) {return !$(el).parents().addBack().toArray().some(e=>Object.hasOwn(e.attribs||{},'hidden') || /display\s*:\s*none|visibility\s*:\s*hidden/.test($(e).attr('style')||''));}
  const services=scope.find('[class*="MoreOptions__ServiceText"]').toArray().filter(visible).map(el=>clean($(el).text()));
  const buttons=scope.find('button').toArray().filter(visible);
  const unavailable=services.some(t=>/out of stock|unavailable|sold out/i.test(t||'')) || buttons.some(el=>/notify me|out of stock/i.test($(el).text()));
  const available=services.some(t=>/^in stock$/i.test(t||'')) || buttons.some(el=>/^add to cart$|^buy now$/i.test(clean($(el).text())||'')&&!$(el).is('[disabled],[aria-disabled="true"]'));
  const stock=unavailable?false:available?true:null;
  return {product_page:!!scope.length&&!!title,title,author:clean(scope.find('a[href*="/author/"]').text().replace(/^\s*,|,\s*$/g,'')),
    publisher:meta.publisher||clean(scope.find('a[href*="/publisher/"]').text()),binding:meta.binding||null,language:meta.language||null,pages:meta.totalpages||meta.pages||meta.noofpages||meta.numberofpages||null,
    publishing_date:meta.publishingdate||null,edition:meta.productedition||null,price,mrp,discount:clean(scope.find('[class*="AmountBlock__Discount"]').first().text()) || (mrp&&price!==null&&mrp>price?`${Math.round((mrp-price)/mrp*100)}%`:null),
    currency:'INR',in_stock:stock,stock_status:stock===true?'In Stock':stock===false?'Out of Stock':'Unknown',
    delivery:clean(scope.find('[class*="Pincode__NormalText"]').first().text()),isbn_evidence:evidence,url,source:'browser_dom'};
}
module.exports={parseProduct,money};

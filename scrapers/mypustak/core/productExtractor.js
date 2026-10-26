const cheerio=require('cheerio');
const {normalizeIsbn}=require('./isbn');
const clean=value=>{const text=String(value??'').replace(/\s+/g,' ').trim();return !text||/^(?:N\/A|NA|none)$/i.test(text)?null:text;};
function money(value){const match=String(value??'').match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);return match?Number(match[1].replace(/,/g,'')):null;}
function parseProduct(html,url){
  const $=cheerio.load(html),scope=$('[class*="Product_product_maindiv"]').first(),right=scope.find('.product_right_inner').first();
  const title=clean(scope.find('h1').first().text()),meta={},evidence=[];
  scope.find('.product_right_details .row').each((_,el)=>{
    const fields=$(el).children('[itemprop]');if(fields.length!==2)return;
    const label=clean(fields.first().text())?.replace(/[^a-z0-9]/gi,'').toLowerCase(),value=clean(fields.last().text());
    if(label&&value)meta[label]=value;
    if(/^isbn(?:10|13)?$/.test(label||'')&&normalizeIsbn(value))evidence.push({source:'product_specifications',value});
  });
  let structured=null;
  $('script[type="application/ld+json"]').each((_,el)=>{try{
    const data=JSON.parse($(el).text());
    for(const item of Array.isArray(data)?data:[data]){
      if(!['Product','Book'].includes(item['@type']))continue;
      let same=false;try{same=new URL(item.url,url).pathname===new URL(url).pathname;}catch{}
      if(!same)continue;structured=item;
      for(const value of [item.isbn,item.sku,item.gtin13])if(normalizeIsbn(value))evidence.push({source:'structured_product_data',value});
    }
  }catch{}});
  const inclusive=/Pay Only Including Delivery/i.test(right.find('[itemprop="price Details"]').first().text());
  const price=money(right.find('[itemprop="Price"]').first().text()) ?? (inclusive ? money(right.find('[itemprop="price Details"]').first().text()) : null);
  const mrp=inclusive?null:money(right.find('[itemprop="MRP"]').first().text());
  const amount=label=>{
    const el=right.find(`[itemprop="${label}"]`).first();
    const row=el.closest('.row');return row.length?money(row.clone().find('[itemprop]').remove().end().text()):null;
  };
  function visible(el){return !$(el).parents().addBack().toArray().some(e=>Object.hasOwn(e.attribs||{},'hidden')||/display\s*:\s*none|visibility\s*:\s*hidden/.test($(e).attr('style')||''));}
  const buttons=scope.find('button').toArray().filter(visible);
  const unavailable=buttons.some(el=>/^(?:out of stock|sold out|notify me|currently unavailable)$/i.test(clean($(el).text())||''));
  const available=buttons.some(el=>/^(?:buy now|add to cart)$/i.test(clean($(el).text())||'')&&!$(el).is('[disabled],[aria-disabled="true"]'));
  const stock=unavailable?false:available?true:null;
  const condition=clean(right.find('button[class*="contained_btn"] [itemprop$=" Condition"]').first().text());
  const shipping=scope.find('p').toArray().map(el=>clean($(el).text())).find(t=>/^Ships within/i.test(t||''))||null;
  const estimated=scope.find('*').toArray().filter(el=>!$(el).children().length).map(el=>clean($(el).text())).find(t=>/^Estimated delivery by/i.test(t||''))||null;
  return {product_page:!!scope.length&&!!title,title,author:clean(scope.find('h2[class*="book_sub_title"] a[href*="/author/"]').text())||clean(structured?.author?.name),
    publisher:meta.publication||meta.publisher||clean(structured?.publisher?.name),binding:meta.binding||null,language:meta.language||null,pages:meta.pages||null,
    condition,price,mrp,discount:mrp&&price!==null&&mrp>price?`${Math.round((mrp-price)/mrp*100)}%`:null,currency:'INR',
    price_includes_delivery:inclusive,price_type:inclusive?'delivery_inclusive_charge':'item_price',
    shipping_cost:amount('delivery charge'),total_amount:amount('Total amount') ?? (inclusive ? price : null),delivery:estimated||shipping,shipping_dispatch:shipping,
    in_stock:stock,stock_status:stock===true?'In Stock':stock===false?'Out of Stock':'Unknown',isbn_evidence:evidence,url,source:'browser_dom'};
}
async function extractMyPustakDOM(page){return parseProduct(await page.content(),page.url());}
module.exports={parseProduct,money,extractMyPustakDOM};

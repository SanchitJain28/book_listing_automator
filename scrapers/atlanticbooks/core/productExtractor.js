const cheerio=require('cheerio');
const {normalizeIsbn,sameIsbn}=require('./isbn');
const clean=value=>{const text=String(value??'').replace(/\s+/g,' ').trim();return !text||/^(?:N\/A|N|NA|none)$/i.test(text)?null:text;};
function money(value){const match=String(value??'').match(/(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/);return match?Number(match[1].replace(/,/g,'')):null;}
const cents=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))?Number(value)/100:null;
function parseProduct(html,url,target){
  const $=cheerio.load(html),scope=$('.product-main').first(),handle=new URL(url).pathname.replace(/^\/products\//,'').replace(/\.js$/,'');
  let product=null,variantMeta={};
  $('script[type="application/json"]').each((_,el)=>{try{const data=JSON.parse($(el).text());if(data.product?.handle===handle&&Array.isArray(data.product.variants))product=data.product;}catch{}});
  try{variantMeta=JSON.parse($('#variant_metafield_data').text()||'{}');}catch{}
  const variants=product?.variants||[];
  const variant=variants.find(v=>[v.barcode,v.sku,variantMeta[v.id]?.barcode].some(value=>sameIsbn(value,target))) || variants.find(v=>String(v.id)===new URL(url).searchParams.get('variant')) || variants[0];
  const vm=variantMeta[variant?.id]||{}, evidence=[],meta={};
  (scope.closest('.product--section').length ? scope.closest('.product--section') : scope).find('li:has(> strong)').each((_,el)=>{
    const label=clean($(el).children('strong').first().text())?.replace(/[^a-z0-9]/gi,'').toLowerCase();
    const value=clean($(el).clone().children('strong').remove().end().text());if(label&&value)meta[label]=value;
    // Variant-specific DOM values initially describe the default variant.
    if(/^isbn(?:10|13)?$/.test(label||'') && normalizeIsbn(value) && (!variant||String(variant.id)===String(variants[0]?.id)))evidence.push({source:'product_specifications',value});
  });
  if(variant)for(const [source,value] of [['shopify_variant_barcode',variant.barcode],['shopify_variant_sku',variant.sku],['variant_metafield_barcode',vm.barcode]])if(normalizeIsbn(value))evidence.push({source,value});
  const title=clean(scope.find('h1.product-title, h1').first().text())||clean(product?.title);
  const domPrice=money(scope.find('.price__current .money').first().text());
  const price=variant?cents(variant.price):domPrice;
  const mrp=variant?cents(variant.compare_at_price):money(scope.find('.price__compare-at .money').first().text());
  const atc=scope.find('button.product-form--atc-button').first();
  const buttonText=clean(atc.text());
  const stock=typeof variant?.available==='boolean'?variant.available:/sold out|unavailable/i.test(buttonText||'')?false:atc.length&&!atc.is('[disabled],[aria-disabled="true"]')&&/add to cart/i.test(buttonText||'')?true:null;
  const author=clean(scope.find('.custom-liquid').filter((_,el)=>/^by\s+/i.test(clean($(el).text())||'')).first().text().replace(/^\s*by\s+/i,''));
  const delivery=scope.find('*').toArray().filter(el=>!$(el).children().length).map(el=>clean($(el).text())).find(text=>/^Ships (?:in|within)/i.test(text||''))||null;
  return {product_page:!!scope.length&&!!title,title,author,publisher:meta.publisher||clean(product?.vendor),publisher_imprint:meta.publisherimprint||null,
    binding:clean(vm.binding)||clean(variant?.option1)||meta.binding||null,language:meta.language||null,pages:meta.pages||null,edition:clean(vm.edition)||meta.edition||null,
    publication_date:meta.publicationdate||null,weight_grams:variant?.weight??null,variant_id:variant?.id||null,
    price,mrp,discount:mrp&&price!==null&&mrp>price?`${Math.round((mrp-price)/mrp*100)}%`:null,currency:'INR',
    in_stock:stock,stock_status:stock===true?'In Stock':stock===false?'Out of Stock':'Unknown',delivery,isbn_evidence:evidence,url,source:product?'shopify_product_data_and_dom':'browser_dom'};
}
async function extractAtlanticDomData(page){return parseProduct(await page.content(),page.url());}
module.exports={parseProduct,money,extractAtlanticDomData};

const cheerio = require('cheerio');
const {normalizeIsbn}=require('./isbn');
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()||null;
function money(value){const match=String(value??'').match(/(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/);return match?Number(match[1].replace(/,/g,'')):null;}
function parseProduct(html,url){
  const $=cheerio.load(html), scope=$('#detailcol2'), prefix='#ctl00_phBody_ProductDetail_';
  const field=name=>clean(scope.find(prefix+name).first().text());
  const title=field('lblTitle'), meta={}, evidence=[];
  scope.find('.item').each((_,el)=>{
    const spans=$(el).find('span');const label=clean(spans.first().text())?.toLowerCase().replace(/[^a-z0-9]/g,'');const value=clean(spans.last().text());
    if(label&&value&&spans.length>1)meta[label]=value;
    if(/^isbn(?:10|13)?$/.test(label||'')&&normalizeIsbn(value))evidence.push({source:'product_specifications',value});
  });
  $('#bookdetail li, #bookdetail tr').each((_,el)=>{
    const label=clean($(el).find('span,th,td').first().text())?.replace(/[^a-z0-9]/gi,'').toLowerCase();
    const value=$(el).is('li') ? clean($(el).clone().children('span').remove().end().text()) : clean($(el).find('td').last().text());
    if(label&&value)meta[label]=value;
    if(/^isbn(?:10|13)?$/.test(label||'')&&normalizeIsbn(value))evidence.push({source:'product_specifications',value});
  });
  const hidden=normalizeIsbn(scope.find(prefix+'hdnISBN').val());
  if(hidden)evidence.push({source:'product_hidden_isbn',value:hidden});
  const price=money(field('lblourPrice')), mrp=money(field('lblListPrice')||field('lblDocPrice'));
  const availability=field('lblAvailable');
  const stock=/out of stock|unavailable|not available|sold out/i.test(availability||'')?false:/^(?:available|in stock)\b/i.test(availability||'')?true:null;
  const author=clean(scope.find('[id*="_lblAuthor"]').filter((_,el)=>!($(el).attr('id')||'').includes('AuthorType')).text().replace(/^\s*By:\s*/i,''));
  return {product_page:!!scope.length&&!!title,title,author,publisher:field('lblPublisher')?.replace(/^\s*\|?\s*Publisher:\s*/i,'')||null,
    binding:field('lblBinding')?.replace(/[()]/g,'')||meta.binding||null,language:meta.language||null,pages:meta.noofpages||meta.pages||meta.pagenumber||meta.numberofpages||null,
    publishing_date:field('lblRelease')?.replace(/^\s*\|?\s*Released:\s*/i,'')||null,
    price,mrp,discount:field('lblDiscount') || (mrp&&price!==null&&mrp>price?`${Math.round((mrp-price)/mrp*100)}%`:null),currency:'INR',
    in_stock:stock,stock_status:stock===true?'In Stock':stock===false?'Out of Stock':'Unknown',availability_text:availability,
    delivery:field('lblBusiness')||field('lishipping'),isbn_evidence:evidence,url,source:'browser_dom'};
}
module.exports={parseProduct,money};

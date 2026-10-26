const cheerio = require('cheerio');
const { sameIsbn } = require('./isbn');
function bookswagonUrl(value) {
  try { const url = new URL(value, 'https://www.bookswagon.com');
    if (url.protocol !== 'https:' || !/^(?:www\.)?bookswagon\.com$/.test(url.hostname)) return null;
    url.hash = ''; return url;
  } catch { return null; }
}
const pathIsbn = url => url.pathname.match(/^\/book\/[^/]+\/(\d{13}|\d{9}[\dX])\/?$/i)?.[1];
function searchUrl(isbn) { return `https://www.bookswagon.com/search-books/${encodeURIComponent(isbn)}`; }
function parseSearch(html,target) {
  const $=cheerio.load(html), scope=$('#listSearchResult, #gridSearchResult'), candidates=[], seen=new Set();
  scope.find('.list-view-books a[href*="/book/"], .product-card a[href*="/book/"]').each((_,el)=>{
    const url=bookswagonUrl($(el).attr('href'));
    if(!url || !sameIsbn(pathIsbn(url),target) || seen.has(url.href)) return;
    seen.add(url.href);candidates.push({url:url.href,title:$(el).closest('.list-view-books, .product-card').find('.title, .book-title, h2').first().text().trim()});
  });
  const text=$('body').text().replace(/\s+/g,' ');
  return {candidates,hasResults:scope.find('.list-view-books, .product-card').length>0,empty:/\b0\s+results? found|no (?:books|results|records) found|could not find|sorry[^.]*no results/i.test(text)};
}
function pageFailure(html,status=200) {
  const $=cheerio.load(html);$('script,style').remove();const text=$('body').text();
  if([403,429,503].includes(status)||/access denied|verify (?:that )?you are human|checking your browser|unusual traffic|captcha challenge|just a moment/i.test(text))return {code:'blocked',message:`BooksWagon blocked the request (HTTP ${status}).`};
  return status>=400?{code:'http_error',message:`BooksWagon returned HTTP ${status}.`}:null;
}
async function navigate(page,url) {
  let last;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});const status=response?.status()||200;
      if(status<400)await page.waitForSelector('#ctl00_phBody_ProductDetail_lblTitle, #listSearchResult .list-view-books, #gridSearchResult .product-card, #ctl00_phBody_lblSearchResult, .search-results',{timeout:10000}).catch(()=>{});
      const html=await page.content(),failure=pageFailure(html,status);
      if(!failure)return html;
      last=Object.assign(new Error(failure.message),{code:failure.code});
    }catch(error){last=error;}
    if(attempt<2)await page.waitForTimeout(2500*(attempt+1));
  }
  throw last;
}
module.exports={bookswagonUrl,pathIsbn,searchUrl,parseSearch,pageFailure,navigate};

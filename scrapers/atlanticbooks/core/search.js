const cheerio=require('cheerio');
const {sameIsbn}=require('./isbn');
function atlanticUrl(value){
  try{const url=new URL(value,'https://atlanticbooks.com');if(url.protocol!=='https:'||!/^(?:www\.)?atlanticbooks\.com$/.test(url.hostname))return null;url.hash='';return url;}catch{return null;}
}
function searchUrl(isbn){return `https://atlanticbooks.com/search?q=${encodeURIComponent(isbn)}`;}
function parseSearch(html,target){
  const $=cheerio.load(html),scope=$('.search--section .productgrid--items'),seen=new Set(),candidates=[];
  scope.find('.productgrid--item a[href*="/products/"]').each((_,el)=>{
    const url=atlanticUrl($(el).attr('href'));if(!url||!url.pathname.startsWith('/products/'))return;
    url.search='';if(seen.has(url.href))return;seen.add(url.href);
    const identifier=url.pathname.match(/-(\d{13}|\d{9}[\dX])\/?$/i)?.[1];
    candidates.push({url:url.href,title:$(el).closest('.productgrid--item').find('.productitem--title').text().trim(),exact:sameIsbn(identifier,target)});
  });
  const text=$('.search--section').text().replace(/\s+/g,' ');
  return {candidates:candidates.filter(c=>c.exact).concat(candidates.filter(c=>!c.exact)).slice(0,10),hasResults:candidates.length>0,empty:/\b0 results?\b|no results|no products|did not (?:yield|return)|could not find/i.test(text)};
}
function pageFailure(html,status=200){
  const $=cheerio.load(html);$('script,style').remove();const text=$('body').text();
  if([401,403,429,503].includes(status)||/access denied|verify (?:that )?you are human|checking your browser|unusual traffic|captcha challenge|just a moment|enter store password/i.test(text))return {code:'blocked',message:`Atlantic Books blocked the request (HTTP ${status}).`};
  return status>=400?{code:'http_error',message:`Atlantic Books returned HTTP ${status}.`}:null;
}
async function navigate(page,url){
  let last;for(let attempt=0;attempt<3;attempt++){
    try{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});const status=response?.status()||200;
      if(status<400)await page.waitForSelector('.product-main h1, .search--section .productgrid--item, .search--section h1',{timeout:10000}).catch(()=>{});
      const html=await page.content(),failure=pageFailure(html,status);if(!failure)return html;
      last=Object.assign(new Error(failure.message),{code:failure.code});
    }catch(error){last=error;}
    if(attempt<2)await page.waitForTimeout(2500*(attempt+1));
  }throw last;
}
module.exports={atlanticUrl,searchUrl,parseSearch,pageFailure,navigate};

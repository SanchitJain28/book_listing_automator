const cheerio = require('cheerio');
const { sameIsbn } = require('./isbn');
function sapnaUrl(value) {
  try { const url = new URL(value, 'https://www.sapnaonline.com');
    if (url.protocol !== 'https:' || !/^(?:www\.)?sapnaonline\.com$/.test(url.hostname)) return null;
    url.hash = ''; return url;
  } catch { return null; }
}
const pathIsbn = url => url.pathname.match(/-(\d{13}|\d{9}[\dX])\/?$/i)?.[1];
function searchUrl(isbn) { return `https://www.sapnaonline.com/search?keyword=${encodeURIComponent(isbn)}`; }
function parseSearch(html, target) {
  const $ = cheerio.load(html), scope = $('#infinite-container');
  const seen = new Set(), candidates = [];
  scope.find('[class*="ProductCard__CardBox"] a[href*="/books/"]').each((_, el) => {
    const url = sapnaUrl($(el).attr('href'));
    if (!url || !sameIsbn(pathIsbn(url), target) || seen.has(url.href)) return;
    seen.add(url.href); candidates.push({ url: url.href, title: $(el).closest('[class*="ProductCard__CardBox"]').find('h2').first().text().trim() });
  });
  const text = $('body').text().replace(/\s+/g, ' ');
  return { candidates, hasResults: scope.find('[class*="ProductCard__CardBox"]').length > 0,
    empty: /\(\s*0 results found\s*\)|no (?:books|products|results) found|could not find|no results/i.test(text) };
}
function pageFailure(html, status = 200) {
  const $ = cheerio.load(html); $('script,style').remove(); const text = $('body').text();
  if ([403,429,503].includes(status) || /access denied|verify (?:that )?you are human|checking your browser|unusual traffic|captcha challenge/i.test(text)) return {code:'blocked', message:`SapnaOnline blocked the request (HTTP ${status}).`};
  return status >= 400 ? {code:'http_error',message:`SapnaOnline returned HTTP ${status}.`} : null;
}
async function navigate(page, url) {
  let last;
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
      const status=response?.status() || 200;
      if(status<400) await page.waitForSelector('[class*="ProductImageDetailCard__TitleText"] h1, #infinite-container [class*="ProductCard__CardBox"], [class*="CategoryTab__Title"]', {timeout:12000}).catch(()=>{});
      const html=await page.content(), failure=pageFailure(html,status);
      if(!failure) return html;
      last=Object.assign(new Error(failure.message),{code:failure.code});
    } catch(error) {last=error;}
    if(attempt<2) await page.waitForTimeout(2500*(attempt+1));
  }
  throw last;
}
module.exports={sapnaUrl,pathIsbn,searchUrl,parseSearch,pageFailure,navigate};

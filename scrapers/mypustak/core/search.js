const cheerio=require('cheerio');
function mypustakUrl(value){try{const url=new URL(value,'https://www.mypustak.com');if(url.protocol!=='https:'||!/^(?:www\.)?mypustak\.com$/.test(url.hostname))return null;url.hash='';return url;}catch{return null;}}
function searchUrl(isbn){return `https://www.mypustak.com/search?value=${encodeURIComponent(isbn)}&page=1`;}
function parseSearch(html){
  const $=cheerio.load(html),candidates=[];
  for(let index=0;index<3;index++){
    const card=$(`[data-book-grid-index="${index}"]`).first();if(!card.length)continue;
    const id=card.find('[data-pid]').first().attr('data-pid')||null;
    const link=card.find('a[href]').toArray().map(el=>mypustakUrl($(el).attr('href'))).find(url=>url&&/\/(?:book|product)\//.test(url.pathname)&&(!id||url.pathname.replace(/\/$/,'').endsWith('/'+id)));
    candidates.push({rank:index+1,id,title:card.find('h2[aria-label]').first().text().trim()||null,...(link?{url:link.href}:{})});
  }
  const text=$('body').text().replace(/\s+/g,' ');
  return {first:candidates[0]||null,candidates,empty:/showing\s+0\s+results|no (?:books|results|products) found|no search results/i.test(text)};
}
function pageFailure(html,status=200){
  const $=cheerio.load(html);$('script,style').remove();const text=$('body').text();
  if([401,403,429,503].includes(status)||/access denied|verify (?:that )?you are human|checking your browser|unusual traffic|captcha challenge|just a moment/i.test(text))return {code:'blocked',message:`MyPustak blocked the request (HTTP ${status}).`};
  return status>=400?{code:'http_error',message:`MyPustak returned HTTP ${status}.`}:null;
}
async function ready(page,status=200){
  if(status<400)await page.waitForSelector('[data-book-grid-index="0"] h2[aria-label], [itemprop="ISBN"], [class*="Product_book_title"], [data-testid="no-results"]',{timeout:15000}).catch(()=>{});
  const html=await page.content(),failure=pageFailure(html,status);if(failure)throw Object.assign(new Error(failure.message),{code:failure.code});return html;
}
async function navigate(page,url){
  let last;for(let attempt=0;attempt<3;attempt++){
    try{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});return await ready(page,response?.status()||200);}catch(error){last=error;}
    if(attempt<2)await page.waitForTimeout(2500*(attempt+1));
  }throw last;
}
const popupGuards=new WeakMap();
function popupGuard(page){
  if(popupGuards.has(page))return popupGuards.get(page);
  const guard={active:null};
  const onPopup=popup=>{
    if(guard.active){guard.active.popups.add(popup);guard.active.choose(popup);}
    else Promise.resolve().then(()=>popup.close()).catch(()=>{});
  };
  page.on('popup',onPopup);
  page.once('close',()=>{page.removeListener('popup',onPopup);popupGuards.delete(page);});
  popupGuards.set(page,guard);
  return guard;
}
async function openResult(page,rank=1){
  const guard=popupGuard(page);
  if(guard.active)throw new Error('MyPustak result inspection must be sequential.');
  let resolveDestination,timer;
  const destination=new Promise(resolve=>{resolveDestination=resolve;});
  const operation={popups:new Set(),chosen:null,choose(target){if(!this.chosen){this.chosen=target;resolveDestination(target);}}};
  guard.active=operation;
  const sameTab=()=>{if(/\/(?:book|product)\//.test(new URL(page.url()).pathname))operation.choose(page);};
  page.on('framenavigated',sameTab);
  try {
    // The popup listener is active throughout the click, including click failures.
    await page.locator(`[data-book-grid-index="${rank-1}"] h2[aria-label]`).click({timeout:15000});
    sameTab();
    if(!operation.chosen)timer=setTimeout(()=>resolveDestination(null),25000);
    const productPage=operation.chosen||await destination;
    if(!productPage)throw new Error('MyPustak product did not open within 25 seconds.');
    await productPage.waitForURL(url=>/\/(?:book|product)\//.test(url.pathname),{waitUntil:'domcontentloaded',timeout:25000});
    await productPage.waitForSelector('[itemprop="ISBN"]',{timeout:15000}).catch(()=>{});
    return {html:await ready(productPage),url:productPage.url()};
  }finally {
    clearTimeout(timer);
    page.removeListener('framenavigated',sameTab);
    guard.active=null;
    await Promise.allSettled([...operation.popups].map(popup=>popup.close()));
    // Keep the idle popup guard until the main page closes: late popups are closed too.
  }
}
const openFirstResult=page=>openResult(page,1);
module.exports={openResult,mypustakUrl,searchUrl,parseSearch,pageFailure,navigate,openFirstResult};

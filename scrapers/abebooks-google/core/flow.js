const {resolveGoogleResults,hasOrganicResults,googleChallenge}=require('./google');
const {scrapeAbePage}=require('./abe');
const {solveGoogleChallenge}=require('./capsolver');
const {classifyAbeUrl}=require('./google');
const {getRandomDelay}=require('../../../utils/browser');
const cheerio=require('cheerio');

function abeBlocked(html,url,status) {
  if ([401,403,429,503].includes(status) || /\/(?:captcha|blocked|robot-check)(?:\/|\?|$)/i.test(url)) return true;
  const $=cheerio.load(html);
  const title=$('title').first().text();
  const main=$('h1').first().text();
  return /captcha|robot check|access denied|too many requests|verify you are human/i.test(`${title} ${main}`)
    || !!$('#captcha-container, #recaptcha, .g-recaptcha').length;
}
async function readyGoogleHtml(page) {
  await page.waitForFunction(() => {
    const text=document.body?.innerText||'';
    return document.querySelectorAll('a[href] h3').length>0
      || /did not match any documents|no results found/i.test(text);
  },null,{timeout:12000}).catch(()=>{});
  return page.content();
}

async function navigateAbe(page,url) {
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  const status=response?.status() || 0;
  const html=await page.content();
  if (abeBlocked(html,page.url(),status)) return {status:'blocked',http_status:status};
  if (status>=400) return {status:'error',http_status:status};
  return {status:'ok',http_status:status};
}
async function scrapeIsbn(page,isbn,{clientKey=null,solveChallenge=solveGoogleChallenge,scrapePage=scrapeAbePage,delay=ms=>page.waitForTimeout(ms),maxLinks=Infinity,onProgress=()=>{},allowManualChallenge=false}={}) {
  const googleUrl=`https://www.google.com/search?q=${encodeURIComponent(isbn)}&hl=en`;
  onProgress(`Searching Google for ${isbn}.`);
  let response=await page.goto(googleUrl,{waitUntil:'domcontentloaded',timeout:45000});
  let html=await page.content();
  if (googleChallenge(html,page.url(),response?.status())) {
    onProgress('Google reCAPTCHA detected.');
    const resolution=await solveChallenge(page,html,clientKey,onProgress,undefined,{allowManual:allowManualChallenge});
    if (!resolution.solved) return {status:'blocked',error:resolution.reason,google_url:googleUrl,google_links:[],pages:[]};
    html=await readyGoogleHtml(page);
    if (googleChallenge(html,page.url())) return {status:'blocked',error:'Google challenge remained after solving.',google_url:googleUrl,google_links:[],pages:[]};
  }
  else {
    html=await readyGoogleHtml(page);
    if (googleChallenge(html,page.url())) return {status:'blocked',error:'Google challenge appeared while results loaded.',google_url:googleUrl,google_links:[],pages:[]};
  }
  const resolved=await resolveGoogleResults(page,html,{onProgress});
  const links=resolved.results.slice(0,maxLinks);
  onProgress(`Found ${links.length} AbeBooks link(s) on the first Google page.`);
  if (!links.length && resolved.errors.length) {
    return {status:'error',error:`Google showed ${resolved.candidate_count} AbeBooks result(s), but their redirect URLs could not be resolved.`,google_url:googleUrl,google_links:[],google_link_errors:resolved.errors,pages:[]};
  }
  if (!links.length && !hasOrganicResults(html) && !/no results found|did not match any documents/i.test(html)) {
    return {status:'error',error:'Google page exposed no recognizable organic results after waiting.',google_url:googleUrl,google_links:[],pages:[]};
  }
  const pages=[];
  for (const link of links) {
    const entry={...link,status:'error',listings:[]};
    try {
      await delay(getRandomDelay(1800,3400));
      onProgress(`Opening AbeBooks ${link.google_rank}/${links.length}: ${link.type}.`);
      const navigation=await navigateAbe(page,link.url);
      entry.url=page.url(); entry.status=navigation.status;entry.http_status=navigation.http_status;
      if (navigation.status==='ok') {
        const final=classifyAbeUrl(page.url());
        if (!final) {entry.status='error';entry.error='AbeBooks redirected to an unexpected page.';}
        else {entry.type=final.type;entry.listings=await scrapePage(page,isbn,entry.type);entry.status=entry.listings.length?'found':'not_found';}
      }
    } catch(error) {entry.status='error';entry.error=error.message;}
    pages.push(entry);
    if (entry.status==='blocked') return {status:'blocked',error:`AbeBooks blocked ${link.url}`,google_url:googleUrl,google_links:links,pages};
  }
  return {status:pages.some(p=>p.status==='found')?'found':pages.some(p=>p.status==='error')?'error':'not_found',google_url:googleUrl,google_links:links,pages};
}
module.exports={scrapeIsbn,navigateAbe,abeBlocked};

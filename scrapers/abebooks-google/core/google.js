const cheerio = require('cheerio');

const TRACKING = /^(?:utm_[\w]+|srsltid|gclid|fbclid|cm_sp|ref|ref_|_gl)$/i;
function classifyAbeUrl(raw, base = 'https://www.google.com/') {
  try {
    let url = new URL(raw, base);
    if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && ['/url', '/goto'].includes(url.pathname)) {
      const destination = url.searchParams.get('q') || url.searchParams.get('url');
      if (!destination) return null;
      url = new URL(destination);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!/^(?:[a-z0-9-]+\.)*abebooks\.(?:com|co\.uk|de|fr|it|es)$/i.test(url.hostname)) return null;
    const pathname = decodeURIComponent(url.pathname);
    const type = /\/(?:bd|plp)\/?$/i.test(pathname) ? 'product'
      : /^\/servlet\/SearchResults\/?$/i.test(pathname) || /^\/book-search(?:\/|$)/i.test(pathname) ? 'search' : null;
    if (!type) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase();
    return { url: url.toString(), type };
  } catch { return null; }
}
function parseGoogleResults(html, base = 'https://www.google.com/') {
  const results=parseGoogleCandidates(html,base).filter(result=>result.type);
  return results.map((result,index)=>({...result,google_rank:index+1}));
}
function parseGoogleCandidates(html, base = 'https://www.google.com/') {
  const $ = cheerio.load(html);
  const results = [], seen = new Set();
  // Google sometimes replaces the visible destination with an opaque /goto
  // token. In that case the result's displayed citation identifies AbeBooks.
  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    let result=classifyAbeUrl(href,base);
    if (!result && $(anchor).find('h3').length) {
      const citation=$(anchor).find('cite').first().text();
      if (/(?:^|[^\w])(?:www\.)?abebooks\.(?:com|co\.uk|de|fr|it|es)(?:\b|\/)/i.test(citation)) {
        try {
          const redirect=new URL(href,base);
          if (/(^|\.)google\.[a-z.]+$/i.test(redirect.hostname) && ['/goto','/url'].includes(redirect.pathname)) {
            result={redirect_url:redirect.toString(),type:null};
          }
        } catch {}
      }
    }
    if (!result) return;
    const key=result.url||result.redirect_url;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ ...result, google_rank: results.length + 1, google_title: $(anchor).find('h3').first().text().trim() || $(anchor).text().trim() || null });
  });
  return results;
}
async function resolveGoogleResults(page,html,{onProgress=()=>{}}={}) {
  const candidates=parseGoogleCandidates(html,page.url());
  const results=[],errors=[],seen=new Set();
  for (const candidate of candidates) {
    let result=candidate;
    if (candidate.redirect_url) {
      try {
        const response=await page.context().request.get(candidate.redirect_url,{maxRedirects:0,timeout:20000});
        const location=response.headers().location;
        const destination=location && classifyAbeUrl(location,candidate.redirect_url);
        if (!destination) throw new Error(`Google redirect returned ${response.status()} without an AbeBooks destination.`);
        result={...candidate,...destination};
        delete result.redirect_url;
      } catch(error) {
        errors.push({google_rank:candidate.google_rank,error:error.message});
        onProgress(`Could not resolve Google AbeBooks result ${candidate.google_rank}: ${error.message}`);
        continue;
      }
    }
    if (!seen.has(result.url)) {seen.add(result.url);results.push(result);}
  }
  return {results,errors,candidate_count:candidates.length};
}
function hasOrganicResults(html) {
  const $=cheerio.load(html);
  return $('a[href] h3').length>0;
}
function googleChallenge(html, url = '', status = 200) {
  if ([403,429,503].includes(status) || /\/sorry(?:\/|\?)/i.test(url)) return true;
  const $=cheerio.load(html);
  const organic=$('a[href] h3').length>0;
  if (organic) return false;
  if ($('#captcha-form, form[action*="/sorry"], .g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]').length) return true;
  const title=$('title').first().text();
  const heading=$('h1').first().text();
  if (/unusual traffic|captcha|robot check/i.test(`${title} ${heading}`)) return true;
  $('script,style,noscript').remove();
  const visibleText=$('body').text();
  return /our systems have detected unusual traffic|to continue, please type the characters/i.test(visibleText);
}
module.exports = { classifyAbeUrl, parseGoogleResults, parseGoogleCandidates, resolveGoogleResults, hasOrganicResults, googleChallenge };

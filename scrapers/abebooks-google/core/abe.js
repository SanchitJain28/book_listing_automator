const cheerio = require('cheerio');
const { normalizeIsbn, isValidIsbn, sameIsbn } = require('../../atlanticbooks/core/isbn');
const { extractAbeBooksListings } = require('../../abebooks/core/multiListingExtractor');
const { classifyAbeUrl } = require('./google');

function isbnValues(raw) {
  const text = String(raw || '').replace(/&nbsp;/g, ' ');
  const candidates = text.match(/(?<!\d)(?:97[89](?:[\s-]?\d){10}|\d(?:[\s-]?\d){8}[\s-]?[\dXx])(?!\d)/g) || [];
  return [...new Set(candidates.map(normalizeIsbn).filter(value => value && isValidIsbn(value)))];
}
function isbnEvidence($, root) {
  const found = [];
  const selectors = ['#isbn13','#isbn10','[itemprop="isbn"]','.isbns','[data-test-id="listing-isbn-link"]','[data-test-id="listing-isbn-13"]','[data-test-id="isbn13"]','[data-test-id="isbn10"]','[data-test-id^="isbn-"]'];
  for (const selector of selectors) $(root).find(selector).addBack(selector).each((_, el) => {
    for (const value of isbnValues([$(el).attr('content'),$(el).attr('aria-label'),$(el).text()].filter(Boolean).join(' '))) found.push({ value, source: selector.includes('listing-') ? 'search_card_isbn' : 'product_isbn' });
  });
  // Older layouts use a plain metadata row with an ISBN label.
  $(root).find('li,dt,dd,tr').each((_,el)=>{
    const value=$(el).text().trim();
    if (/\bISBN(?:-1[03])?\b/i.test(value) && value.length < 180) {
      for (const isbn of isbnValues(value)) found.push({value:isbn,source:'labeled_isbn'});
    }
  });
  return found;
}
function structuredEvidence($) {
  const found=[];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const value=JSON.parse($(script).html());
      const visit=(node,depth=0)=>{
        if (depth>12 || !node || typeof node!=='object') return;
        if (Array.isArray(node)) return node.forEach(child=>visit(child,depth+1));
        if (node.isbn) for (const isbn of isbnValues(node.isbn)) found.push({ value:isbn, source:'structured_isbn' });
        for (const [key,child] of Object.entries(node)) if (key!=='isbn') visit(child,depth+1);
      };
      visit(value);
    } catch {}
  });
  return found;
}
function verify(target, evidence) {
  const unique=[...new Map(evidence.map(x=>[x.value,x])).values()];
  if (!unique.length) return { found_isbn:null, isbn_matched:false, isbn_match_status:'unverified', isbn_match_source:null, isbn_evidence:[] };
  const conflict=unique.find(x=>!sameIsbn(x.value,target));
  const chosen=conflict || unique[0];
  return { found_isbn:chosen.value, isbn_matched:!conflict, isbn_match_status:conflict?'mismatched':'matched', isbn_match_source:chosen.source, isbn_evidence:unique };
}
function parseAbePage(html, url, target, type, extracted=[]) {
  const $=cheerio.load(html);
  if (type==='search') {
    const cards=$('[data-srp-item-role="listing"], .result-data').toArray();
    return cards.map((card,index)=>{
      const $card=$(card), detail=extracted[index] || {};
      const href=$card.find('a[data-test-id="listing-title-link"], a[href*="/bd"], a[href*="/plp"]').toArray()
        .map(anchor=>$(anchor).attr('href'))
        .find(value=>value && classifyAbeUrl(value,url)?.type==='product');
      const listingUrl=href ? new URL(href,url).toString() : null;
      const evidence=isbnEvidence($,card);
      const check=verify(target,evidence);
      const rawPrice=$card.find('[data-test-id^="item-price"], [data-test-id="listing-price"]').first().text().trim();
      const priceMatch=rawPrice.match(/[\d,.]+/);
      return { ...detail, title:detail.title || $card.find('[data-test-id="listing-title"],h2,h3').first().text().trim() || null,
        author:detail.author || $card.find('[data-test-id="listing-author"],.author').first().text().trim() || null,
        seller:detail.seller || $card.find('[data-test-id="listing-seller-link"]').first().text().trim() || null,
        price:detail.price || rawPrice || null, price_num:detail.price_num ?? (priceMatch ? Number(priceMatch[0].replace(/,/g,'')) : null),
        condition:$card.find('[data-test-id^="listing-condition"], [data-test-id^="listing-book-condition"]').first().text().trim() || null,
        publisher:detail.publisher || $card.find('[data-test-id^="publisher-"]').first().text().trim() || null,
        binding:detail.binding || $card.find('[aria-label="Softcover"],[aria-label="Hardcover"]').first().attr('aria-label') || null,
        listing_url:listingUrl, ...check, isbn_match:check.isbn_matched };
    });
  }
  const evidence=[...isbnEvidence($,$.root()),...structuredEvidence($)];
  const check=verify(target,evidence);
  const base=extracted[0] || {};
  const title=base.title && base.title!=='N/A' ? base.title : $('#book-title, [data-test-id="book-title"],h1').first().text().trim() || null;
  if (!title && !evidence.length) return [];
  return [{ ...base, title, listing_url:url, ...check, isbn_match:check.isbn_matched }];
}
async function scrapeAbePage(page, target, type) {
  const url=page.url();
  const html=await page.content();
  const extracted=await extractAbeBooksListings(page,null);
  return parseAbePage(html,url,target,type,extracted);
}
module.exports={isbnValues,verify,parseAbePage,scrapeAbePage};

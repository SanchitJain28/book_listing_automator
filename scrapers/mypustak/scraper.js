const {normalizeIsbn,isValidIsbn,verifyIsbn}=require('./core/isbn');
const {mypustakUrl,searchUrl,parseSearch,navigate,openResult}=require('./core/search');
const {parseProduct}=require('./core/productExtractor');
function emptyResult(isbn,url,status,code=null,error=null){return {store:'MyPustak',searched_isbn:isbn,found:false,title:null,author:null,publisher:null,binding:null,language:null,pages:null,price:null,mrp:null,currency:'INR',in_stock:null,stock_status:status,seller:'MyPustak',found_isbn:null,isbn_matched:false,isbn_match_source:null,url,...(code?{error_code:code,error}:{})};}
async function scrapeMyPustakBook(page,{directUrl,isbn:targetIsbn}={}){
  const direct=directUrl?mypustakUrl(directUrl):null;
  const isbn=normalizeIsbn(targetIsbn||direct?.searchParams.get('value')||direct?.pathname.match(/-(\d{13}|\d{9}[\dX])(?:\/|$)/i)?.[1]);
  let url=direct?.href||(isbn?searchUrl(isbn):null);
  try{
    if(directUrl&&!direct)return emptyResult(isbn,null,'Error','invalid_url','Expected an HTTPS MyPustak URL.');
    if(!isValidIsbn(isbn))return emptyResult(isbn||String(targetIsbn||''),url,'Invalid ISBN','invalid_isbn','A valid ISBN-10 or ISBN-13 is required.');
    let html=await navigate(page,url);
    const checked=[];
    function extract(content,productUrl,searchCandidate){
      const data=parseProduct(content,productUrl);
      if(!data.product_page)throw Object.assign(new Error('MyPustak product details did not load.'),{code:'extraction_error'});
      const validation=verifyIsbn(isbn,data),{product_page,...fields}=data;
      const result={store:'MyPustak',searched_isbn:isbn,seller:'MyPustak',found:validation.isbn_matched,...fields,...validation,
        ...(searchCandidate?{search_candidate:searchCandidate}:{})};
      checked.push({rank:searchCandidate?.rank||null,url:productUrl,title:data.title,...validation,isbn_evidence:data.isbn_evidence});
      return result;
    }
    if(/\/(?:book|product)\//.test(new URL(page.url()).pathname)){
      const result=extract(html,page.url(),null);
      return {...result,...(!result.isbn_matched?{stock_status:'ISBN mismatch',listing_stock_status:result.stock_status}:{})};
    }
    const search=parseSearch(html);
    if(!search.candidates.length){if(search.empty)return emptyResult(isbn,page.url(),'Not Listed');throw Object.assign(new Error('Search exposed neither result cards nor an explicit empty result.'),{code:'extraction_error'});}
    let firstResult;
    for(const candidate of search.candidates){
      // Reuse the current page when the card exposes a real product URL.
      // Otherwise retain the site's click/popup navigation; never invent a URL from its ID.
      const opened=candidate.url?{html:await navigate(page,candidate.url),url:page.url()}:await openResult(page,candidate.rank);url=opened.url;
      const result=extract(opened.html,opened.url,candidate);
      if(!firstResult)firstResult=result;
      if(result.isbn_matched)return {...result,search_candidates_checked:checked};
      // Mobile layouts may navigate in the same tab rather than opening a popup.
      if(!page.url().includes('/search'))await navigate(page,searchUrl(isbn));
    }
    return {...firstResult,stock_status:'ISBN mismatch',listing_stock_status:firstResult.stock_status,search_candidates_checked:checked};
  }catch(error){return emptyResult(isbn,url,error.code==='blocked'?'Blocked':'Error',error.code||'navigation_error',error.message);}
}
module.exports={scrapeMyPustakBook};

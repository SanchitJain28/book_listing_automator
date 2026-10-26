const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseSearch,searchUrl,bookswagonUrl,pageFailure}=require('../scrapers/bookswagon/core/search');
const {parseProduct}=require('../scrapers/bookswagon/core/productExtractor');
const {verifyIsbn,sameIsbn}=require('../scrapers/bookswagon/core/isbn');
const {scrapeBookswagon}=require('../scrapers/bookswagon/bookswagon-isbn');
const {runBatch}=require('../scrapers/bookswagon/runner');
const isbn='9789395185097',url=`https://www.bookswagon.com/book/example/${isbn}`;
const reference=fs.readFileSync(path.join(__dirname,'../references/bookswagon-reference.md'),'utf8');
const product=reference.split('## Product page reference')[1];
const search=reference.split('## Header reference')[0];
function details(body='',identifier=isbn){return `<div id="detailcol2"><span id="ctl00_phBody_ProductDetail_lblTitle">Book</span><label id="ctl00_phBody_ProductDetail_lblourPrice">₹199</label><div class="item"><span>ISBN-13</span><span>${identifier}</span></div>${body}</div>`;}
const status=text=>`<span id="ctl00_phBody_ProductDetail_lblAvailable">${text}</span>`;
function fakePage(pages,status=200){let current;return {visits:0,async goto(url){this.visits++;current=url;if(!pages[url])throw Error(`Unexpected URL ${url}`);return {status:()=>status};},url:()=>current,content:async()=>pages[current],waitForSelector:async()=>{},waitForTimeout:async()=>{}};}

test('reference search selects only exact ISBN cards and deduplicates image/title links',()=>{
 assert.equal(searchUrl(isbn),`https://www.bookswagon.com/search-books/${isbn}`);
 const result=parseSearch(search,isbn);assert.equal(result.candidates.length,1);assert.match(result.candidates[0].title,/Veterinary/);
 assert.equal(parseSearch(search,'9780306406157').candidates.length,0);
 assert.equal(parseSearch(`<a href="${url}">Navigation</a>`,isbn).candidates.length,0);
});
test('new grid layout selects exact product links and ignores lookalike hosts',()=>{
 const html=`<div id="gridSearchResult"><div class="product-card"><h2>Book</h2><a href="${url}">Book</a><a href="https://bookswagon.com.evil.example/book/example/${isbn}">Bad</a></div></div>`;
 assert.equal(parseSearch(html,isbn).candidates.length,1);
});
test('reference product isolates price and availability from app offers and notification text',()=>{
 const data=parseProduct(product,url);assert.match(data.title,/Veterinary/);assert.equal(data.author,'Books Wagon');assert.equal(data.publisher,'Books Wagon');
 assert.equal(data.price,1584);assert.equal(data.mrp,2295);assert.equal(data.discount,'31%');assert.equal(data.in_stock,true);assert.equal(data.binding,'Paperback');assert.equal(data.language,'English');
 assert.match(data.delivery,/6-8 Business Days/);assert.equal(verifyIsbn(isbn,data).isbn_match_source,'product_specifications');
});
test('full specifications use value text after the label, not the label itself',()=>{
 const data=parseProduct(details()+`<div id="bookdetail"><ul><li><span>Language: </span>English</li><li><span>No of Pages: </span>320</li><li><span>ISBN-13: </span>${isbn}</li></ul></div>`,url);
 assert.equal(data.language,'English');assert.equal(data.pages,'320');assert(data.isbn_evidence.some(e=>e.value===isbn));
});
test('unavailable product is found with independent ISBN even when it retains a price',async()=>{
 const html=details(status('Out of Stock'));const result=await scrapeBookswagon(fakePage({[url]:html}),url,isbn);assert.equal(result.found,true);assert.equal(result.isbn_matched,true);assert.equal(result.in_stock,false);assert.equal(result.price,199);
});
test('recommendation stock, price and app discounts cannot supply missing target values',()=>{
 const html=`<div id="detailcol2"><span id="ctl00_phBody_ProductDetail_lblTitle">Book</span></div><div>In stock ₹1</div><div id="ctl00_phBody_ProductDetail_CartBoxWeb_divAppPriceBox">₹50</div>`;
 const data=parseProduct(html,url);assert.equal(data.price,null);assert.equal(data.mrp,null);assert.equal(data.in_stock,null);
});
test('conflicting specifications reject a matching URL; ISBN-10 is equivalent',()=>{
 assert.equal(verifyIsbn(isbn,parseProduct(details('','9780306406157'),url)).isbn_matched,false);assert.equal(sameIsbn('9395185090',isbn),true);
});
test('hidden ISBN evidence is checked for conflicts and recorded separately',()=>{
 const data=parseProduct(details('','')+`<div id="detailcol2"><input id="ctl00_phBody_ProductDetail_hdnISBN" value="${isbn}"></div>`,url);
 assert.equal(verifyIsbn(isbn,data).isbn_match_source,'product_hidden_isbn');
});
test('matching query is never evidence for a product; exact product path fallback is labeled',()=>{
 assert.equal(verifyIsbn(isbn,{title:'Book',url:searchUrl(isbn),isbn_evidence:[]}).isbn_matched,false);
 assert.equal(verifyIsbn(isbn,{title:'Book',url,isbn_evidence:[]}).isbn_match_source,'product_url_isbn');
});
test('empty search, extraction failures and blocked responses remain distinct',async()=>{
 const empty=await scrapeBookswagon(fakePage({[searchUrl(isbn)]:'<body>0 results found</body>'}),null,isbn);assert.equal(empty.stock_status,'Not Listed');
 const blank=await scrapeBookswagon(fakePage({[searchUrl(isbn)]:'<body></body>'}),null,isbn);assert.equal(blank.error_code,'extraction_error');
 const page=fakePage({[searchUrl(isbn)]:'Access denied'},403);const blocked=await scrapeBookswagon(page,null,isbn);assert.equal(blocked.stock_status,'Blocked');assert.equal(page.visits,3);assert.equal(pageFailure('Too many requests',429).code,'blocked');
});
test('invalid domain and script URLs are rejected',()=>{assert.equal(bookswagonUrl('https://bookswagon.com.evil.example/book/foo'),null);assert.equal(bookswagonUrl('javascript:alert(1)'),null);});
test('search-to-product flow uses real candidate links and product ISBN evidence',async()=>{
 const target=parseSearch(search,isbn).candidates[0].url,page=fakePage({[searchUrl(isbn)]:search,[target]:product});
 const data=await scrapeBookswagon(page,null,isbn);assert.equal(data.found,true);assert.equal(data.url,target);assert.equal(data.isbn_match_source,'product_specifications');assert.equal(page.visits,2);
});
test('duplicate inputs retain output rows and resume skips both verified occurrences',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bookswagon-resume-')),output=path.join(dir,'results.jsonl');const items=[{searched_isbn:isbn},{searched_isbn:isbn},{searched_isbn:'9780306406157'}];let calls=0;
 try{
 const first=await runBatch({items,output,page:{},delay:async()=>{},scrape:async(_,__,target)=>{calls++;return {searched_isbn:target,found:target===isbn,isbn_matched:target===isbn};}});
 assert.equal(calls,2);assert.equal(first.report.input_count,3);assert.equal(first.report.matched_count,2);
 assert.equal(fs.readFileSync(output,'utf8').trim().split('\n').length,3);
 calls=0;const next=await runBatch({retryFailed:true,items,output,page:{},delay:async()=>{},scrape:async(_,__,target)=>{calls++;return {searched_isbn:target,found:true,isbn_matched:true};}});
 assert.equal(calls,1);assert.equal(next.report.matched_count,3);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a direct search URL can supply the target ISBN without using the query as match evidence',async()=>{
 const target=parseSearch(search,isbn).candidates[0].url;
 const result=await scrapeBookswagon(fakePage({[searchUrl(isbn)]:search,[target]:product}),searchUrl(isbn));
 assert.equal(result.searched_isbn,isbn);assert.equal(result.found,true);assert.equal(result.isbn_match_source,'product_specifications');
});

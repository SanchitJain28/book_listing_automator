const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {EventEmitter}=require('node:events');
const {parseSearch,searchUrl,mypustakUrl,pageFailure,openFirstResult}=require('../scrapers/mypustak/core/search');
const {parseProduct}=require('../scrapers/mypustak/core/productExtractor');
const {verifyIsbn,sameIsbn}=require('../scrapers/mypustak/core/isbn');
const {scrapeMyPustakBook}=require('../scrapers/mypustak/scraper');
const {runBatch}=require('../scrapers/mypustak/runner');
const isbn='9788174734099',url=`https://www.mypustak.com/book/dentodrite-international-series-anatomy-nk-choudhary-${isbn}/2331399`;
const ref=fs.readFileSync(path.join(__dirname,'../references/mypustak-reference.md'),'utf8');
const product=ref.split('## Product page refernence')[1],search=ref.split('## Product page refernence')[0];
function details({identifier=isbn,body='',pricing='<span itemprop="Price">₹199</span><span itemprop="MRP">₹300</span>'}={}){return `<div class="Product_product_maindiv"><div class="product_right_inner"><h1>Book</h1>${pricing}${body}<div class="product_right_details"><div class="row"><span itemprop="ISBN">ISBN :</span><span itemprop="${identifier}">${identifier}</span></div></div></div></div>`;}
function fakePage(pages,status=200){let current;return Object.assign(new EventEmitter(),{visits:0,async goto(url){this.visits++;current=url;if(!pages[url])throw Error(`Unexpected URL ${url}`);return {status:()=>status};},url:()=>current,content:async()=>pages[current],waitForSelector:async()=>{},waitForTimeout:async()=>{}});}

test('search uses value and page=1; only the top three cards are candidates',()=>{
 assert.equal(searchUrl(isbn),`https://www.mypustak.com/search?value=${isbn}&page=1`);const result=parseSearch(search);assert.equal(result.first.id,'2331399');assert.equal(result.first.rank,1);assert.equal(result.candidates.length,3);assert.match(result.first.title,/Dentodrite/);
});
test('reference new book price is scoped to product and excludes recently viewed cards',()=>{
 const d=parseProduct(product,url);assert.match(d.title,/Dentodrite/);assert.equal(d.author,'N.K. Choudhary');assert.equal(d.price,213);assert.equal(d.mrp,250);assert.equal(d.shipping_cost,40);assert.equal(d.total_amount,253);assert.equal(d.price_includes_delivery,false);assert.equal(d.condition,'Brand New');assert.equal(d.binding,'paperback');assert.equal(d.language,'English');assert.equal(d.in_stock,true);assert.equal(verifyIsbn(isbn,d).isbn_match_source,'product_specifications');
});
test('used book delivery-inclusive charge is retained without inventing an MRP or shipping split',()=>{
 const d=parseProduct(details({pricing:'<span itemprop="price Details">Pay Only Including Delivery <span itemprop="MRP">₹320 Used Donated</span></span>'}),url);assert.equal(d.price,320);assert.equal(d.mrp,null);assert.equal(d.price_includes_delivery,true);assert.equal(d.price_type,'delivery_inclusive_charge');assert.equal(d.total_amount,320);assert.equal(d.shipping_cost,null);
});
test('incorrect first product ISBN remains a mismatch and is not counted as found',async()=>{
 const result=await scrapeMyPustakBook(fakePage({[url]:details({identifier:'9780306406157',body:'<button>Add to Cart</button>'})}),{directUrl:url,isbn});assert.equal(result.found,false);assert.equal(result.isbn_matched,false);assert.equal(result.found_isbn,'9780306406157');assert.equal(result.stock_status,'ISBN mismatch');assert.equal(result.listing_stock_status,'In Stock');
});
test('three mismatching results report mismatch and never inspect a fourth result',async()=>{
 let clicks=0,rank=0;
 const child={waitForURL:async()=>{},waitForSelector:async()=>{},content:async()=>details({identifier:'9780306406157'}),url:()=>url,close:async()=>{}};
 const page=fakePage({[searchUrl(isbn)]:search});page.waitForEvent=async()=>child;
 page.locator=selector=>({click:async()=>{rank=Number(selector.match(/index="(\d+)"/)[1])+1;assert(rank<=3);clicks++;page.emit('popup',child);}});
 const result=await scrapeMyPustakBook(page,{isbn});assert.equal(result.found,false);assert.equal(result.search_candidates_checked.length,3);assert.equal(clicks,3);assert.equal(result.stock_status,'ISBN mismatch');
});
test('an exact second result is selected after rejecting the first and stops further inspection',async()=>{
 let clicks=0,rank=0;
 const child={waitForURL:async()=>{},waitForSelector:async()=>{},content:async()=>details({identifier:rank===2?isbn:'9780306406157'}),url:()=>url,close:async()=>{}};
 const page=fakePage({[searchUrl(isbn)]:search});page.waitForEvent=async()=>child;
 page.locator=selector=>({click:async()=>{rank=Number(selector.match(/index="(\d+)"/)[1])+1;clicks++;page.emit('popup',child);}});
 const result=await scrapeMyPustakBook(page,{isbn});assert.equal(result.found,true);assert.equal(result.search_candidate.rank,2);assert.equal(result.search_candidates_checked.length,2);assert.equal(clicks,2);
});
test('popup is closed after extraction and even when product load fails',async()=>{
 let closed=0;const child={waitForURL:async()=>{},waitForSelector:async()=>{},content:async()=>product,url:()=>url,close:async()=>{closed++;}};
 const page=Object.assign(new EventEmitter(),{url:()=>searchUrl(isbn),locator:()=>({click:async()=>{page.emit('popup',child);}})});
 assert.equal((await openFirstResult(page)).url,url);assert.equal(closed,1);
 child.content=async()=>{throw Error('failed');};await assert.rejects(openFirstResult(page),/failed/);assert.equal(closed,2);
});
test('unavailable matching product is still found and retains item price',async()=>{
 const result=await scrapeMyPustakBook(fakePage({[url]:details({body:'<button>Out of Stock</button>'})}),{directUrl:url,isbn});assert.equal(result.found,true);assert.equal(result.in_stock,false);assert.equal(result.price,199);
});
test('missing prices and purchase controls remain null; unrelated stock and offers are ignored',()=>{
 const d=parseProduct(details({pricing:''})+'<aside>Out of Stock ₹1<button>Add to cart</button></aside>',url);assert.equal(d.price,null);assert.equal(d.mrp,null);assert.equal(d.in_stock,null);
});
test('hidden notification dialog does not override available product',()=>{
 const d=parseProduct(details({body:'<button>Add to Cart</button><div style="display:none"><button>Notify Me</button></div>'}),url);assert.equal(d.in_stock,true);
});
test('structured ISBN is scoped to the actual product URL and conflicts reject a listing',()=>{
 const data={'@type':'Product',url,isbn:'9780306406157',sku:'9780306406157'};
 const d=parseProduct(details()+`<script type="application/ld+json">${JSON.stringify(data)}</script>`,url);assert.equal(verifyIsbn(isbn,d).isbn_matched,false);
 const other=parseProduct(details()+`<script type="application/ld+json">${JSON.stringify({...data,url:'/book/other/1'})}</script>`,url);assert.equal(verifyIsbn(isbn,other).isbn_matched,true);
});
test('query and product URL ISBN alone never prove a match; equivalent ISBN-10 works',()=>{
 assert.equal(verifyIsbn(isbn,{title:'Book',url,isbn_evidence:[]}).isbn_matched,false);assert.equal(verifyIsbn(isbn,{title:'Book',url:searchUrl(isbn),isbn_evidence:[]}).isbn_matched,false);assert.equal(sameIsbn('0-306-40615-2','9780306406157'),true);
});
test('blank, empty and blocked search pages are distinct with bounded retries',async()=>{
 const empty=await scrapeMyPustakBook(fakePage({[searchUrl(isbn)]:'<body>Showing 0 Results</body>'}),{isbn});assert.equal(empty.stock_status,'Not Listed');
 const blank=await scrapeMyPustakBook(fakePage({[searchUrl(isbn)]:'<body></body>'}),{isbn});assert.equal(blank.error_code,'extraction_error');
 const page=fakePage({[searchUrl(isbn)]:'Access denied'},403);const blocked=await scrapeMyPustakBook(page,{isbn});assert.equal(blocked.stock_status,'Blocked');assert.equal(page.visits,3);assert.equal(pageFailure('Too many requests',429).code,'blocked');
});
test('invalid domains and script URLs are rejected',()=>{assert.equal(mypustakUrl('https://mypustak.com.evil.example/book/foo'),null);assert.equal(mypustakUrl('javascript:alert(1)'),null);});
test('resume skips verified successes by identity while retrying failures',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mypustak-resume-')),output=path.join(dir,'results.jsonl'),items=[{searched_isbn:isbn},{searched_isbn:'9780306406157'}];let calls=[];
 try{await runBatch({items,output,page:{},delay:async()=>{},scrape:async(_,params)=>{calls.push(params.isbn);return {searched_isbn:params.isbn,found:params.isbn===isbn,isbn_matched:params.isbn===isbn};}});assert.equal(calls.length,2);calls=[];
 const {report}=await runBatch({retryFailed:true,items:[...items].reverse(),output,page:{},delay:async()=>{},scrape:async(_,params)=>{calls.push(params.isbn);return {searched_isbn:params.isbn,found:true,isbn_matched:true};}});assert.deepEqual(calls,['9780306406157']);assert.equal(report.matched_count,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('popup cleanup covers a click that throws after opening a product',async()=>{
 let closed=0;const child={close:async()=>{closed++;}};
 const page=Object.assign(new EventEmitter(),{url:()=>searchUrl(isbn),locator:()=>({click:async()=>{page.emit('popup',child);throw Error('click timed out');}})});
 await assert.rejects(openFirstResult(page),/click timed out/);assert.equal(closed,1);assert.equal(page.listenerCount('framenavigated'),0);
 page.emit('popup',child);await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,2);
 page.emit('close');assert.equal(page.listenerCount('popup'),0);
});
test('same-tab results are supported and unexpected additional popups are closed',async()=>{
 let current=searchUrl(isbn),closed=0;
 const child={close:async()=>{closed++;}};
 const page=Object.assign(new EventEmitter(),{url:()=>current,locator:()=>({click:async()=>{current=url;page.emit('framenavigated');page.emit('popup',child);}}),
  waitForURL:async()=>{},waitForSelector:async()=>{},content:async()=>product});
 assert.equal((await openFirstResult(page)).url,url);assert.equal(closed,1);assert.equal(page.listenerCount('framenavigated'),0);
 page.emit('close');
});

test('an explicit card product link is inspected in the reusable main page without a popup',async()=>{
 const html=`<div data-book-grid-index="0"><div data-pid="2331399"><a href="${url}"><h2 aria-label="Book">Book</h2></a></div></div>`;
 const page=fakePage({[searchUrl(isbn)]:html,[url]:details({body:'<button>Add to cart</button>'})});
 page.waitForEvent=()=>{throw Error('No popup should be opened');};
 const result=await scrapeMyPustakBook(page,{isbn});assert.equal(result.found,true);assert.equal(result.search_candidate.url,url);assert.equal(page.visits,2);
 const wrong=html.replace(url,'https://mypustak.com.evil.example/book/book/2331399');assert.equal(parseSearch(wrong).candidates[0].url,undefined);
});

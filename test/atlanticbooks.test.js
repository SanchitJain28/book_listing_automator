const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseSearch,searchUrl,atlanticUrl,pageFailure}=require('../scrapers/atlanticbooks/core/search');
const {parseProduct}=require('../scrapers/atlanticbooks/core/productExtractor');
const {verifyIsbn,sameIsbn}=require('../scrapers/atlanticbooks/core/isbn');
const {scrapeAtlanticBook}=require('../scrapers/atlanticbooks/scraper');
const {runBatch}=require('../scrapers/atlanticbooks/runner');
const isbn='9788125063247',handle=`gleanings-from-home-and-abroad-${isbn}`,url=`https://atlanticbooks.com/products/${handle}`;
const reference=fs.readFileSync(path.join(__dirname,'../references/atlantic-reference.md'),'utf8');
const product=reference.split('## Product page reference')[1],search=reference.split('## header reference')[0];
function details({identifier=isbn,variants,extra='',withData=true}={}){
 const p={title:'Book',handle,variants:variants||[{id:1,barcode:identifier,sku:identifier,price:19900,compare_at_price:30000,available:true,option1:'Paperback'}]};
 return `<div class="product--section"><div class="product-main"><h1 class="product-title">Book</h1>${extra}</div><ul><li><strong>ISBN13: </strong>${identifier}</li></ul>${withData?`<script type="application/json">${JSON.stringify({product:p})}</script>`:''}</div>`;
}
function fakePage(pages,status=200){let current;return {visits:0,async goto(url){this.visits++;current=url;if(!pages[url])throw Error(`Unexpected URL ${url}`);return {status:()=>status};},url:()=>current,content:async()=>pages[current],waitForSelector:async()=>{},waitForTimeout:async()=>{}};}

test('reference search selects product cards, strips tracking and ranks exact identifiers first',()=>{
 assert.equal(searchUrl(isbn),`https://atlanticbooks.com/search?q=${isbn}`);const result=parseSearch(search,isbn);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].url,url);assert.equal(result.candidates[0].exact,true);
 assert.equal(parseSearch(`<a href="${url}">Unrelated</a>`,isbn).candidates.length,0);
});
test('reference product verifies specifications and Shopify variant while extracting independent stock and price',()=>{
 const data=parseProduct(product,url,isbn);assert.equal(data.title,'Gleanings From Home And Abroad');assert.equal(data.author,'Board Of Editors');assert.equal(data.publisher,'Orient Blackswan Pvt Ltd');assert.equal(data.binding,'Hardcover');assert.equal(data.language,'English');assert.equal(data.pages,null);assert.equal(data.price,179);assert.equal(data.mrp,210);assert.equal(data.discount,'15%');assert.equal(data.in_stock,true);assert.match(data.delivery,/7-10 Days/);assert.equal(verifyIsbn(isbn,data).isbn_match_source,'product_specifications');
});
test('a conflicting ISBN specification disqualifies even a matching variant and URL',()=>{
 const html=details({identifier:'9780306406157',variants:[{id:1,barcode:isbn,sku:isbn,price:19900,available:true}]});assert.equal(verifyIsbn(isbn,parseProduct(html,url,isbn)).isbn_match_source,'product_isbn_conflict');
});
test('matching variant supplies its own price, availability, binding and ISBN instead of first variant',()=>{
 const other='9780306406157';const html=details({identifier:other,variants:[{id:1,barcode:other,price:10000,available:true,option1:'Hardcover'},{id:2,barcode:isbn,sku:isbn,price:25000,compare_at_price:40000,available:false,option1:'Paperback'}]});
 const data=parseProduct(html,url,isbn);assert.equal(data.variant_id,2);assert.equal(data.price,250);assert.equal(data.mrp,400);assert.equal(data.in_stock,false);assert.equal(data.binding,'Paperback');assert.equal(verifyIsbn(isbn,data).isbn_match_source,'shopify_variant_barcode');
});
test('an unavailable matching book is found; missing values are not invented',async()=>{
 const html=details({variants:[{id:1,barcode:isbn,available:false}]});const result=await scrapeAtlanticBook(fakePage({[url]:html}),{directUrl:url,isbn});assert.equal(result.found,true);assert.equal(result.isbn_matched,true);assert.equal(result.in_stock,false);assert.equal(result.price,null);assert.equal(result.mrp,null);assert.equal(result.language,null);
});
test('unrelated embedded products cannot supply price, stock or ISBN',()=>{
 const html=details({identifier:'',withData:false})+`<script type="application/json">${JSON.stringify({product:{handle:'other',variants:[{id:1,barcode:isbn,price:100,available:true}]}})}</script>`;
 const data=parseProduct(html,url,isbn);assert.equal(data.price,null);assert.equal(data.in_stock,null);assert.deepEqual(data.isbn_evidence,[]);
});
test('DOM fallback scopes item prices and purchase controls away from recommendations and bulk quotes',()=>{
 const html=details({withData:false,extra:'<div class="price__current"><span class="money">₹199</span></div><button class="product-form--atc-button">Add to cart</button>'})+'<section>Sold out ₹1<div class="price__current"><span class="money">₹1</span></div></section>';
 const data=parseProduct(html,url,isbn);assert.equal(data.price,199);assert.equal(data.mrp,null);assert.equal(data.in_stock,true);
});
test('Shopify false availability wins over an unrelated or stale add-to-cart label',()=>{
 const html=details({variants:[{id:1,barcode:isbn,available:false,price:19900}],extra:'<button class="product-form--atc-button">Add to cart</button>'});assert.equal(parseProduct(html,url,isbn).in_stock,false);
});
test('equivalent ISBN-10 matches ISBN-13, while search query alone cannot prove a match',()=>{
 assert.equal(sameIsbn('0-306-40615-2','9780306406157'),true);assert.equal(verifyIsbn(isbn,{title:'Book',url:searchUrl(isbn),isbn_evidence:[]}).isbn_matched,false);assert.equal(verifyIsbn(isbn,{title:'Book',url,isbn_evidence:[]}).isbn_match_source,'product_url_isbn');
});
test('lookalike hosts and script URLs are rejected',()=>{assert.equal(atlanticUrl('https://atlanticbooks.com.evil.example/products/foo'),null);assert.equal(atlanticUrl('javascript:alert(1)'),null);});
test('empty, blank and blocked search pages remain distinct with bounded retries',async()=>{
 const empty=await scrapeAtlanticBook(fakePage({[searchUrl(isbn)]:'<div class="search--section">0 results</div>'}),{isbn});assert.equal(empty.stock_status,'Not Listed');
 const blank=await scrapeAtlanticBook(fakePage({[searchUrl(isbn)]:'<body></body>'}),{isbn});assert.equal(blank.error_code,'extraction_error');
 const page=fakePage({[searchUrl(isbn)]:'Access denied'},403);const blocked=await scrapeAtlanticBook(page,{isbn});assert.equal(blocked.stock_status,'Blocked');assert.equal(page.visits,3);assert.equal(pageFailure('Too many requests',429).code,'blocked');
});
test('search follows discovered product URL and validates ISBN, without fixed product mappings',async()=>{
 const page=fakePage({[searchUrl(isbn)]:search,[url]:product});const result=await scrapeAtlanticBook(page,{isbn});assert.equal(result.found,true);assert.equal(result.url,url);assert.equal(result.isbn_match_source,'product_specifications');assert.equal(page.visits,2);
});
test('resume preserves verified successes and retries failed inputs by identity',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlantic-resume-')),output=path.join(dir,'results.jsonl'),items=[{searched_isbn:isbn},{searched_isbn:'9780306406157'}];let calls=[];
 try{await runBatch({items,output,page:{},delay:async()=>{},scrape:async(_,params)=>{calls.push(params.isbn);return {searched_isbn:params.isbn,found:params.isbn===isbn,isbn_matched:params.isbn===isbn};}});assert.equal(calls.length,2);calls=[];
 const {report}=await runBatch({items:[...items].reverse(),output,page:{},delay:async()=>{},scrape:async(_,params)=>{calls.push(params.isbn);return {searched_isbn:params.isbn,found:true,isbn_matched:true};}});assert.deepEqual(calls,['9780306406157']);assert.equal(report.matched_count,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

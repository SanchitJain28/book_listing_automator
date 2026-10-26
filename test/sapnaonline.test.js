const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {parseSearch,searchUrl,sapnaUrl,pageFailure} = require('../scrapers/sapnaonline/core/search');
const {parseProduct} = require('../scrapers/sapnaonline/core/productExtractor');
const {verifyIsbn,sameIsbn,isValidIsbn} = require('../scrapers/sapnaonline/core/isbn');
const {scrapeSapnaOnline} = require('../scrapers/sapnaonline/sapnaonline-isbn');
const {runBatch,identity} = require('../scrapers/sapnaonline/runner');
const isbn='9788188230846', url=`https://www.sapnaonline.com/books/example-8188230847-${isbn}`;
const reference=fs.readFileSync(path.join(__dirname,'../references/sapnabooks-reference.md'),'utf8');
const product=reference.split('## Product page reference')[1];
const search=reference.split('## Search bar reference')[0];
function details(body='',identifier=isbn) {return `<div class="ProductImageDetailCard__CardBox"><h1>Book</h1><div class="AmountBlock__PriceText">₹199</div>${body}</div><div class="ProductDetailBlock__OfferText"><span class="title">ISBN-13</span><span class="shortdescription">${identifier}</span></div>`;}
function fakePage(pages,status=200) {let current;return {visits:0,async goto(url){this.visits++;current=url;if(!pages[url]) throw Error(`Unexpected URL ${url}`);return {status:()=>status};},url:()=>current,content:async()=>pages[current],waitForSelector:async()=>{},waitForTimeout:async()=>{}};}

test('search uses keyword and selects only matching ISBN cards in result container',()=>{
 assert.equal(searchUrl(isbn),`https://www.sapnaonline.com/search?keyword=${isbn}`);
 const result=parseSearch(search,isbn);assert.equal(result.candidates.length,1);assert.match(result.candidates[0].title,/Numerology/);
 assert.equal(parseSearch(search,'9780306406157').candidates.length,0);
 assert.equal(parseSearch(`<a href="${url}">unrelated</a>`,isbn).candidates.length,0);
});
test('reference extracts product specifications, price, author and stock without recommendations',()=>{
 const data=parseProduct(product,url);assert.equal(data.title,'Numerology & Your Business');assert.equal(data.author,'Rajsushila V');assert.equal(data.publisher,'Ranjan Publications');
 assert.equal(data.price,150);assert.equal(data.mrp,null);assert.equal(data.language,'English');assert.equal(data.binding,'Paper Back');assert.equal(data.in_stock,true);
 assert.equal(verifyIsbn(isbn,data).isbn_match_source,'product_specifications');
});
test('unavailable book retains item price and is found even when unavailable',async()=>{
 const html=details('<button>Notify Me</button>');const data=parseProduct(html,url);assert.equal(data.price,199);assert.equal(data.in_stock,false);
 const result=await scrapeSapnaOnline(fakePage({[url]:html}),url,isbn);assert.equal(result.found,true);assert.equal(result.isbn_matched,true);assert.equal(result.in_stock,false);
});
test('ISBN conflict disqualifies matching URL; query alone cannot prove match',()=>{
 assert.equal(verifyIsbn(isbn,parseProduct(details('','9780306406157'),url)).isbn_matched,false);
 assert.equal(verifyIsbn(isbn,{title:'Book',url:`https://www.sapnaonline.com/search?keyword=${isbn}`,isbn_evidence:[]}).isbn_matched,false);
 assert.equal(sameIsbn('0-306-40615-2','9780306406157'),true);assert.equal(isValidIsbn('9780306406158'),false);
});
test('exact product path fallback is recorded distinctly',()=>{
 const data=parseProduct(details('',''),url);assert.equal(verifyIsbn(isbn,data).isbn_match_source,'product_url_isbn');
});
test('unrelated Apollo entities cannot supply title, ISBN, stock or price',()=>{
 const html=`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{initialApolloState:{'Product:other':{name:'Other',product_unit_price:1}}}}})}</script>`;
 const data=parseProduct(html,url);assert.equal(data.title,null);assert.equal(data.price,null);assert.equal(data.in_stock,null);assert.deepEqual(data.isbn_evidence,[]);
});
test('unrelated discounts, recommendation prices and missing purchase controls do not imply stock',()=>{
 const data=parseProduct(details('')+'<div class="ProductCard__CardBox">Out of Stock ₹1<button>Add to cart</button></div>',url);assert.equal(data.price,199);assert.equal(data.in_stock,null);assert.equal(data.mrp,null);
});
test('hidden notification controls do not override available product',()=>{
 const data=parseProduct(details('<button>Add to cart</button><div style="display:none"><button>Notify Me</button></div>'),url);assert.equal(data.in_stock,true);
});
test('lookalike domains and script URLs are rejected',()=>{assert.equal(sapnaUrl('https://sapnaonline.com.evil.example/books/foo'),null);assert.equal(sapnaUrl('javascript:alert(1)'),null);});
test('blank, empty and blocked search responses are distinct',async()=>{
 const empty=await scrapeSapnaOnline(fakePage({[searchUrl(isbn)]:'<body>(0 results found)</body>'}),null,isbn);assert.equal(empty.stock_status,'Not Listed');
 const blank=await scrapeSapnaOnline(fakePage({[searchUrl(isbn)]:'<body></body>'}),null,isbn);assert.equal(blank.error_code,'extraction_error');
 const page=fakePage({[searchUrl(isbn)]:'Access denied'},403);const blocked=await scrapeSapnaOnline(page,null,isbn);assert.equal(blocked.stock_status,'Blocked');assert.equal(page.visits,3);assert.equal(pageFailure('Too many requests',429).code,'blocked');
});

test('fresh batch skips no inputs and resume skips verified successes while retrying failures', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sapna-resume-'));
  const output = path.join(directory, 'results.jsonl');
  const items = [{ searched_isbn: isbn }, { searched_isbn: '9780306406157' }];
  const called = [];
  try {
    await runBatch({ items, output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { called.push(target); return { searched_isbn: target, found: target === isbn, isbn_matched: target === isbn }; } });
    assert.deepEqual(called, items.map(item => item.searched_isbn));
    called.length = 0;
    const { report } = await runBatch({ items: [...items].reverse(), output, page: {}, delay: async () => {}, scrape: async (_, direct, target) => { called.push(target); return { searched_isbn: target, found: true, isbn_matched: true }; } });
    assert.deepEqual(called, ['9780306406157']);
    assert.equal(report.matched_count, 2);
    assert.equal(identity({ searched_isbn: isbn, url }), identity({ searched_isbn: isbn, input_url: url }));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('search-to-product flow verifies product specifications without hardcoded product mapping',async()=>{
 const target=parseSearch(search,isbn).candidates[0].url;
 const page=fakePage({[searchUrl(isbn)]:search,[target]:product});
 const result=await scrapeSapnaOnline(page,null,isbn);
 assert.equal(result.found,true);assert.equal(result.url,target);assert.equal(result.isbn_match_source,'product_specifications');assert.equal(page.visits,2);
});
test('disabled purchase controls and missing price stay unknown and null',()=>{
 const data=parseProduct('<div class="ProductImageDetailCard__CardBox"><h1>Book</h1><button disabled>Add to Cart</button></div>',url);
 assert.equal(data.in_stock,null);assert.equal(data.price,null);assert.equal(data.mrp,null);
});

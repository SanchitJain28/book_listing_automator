const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyAbeUrl,parseGoogleResults,parseGoogleCandidates,resolveGoogleResults,googleChallenge}=require('../scrapers/abebooks-google/core/google');
const {isbnValues,verify,parseAbePage}=require('../scrapers/abebooks-google/core/abe');
const {abeBlocked}=require('../scrapers/abebooks-google/core/flow');
const {createContextPage}=require('../scrapers/abebooks-google/core/backgroundPage');
const {loadGoogleClearance,saveGoogleClearance}=require('../scrapers/abebooks-google/core/googleSession');
const {scrapeIsbn}=require('../scrapers/abebooks-google/core/flow');
const {solveRecaptcha,recaptchaSiteKey,recaptchaConfig,waitForManualClearance,solveGoogleChallenge}=require('../scrapers/abebooks-google/core/capsolver');
const {options,itemsFrom,identity,pendingIndexes,clearanceCookieFrom,isBrowserClosedError}=require('../scrapers/abebooks-google/abebooks-google-isbn');
const {getResumeIndex}=require('../utils/resume');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const isbn='9780091884970';
const other='9780306406157';

test('first Google page yields only organic AbeBooks product and search links',()=>{
  const html=`<div id="rso">
    <a href="https://www.google.com/url?q=https%3A%2F%2Fwww.abebooks.com%2F9780091884970%2FWhere-Live%2Fplp%3Fcm_sp%3Dtest"><h3>Product</h3></a>
    <a href="https://www.abebooks.com/servlet/SearchResults?an=smith"><h3>Search</h3></a>
    <a href="https://www.abebooks.com/servlet/SearchResults?an=smith"><h3>Duplicate</h3></a>
    <a href="https://not-abebooks.com/servlet/SearchResults"><h3>Impostor</h3></a>
    <a href="https://www.abebooks.com/other"><h3>Unrelated</h3></a>
    <a href="https://www.abebooks.com/other">AbeBooks site link</a>
  </div>`;
  const links=parseGoogleResults(html);
  assert.deepEqual(links.map(x=>x.type),['product','search']);
  assert.equal(links[0].url,'https://www.abebooks.com/9780091884970/Where-Live/plp');
  assert.equal(links[1].google_rank,2);
  assert.equal(classifyAbeUrl('javascript:alert(1)'),null);
  assert.equal(classifyAbeUrl('https://www.abebooks.com/Sample/123/bd')?.type,'product');
});

test('Google AbeBooks links are captured outside legacy result containers',()=>{
  const html=`<main><section><a href="https://www.abebooks.com/9780299297947/The-Body-in-Bodega-Bay/plp"><h3>The Body in Bodega Bay</h3></a></section></main>`;
  const links=parseGoogleResults(html);
  assert.equal(links.length,1);
  assert.equal(links[0].type,'product');
});

test('opaque Google /goto result resolves through its redirect Location',async()=>{
  const html='<a href="/goto?url=CAESopaque"><h3>Hot Topics Flashcards</h3><cite>https://www.abebooks.com › 9781932735024 › plp</cite></a>';
  assert.equal(parseGoogleCandidates(html).length,1);
  const requested=[];
  const page={url:()=> 'https://www.google.com/search?q=9781932735024',context:()=>({request:{get:async(url,options)=>{
    requested.push({url,options});
    return {status:()=>302,headers:()=>({location:'https://www.abebooks.com/9781932735024/Hot-Topics/plp'})};
  }}})};
  const resolved=await resolveGoogleResults(page,html);
  assert.equal(requested[0].options.maxRedirects,0);
  assert.equal(resolved.results[0].type,'product');
  assert.equal(resolved.results[0].url,'https://www.abebooks.com/9781932735024/Hot-Topics/plp');
  assert.equal(resolved.errors.length,0);
});

test('flow waits for rendered Google results before deciding there are no links',async()=>{
  const googleHtml='<main><a href="https://www.abebooks.com/9780299297947/Book/plp"><h3>Book</h3></a></main>';
  let currentUrl='https://www.google.com/search?q=9780299297947';
  let html='<html><div id="search"></div></html>';
  const page={
    goto:async url=>{currentUrl=url;if(url.includes('abebooks.com'))html='<h1>Book</h1>';return {status:()=>200}},
    content:async()=>html,url:()=>currentUrl,
    waitForFunction:async()=>{html=googleHtml}
  };
  const result=await scrapeIsbn(page,'9780299297947',{delay:async()=>{},scrapePage:async()=>[{title:'Book',isbn_matched:true}]});
  assert.equal(result.status,'found');
  assert.equal(result.google_links.length,1);
});

test('ISBN evidence accepts ISBN-10 equivalent, but rejects conflicting specifications',()=>{
  assert.deepEqual(isbnValues('ISBN-10: 0091884977 / ISBN-13: 9780091884970'),['0091884977',isbn]);
  assert.equal(verify(isbn,[{value:'0091884977',source:'product_isbn'}]).isbn_matched,true);
  const result=verify(isbn,[{value:isbn,source:'product_isbn'},{value:other,source:'structured_isbn'}]);
  assert.equal(result.isbn_match_status,'mismatched');
  assert.equal(result.found_isbn,other);
});

test('direct product page gets ISBN from observed metadata, not requested ISBN or URL',()=>{
  const url=`https://www.abebooks.com/${isbn}/title/plp`;
  const mismatch=parseAbePage(`<h1>Different book</h1><section class="detail-block"><div id="isbn13">${other}</div></section>`,url,isbn,'product');
  assert.equal(mismatch[0].isbn_match_status,'mismatched');
  assert.equal(mismatch[0].found_isbn,other);
  const unverified=parseAbePage('<h1>Unverified book</h1><div id="bookPurchase"></div>',url,isbn,'product');
  assert.equal(unverified[0].isbn_match_status,'unverified');
  assert.equal(unverified[0].found_isbn,null);
  const structured=parseAbePage(`<h1>Book</h1><script type="application/ld+json">{"@type":"Book","isbn":"${isbn}"}</script>`,url,isbn,'product');
  assert.equal(structured[0].isbn_match_source,'structured_isbn');
});

test('search page saves every listing and checks ISBN separately',()=>{
  const html=`<div data-srp-item-role="listing"><h2>One</h2><a data-test-id="listing-isbn-link">ISBN ${isbn}</a><span data-test-id="item-price-1">US$ 12.50</span></div>
    <div data-srp-item-role="listing"><h2>Two</h2><a data-test-id="listing-isbn-link">ISBN ${other}</a><span data-test-id="item-price-2">US$ 8.00</span></div>`;
  const listings=parseAbePage(html,'https://www.abebooks.com/servlet/SearchResults?an=x',isbn,'search');
  assert.equal(listings.length,2);
  assert.deepEqual(listings.map(x=>x.isbn_match_status),['matched','mismatched']);
  assert.deepEqual(listings.map(x=>x.price_num),[12.5,8]);
});

test('challenge and block classification avoids incidental page text',()=>{
  assert.equal(googleChallenge('<h1>Unusual traffic from your computer network</h1>','https://www.google.com/sorry/index'),true);
  assert.equal(googleChallenge('<script>const message="not a robot; recaptcha challenge"</script><a href="/goto?url=x"><h3>Book result</h3></a>','https://www.google.com/search?q=isbn',200),false);
  assert.equal(googleChallenge('<title>ISBN - Google Search</title><a href="/goto?url=x"><h3>Book result</h3></a><p>Not a robot is a book title</p>','https://www.google.com/search?q=isbn',200),false);
  assert.equal(googleChallenge('<form id="captcha-form"><div class="g-recaptcha" data-sitekey="key"></div></form>','https://www.google.com/search?q=isbn',200),true);
  assert.equal(abeBlocked('<script>const captcha = false</script><h1>Book</h1>','https://www.abebooks.com/book/1/bd',200),false);
  assert.equal(abeBlocked('<h1>Access denied</h1>','https://www.abebooks.com/book/1/bd',200),true);
  assert.equal(abeBlocked('<h1>Book</h1>','https://www.abebooks.com/book/1/bd',429),true);
});

test('CapSolver request flow polls without exposing the API key',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>calls.length===1?{errorId:0,taskId:'task-1'}:{errorId:0,status:'ready',solution:{gRecaptchaResponse:'token'}}};
  };
  const progress=[];
  const token=await solveRecaptcha({clientKey:'secret',websiteURL:'https://www.google.com/sorry/',websiteKey:'site',recaptchaDataSValue:'google-blob',fetcher,sleep:async()=>{},onProgress:message=>progress.push(message)});
  assert.equal(token,'token');
  assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/createTask','/getTaskResult']);
  assert.equal(calls[0].body.task.type,'ReCaptchaV2TaskProxyLess');
  assert.equal(calls[0].body.task.recaptchaDataSValue,'google-blob');
  assert.ok(progress.some(message=>message.includes('token received')));
  assert.equal(recaptchaSiteKey('<div class="g-recaptcha" data-sitekey="site"></div>'),'site');
  assert.deepEqual(recaptchaConfig('<div data-sitekey="site" data-s="google-blob" data-callback="onSuccess"></div>'),{siteKey:'site',dataS:'google-blob',callback:'onSuccess'});
});

test('Google challenge passes data-s and gives a clear result if the page stays blocked',async()=>{
  const page={url:()=> 'https://www.google.com/sorry/index',evaluate:async()=>true,waitForURL:async()=>{throw new Error('timeout')},waitForLoadState:async()=>{}};
  const result=await solveGoogleChallenge(page,'<div data-sitekey="site" data-s="google-blob"></div>','secret',()=>{},async args=>{
    assert.equal(args.recaptchaDataSValue,'google-blob');
    return 'token';
  });
  assert.equal(result.solved,false);
  assert.match(result.reason,/did not leave its challenge page/);
});

test('unsupported Google challenge can be completed manually in headed mode',async()=>{
  const page={waitForSelector:async()=>{throw new Error('timeout')},content:async()=>'<h1>Challenge</h1>',url:()=> 'https://www.google.com/sorry/index'};
  let manualCalled=false;
  const result=await solveGoogleChallenge(page,'<h1>Challenge</h1>','secret',()=>{},async()=>{throw new Error('API must not be called')},{allowManual:true,manualWait:async()=>{manualCalled=true;return {solved:true}}});
  assert.equal(manualCalled,true);
  assert.equal(result.solved,true);
  const cleared=await waitForManualClearance({content:async()=>'<a href="/url"><h3>Search result</h3></a>',url:()=> 'https://www.google.com/search?q=isbn'},()=>{},{sleep:async()=>{}});
  assert.equal(cleared.solved,true);
});

test('JSONL resume tracks duplicate ISBN input occurrences',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abe-google-'));
  try {
    const input=path.join(dir,'input.txt'),output=path.join(dir,'results.jsonl');
    fs.writeFileSync(input,`${isbn}\n${isbn}\n${other}\n`);
    const items=itemsFrom(input);
    fs.writeFileSync(output,JSON.stringify({...items[0],input_index:0})+'\n');
    assert.equal(getResumeIndex(output,items,identity),1);
    fs.appendFileSync(output,JSON.stringify({...items[1],input_index:1})+'\n');
    assert.equal(getResumeIndex(output,items,identity),2);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('retry flag revisits only zero-link not-found rows while preserving found rows',()=>{
  const items=[{searched_isbn:isbn},{searched_isbn:other},{searched_isbn:'9788131219409'}];
  const records=new Map([
    [0,{status:'found',google_links:[{url:'https://www.abebooks.com/book/1/bd'}]}],
    [1,{status:'not_found',google_links:[]}],
    [2,{status:'not_found',google_links:[]}]
  ]);
  assert.deepEqual(pendingIndexes(items,records,false),[]);
  assert.deepEqual(pendingIndexes(items,records,true),[1,2]);
  assert.equal(options(['test/data/abebooks-google/input-16.txt','--retry-zero-links']).retryZeroLinks,true);
});

test('only a valid Google challenge-clearance cookie is shared',()=>{
  const future=Date.now()/1000+3600;
  const cookie={name:'GOOGLE_ABUSE_EXEMPTION',domain:'.google.com',expires:future,value:'secret'};
  assert.deepEqual(clearanceCookieFrom([{name:'NID',domain:'.google.com',expires:future},cookie]),cookie);
  assert.equal(clearanceCookieFrom([{...cookie,expires:Date.now()/1000-1}]),null);
  assert.equal(clearanceCookieFrom([{...cookie,domain:'.other.com'}]),null);
  assert.equal(options(['test/data/abebooks-google/input-16.txt','--headless','--no-clearance-reuse']).reuseClearance,false);
});

test('Google clearance survives a restart in an ignored local session file',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abe-google-session-'));
  try {
    const file=path.join(dir,'google-clearance.json');
    const cookie={name:'GOOGLE_ABUSE_EXEMPTION',domain:'.google.com',path:'/',value:'local-token',expires:Date.now()/1000+3600,httpOnly:true,secure:true,sameSite:'Lax'};
    assert.equal(saveGoogleClearance(cookie,file),true);
    assert.deepEqual(loadGoogleClearance(file),cookie);
    assert.equal(fs.statSync(file).mode&0o777,0o600);
    assert.equal(loadGoogleClearance(file,Date.now()+7200_000),null);
    fs.writeFileSync(file,'{broken');
    assert.equal(loadGoogleClearance(file),null);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('closing a headed browser is treated as an interruption',()=>{
  assert.equal(isBrowserClosedError(new Error('page.waitForTimeout: Target page, context or browser has been closed')),true);
  assert.equal(isBrowserClosedError(new Error('Google navigation timed out')),false);
});

test('headed page creation asks Chromium to keep the new context in the background',async()=>{
  let ids=[],targetOptions;
  const page={url:()=> 'about:blank'};
  const context={waitForEvent:async()=>page,newPage:async()=>{throw new Error('newPage would steal focus')},close:async()=>{}};
  const browser={newContext:async()=>{ids=['context-1'];return context}};
  const backgroundSession={send:async(method,options)=>{
    if(method==='Target.getBrowserContexts') return {browserContextIds:[...ids]};
    targetOptions=options;return {targetId:'target-1'};
  }};
  const created=await createContextPage(browser,{viewport:{width:1280,height:800}},{backgroundSession});
  assert.equal(created.page,page);
  assert.equal(created.context,context);
  assert.deepEqual(targetOptions,{url:'about:blank',browserContextId:'context-1',background:true,focus:false});
});

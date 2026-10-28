#!/usr/bin/env node
require('dotenv').config();
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');
const {readSearchTerms,readJsonLines,appendResult}=require('../../utils/file');
const {getResumeIndex}=require('../../utils/resume');
const {normalizeIsbn,isValidIsbn}=require('../atlanticbooks/core/isbn');
const {scrapeIsbn}=require('./core/flow');
const {createContextPage}=require('./core/backgroundPage');
const {DEFAULT_SESSION_FILE,clearanceCookieFrom,loadGoogleClearance,saveGoogleClearance}=require('./core/googleSession');
const {getRandomDelay}=require('../../utils/browser');

function options(argv) {
  const args=[...argv];const input=args.shift();if(!input || input.startsWith('--')) throw new Error('Usage: node scrapers/abebooks-google/abebooks-google-isbn.js input.txt [--headless] [--retry-zero-links] [--no-clearance-reuse] [--output results.jsonl]');
  let output=null,headless=false,retryZeroLinks=false,reuseClearance=true;
  while(args.length) {const flag=args.shift();if(flag==='--headless') headless=true;else if(flag==='--retry-zero-links') retryZeroLinks=true;else if(flag==='--no-clearance-reuse') reuseClearance=false;else if(flag==='--output' && args[0] && !args[0].startsWith('--')) output=args.shift();else throw new Error(`Unknown or incomplete option: ${flag}`);}
  const absolute=path.resolve(input);
  if(!fs.existsSync(absolute)) throw new Error(`Input file not found: ${absolute}`);
  if(!/\.(?:txt|jsonl?|ndjson)$/i.test(absolute)) throw new Error('Input must be TXT or JSON Lines.');
  const base=path.parse(absolute);
  return {input:absolute,headless,retryZeroLinks,reuseClearance,output:path.resolve(output || path.join('output/abebooks-google',base.name==='input'?path.basename(base.dir):base.name,'results.jsonl'))};
}
function itemsFrom(file) {
  const items=/\.txt$/i.test(file) ? readSearchTerms(file).map(searched_isbn=>({searched_isbn})) : readJsonLines(file);
  const seen=new Map();
  return items.map(item=>{const isbn=normalizeIsbn(item.searched_isbn||item.isbn);const count=(seen.get(isbn)||0)+1;seen.set(isbn,count);return {...item,searched_isbn:isbn || item.searched_isbn || item.isbn,input_occurrence:count};});
}
function identity(item) {return JSON.stringify([normalizeIsbn(item.searched_isbn||item.isbn),item.input_occurrence]);}
function currencyFor(listing) {
  if (!listing) return null;
  const price=String(listing.price||'');
  if (/\b(?:US\$|USD)\b/i.test(price) || /US\$/i.test(price)) return 'USD';
  if (/\b(?:GBP)\b|£/i.test(price)) return 'GBP';
  if (/\b(?:EUR)\b|€/i.test(price)) return 'EUR';
  if (/\b(?:CAD|C\$)\b/i.test(price)) return 'CAD';
  if (/\$/.test(price)) return 'USD';
  return null;
}
function saveJson(file,value) {fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file);}
function loadRecords(output,items) {
  const records=new Map();
  if(!fs.existsSync(output)) return records;
  for(const record of readJsonLines(output)) {
    const index=record.input_index;
    if(!Number.isInteger(index) || index<0 || index>=items.length || identity(record)!==identity(items[index])) throw new Error(`Output does not match input at saved index ${index}.`);
    records.set(index,record);
  }
  return records;
}
function pendingIndexes(items,records,retryZeroLinks=false) {
  return items.map((_,index)=>index).filter(index=>{
    const saved=records.get(index);
    return !saved || retryZeroLinks && saved.status==='not_found' && !saved.google_links?.length;
  });
}
function writeRecords(output,records) {
  const temp=`${output}.tmp`;
  fs.writeFileSync(temp,[...records.entries()].sort((a,b)=>a[0]-b[0]).map(([,record])=>JSON.stringify(record)).join('\n')+'\n');
  fs.renameSync(temp,output);
}
function isBrowserClosedError(error) {
  return /Target page, context or browser has been closed|Browser has been closed/i.test(error?.message||'');
}
async function scrapeWithContext(browser,isbn,{clientKey,clearanceCookie=null,onProgress=()=>{},allowManualChallenge=false,blockedScreenshotPath=null,backgroundSession=null}={}) {
  const settings={viewport:{width:1280,height:800}};
  if(clearanceCookie) settings.storageState={cookies:[clearanceCookie],origins:[]};
  const {context,page}=await createContextPage(browser,settings,{backgroundSession});
  try {
    const result=await scrapeIsbn(page,isbn,{clientKey,onProgress,allowManualChallenge});
    if(result.status==='blocked') {
      result.diagnostic_url=page.url();
      result.diagnostic_title=await page.title().catch(()=>null);
      if(blockedScreenshotPath) {
        try {await page.screenshot({path:blockedScreenshotPath});result.diagnostic_screenshot=blockedScreenshotPath;onProgress(`Blocked-page screenshot: ${blockedScreenshotPath}`);}
        catch(error) {onProgress(`Could not save blocked-page screenshot: ${error.message}`);}
      }
    }
    const cookies=await context.cookies('https://www.google.com');
    return {result,clearanceCookie:clearanceCookieFrom(cookies)};
  } finally {await context.close();}
}
async function run({input,output,headless,retryZeroLinks=false,reuseClearance=true}) {
  const items=itemsFrom(input);if(!items.length) throw new Error('Input contains no ISBNs.');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  getResumeIndex(output,items,identity);
  const records=loadRecords(output,items);
  const pending=pendingIndexes(items,records,retryZeroLinks);
  const pauseFile=output+'.pause.json';
  if(fs.existsSync(pauseFile)) {const pause=JSON.parse(fs.readFileSync(pauseFile));if(Date.parse(pause.resume_after)>Date.now()) {console.log(`Paused until ${pause.resume_after}. Output preserved.`);process.exitCode=3;return;}}
  if(!pending.length) {console.log(`All ${items.length} inputs already saved in ${output}.`);return;}
  let browser,backgroundSession,clearanceCookie=reuseClearance?loadGoogleClearance():null;
  function rememberClearance(cookie) {
    if(!reuseClearance || !cookie) return;
    const changed=!clearanceCookie || clearanceCookie.value!==cookie.value || clearanceCookie.expires!==cookie.expires;
    clearanceCookie=cookie;
    if(changed) {
      try {saveGoogleClearance(cookie);console.log(`Saved Google clearance profile: ${DEFAULT_SESSION_FILE}`);}
      catch(error) {console.warn(`Could not save Google clearance profile: ${error.message}`);}
    }
  }
  const stop={requested:false};const signal=()=>{stop.requested=true;console.log('Stopping after current ISBN.');};
  process.on('SIGINT',signal);process.on('SIGTERM',signal);
  try {
    browser=await chromium.launch({headless,args:['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled']});
    if(!headless) backgroundSession=await browser.newBrowserCDPSession();
    if(clearanceCookie) console.log(`Loaded Google clearance profile: ${DEFAULT_SESSION_FILE}`);
    console.log(`AbeBooks Google input: ${input}\nOutput: ${output}\nPending: ${pending.length}/${items.length}; starting at ${pending[0]+1}.`);
    for(const index of pending) {
      if(stop.requested) break;
      const item=items[index],isbn=normalizeIsbn(item.searched_isbn);
      let result;
      const progress=message=>console.log(`[${index+1}/${items.length}] ${message}`);
      try {
        if(!isbn || !isValidIsbn(isbn)) throw new Error('Invalid ISBN.');
        const activeClearance=reuseClearance?clearanceCookieFrom([clearanceCookie]):null;
        if(activeClearance) progress('Reusing saved Google challenge clearance in a fresh context.');
        const first=await scrapeWithContext(browser,isbn,{clientKey:process.env.CAP_SOLVER||null,clearanceCookie:activeClearance,onProgress:progress,allowManualChallenge:!headless,blockedScreenshotPath:`${output}.blocked-${index+1}.png`,backgroundSession});
        result=first.result;
        const usedClearance=!!activeClearance;
        rememberClearance(first.clearanceCookie);
        if(usedClearance && result.status==='not_found' && !result.google_links?.length) {
          progress('No AbeBooks links with shared Google clearance; checking once in a clean context.');
          const second=await scrapeWithContext(browser,isbn,{clientKey:process.env.CAP_SOLVER||null,onProgress:progress,allowManualChallenge:!headless,blockedScreenshotPath:`${output}.blocked-${index+1}.png`,backgroundSession});
          result=second.result;
          rememberClearance(second.clearanceCookie);
        }
      } catch(error) {
        if(stop.requested || isBrowserClosedError(error)) {
          console.log(`[${index+1}/${items.length}] Browser closed; pending ISBN ${isbn} was not saved.`);
          stop.requested=true;break;
        }
        if(error.code==='BACKGROUND_PAGE_FAILURE') {
          console.error(`[${index+1}/${items.length}] Could not open Chromium in the background: ${error.message}. Pending ISBN was not saved.`);
          process.exitCode=1;break;
        }
        result={status:'error',error:error.message,google_links:[],pages:[]};
      }
      const listings=result.pages.flatMap(source=>source.listings.map(listing=>({...listing,source_page_url:source.url,source_page_type:source.type,google_rank:source.google_rank})));
      if(result.status==='blocked') {
        const resume_after=new Date(Date.now()+30*60*1000).toISOString();
        appendResult(output+'.blocked.jsonl',{...item,input_index:index,...result,blocked_at:new Date().toISOString()});
        if(records.delete(index)) writeRecords(output,records);
        saveJson(pauseFile,{input_index:index,resume_after,reason:result.error});
        console.log(`[${index+1}/${items.length}] ${isbn}: Blocked (${result.error||'unknown reason'}). Pending input preserved; retry after ${resume_after}.`);
        process.exitCode=3;break;
      }
      const best=listings.find(listing=>listing.isbn_matched)||listings[0];
      const record={...item,input_index:index,scraped_at:new Date().toISOString(),store:'AbeBooks Google',status:result.status,
        found:listings.length>0,isbn_matched:listings.some(listing=>listing.isbn_matched),found_isbn:best?.found_isbn||null,
        isbn_match_source:best?.isbn_match_source||null,title:best?.title||null,author:best?.author||null,
        price:best?.price_num??null,currency:currencyFor(best),
        stock_status:result.status==='error'?'Error':!listings.length?'Not Found':best?.is_out_of_stock===true?'Out of Stock':best?.is_out_of_stock===false?'In Stock':'Unknown',google_url:result.google_url||null,
        google_links:result.google_links,pages:result.pages,listings,error:result.error||null};
      const hadRecord=records.has(index),hasLater=[...records.keys()].some(savedIndex=>savedIndex>index);
      records.set(index,record);
      if(hadRecord||hasLater) writeRecords(output,records);else appendResult(output,record);
      fs.rmSync(pauseFile,{force:true});
      console.log(`[${index+1}/${items.length}] ${isbn}: ${result.status} | ${listings.length} listing(s) | ${result.google_links.length} AbeBooks link(s)`);
      if(index!==pending.at(-1) && !stop.requested) await new Promise(resolve=>setTimeout(resolve,getRandomDelay(3000,6000)));
    }
  } finally {process.off('SIGINT',signal);process.off('SIGTERM',signal);await backgroundSession?.detach().catch(()=>{});await browser?.close();}
  if(stop.requested) process.exitCode=130;
  console.log(`Saved results: ${output}`);
}
if(require.main===module) {try{run(options(process.argv.slice(2))).catch(error=>{console.error(error.message);process.exitCode=1;});}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={options,itemsFrom,identity,pendingIndexes,clearanceCookieFrom,isBrowserClosedError,run};

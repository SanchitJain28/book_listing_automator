const cheerio=require('cheerio');
const {googleChallenge,hasOrganicResults}=require('./google');
const ENDPOINT='https://api.capsolver.com';
async function request(path, body, fetcher=fetch) {
  const response=await fetcher(ENDPOINT+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`CapSolver HTTP ${response.status}`);
  const data=await response.json();
  if (data.errorId || data.status==='failed') throw new Error(`CapSolver ${data.errorCode || 'task_failed'}`);
  return data;
}
async function solveRecaptcha({clientKey,websiteURL,websiteKey,recaptchaDataSValue=null,fetcher=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=90000,onProgress=()=>{}}) {
  if (!clientKey || !websiteKey) throw new Error('CapSolver key or reCAPTCHA site key is missing.');
  const task={type:'ReCaptchaV2TaskProxyLess',websiteURL,websiteKey};
  if (recaptchaDataSValue) task.recaptchaDataSValue=recaptchaDataSValue;
  onProgress(`Creating CapSolver reCAPTCHA v2 task${recaptchaDataSValue?' with Google data-s':''}.`);
  const created=await request('/createTask',{clientKey,task},fetcher);
  if (created.status==='ready' && created.solution?.gRecaptchaResponse) return created.solution.gRecaptchaResponse;
  if (!created.taskId) throw new Error('CapSolver did not return a task ID.');
  onProgress('CapSolver task created; waiting for a token.');
  const deadline=Date.now()+timeoutMs;
  let polls=0;
  while (Date.now()<deadline) {
    await sleep(2500);
    const result=await request('/getTaskResult',{clientKey,taskId:created.taskId},fetcher);
    if (result.status==='ready') {
      if (!result.solution?.gRecaptchaResponse) throw new Error('CapSolver returned no reCAPTCHA token.');
      onProgress('CapSolver token received.');
      return result.solution.gRecaptchaResponse;
    }
    polls++;
    if (polls%4===0) onProgress(`CapSolver is still processing (${Math.round((timeoutMs-(deadline-Date.now()))/1000)}s elapsed).`);
  }
  throw new Error('CapSolver task timed out.');
}
function recaptchaConfig(html) {
  const $=cheerio.load(html);
  const widget=$('[data-sitekey]').first();
  const direct=widget.attr('data-sitekey');
  let siteKey=direct || null;
  let dataS=widget.attr('data-s') || null;
  const callback=widget.attr('data-callback') || null;
  for (const frame of $('iframe[src*="recaptcha"]').toArray()) {
    try {
      const params=new URL($(frame).attr('src'),'https://www.google.com').searchParams;
      siteKey ||=params.get('k');
      dataS ||=params.get('s');
    } catch{}
  }
  return {siteKey,dataS,callback};
}
function recaptchaSiteKey(html) {return recaptchaConfig(html).siteKey;}
async function waitForManualClearance(page,onProgress=()=>{}, {timeoutMs=120000,sleep=ms=>page.waitForTimeout(ms)}={}) {
  onProgress('Check the headed browser and complete the Google challenge manually. Waiting up to 2 minutes.');
  const deadline=Date.now()+timeoutMs;
  let nextUpdate=Date.now()+15000;
  while(Date.now()<deadline) {
    await sleep(2000);
    try {
      const html=await page.content();
      if(!googleChallenge(html,page.url()) && (hasOrganicResults(html) || /no results found|did not match any documents/i.test(html))) {
        onProgress('Google challenge cleared manually.');
        return {solved:true};
      }
    } catch {} // A manual form submission may navigate between polls.
    if(Date.now()>=nextUpdate) {onProgress('Still waiting for manual Google challenge completion.');nextUpdate=Date.now()+15000;}
  }
  return {solved:false,reason:'Google challenge was not cleared manually within 2 minutes.'};
}
async function solveGoogleChallenge(page, html, clientKey, onProgress=()=>{}, solve=solveRecaptcha, {allowManual=false,manualWait=waitForManualClearance}={}) {
  const manualOrBlocked=reason=>allowManual ? manualWait(page,onProgress) : {solved:false,reason};
  let config=recaptchaConfig(html);
  if (!config.siteKey) {
    onProgress('Waiting for Google reCAPTCHA widget to render.');
    await page.waitForSelector('[data-sitekey], iframe[src*="recaptcha"]',{timeout:10000}).catch(()=>{});
    config=recaptchaConfig(await page.content());
  }
  const {siteKey,dataS,callback}=config;
  if (!siteKey) return manualOrBlocked('Google challenge has no supported reCAPTCHA v2 site key.');
  if (!clientKey) return manualOrBlocked('CAP_SOLVER is missing from .env.');
  let token;
  try { token=await solve({clientKey,websiteURL:page.url(),websiteKey:siteKey,recaptchaDataSValue:dataS,onProgress}); }
  catch(error) {onProgress(`CapSolver failed: ${error.message}`);return manualOrBlocked(error.message);}
  if (!/\/sorry(?:\/|\?)/i.test(page.url())) return {solved:true};
  onProgress('Submitting token to Google.');
  const submitted=await page.evaluate(({value,callbackName})=>{
    const form=document.querySelector('#captcha-form,form[action*="sorry"],form[action*="recaptcha"],form');
    if (!form) return false;
    let field=form.querySelector('[name="g-recaptcha-response"]');
    if (!field) { field=document.createElement('textarea');field.name='g-recaptcha-response';form.appendChild(field); }
    field.value=value;
    const namedCallback=/^[A-Za-z_$][\w$]*$/.test(callbackName||'') ? window[callbackName] : null;
    setTimeout(()=>{
      if (typeof namedCallback==='function') namedCallback(value);
      else form.submit();
    },0);
    return true;
  },{value:token,callbackName:callback});
  if (!submitted) return manualOrBlocked('Google challenge form was not found.');
  const navigated=await page.waitForURL(url=>!/\/sorry(?:\/|\?)/i.test(url.toString()),{timeout:20000}).then(()=>true,()=>false);
  await page.waitForLoadState('domcontentloaded',{timeout:20000}).catch(()=>{});
  if (!navigated) return manualOrBlocked('Google did not leave its challenge page after token submission.');
  onProgress('Google challenge cleared.');
  return {solved:true};
}
module.exports={solveRecaptcha,recaptchaSiteKey,recaptchaConfig,waitForManualClearance,solveGoogleChallenge};

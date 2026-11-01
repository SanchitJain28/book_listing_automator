import fs from 'node:fs/promises';
import path from 'node:path';
import { getConnectionPool } from './vpsConnectionPool.js';
import { VpsLiveService } from './vpsLiveService.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export function serversFromInfo(contents) {
  return [...contents.matchAll(/^##\s+VPS\s+(\d+)\s*$([\s\S]*?)(?=^##\s+VPS\s+\d+\s*$|$(?![\s\S]))/gim)].map(match => {
    const ip = match[2].match(/^\s*-\s*IP\s*:\s*([^\s]+)\s*$/im)?.[1];
    const password = match[2].match(/^\s*-\s*PASSWORD\s*:\s*(.*?)\s*$/im)?.[1]?.replace(/^`|`$/g, '');
    if (!ip || !password || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) || ip.split('.').some(n => Number(n)>255)) return null;
    return { id: match[1], name: `VPS ${match[1]}`, ip, password };
  }).filter(Boolean);
}
export async function remoteOperation(root, server, request) {
  const source = await fs.readFile(path.join(root, 'scripts/vps-status/manager.py'), 'utf8');
  const runtime = await fs.readFile(path.join(root, 'utils/runtimeObserver.cjs'), 'utf8');
  const sink = await fs.readFile(path.join(root, 'utils/consoleSink.py'), 'utf8');
  const events = await fs.readFile(path.join(root, 'utils/jobEvents.js'), 'utf8');
  const payload = Buffer.from(JSON.stringify(request)).toString('base64url');
  const prefix = `RUNTIME_SOURCE = ${JSON.stringify(runtime)}\nEVENTS_SOURCE = ${JSON.stringify(events)}\nSINK_SOURCE = ${JSON.stringify(sink)}\nSERVER_ID = ${JSON.stringify(String(server.id))}\n`;
  const { stdout, code } = await getConnectionPool().exec(server, `python3 - ${payload}`, prefix + source);
  let result;
  try { result = JSON.parse(stdout); } catch { throw new Error(`VPS returned an invalid response (exit ${code}). Refresh status before retrying an action.`); }
  if (!result.ok) throw new Error(result.error || 'VPS management operation failed.');
  return result.result;
}

export function vpsManagerMiddleware(root, operate = remoteOperation, live = null) {
  let busy = new Set();
  return async (req,res,next) => {
    const url = new URL(req.url, 'http://localhost');
    if (!['/api/vps-manager','/api/vps-events'].includes(url.pathname)) return next();
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const host=req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin && req.headers.origin!==`http://${host}`)) throw Object.assign(new Error('Only the local dashboard can use VPS management.'),{status:403});
      const servers=serversFromInfo(await fs.readFile(path.join(root,'VPSInfo.md'),'utf8'));
      if(url.pathname==='/api/vps-events') {
        if(req.method!=='GET'||!live) throw new Error('Live monitoring is unavailable.');
        return await live.stream(req,res,servers,url);
      }
      if(req.method==='GET' && !url.search) return res.end(JSON.stringify({servers:servers.map(({id,name})=>({id,name}))}));
      if(req.method!=='POST' || url.search || req.headers.origin!==`http://${host}` || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Use the local dashboard to submit this request.'),{status:403});
      let raw='';for await (const chunk of req){raw+=chunk;if(raw.length>8192) throw Object.assign(new Error('Request too large.'),{status:413});}
      const body=JSON.parse(raw); const server=servers.find(s=>s.id===String(body.server));
      if(!server || !['status','files','sync','launch','stop','resume','retry','clear-pause','logs','activity'].includes(body.op)) throw Object.assign(new Error('Invalid server or operation.'),{status:400});
      const mutation=!['status','files','logs','activity'].includes(body.op);
      if(mutation && busy.has(server.id)) throw Object.assign(new Error('Another operation is already running for this VPS.'),{status:409});
      const request={op:body.op};
      if(body.op==='files') request.folder=body.folder;
      if(body.op==='launch') {request.input=body.input;request.scraper=body.scraper;}
      if(['stop','resume','retry','clear-pause','logs'].includes(body.op)) {
        if(typeof body.job!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.job))throw Object.assign(new Error('Choose a listed scraper job.'),{status:400});
        request.job=body.job;
      }
      if(body.op==='retry'||body.op==='clear-pause'||body.op==='logs') {
        if(typeof body.scraper!=='string'||!/^[-a-z0-9]{1,64}$/.test(body.scraper))throw Object.assign(new Error('Choose a scraper in this job.'),{status:400});
        request.scraper=body.scraper;
      }
      if(body.op==='logs') {
        if(!['auto','events','console'].includes(body.source||'auto') || body.cursor && (typeof body.cursor!=='string'||body.cursor.length>1024)) throw new Error('Invalid log request.');
        if(body.attempt && (typeof body.attempt!=='string'||!/^[\w-]{1,100}$/.test(body.attempt)))throw new Error('Invalid attempt.');
        request.source=body.source||'auto';request.cursor=body.cursor||null;request.attempt=body.attempt||'current';
      }
      if(mutation) busy.add(server.id);
      try {
        if(body.op==='status'&&body.reconnect===true&&live)getConnectionPool().reset(server);
        if(body.op==='sync' || body.op==='launch') { const {stdout}=await exec('git',['rev-parse','HEAD'],{cwd:root,timeout:5000}); request.commit=stdout.trim(); }
        res.end(JSON.stringify(live ? await live.run(server,request,body.op==='status') : await operate(root,server,request)));} finally {if(mutation) busy.delete(server.id);}
    } catch(error) {res.statusCode=error.status || 400;res.end(JSON.stringify({error:error.message || 'VPS operation failed.'}));}
  };
}
export function vpsManagerPlugin(root) {
  function install(server) {
    const pool=getConnectionPool();
    const live=new VpsLiveService(root,remoteOperation,id=>pool.state(id));
    const previous=pool.onState;
    pool.onState=(id,state)=>{previous(id,state);live.connectionChanged(id,state); if(state.state==='Connected'||state.error) { fs.readFile(path.join(root,'VPSInfo.md'),'utf8').then(text=>{const target=serversFromInfo(text).find(s=>s.id===id);if(target)return live.record(target,'connection',state.error||state.state,state.error?'warn':'info');}).catch(()=>{}); }};
    server.middlewares.use(vpsManagerMiddleware(root,remoteOperation,live));
    server.httpServer?.once('close',()=>{live.close();pool.close();});
  }
  return {name:'local-vps-manager',configureServer:install,configurePreviewServer:install};
}

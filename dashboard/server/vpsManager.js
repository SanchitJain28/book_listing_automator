import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
function safeError(message, code) {
  if (/host key verification failed|authenticity of host/i.test(message)) return 'SSH host key is not trusted. Verify it in your terminal first.';
  if (/permission denied|password/i.test(message) || code === 5) return 'SSH authentication failed.';
  return 'Could not connect to the VPS or execute the management operation.';
}
export async function remoteOperation(root, server, request) {
  const source = await fs.readFile(path.join(root, 'scripts/vps-status/manager.py'), 'utf8');
  const payload = Buffer.from(JSON.stringify(request)).toString('base64url');
  const executable = ['/opt/homebrew/bin/sshpass', '/usr/local/bin/sshpass', '/usr/bin/sshpass'].find(p => { try { return requireAccess(p); } catch { return false; } }) || 'sshpass';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-e', 'ssh', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=10', '-o', 'NumberOfPasswordPrompts=1', `root@${server.ip}`, `python3 - ${payload}`], { env: { ...process.env, SSHPASS: server.password }, stdio: ['pipe', 'pipe', 'pipe'] });
    let output='', error='', done=false;
    const finish=(err,value)=>{if(done)return;done=true;clearTimeout(timer);err?reject(err):resolve(value);};
    const timer=setTimeout(()=>{child.kill('SIGKILL');finish(new Error('VPS request timed out. Check the job status before retrying a launch.'));}, 120000);
    child.on('error',()=>finish(new Error('Could not start sshpass or SSH.'))); child.stdin.on('error',()=>{});
    child.stdout.on('data', data=>{output+=data;if(output.length>3_000_000){child.kill();finish(new Error('VPS response exceeded the size limit.'));}});
    child.stderr.on('data',data=>{if(error.length<2000) error+=data;});
    child.on('close',code=>{try { const result=JSON.parse(output); if(!result.ok) return finish(new Error(result.error));finish(null,result.result); } catch {finish(new Error(safeError(error,code)));}});
    child.stdin.end(source);
  });
}
import { accessSync, constants } from 'node:fs';
function requireAccess(p) { accessSync(p, constants.X_OK); return true; }

export function vpsManagerMiddleware(root, operate = remoteOperation) {
  let busy = new Set();
  return async (req,res,next) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/vps-manager') return next();
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      const host=req.headers.host || '';
      if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) || req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin && req.headers.origin!==`http://${host}`)) throw Object.assign(new Error('Only the local dashboard can use VPS management.'),{status:403});
      const servers=serversFromInfo(await fs.readFile(path.join(root,'VPSInfo.md'),'utf8'));
      if(req.method==='GET' && !url.search) return res.end(JSON.stringify({servers:servers.map(({id,name})=>({id,name}))}));
      if(req.method!=='POST' || url.search || req.headers.origin!==`http://${host}` || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Use the local dashboard to submit this request.'),{status:403});
      let raw='';for await (const chunk of req){raw+=chunk;if(raw.length>8192) throw Object.assign(new Error('Request too large.'),{status:413});}
      const body=JSON.parse(raw); const server=servers.find(s=>s.id===String(body.server));
      if(!server || !['status','files','sync','launch','stop','resume','retry','clear-pause'].includes(body.op)) throw Object.assign(new Error('Invalid server or operation.'),{status:400});
      if(busy.has(server.id)) throw Object.assign(new Error('Another operation is already running for this VPS.'),{status:409});
      const request={op:body.op};
      if(body.op==='files') request.folder=body.folder;
      if(body.op==='launch') {request.input=body.input;request.scraper=body.scraper;}
      if(['stop','resume','retry','clear-pause'].includes(body.op)) {
        if(typeof body.job!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.job))throw Object.assign(new Error('Choose a listed scraper job.'),{status:400});
        request.job=body.job;
      }
      if(body.op==='retry'||body.op==='clear-pause') {
        if(typeof body.scraper!=='string'||!/^[-a-z0-9]{1,64}$/.test(body.scraper))throw Object.assign(new Error('Choose a scraper in this job.'),{status:400});
        request.scraper=body.scraper;
      }
      if(body.op==='sync' || body.op==='launch') { const {stdout}=await exec('git',['rev-parse','HEAD'],{cwd:root,timeout:5000}); request.commit=stdout.trim(); }
      busy.add(server.id);
      try {res.end(JSON.stringify(await operate(root,server,request)));} finally {busy.delete(server.id);}
    } catch(error) {res.statusCode=error.status || 400;res.end(JSON.stringify({error:error.message || 'VPS operation failed.'}));}
  };
}
export function vpsManagerPlugin(root) { return {name:'local-vps-manager',configureServer(s){s.middlewares.use(vpsManagerMiddleware(root));},configurePreviewServer(s){s.middlewares.use(vpsManagerMiddleware(root));}}; }

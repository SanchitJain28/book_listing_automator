import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { serversFromInfo, vpsManagerMiddleware } from './vpsManager.js';

test('server discovery only returns configured valid hosts and keeps passwords internal', () => {
  const data=serversFromInfo('## VPS 1\n- IP : 192.0.2.1\n- PASSWORD : `test`\n## VPS 2\n- IP : 999.0.0.1\n- PASSWORD : test\n');
  assert.equal(data.length,1);assert.equal(data[0].id,'1');assert.equal(data[0].password,'test');
});

test('management endpoint enforces local same-origin JSON and selects only configured targets', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vps-manager-'));
  try {
    fs.writeFileSync(path.join(dir,'VPSInfo.md'),'## VPS 1\n- IP : 192.0.2.1\n- PASSWORD : hidden\n');
    const calls=[];const handler=vpsManagerMiddleware(dir,async (root,server,request)=>{calls.push({server,request});return {works:true};});
    async function request(method,body,headers={}) {
      const req=Readable.from(body?[JSON.stringify(body)]:[]); Object.assign(req,{url:'/api/vps-manager',method,headers:{host:'127.0.0.1:5176',...headers}});
      const res={statusCode:200,setHeader(){},end(value){this.body=JSON.parse(value)}};await handler(req,res,()=>{});return res;
    }
    const list=await request('GET');assert.deepEqual(list.body.servers,[{id:'1',name:'VPS 1'}]);assert.equal(JSON.stringify(list.body).includes('hidden'),false);
    assert.equal((await request('POST',{server:'1',op:'launch'},{'content-type':'application/json'})).statusCode,403);
    assert.equal((await request('POST',{server:'1',op:'status'},{origin:'https://evil.example','content-type':'application/json'})).statusCode,403);
    const headers={origin:'http://127.0.0.1:5176','content-type':'application/json'};
    assert.equal((await request('POST',{server:'2',op:'status'},headers)).statusCode,400);
    assert.equal((await request('POST',{server:'1',op:'status',host:'198.51.100.2'},headers)).statusCode,200);
    assert.deepEqual(calls[0].request,{op:'status'});assert.equal(calls[0].server.ip,'192.0.2.1');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

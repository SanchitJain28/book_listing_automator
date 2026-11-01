"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { BATCHES, runSequence, scope, complete } = require("../scripts/keepa-batches.cjs");
const collector = path.resolve(__dirname, "../keepa_collect.js");

function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keepa-batch-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test("collector uses exact API bounds, ISBN checksums, and preserves price drift", t => {
  for (const [index, batch] of BATCHES.entries()) {
    const dir = temp(t);
    const harness = `
      const fs = require('node:fs');
      global.fetch = async (url) => {
        const u = new URL(url);
        let data;
        if(u.pathname === '/query') {
          fs.appendFileSync('queries.jsonl', JSON.stringify(JSON.parse(u.searchParams.get('selection'))) + '\\n');
          data = { totalResults: 4, asinList: ['9359178675','0281054169','1409435636','9359178676'] };
        } else {
          const prices = [120000,120400,160000];
          const asins = u.searchParams.get('asin').split(',');
          if(asins.includes('9359178676')) throw new Error('Invalid ISBN was looked up');
          data = {products: asins.map((asin,i)=>{const current=Array(34).fill(-1);current[1]=prices[i];return {asin,title:'Test',stats:{current}};})};
        }
        return {status:200,ok:true,json:async()=>({...data,tokensLeft:3000,tokensConsumed:1})};
      };
      require(${JSON.stringify(collector)});
    `;
    const result = spawnSync(process.execPath, ["-e", harness], { cwd: dir, encoding: "utf8", env: { ...process.env, ...batch.env, STRICT_ISBN: "1", KEEPA_API_KEY: "test-only", KEEPA_API_KEY_2: "", MAX_MINUTES: "0" }, timeout: 15000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const queries = fs.readFileSync(path.join(dir, "queries.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    for (const q of queries) {
      assert.equal(q.current_BUY_BOX_SHIPPING_gte, 1);
      assert.equal(q.current_NEW_lte, index ? 159999 : 119999);
      assert.equal(q.current_NEW_gte, index ? 120001 : 1);
      if(index) assert.equal(q.hasReviews, false);
      else { assert.equal(q.current_COUNT_REVIEWS_gte, 21); assert.equal(q.current_COUNT_REVIEWS_lte, undefined); }
    }
    const summary = JSON.parse(fs.readFileSync(path.join(dir, "collect_summary.json")));
    assert.equal(summary.complete, true);
    assert.equal(summary.booksWritten, 3);
    const lines = fs.readFileSync(path.join(dir, "books.csv"), "utf8").trim().split("\n").map(l=>l.split(','));
    const header = lines.shift();
    const priceColumn = header.indexOf("price_filter");
    const reviewColumn = header.indexOf("review_count");
    const flags = lines.map(row=>row[priceColumn]);
    assert.deepEqual(flags, index ? ["low_price","within_limit","high_price"] : ["high_price","high_price","high_price"]);
    assert.ok(lines.every(row => row[reviewColumn] === ""));
  }
});

function fakeCollector(root, failFirst = false) {
  fs.writeFileSync(path.join(root, "keepa_collect.js"), `
    const fs=require('fs'),path=require('path');
    fs.appendFileSync(path.join('..','order.txt'), process.env.PASS+'\\n');
    const scope={reviewMin:Number(process.env.REVIEW_MIN),reviewMax:process.env.REVIEW_MAX==='none'?null:Number(process.env.REVIEW_MAX),onlyPass:Number(process.env.PASS),priceAbove:process.env.PRICE_ABOVE?Number(process.env.PRICE_ABOVE):null,priceBelow:Number(process.env.PRICE_BELOW),strictIsbn:true};
    const success=${!failFirst} || process.env.PASS!=='1';
    fs.writeFileSync('.collect_checkpoint.json',JSON.stringify({scope,passIndex:success?1:0,stack:success?[]:[[0,1]],pending:[],booksWritten:5}));
    fs.writeFileSync('collect_summary.json',JSON.stringify({scope,complete:success,endedOnError:success?null:'test failure'}));
  `);
}
test("sequence runs in order and a rerun skips completed batches", async t => {
  const root = temp(t); fakeCollector(root);
  await runSequence(root);
  assert.equal(fs.readFileSync(path.join(root,"order.txt"),"utf8"), "1\n2\n");
  assert.ok(BATCHES.every(batch=>complete(root,batch)));
  await runSequence(root);
  assert.equal(fs.readFileSync(path.join(root,"order.txt"),"utf8"), "1\n2\n");
});
test("incomplete first batch prevents second from starting", async t => {
  const root = temp(t); fakeCollector(root,true);
  await assert.rejects(runSequence(root), /Next batch was not started/);
  assert.equal(fs.readFileSync(path.join(root,"order.txt"),"utf8"), "1\n");
  assert.equal(fs.existsSync(path.join(root,BATCHES[1].id)), false);
});
test("completion requires the expected scope", t => {
  const root = temp(t), batch = BATCHES[0], dir = path.join(root,batch.id);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,"collect_summary.json"),JSON.stringify({complete:true,scope:scope(batch)}));
  fs.writeFileSync(path.join(dir,".collect_checkpoint.json"),JSON.stringify({scope:{...scope(batch),reviewMin:1},passIndex:1,stack:[],pending:[]}));
  assert.equal(complete(root,batch), false);
});

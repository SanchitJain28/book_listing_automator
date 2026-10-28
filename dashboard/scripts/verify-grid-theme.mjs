import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{host:'127.0.0.1',port:0},clearScreen:false});
let browser;
const counts={matched:21,blocked:1,errors:2,not_listed:60,in_stock:4};
const platforms=['atlanticbooks','bookswagon','flipkart'];
const states=['Blocked','Running','Stopped'];
const jobs=platforms.map((scraper,index)=>({id:scraper,control_id:scraper,scraper,state:states[index],input:'input-data/test.txt',output:'output/test.jsonl',processed:100,total:200,matched:21,blocked:1,errors:2,can_stop:index<2,can_resume:index===2,can_retry:index===0,can_clear_pause:index===0,shared:false}));
const processes=[{pid:123,parent_pid:1,name:'node',rss_bytes:1024**3,memory_percent:5,scraper:'bookswagon'}];
const monitor={checked_at:new Date().toISOString(),scrapers:jobs.map(job=>({...job,name:job.scraper,counts,statuses:{'In stock':4},session:'theme-fixture',last_updated:new Date().toISOString()})),process_count:1,processes,memory:{},scraper_groups:[]};

async function checkGrids(page,label) {
  const grids=await page.locator('.MuiDataGrid-root').evaluateAll(elements=>elements.map(grid=>{
    const value=element=>element?{color:getComputedStyle(element).color,bg:getComputedStyle(element).backgroundColor}:null;
    return {root:value(grid),header:value(grid.querySelector('.MuiDataGrid-columnHeader')),title:value(grid.querySelector('.MuiDataGrid-columnHeaderTitle')),
      cell:value(grid.querySelector('.MuiDataGrid-cell')),text:[...grid.querySelectorAll('.MuiDataGrid-cell .MuiTypography-root')].map(value),
      footer:value(grid.querySelector('.MuiDataGrid-footerContainer')),sort:value(grid.querySelector('.MuiDataGrid-sortButton'))};
  }));
  assert.ok(grids.length,`${label}: no grids rendered`);
  const rgb=color=>color.match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
  for(const grid of grids) {
    assert.deepEqual(rgb(grid.root.bg),[34,34,34],`${label}: grid background`);
    assert.deepEqual(rgb(grid.root.color),[237,237,237],`${label}: grid text`);
    for(const part of [grid.header,grid.footer,grid.sort].filter(Boolean)) assert.ok(Math.max(...rgb(part.bg))<80,`${label}: light grid surface ${part.bg}`);
    for(const part of [grid.title,grid.cell,...grid.text].filter(Boolean)) assert.ok(Math.max(...rgb(part.color))>=150,`${label}: unreadable dark text ${part.color}`);
  }
}

try {
  await server.listen();
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/vps-manager',route=>route.fulfill({json:route.request().method()==='GET'?{servers:[{id:'6',name:'VPS 6'}]}:{jobs,processes,process_count:1,memory:{MemAvailable:10*1024**3,MemTotal:16*1024**3,SwapTotal:0,SwapFree:0},git:{branch:'main',commit:'a'.repeat(40)},sessions:[]}}));
  await page.route('**/api/vps-status',route=>route.fulfill({json:monitor}));
  const address=server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.getByRole('button',{name:'VPS',exact:true}).click();
  await page.getByRole('button',{name:'Connect / refresh',exact:true}).click();
  await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
  await page.getByRole('button',{name:'Show processes',exact:true}).click();
  await page.getByRole('button',{name:'View existing VPS 6 batch',exact:true}).click();
  await page.getByRole('button',{name:'View processes',exact:true}).click();
  await page.locator('.MuiDataGrid-root').nth(3).waitFor();
  for(const scheme of ['light','dark']) {await page.emulateMedia({colorScheme:scheme});await checkGrids(page,`VPS ${scheme}`);}
  const running=page.locator('.MuiChip-root').filter({hasText:/^Running$/}).first();
  const blocked=page.locator('.MuiChip-root').filter({hasText:/^Blocked$/}).first();
  assert.equal(await running.evaluate(el=>getComputedStyle(el).color),'rgb(155, 225, 181)');
  assert.equal(await blocked.evaluate(el=>getComputedStyle(el).color),'rgb(255, 178, 166)');
  assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).evaluate(el=>getComputedStyle(el).color),'rgb(155, 225, 181)');
  const screenshot=path.join(os.tmpdir(),'dashboard-vps-dark-grids.png');await page.screenshot({path:screenshot,fullPage:true});
  await page.getByRole('heading',{name:'Scraper jobs',exact:true}).locator('..').locator('..').screenshot({path:path.join(os.tmpdir(),'dashboard-vps-jobs-dark.png')});
  await page.getByRole('heading',{name:'Scrapers',exact:true}).locator('..').locator('..').locator('..').screenshot({path:path.join(os.tmpdir(),'dashboard-vps-monitor-dark.png')});
  await page.getByRole('button',{name:'Output explorer',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'theme-fixture.jsonl',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({searched_isbn:'9780091884970',title:'Theme fixture',found:true,isbn_matched:true,stock_status:'In Stock',price:12}))});
  await page.getByRole('gridcell').filter({hasText:'Theme fixture'}).first().waitFor();
  await checkGrids(page,'output explorer');
  assert.deepEqual(errors,[]);
  console.log(`PASS: all five dashboard grids stay dark with readable text; running/resume are green and blocked is red. Screenshot: ${screenshot}`);
} finally {await browser?.close();await server.close();}

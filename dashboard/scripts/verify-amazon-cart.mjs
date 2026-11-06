import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, configFile: path.join(root, 'vite.config.js'), cacheDir: path.join(root, 'node_modules/.vite-verify-amazon'), server: { host: '127.0.0.1', port: 0 }, clearScreen: false });
let browser;
const tab = { file: 'books.json', name: 'ZB346+ZB346B_2NOV_UNDER3_POD_NOPUB', total: 2401, cursor: 17, startRow: 902 };
let version = 1, session = null;
const requests = [];
const offer = { candidateAsin: '1905721005', candidateTitle: '100 Key Clinical Trials: Diabetes and Cardiovascular Disease', candidateFormat: 'Paperback', seller: 'J B Books Sellers & Distributors', condition: 'Used', conditionDetail: 'Used - Good', source: 'sidebar_offer_1', offerIndex: 0, itemPrice: 595, shippingFee: 0, totalPrice: 595, effectivePrice: 595, score: 1, deliveryDays: 9, deliveryDateFormatted: '14 November', deliveryPenalty: 0, isQualified: true, identityVerified: true, identityMethod: 'TITLE', titleCheck: { isMatching: true, reason: 'Same work and volume; publisher and binding changes are allowed.' } };
const book = { title: '100 Key Clinical Trials: Diabetes and Cardiovascular Disease', isbn: '9781850092780', amazonIsbn: '9781905721009', sheetRowNumber: 907, index: 902, total: 2401, batchNumber: 18, targetPrice: 1022, sellPrice: 1278, rowColor: 'yellow' };
const evaluation = { isbn: book.isbn, sheetRowNumber: 907, expectedTitle: book.title, status: 'QUALIFIED', reason: 'ALL RULES PASSED', chosenOffer: offer, evaluatedOffers: [offer, { ...offer, seller: 'Cocoblu Retail', condition: 'New', conditionDetail: 'New', source: 'sidebar_pinned', offerIndex: undefined, itemPrice: 1022, totalPrice: 1022, effectivePrice: 1022, score: .58 }], identityChecks: [offer, { ...offer, candidateAsin: '1850092788', identityMethod: 'ISBN', titleCheck: null }] };
function prompt(kind, id, defaultValue = '') { session.prompt = { id: `${session.id}:${id}`, kind, defaultValue }; session.status = 'waiting'; }
function showBook() { session.book = book; session.evaluation = evaluation; prompt('feedback', 'feedback'); }
try {
  await vite.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  await page.route('**/api/amazon-cart', async route => {
    const body = route.request().postDataJSON();
    if (body) {
      requests.push(body); version++;
      if (body.op === 'start') {
        session = { id: 'fixture-session', profile: body.profile, mode: body.mode, tabName: tab.name, status: 'starting', phase: 'Opening browser',
          configuration: { total: 2401, startIndex: 896, startRow: 902, batchLimit: 50, batchNumber: 18, pacingSeconds: 30 },
          account: { signedIn: true, greeting: 'Hello, Fixture reader' }, records: [], logs: [], added: 0, processed: 0, review: 0, batchAdded: 0 };
        prompt(body.mode === 'login' ? 'continue' : 'command', 'menu');
      } else if (body.op === 'reply') {
        if (session.prompt.kind === 'command') showBook();
        else if (session.prompt.kind === 'feedback') prompt('add', 'add', 'YES');
        else if (session.prompt.kind === 'add') {
          session.added++; session.processed++; session.batchAdded++;
          session.evaluation = { ...evaluation, cartAddedSuccess: true };
          session.records = [{ isbn: book.isbn, sheetRowNumber: 907, expectedTitle: book.title, cartAddedSuccess: true, timestamp: new Date().toISOString() }];
          session.logs = [{ id: 'line1', message: 'Amazon confirmed the selected used-copy addition.', level: 'info' }, { id: 'line2', message: '<script>window.evil = true</script>', level: 'warning' }];
          prompt('next', 'next');
        } else if (session.prompt.kind === 'continue') { session.prompt = null; session.status = 'completed'; }
        else { session.prompt = null; session.status = 'running'; session.phase = 'Searching next book'; }
      } else if (body.op === 'pause') session.status = 'paused';
      else if (body.op === 'resume') session.status = 'running';
      else if (body.op === 'stop') { session.status = 'stopped'; session.prompt = null; }
    }
    return route.fulfill({ json: { tabs: [tab], version, session } });
  });
  await page.route('**/api/amazon-cart/events', route => route.fulfill({ contentType: 'text/event-stream', body: `retry: 60000\nevent: snapshot\ndata: ${JSON.stringify({ version, session, padding: 'x'.repeat(75000) })}\n\n` }));
  await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/#amazon`);
  await page.getByRole('heading', { name: 'Every offer. A clearer decision.' }).waitFor();
  await page.getByRole('button', { name: 'Open session', exact: true }).waitFor();
  await page.getByText('Live updates · every 2s', { exact: true }).waitFor();
  await page.getByLabel('Cursor', { exact: true }).fill('17');
  await page.getByRole('button', { name: 'Open session', exact: true }).click();
  await page.getByRole('button', { name: 'Start processing', exact: true }).click();
  await page.getByRole('table', { name: 'Amazon offer comparison' }).waitFor();
  await page.getByText(offer.titleCheck.reason, { exact: true }).waitFor();
  await page.getByText('9781850092780', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(os.tmpdir(), 'amazon-dashboard-desktop.png'), fullPage: true });
  await page.getByLabel('Feedback (optional)').fill('Reviewed the title and seller.');
  await page.getByRole('button', { name: 'Continue to cart decision', exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('button', { name: 'Next book', exact: true }).waitFor();
  assert.equal(requests.filter(r => r.op === 'start').length, 1);
  assert.equal(requests.at(-1).value, 'YES');
  const countBeforeReload = requests.length;
  await page.reload(); await page.getByRole('button', { name: 'Next book', exact: true }).waitFor();
  assert.equal(requests.length, countBeforeReload, 'reload must not replay a reply');
  await page.getByText('Live activity', { exact: true }).click();
  await page.getByText('<script>window.evil = true</script>', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.evil), undefined);
  await page.getByRole('button', { name: 'Next book', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(os.tmpdir(), 'amazon-dashboard-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'mobile viewport must not overflow');
  await page.getByRole('button', { name: 'Stop session', exact: true }).click();
  await page.getByRole('dialog', { name: 'Stop this Amazon session?' }).getByRole('button', { name: 'Stop session', exact: true }).click();
  await page.getByRole('button', { name: 'Open session', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Mode', exact: true }).click();
  await page.getByRole('option', { name: 'Auto mode', exact: true }).click();
  await page.getByRole('button', { name: 'Open session', exact: true }).click();
  await page.getByRole('dialog', { name: 'Start automatic cart additions?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(requests.filter(r => r.op === 'start').length, 1, 'cancelling auto mode must not launch');
  await page.getByRole('button', { name: 'Sign in to this profile', exact: true }).click();
  await page.getByRole('button', { name: 'I have signed in · continue', exact: true }).click();
  assert.equal(requests.at(-2).mode, 'login');
  assert.deepEqual(errors, []);
  console.log('PASS: Amazon navigation, session configuration, manual decisions, offer comparison, Gemini reasons, reload recovery, pause/resume, stop, sign-in, auto confirmation, large/closed SSE fallback, and responsive layouts. No live account actions.');
} finally { await browser?.close(); await vite.close(); }

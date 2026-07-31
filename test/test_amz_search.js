const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.amazon.com/s?k=9780008501822');
  const urls = await page.evaluate(() => Array.from(document.querySelectorAll('.s-result-item a.a-link-normal.s-no-outline')).map(a => a.href));
  console.log(urls[0]);
  await browser.close();
})();

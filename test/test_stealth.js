const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.google.com/search?q=9780008501822+site%3Aamazon.com');
  const title = await page.title();
  console.log(title);
  await browser.close();
})();

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://html.duckduckgo.com/html/?q=9780008501822+site%3Aamazon.com');
  console.log(await page.content());
  await browser.close();
})();

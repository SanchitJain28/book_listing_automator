const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://www.bing.com/search?q=9780008501822+site%3Aamazon.com');
  const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('amazon.com') && !h.includes('bing.com')));
  console.log(urls.slice(0, 5));
  await browser.close();
})();

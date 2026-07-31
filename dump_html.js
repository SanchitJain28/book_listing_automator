const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://www.amazon.in/s?k=Manohar+Publishers+history", { waitUntil: "domcontentloaded", timeout: 60000 });
  const html = await page.content();
  require("fs").writeFileSync("page_dump.html", html);
  await browser.close();
})();

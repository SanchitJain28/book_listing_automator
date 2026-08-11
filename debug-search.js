const { initBrowser } = require('./utils/browser');

(async () => {
    const { context, page } = await initBrowser(true);
    await page.goto('https://www.amazon.in/s?k=9780979898303');
    await page.waitForTimeout(5000);
    const html = await page.content();
    require('fs').writeFileSync('search-debug.html', html);
    await context.close();
})();

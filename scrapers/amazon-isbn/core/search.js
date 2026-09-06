const { checkDogPage } = require("../../../utils/amazon");

/**
 * Searches Amazon for an ISBN and navigates to the first product (/dp/) result.
 * @param {import('playwright').Page} page
 * @param {string} isbn
 * @returns {Promise<{ found: boolean, productUrl: string|null }>}
 */
async function searchAmazonForIsbn(page, isbn) {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(isbn)}`;

  await page.goto(searchUrl, {
    timeout: 15000,
    waitUntil: "domcontentloaded",
  });

  let isDogPage = await checkDogPage(page);
  if (isDogPage) {
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  // Get first search result link with /dp/
  const firstResult = await page.$(
    '.s-search-results .s-result-item[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]',
  );

  if (!firstResult) {
    return { found: false, productUrl: null };
  }

  const productUrl = await page.evaluate((el) => el.href, firstResult);
  return { found: true, productUrl };
}

module.exports = { searchAmazonForIsbn };

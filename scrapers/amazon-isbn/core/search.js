const { navigateAmazon } = require("./navigation");
const { closeBuyingOptionsDrawer } = require("./buyingOptions");

/**
 * Searches Amazon for an ISBN and returns the first product (/dp/) link.
 * @param {import('playwright').Page} page
 * @param {string} isbn
 * @returns {Promise<{ found: boolean, productUrl: string|null, block?: { reason: string, status: number|null, retryAfter?: string } }>}
 */
async function searchAmazonForIsbn(page, isbn, domain = "amazon.in") {
  if (!["amazon.in", "amazon.com", "amazon.co.uk"].includes(domain)) throw new Error("Unsupported Amazon domain");
  const searchUrl = `https://www.${domain}/s?k=${encodeURIComponent(isbn)}`;
  let submitSearch;
  if (new URL(page.url()).hostname.replace(/^www\./, "") === domain &&
      await closeBuyingOptionsDrawer(page)) {
    const searchBox = page.locator("#twotabsearchtextbox");
    const searchButton = page.locator("#nav-search-submit-button");
    const canSubmit = await searchBox.isVisible() && await searchButton.isVisible()
      && await searchButton.click({ trial: true, timeout: 1050 }).then(() => true, () => false);
    if (canSubmit) {
      submitSearch = async (options) => {
        await searchBox.fill(isbn, { timeout: options.timeout });
        const [response] = await Promise.all([
          page.waitForNavigation(options),
          searchButton.click({ timeout: options.timeout }),
        ]);
        return response;
      };
    }
  }

  const block = await navigateAmazon(page, searchUrl, {
    timeout: 10500,
    readySelector: ".s-search-results, .s-no-results-result",
    readyTimeout: 2100,
    submitSearch,
  });
  if (block) return { found: false, productUrl: null, block };

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

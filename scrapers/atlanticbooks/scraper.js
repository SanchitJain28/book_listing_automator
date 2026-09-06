const { searchAtlanticByIsbn } = require("./core/search");
const {
  fetchAtlanticProductData,
  extractAtlanticDomData,
} = require("./core/productExtractor");

/**
 * Scrapes Atlantic Books for a given direct product URL or ISBN.
 * @param {import('playwright').Page|null} page
 * @param {Object} params - { directUrl, isbn }
 * @returns {Promise<Object>}
 */
async function scrapeAtlanticBook(page, { directUrl, isbn }) {
  let handle = null;

  if (directUrl && directUrl.includes("/products/")) {
    try {
      const urlObj = new URL(directUrl);
      handle = urlObj.pathname.replace("/products/", "").replace(".js", "");
    } catch (e) {}
  } else if (isbn) {
    handle = await searchAtlanticByIsbn(isbn);
  }

  // 1. Primary Engine: High-speed Shopify API extraction
  if (handle) {
    const productData = await fetchAtlanticProductData(handle, isbn);
    if (productData) {
      return {
        store: "Atlantic Books",
        searched_isbn: isbn || null,
        found: true,
        ...productData,
      };
    }
  }

  // 2. Fallback Engine: Playwright browser DOM extraction
  if (page) {
    const navUrl =
      directUrl ||
      `https://atlanticbooks.com/search?type=product&q=${encodeURIComponent(isbn)}`;
    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/products/")) {
      const domData = await extractAtlanticDomData(page);

      if (domData.title || domData.price) {
        return {
          store: "Atlantic Books",
          searched_isbn: isbn || null,
          found: true,
          title: domData.title,
          price: domData.price,
          mrp: domData.mrp || domData.price,
          currency: "INR",
          in_stock: domData.inStock,
          stock_status: domData.inStock ? "In Stock" : "Out of Stock",
          seller: "Atlantic Books",
          url: page.url(),
        };
      }
    }
  }

  return {
    store: "Atlantic Books",
    searched_isbn: isbn || null,
    found: false,
    in_stock: false,
    stock_status: "Not Listed",
    url: directUrl || (isbn ? `https://atlanticbooks.com/search?type=product&q=${isbn}` : null),
  };
}

module.exports = { scrapeAtlanticBook };

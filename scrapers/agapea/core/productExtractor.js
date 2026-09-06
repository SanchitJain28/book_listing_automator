/**
 * Extracts product details, author, price, currency, and stock status from Agapea product page.
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>}
 */
async function extractAgapeaProductData(page) {
  return await page.evaluate(() => {
    const titleEl = document.querySelector("h1, .titulo-libro, .title, [itemprop='name']");
    const title = titleEl ? titleEl.innerText.trim() : null;

    let author = null;
    const authorEl = document.querySelector(".autor a, .author a, a[href*='autor'], [itemprop='author']");
    if (authorEl) author = authorEl.innerText.trim();

    let price = null;
    const priceEl = document.querySelector(".precio, .price, .precio-actual, [itemprop='price'], .precio-libro");
    if (priceEl) {
      const m = priceEl.innerText.match(/([\d,.]+)/);
      if (m) price = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
    }

    let publisher = null;
    const pubEl = document.querySelector(".editorial a, a[href*='editorial'], [itemprop='publisher']");
    if (pubEl) publisher = pubEl.innerText.trim();

    let inStock = true;
    let stockStatus = "In Stock";
    const pageText = document.body.innerText;
    if (
      pageText.includes("Agotado") ||
      pageText.includes("No disponible") ||
      !price
    ) {
      inStock = false;
      stockStatus = "Out of Stock";
    }

    return {
      title,
      author,
      price,
      mrp: price,
      currency: "EUR",
      in_stock: inStock,
      stock_status: stockStatus,
      seller: "Agapea",
      publisher,
    };
  });
}

module.exports = { extractAgapeaProductData };

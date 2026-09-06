/**
 * Evaluates the live MyPustak DOM and extracts title, author, pricing, publisher, and stock status.
 * @param {import('playwright').Page} page
 * @param {string} targetIsbn
 * @returns {Promise<Object|null>}
 */
async function extractMyPustakDOM(page, targetIsbn) {
  return await page.evaluate((target) => {
    const title = document
      .querySelector("h1, .Product_title")
      ?.innerText.trim();
    if (!title || title === "404" || title.includes("404")) return null;

    let price = null;
    let mrp = null;

    const body = document.body.innerText;
    const priceMatch = body.match(/₹\s*([\d,]+)\s+₹\s*([\d,]+)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ""));
      mrp = parseFloat(priceMatch[2].replace(/,/g, ""));
    } else {
      const pEl = document.querySelector(
        ".Product_price, [class*='font15'], [itemprop='price']",
      );
      if (pEl) {
        const m = pEl.innerText.match(/₹\s*([\d,]+)/);
        if (m) price = parseFloat(m[1].replace(/,/g, ""));
      }
      const mEl = document.querySelector(
        ".Product_mrp, [class*='decoration_overline'], [itemprop='mrp']",
      );
      if (mEl) {
        const m = mEl.innerText.match(/₹\s*([\d,]+)/);
        if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
      }
    }

    let author = null;
    const authorMatch = body.match(/By\s+([^(\n]+)(?:\(Author\))?/i);
    if (authorMatch) author = authorMatch[1].trim();

    let publisher = null;
    const pubMatch = body.match(/Publication\s*(?:Date)?\s*:\s*([^\n]+)/i);
    if (pubMatch) publisher = pubMatch[1].trim();

    const hasOutOfStock = /out\s+of\s+stock|sold\s+out/i.test(body);
    const hasBuyNow = body.includes("Buy Now") || body.includes("Add To Cart");
    const inStock = hasBuyNow && !hasOutOfStock;

    return {
      title,
      author,
      publisher,
      price,
      mrp: mrp || price,
      inStock,
      stockStatus: inStock ? "In Stock" : "Out of Stock",
      url: window.location.href,
    };
  }, targetIsbn);
}

module.exports = { extractMyPustakDOM };

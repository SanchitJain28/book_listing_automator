const { queryTypesense, fetchLiveProductData } = require("./core/search");
const { extractMyPustakDOM } = require("./core/productExtractor");

/**
 * Scrapes MyPustak for a given product URL or ISBN using core modules.
 * @param {import('playwright').Page} page
 * @param {Object} params - { directUrl, isbn }
 * @returns {Promise<Object>}
 */
async function scrapeMyPustakBook(page, { directUrl, isbn }) {
  let doc = null;
  let bookUrl = directUrl;

  if (!bookUrl && isbn) {
    doc = await queryTypesense(isbn);
    if (doc) {
      const slug = doc.slug || `${doc.title || "book"}-${isbn}`;
      bookUrl = `https://www.mypustak.com/product/${slug}`;
    }
  }

  // 1. Primary: Live Browser Navigation & DOM Extraction
  if (page && bookUrl) {
    try {
      await page.goto(bookUrl, {
        waitUntil: "domcontentloaded",
        timeout: 35000,
      });
      await page.waitForTimeout(2000);

      const domData = await extractMyPustakDOM(page, isbn);

      if (domData && domData.title) {
        const mrpVal = domData.mrp;
        const priceVal = domData.price;
        return {
          store: "MyPustak",
          searched_isbn: isbn || null,
          found: true,
          title: domData.title,
          price: priceVal,
          mrp: mrpVal,
          discount:
            mrpVal && priceVal && mrpVal > priceVal
              ? `${Math.round(((mrpVal - priceVal) / mrpVal) * 100)}%`
              : null,
          currency: "INR",
          in_stock: domData.inStock,
          stock_status: domData.stockStatus,
          seller: "MyPustak",
          author: domData.author || null,
          publisher: domData.publisher || null,
          binding: null,
          url: domData.url,
        };
      }
    } catch (e) {}
  }

  // 2. Fallback: Fast HTTP fetching if browser DOM was not available
  if (bookUrl) {
    const liveData = await fetchLiveProductData(bookUrl, doc);
    if (liveData && liveData.price) {
      const price = liveData.price;
      const mrp = liveData.mrp || price;
      return {
        store: "MyPustak",
        searched_isbn: isbn || null,
        found: true,
        title: doc?.title || "MyPustak Book",
        price,
        mrp,
        discount:
          mrp && price && mrp > price
            ? `${Math.round(((mrp - price) / mrp) * 100)}%`
            : null,
        currency: "INR",
        in_stock: liveData.inStock,
        stock_status: liveData.stockStatus,
        seller: "MyPustak",
        author: doc?.author || null,
        publisher: doc?.publication || null,
        binding: liveData.binding || doc?.binding || null,
        url: liveData.url,
      };
    }
  }

  return {
    store: "MyPustak",
    searched_isbn: isbn || null,
    found: false,
    in_stock: false,
    stock_status: "Listing Not Found",
    price: null,
    mrp: null,
    currency: "INR",
    url:
      directUrl ||
      `https://www.mypustak.com/search?q=${encodeURIComponent(isbn)}`,
  };
}

module.exports = { scrapeMyPustakBook };

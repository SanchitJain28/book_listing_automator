/**
 * Fetches and parses Shopify JSON and product page HTML for Atlantic Books.
 * @param {string} handle
 * @param {string} targetIsbn
 * @returns {Promise<Object|null>}
 */
async function fetchAtlanticProductData(handle, targetIsbn) {
  try {
    const jsonUrl = `https://atlanticbooks.com/products/${handle}.js`;
    const pageUrl = `https://atlanticbooks.com/products/${handle}`;

    const [jsonRes, pageRes] = await Promise.all([
      fetch(jsonUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }),
      fetch(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }),
    ]);

    if (!jsonRes.ok) return null;
    const productJson = await jsonRes.json();
    const html = pageRes.ok ? await pageRes.text() : "";

    const cleanTarget = targetIsbn ? targetIsbn.replace(/[^0-9]/g, "") : "";
    let variant = productJson.variants?.[0];
    if (cleanTarget && productJson.variants?.length > 1) {
      const match = productJson.variants.find(
        (v) =>
          (v.barcode && v.barcode.replace(/[^0-9]/g, "") === cleanTarget) ||
          (v.sku && v.sku.replace(/[^0-9]/g, "") === cleanTarget),
      );
      if (match) variant = match;
    }

    const inStock = variant ? variant.available : productJson.available;
    const price = variant?.price
      ? variant.price / 100
      : productJson.price
        ? productJson.price / 100
        : null;
    const mrp = variant?.compare_at_price
      ? variant.compare_at_price / 100
      : productJson.compare_at_price
        ? productJson.compare_at_price / 100
        : price;

    let discount = null;
    if (mrp && price && mrp > price) {
      discount = `${Math.round(((mrp - price) / mrp) * 100)}%`;
    }

    let author = null;
    const authorMatch = html.match(
      /<div class="custom-liquid">\s*by\s*([^<]+)<\/div>/i,
    );
    if (authorMatch) {
      const rawAuthor = authorMatch[1].trim();
      if (rawAuthor && rawAuthor !== "N") author = rawAuthor;
    }

    let pages = null;
    const pagesMatch = html.match(/<strong>Pages:<\/strong>\s*([^<]+)<\/li>/i);
    if (pagesMatch && pagesMatch[1].trim() !== "N/A") {
      pages = pagesMatch[1].trim();
    }

    let pubDate = null;
    const dateMatch =
      html.match(/<time[^>]*class="metafield-date"[^>]*>([^<]+)<\/time>/i) ||
      html.match(/<strong>Publication Date:<\/strong>\s*([^<]+)<\/li>/i);
    if (dateMatch && dateMatch[1].trim() !== "N/A") {
      pubDate = dateMatch[1].trim();
    }

    let language = null;
    const langMatch = html.match(/<strong>Language:<\/strong>\s*([^<]+)<\/li>/i);
    if (langMatch && langMatch[1].trim() !== "N/A") {
      language = langMatch[1].trim();
    }

    return {
      title: productJson.title,
      price,
      mrp,
      discount,
      currency: "INR",
      in_stock: inStock,
      stock_status: inStock ? "In Stock" : "Out of Stock",
      seller: "Atlantic Books",
      author,
      publisher: productJson.vendor || null,
      binding: variant?.option1 || variant?.title || null,
      language: language || "English",
      pages,
      publication_date: pubDate,
      weight_grams: variant?.weight || null,
      url: pageUrl,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fallback DOM extraction for Playwright browser pages.
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>}
 */
async function extractAtlanticDomData(page) {
  return await page.evaluate(() => {
    const title = document.querySelector("h1.product-title, h1")?.innerText.trim();
    let price = null;
    const pEl = document.querySelector(".price__current .money, [data-price]");
    if (pEl) {
      const m = pEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) price = parseFloat(m[1].replace(/,/g, ""));
    }
    let mrp = null;
    const mEl = document.querySelector(".price__compare-at .money, [data-price-compare]");
    if (mEl) {
      const m = mEl.innerText.match(/₹\s*([\d,.]+)/);
      if (m) mrp = parseFloat(m[1].replace(/,/g, ""));
    }
    let inStock = true;
    const soldBadge = document.querySelector(".product__badge--soldout");
    const atcBtn = document.querySelector(".product-form--atc-button");
    if (soldBadge || atcBtn?.disabled || /sold\s*out/i.test(atcBtn?.innerText || "")) {
      inStock = false;
    }
    return { title, price, mrp, inStock };
  });
}

module.exports = {
  fetchAtlanticProductData,
  extractAtlanticDomData,
};

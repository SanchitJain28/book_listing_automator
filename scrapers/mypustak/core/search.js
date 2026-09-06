const TYPESENSE_SEARCH_URL =
  "https://ew5h2tr67livkp41p-1.a1.typesense.net/multi_search?use_cache=true&x-typesense-api-key=ynYXfz3KuyLdSvLrMitLZWtsOImkATlb";

/**
 * Searches MyPustak via internal Typesense multi-search API by ISBN.
 * @param {string} isbn
 * @returns {Promise<Object|null>}
 */
async function queryTypesense(isbn) {
  if (!isbn) return null;
  try {
    const payload = {
      searches: [
        {
          collection: "books_collection",
          q: isbn,
          query_by: "isbn,title,author,publication",
          per_page: 5,
        },
      ],
    };

    const res = await fetch(TYPESENSE_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const hits = json.results?.[0]?.hits || [];
    if (hits.length === 0) return null;

    const cleanTarget = isbn.replace(/[^0-9]/g, "");
    const exactHit = hits.find(
      (h) =>
        h.document?.isbn &&
        h.document.isbn.replace(/[^0-9]/g, "") === cleanTarget,
    );
    return exactHit ? exactHit.document : null;
  } catch (e) {
    return null;
  }
}

/**
 * Fast direct HTTP fallback parser for MyPustak product pages.
 * @param {string} bookUrl
 * @param {Object} fallbackDoc
 * @returns {Promise<Object|null>}
 */
async function fetchLiveProductData(bookUrl, fallbackDoc) {
  try {
    const res = await fetch(bookUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const hasOutOfStock =
      /out\s+of\s+stock/i.test(html) || html.includes("Notify Me");
    const hasBuyNow = html.includes("Buy Now") || html.includes("Add to Cart");
    const inStock = hasBuyNow && !hasOutOfStock;

    let price = fallbackDoc?.price ? parseFloat(fallbackDoc.price) : null;
    let mrp = fallbackDoc?.mrp ? parseFloat(fallbackDoc.mrp) : null;

    const sp =
      html.match(/itemProp="Price"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i) ||
      html.match(
        /class="[^"]*Product_font15[^"]*"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i,
      );
    if (sp) price = parseFloat(sp[1].replace(/,/g, ""));

    const mp =
      html.match(/itemProp="MRP"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i) ||
      html.match(
        /class="[^"]*Product_decoration_overline[^"]*"[^>]*>₹(?:<!--\s*-->|\s)*([\d,]+)/i,
      );
    if (mp) mrp = parseFloat(mp[1].replace(/,/g, ""));

    let condition = "Used";
    if (html.includes("Brand New")) condition = "Brand New";
    else if (html.includes("Very Good")) condition = "Very Good";
    else if (html.includes("Good")) condition = "Good";

    let binding = fallbackDoc?.binding || null;
    const bindingMatch = html.match(
      /itemProp="Binding"[^>]*>[^<]*<\/span><span[^>]*itemProp="([^"]+)"/i,
    );
    if (bindingMatch) binding = bindingMatch[1];

    let language = fallbackDoc?.language || null;
    const langMatch = html.match(
      /itemProp="Language"[^>]*>[^<]*<\/span><span[^>]*itemProp="([^"]+)"/i,
    );
    if (langMatch) language = langMatch[1];

    return {
      inStock,
      stockStatus: inStock ? "In Stock" : "Out of Stock",
      price,
      mrp,
      condition,
      binding,
      language,
      url: bookUrl,
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  queryTypesense,
  fetchLiveProductData,
};

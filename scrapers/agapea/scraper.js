const { searchAgapeaForIsbn } = require("./core/search");
const { extractAgapeaProductData } = require("./core/productExtractor");

/**
 * Scrapes Agapea for a given direct product URL or ISBN.
 * @param {import('playwright').Page} page
 * @param {Object} params - { directUrl, isbn }
 * @returns {Promise<Object>}
 */
async function scrapeAgapeaBook(page, { directUrl, isbn }) {
  await searchAgapeaForIsbn(page, directUrl, isbn);
  const data = await extractAgapeaProductData(page);

  const found = !!data.title || !!data.price;

  return {
    store: "Agapea",
    searched_isbn: isbn || null,
    found,
    ...data,
    url: page.url(),
  };
}

module.exports = { scrapeAgapeaBook };

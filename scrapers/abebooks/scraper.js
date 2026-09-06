const { navigateWithRateLimitHandling } = require("./core/search");
const { extractAbeBooksListings } = require("./core/multiListingExtractor");

/**
 * Scrapes AbeBooks for a given product URL or ISBN using core extraction modules.
 * @param {import('playwright').Page} page
 * @param {Object} params - { directUrl, isbn }
 * @returns {Promise<Object>}
 */
async function scrapeAbeBooksBook(page, { directUrl, isbn }) {
  let targetUrl = directUrl;
  let isUk = false;

  if (targetUrl) {
    if (targetUrl.includes("abebooks.co.uk")) isUk = true;
  }

  const storeName = isUk ? "AbeBooks UK" : "AbeBooks";
  const currency = isUk ? "GBP" : "USD";

  const navResult = await navigateWithRateLimitHandling(page, directUrl, isbn);

  if (!navResult.ok) {
    return {
      searched_isbn: isbn || null,
      found: false,
      in_stock: false,
      stock_status: "Rate Limited (429)",
      listings: [],
      url: page.url(),
    };
  }

  const listings = await extractAbeBooksListings(page, isbn);

  if (!listings || listings.length === 0) {
    return {
      searched_isbn: isbn || null,
      found: false,
      in_stock: false,
      stock_status: "Not Found",
      listings: [],
      url: page.url(),
    };
  }

  const topListing = listings[0];
  const isOutOfStock = !!topListing.is_out_of_stock || (topListing.price_num === null && (!topListing.price || topListing.price === "N/A"));
  const inStock = !isOutOfStock;
  const priceVal = inStock ? (topListing.price_num !== null ? topListing.price_num : topListing.price) : null;

  return {
    store: storeName,
    searched_isbn: isbn || null,
    found: true,
    in_stock: inStock,
    stock_status: inStock ? "In Stock" : "Out of Stock",
    title: topListing.title !== "N/A" ? topListing.title : null,
    author: topListing.author !== "N/A" ? topListing.author : null,
    price: priceVal,
    mrp: priceVal,
    currency,
    seller: topListing.seller !== "N/A" ? topListing.seller : storeName,
    seller_address: topListing.seller_address,
    shipping: topListing.shipping,
    found_isbn: topListing.found_isbn,
    isbn_matched: topListing.isbn_match,
    publisher: topListing.publisher || null,
    publication_date: topListing.publication_date || null,
    binding: topListing.binding || null,
    total_sellers_found: inStock ? listings.length : 0,
    listings: listings,
    url: page.url(),
  };
}

module.exports = { scrapeAbeBooksBook };

const { scrapeAmazonBook: scrapeAmazon } = require("../amazon-isbn/scraper");
const { extractProductData } = require("../amazon-isbn/core/productExtractor");

const emptyBookDetails = {
  cover_url: null,
  asin: null,
  isbn_10: null,
  isbn_13: null,
  language: null,
  pages: null,
  item_weight: null,
  dimensions: null,
  binding: null,
};

async function extractEnhancedProduct(page) {
  const product = await extractProductData(page);
  const details = await page.evaluate(() => {
    const clean = (value) => value?.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").trim() || null;

    const cover = document.querySelector("#landingImage")
      || document.querySelector("#imgBlkFront, #main-image-container .variant-MAIN img");

    const imageUrl = (value) => {
      if (!value?.trim()) return null;
      try {
        const url = new URL(value, document.baseURI);
        return /^https?:$/.test(url.protocol) ? url.href : null;
      } catch {
        return null;
      }
    };

    let coverUrl = imageUrl(cover?.getAttribute("data-old-hires"));
    if (cover && !coverUrl) {
      let largestArea = 0;
      try {
        const images = JSON.parse(cover.getAttribute("data-a-dynamic-image") || "{}");
        for (const [candidate, size] of Object.entries(images ?? {})) {
          const area = Array.isArray(size) ? size[0] * size[1] : 0;
          const url = imageUrl(candidate);
          if (url && area > largestArea) {
            coverUrl = url;
            largestArea = area;
          }
        }
      } catch {
        // Some pages have no usable responsive image data.
      }
      coverUrl ||= imageUrl(cover.currentSrc) || imageUrl(cover.getAttribute("src"));
    }

    const bullets = new Map();
    for (const label of document.querySelectorAll("#detailBullets_feature_div .a-list-item > .a-text-bold")) {
      const key = label.textContent.toLowerCase().replace(/[^a-z0-9]/g, "");
      const value = clean(label.nextElementSibling?.textContent);
      if (value && !bullets.has(key)) bullets.set(key, value);
    }

    const carousel = (id) => clean(document.querySelector(`#rpi-attribute-${id} .rpi-attribute-value`)?.textContent);
    const field = (key, carouselId = `book_details-${key}`) => bullets.get(key) || carousel(carouselId);
    const isbn = (value, pattern) => {
      const normalized = value?.replace(/[\s-]/g, "").toUpperCase();
      return pattern.test(normalized || "") ? normalized : null;
    };

    const pageCount = field("printlength", "book_details-fiona_pages")
      || bullets.get("paperback") || bullets.get("hardcover");
    const pageNumber = pageCount?.match(/^(\d[\d,]*)(?:\s+pages?)?$/i)?.[1];
    const format = clean(document.querySelector("#tmmSwatches .swatchElement.selected .slot-title")?.textContent);
    const subtitle = document.querySelector("#productSubtitle")?.textContent;
    const binding = format
      || subtitle?.match(/\b(?:Mass Market Paperback|Paperback|Hardcover|Hardback|Softcover|Board Book|Spiral.bound|Library Binding)\b/i)?.[0]
      || (bullets.has("paperback") ? "Paperback" : null)
      || (bullets.has("hardcover") ? "Hardcover" : null);

    const asin = [
      location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?=\/|$)/i)?.[1],
      document.querySelector("input#ASIN")?.value,
      document.querySelector("#richProductInformation_feature_div")?.getAttribute("data-csa-c-asin"),
    ].find((value) => /^[a-z0-9]{10}$/i.test(value || ""));

    return {
      cover_url: coverUrl,
      asin: asin?.toUpperCase() || null,
      isbn_10: isbn(field("isbn10"), /^\d{9}[\dX]$/),
      isbn_13: isbn(field("isbn13"), /^\d{13}$/),
      language: field("language", "language"),
      pages: pageNumber ? Number(pageNumber.replace(/,/g, "")) : null,
      item_weight: field("itemweight"),
      dimensions: field("dimensions"),
      binding,
      publisher: field("publisher"),
      publication_date: field("publicationdate", "book_details-publication_date"),
    };
  });

  return {
    ...product,
    ...details,
    publisher: details.publisher || product.publisher,
    publication_date: details.publication_date || product.publication_date,
  };
}

async function scrapeAmazonBook(page, { directUrl, isbn }) {
  if (directUrl) {
    const url = new URL(directUrl);
    if (!/^https?:$/.test(url.protocol) || !/^(www\.)?amazon\.in$/.test(url.hostname)) {
      throw new Error("amazon-isbn-enchanced only accepts Amazon.in product URLs");
    }
  }

  const result = await scrapeAmazon(page, { directUrl, isbn, domain: "amazon.in" }, extractEnhancedProduct);
  return { ...emptyBookDetails, ...result };
}

module.exports = { scrapeAmazonBook, emptyBookDetails };

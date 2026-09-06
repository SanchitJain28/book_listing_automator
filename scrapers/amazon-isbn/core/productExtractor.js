/**
 * Extracts product metadata, bullets, delivery information, primary buybox price, and MRP from Amazon product page.
 * @param {import('playwright').Page} page
 * @returns {Promise<Object>}
 */
async function extractProductData(page) {
  return await page.evaluate(() => {
    let result = {
      title: "N/A",
      found_isbn: "N/A",
      price: "N/A",
      mrp: "N/A",
      delivery: "N/A",
      seller: "N/A",
      author: null,
      used_available: "No Used Options",
      reviews_count: "0",
      publisher: "N/A",
      publication_date: "N/A",
      hasUsedOptions: false,
    };

    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.innerText.trim() : null;
    };

    result.title = getText("#productTitle") || "N/A";

    const authorEl = document.querySelector(
      "#bylineInfo .author a, #bylineInfo a, .contributorNameID",
    );
    if (authorEl) result.author = authorEl.innerText.trim();

    const reviewsText = getText("#acrCustomerReviewText");
    if (reviewsText) {
      result.reviews_count = reviewsText.replace(/[^\d]/g, "");
    }

    const detailBullets = Array.from(
      document.querySelectorAll("#detailBullets_feature_div li"),
    );

    const carouselIsbn = getText(
      "#rpi-attribute-book_details-isbn13 .rpi-attribute-value span",
    );
    if (carouselIsbn) {
      result.found_isbn = carouselIsbn.replace(/[^\dX]/gi, "");
    } else {
      const isbn13Bullet = detailBullets.find((li) =>
        li.innerText.includes("ISBN-13"),
      );
      if (isbn13Bullet) {
        const parts = isbn13Bullet.innerText.split(":");
        if (parts.length > 1)
          result.found_isbn = parts[1].replace(/[^\dX]/gi, "");
      } else {
        // Try ISBN-10 if 13 is missing
        const isbn10Bullet = detailBullets.find((li) =>
          li.innerText.includes("ISBN-10"),
        );
        if (isbn10Bullet) {
          const parts = isbn10Bullet.innerText.split(":");
          if (parts.length > 1)
            result.found_isbn = parts[1].replace(/[^\dX]/gi, "");
        }
      }
    }

    const pubBullet = detailBullets.find((li) =>
      li.innerText.toLowerCase().includes("publisher"),
    );
    if (pubBullet) {
      const parts = pubBullet.innerText.split(":");
      if (parts.length > 1) result.publisher = parts[1].trim();
    }

    const dateBullet = detailBullets.find((li) =>
      li.innerText.toLowerCase().includes("publication date"),
    );
    if (dateBullet) {
      const parts = dateBullet.innerText.split(":");
      if (parts.length > 1) result.publication_date = parts[1].trim();
    }

    result.delivery =
      getText(
        "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
      ) ||
      getText("#deliveryBlockMessage") ||
      "N/A";

    const usedLink = Array.from(document.querySelectorAll("a, span")).find(
      (el) =>
        el.innerText &&
        (el.innerText.toLowerCase().includes("used from") ||
          el.innerText.toLowerCase().includes("new & used") ||
          el.innerText.toLowerCase().includes("used & new")),
    );
    if (usedLink) result.hasUsedOptions = true;

    result.price =
      getText(".priceToPay .a-price-whole") ||
      getText("#corePriceDisplay_desktop_feature_div .a-price-whole") ||
      "N/A";

    const mrpEl = document.querySelector(".a-text-price span.a-offscreen");
    if (mrpEl) result.mrp = mrpEl.textContent.trim();

    result.seller =
      getText("#sellerProfileTriggerId") ||
      getText("#merchant-info a") ||
      "N/A";

    return result;
  });
}

module.exports = { extractProductData };

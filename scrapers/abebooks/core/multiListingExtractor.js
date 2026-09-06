/**
 * Evaluates the AbeBooks page and extracts all seller listings or PLP catalog entries.
 * @param {import('playwright').Page} page
 * @param {string} targetIsbn
 * @returns {Promise<Array<Object>>}
 */
async function extractAbeBooksListings(page, targetIsbn) {
  return await page.evaluate((target) => {
    const cleanText = (el) => (el ? el.innerText.trim() : null);

    const formatShipping = (rawText) => {
      if (!rawText || rawText === "N/A") return "N/A";
      const firstLine = rawText.split("\n")[0];
      const match = firstLine.match(/(.*?shipping)/i);
      return match ? match[1].trim() : firstLine.trim();
    };

    let extractedListings = [];

    // SCENARIO 1: NEW UI (VersoTypography - Search Results)
    const newUIListings = document.querySelectorAll(
      '[data-srp-item-role="listing"]',
    );
    if (newUIListings.length > 0) {
      newUIListings.forEach((item) => {
        const titleEl = item.querySelector("[data-cy='listing-title'], .title, h2, h3");
        const authorEl = item.querySelector("[data-cy='listing-author'], .author");
        const priceEl = item.querySelector('[data-test-id^="item-price"]');
        const shipEl = item.querySelector('[data-test-id^="item-shipping-price"]');
        const sellerLink = item.querySelector('[data-test-id="listing-seller-link"]');

        let address = "N/A";
        const sellerInfoP = item.querySelector('[data-test-id="seller-info"]');
        if (sellerInfoP) {
          const addressSpan = sellerInfoP.querySelector('span[aria-hidden="true"]');
          if (addressSpan) {
            address = cleanText(addressSpan).replace(/^,\s*/, "");
          }
        }

        let foundIsbn = "N/A";
        const isbnLink = item.querySelector('[data-test-id="listing-isbn-link"]');
        if (isbnLink) {
          const match = isbnLink.innerText.match(/(978\d{10})/);
          if (match) foundIsbn = match[1];
        }

        let priceNum = null;
        if (priceEl) {
          const m = priceEl.innerText.match(/([\d,.]+)/);
          if (m) priceNum = parseFloat(m[1].replace(/,/g, ""));
        }

        extractedListings.push({
          title: cleanText(titleEl) || "N/A",
          author: cleanText(authorEl) || "N/A",
          price: cleanText(priceEl) || "N/A",
          price_num: priceNum,
          shipping: formatShipping(cleanText(shipEl)),
          seller: cleanText(sellerLink) || "AbeBooks",
          seller_address: address,
          found_isbn: foundIsbn,
          isbn_match: target ? foundIsbn === target : true,
          is_out_of_stock: priceNum === null,
        });
      });
      return extractedListings;
    }

    // SCENARIO 2: OLD UI (Search Results)
    const oldUIListings = document.querySelectorAll(".result-data");
    if (oldUIListings.length > 0) {
      oldUIListings.forEach((item) => {
        const titleEl = item.querySelector(".title, h2, h3");
        const authorEl = item.querySelector(".author");
        const address = cleanText(item.querySelector('[data-test-id="listing-seller-location"]')) || "N/A";

        let foundIsbn = "N/A";
        const isbn13El = item.querySelector('[data-test-id="listing-isbn-13"]');
        if (isbn13El) {
          const match = isbn13El.innerText.match(/(978\d{10})/);
          if (match) foundIsbn = match[1];
        }

        const priceEl = item.querySelector('[data-test-id="item-price"]');
        let priceNum = null;
        if (priceEl) {
          const m = priceEl.innerText.match(/([\d,.]+)/);
          if (m) priceNum = parseFloat(m[1].replace(/,/g, ""));
        }

        extractedListings.push({
          title: cleanText(titleEl) || "N/A",
          author: cleanText(authorEl) || "N/A",
          price: cleanText(priceEl) || "N/A",
          price_num: priceNum,
          shipping: formatShipping(cleanText(item.querySelector('[data-test-id="shipping-detail"]'))),
          seller: cleanText(item.querySelector('[data-test-id="listing-seller-name"]')) || "AbeBooks",
          seller_address: address,
          found_isbn: foundIsbn,
          isbn_match: target ? foundIsbn === target : true,
          is_out_of_stock: priceNum === null,
        });
      });
      return extractedListings;
    }

    // SCENARIO 3: SINGLE PRODUCT PAGE WITH ACTIVE BUYBOX (#bookPurchase)
    const productPageBuyBox = document.querySelector("#bookPurchase");
    if (productPageBuyBox) {
      const titleEl = document.querySelector("#book-title, h1");
      const authorEl = document.querySelector("#book-author, .author");
      const address = cleanText(document.querySelector("#bookseller-location")) || "N/A";
      const foundIsbn = target || "N/A";

      const priceEl = document.querySelector('#book-price, [data-test-id="item-price"]');
      let priceNum = null;
      if (priceEl) {
        const m = priceEl.innerText.match(/([\d,.]+)/);
        if (m) priceNum = parseFloat(m[1].replace(/,/g, ""));
      }

      extractedListings.push({
        title: cleanText(titleEl) || "N/A",
        author: cleanText(authorEl) || "N/A",
        price: cleanText(priceEl) || "N/A",
        price_num: priceNum,
        shipping: formatShipping(cleanText(document.querySelector(".basket-shipping-line"))),
        seller: cleanText(document.querySelector('#bookseller-name, [data-test-id="bookseller-name"]')) || "AbeBooks",
        seller_address: address,
        found_isbn: foundIsbn,
        isbn_match: true,
        is_out_of_stock: priceNum === null,
      });
      return extractedListings;
    }

    // SCENARIO 4: PRODUCT LANDING PAGE (PLP / .detail-block / Out of Stock / No Available Copies)
    const detailBlock = document.querySelector(".detail-block, .meta-data, #plp-content, .plp-detail");
    if (detailBlock) {
      const h1 = document.querySelector("h1, #book-title, [data-test-id='book-title'], .plp-title");
      const title = cleanText(h1) || "N/A";

      // Author extraction (often in sibling under h1 or .author)
      let author = null;
      if (h1 && h1.nextElementSibling && !h1.nextElementSibling.classList.contains("detail-block")) {
        author = cleanText(h1.nextElementSibling);
      }
      if (!author) {
        author = cleanText(document.querySelector(".author, #author-main, h2 a, [data-test-id='author']")) || "N/A";
      }

      const publisher = cleanText(document.querySelector("#publisher-main, #publisher, [data-test-id='publisher']"));
      const pubDate = cleanText(document.querySelector("#publish-date, #publication-date, [data-test-id='publication-date']"));
      const binding = cleanText(document.querySelector("#binding, [data-test-id='binding']"));
      const isbn13El = document.querySelector("#isbn13, [data-test-id='isbn13'], .isbns span");

      let foundIsbn = target || "N/A";
      if (isbn13El) {
        const match = isbn13El.innerText.match(/(978\d{10})/);
        if (match) foundIsbn = match[1];
      }

      const bodyText = document.body.innerText;
      const hasBasketBtn = !!document.querySelector(
        "#add-to-basket-link-used, #add-to-basket-link-new, .btn-add-to-basket, [data-test-id='add-to-basket-link-used']",
      );
      const isOutOfStock =
        !hasBasketBtn &&
        (/is currently not available|no available copies|\(no available copies\)/i.test(
          bodyText,
        ) ||
          (bodyText.includes("0 Used") && bodyText.includes("0 New")));

      let price = "N/A";
      let priceNum = null;

      if (!isOutOfStock) {
        const priceEl = document.querySelector(
          ".bb-price, #book-price, [data-test-id='item-price'], .item-price, #mbo-count-used .no-wrap, #ntb-price",
        );
        if (priceEl) {
          price = cleanText(priceEl);
          const m = price.match(/([\d,.]+)/);
          if (m) priceNum = parseFloat(m[1].replace(/,/g, ""));
        } else {
          const costAttr = document.querySelector("a[data-csa-c-cost]");
          if (costAttr && costAttr.getAttribute("data-csa-c-cost")) {
            const rawCost = costAttr.getAttribute("data-csa-c-cost");
            price = rawCost;
            priceNum = parseFloat(rawCost);
          }
        }
      }

      // Extract shipping & origin country (e.g. "Ships from U.S.A. to India")
      let shipping = "N/A";
      let sellerAddress = "N/A";
      const shipEl = document.querySelector(".bb-shipping");
      if (shipEl) {
        shipping = cleanText(shipEl);
        const shipMatch = shipping.match(/Ships from[^\n\r]+/i);
        if (shipMatch) {
          sellerAddress = shipMatch[0].trim();
        }
      }

      extractedListings.push({
        title,
        author,
        price,
        price_num: priceNum,
        shipping,
        seller: "AbeBooks",
        seller_address: sellerAddress,
        found_isbn: foundIsbn,
        isbn_match: target ? foundIsbn === target : true,
        publisher,
        publication_date: pubDate,
        binding,
        is_out_of_stock: isOutOfStock || priceNum === null,
      });

      return extractedListings;
    }

    return [];
  }, targetIsbn);
}

module.exports = { extractAbeBooksListings };

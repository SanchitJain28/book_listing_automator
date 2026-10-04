import path from "path";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const stealth = stealthPlugin();
chromium.use(stealth);

const USER_DATA_DIR = path.join(process.cwd(), "amazon_cart_bot_profile");

let sharedContext: any = null;
let sharedPage: any = null;

export async function getAmazonBrowserPage() {
  if (sharedPage && !sharedPage.isClosed() && sharedContext) {
    return { context: sharedContext, page: sharedPage };
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    geolocation: { latitude: 28.6139, longitude: 77.209 },
    permissions: ["geolocation"],
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--lang=en-IN,en-GB,en-US",
    ],
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Warming sequence and pincode verification
  try {
    await page.goto("https://www.amazon.in/", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    const currLoc = await page.textContent("#glow-ingress-line2", { timeout: 4000 }).catch(() => "");
    if (!currLoc || !currLoc.includes("122101")) {
      const btn = await page.$("#nav-global-location-popover-link, #glow-ingress-block");
      if (btn) {
        await btn.click();
        await page.waitForSelector("#GLUXZipUpdateInput", {
          state: "visible",
          timeout: 6000,
        });
        await page.fill("#GLUXZipUpdateInput", "122101");
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const apply =
            document.querySelector("#GLUXZipUpdate input[type='submit']") ||
            document.querySelector("#GLUXZipUpdate .a-button-input") ||
            document.querySelector('[data-action="GLUXPostalInputAction"] input');
          if (apply) (apply as HTMLElement).click();
        });
        await page.waitForTimeout(2000);
        await page.reload({ waitUntil: "domcontentloaded" });
      }
    }
  } catch (e: any) {
    console.log(`⚠️ Note on location setup: ${e.message}`);
  }

  sharedContext = context;
  sharedPage = page;
  return { context, page };
}

function isbn13To10(isbn13: string): string | null {
  if (!isbn13 || typeof isbn13 !== "string") return null;
  const clean = isbn13.replace(/[^\dX]/gi, "");
  if (clean.length !== 13 || !clean.startsWith("978")) return null;
  const core = clean.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const rem = (11 - (sum % 11)) % 11;
  const check = rem === 10 ? "X" : rem.toString();
  return core + check;
}

export async function searchAmazonIsbn(page: any, isbn: string) {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(isbn)}`;
  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  const isBlocked = await page.evaluate(() => {
    return (
      document.title.includes("Sorry! Something went wrong") ||
      document.title.includes("Robot Check") ||
      document.body.innerText.includes("Enter the characters you see below")
    );
  });

  if (isBlocked) {
    throw new Error("Amazon CAPTCHA / Robot Check detected.");
  }

  await page
    .waitForSelector('div[data-component-type="s-search-result"], .s-result-item, h2 a', { timeout: 8000 })
    .catch(() => {});

  const topResult = await page.evaluate(() => {
    const resultElements = Array.from(
      document.querySelectorAll('div[data-component-type="s-search-result"]'),
    );

    for (const el of resultElements) {
      const isSponsored =
        el.getAttribute("data-component-type") === "sp-sponsored-result" ||
        el.querySelector(".puis-sponsored-label-text") !== null ||
        el.querySelector("span.a-color-secondary")?.textContent?.toLowerCase().includes("sponsored") ||
        (el as HTMLElement).innerText.toLowerCase().includes("sponsored");

      if (isSponsored) continue;

      const titleRecipeLink = el.querySelector(
        'div[data-cy="title-recipe"] a.a-link-normal, h2 a.a-link-normal',
      ) as HTMLAnchorElement | null;
      const linkEl =
        titleRecipeLink || (el.querySelector('a.a-link-normal[href*="/dp/"]') as HTMLAnchorElement | null);

      if (linkEl && linkEl.href) {
        const titleEl =
          el.querySelector('div[data-cy="title-recipe"] h2 span') ||
          el.querySelector("h2 span") ||
          linkEl;
        const priceEl = el.querySelector(".a-price .a-price-whole") as HTMLElement | null;
        const rawPrice = priceEl ? priceEl.innerText.trim() : null;

        return {
          found: true,
          url: linkEl.href,
          title: titleEl ? (titleEl as HTMLElement).innerText.trim() : "Unknown Title",
          pricePreview: rawPrice,
        };
      }
    }

    return { found: false, url: null, title: null, pricePreview: null };
  });

  return topResult;
}

export async function checkProductPageIsbn(page: any, searchedIsbn: string) {
  const isbn10 = isbn13To10(searchedIsbn);

  return await page.evaluate(
    ({ searchedIsbn, isbn10 }: { searchedIsbn: string; isbn10: string | null }) => {
      const getText = (sel: string) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        return el ? el.innerText.trim() : "";
      };

      const title = getText("#productTitle") || document.title;
      let foundIsbn: string | null = null;

      const carousel13 = getText("#rpi-attribute-book_details-isbn13 .rpi-attribute-value span");
      const carousel10 = getText("#rpi-attribute-book_details-isbn10 .rpi-attribute-value span");

      if (carousel13) foundIsbn = carousel13.replace(/[^\dX]/gi, "");
      else if (carousel10) foundIsbn = carousel10.replace(/[^\dX]/gi, "");

      if (!foundIsbn) {
        const bullets = Array.from(document.querySelectorAll("#detailBullets_feature_div li"));
        for (const li of bullets) {
          const t = (li as HTMLElement).innerText;
          if (t.includes("ISBN-13")) {
            const parts = t.split(":");
            if (parts.length > 1) foundIsbn = parts[1].replace(/[^\dX]/gi, "");
            break;
          } else if (t.includes("ISBN-10")) {
            const parts = t.split(":");
            if (parts.length > 1) foundIsbn = parts[1].replace(/[^\dX]/gi, "");
          }
        }
      }

      if (!foundIsbn) {
        const rows = Array.from(
          document.querySelectorAll("#productDetails_techSpec_section_1 tr, .content ul li"),
        );
        for (const r of rows) {
          const text = (r as HTMLElement).innerText;
          if (text.includes("ISBN-13") || text.includes("ISBN-10")) {
            const m = text.match(/ISBN(?:-13|-10)?\s*[:\s]*([0-9X]{10,13})/i);
            if (m) {
              foundIsbn = m[1].replace(/[^\dX]/gi, "");
              break;
            }
          }
        }
      }

      const currentUrl = window.location.href;
      const asinMatch = currentUrl.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      const urlAsin = asinMatch ? asinMatch[1] : null;

      const pageText = document.body.innerText;
      const matched =
        (foundIsbn &&
          (foundIsbn === searchedIsbn ||
            (isbn10 && foundIsbn === isbn10) ||
            foundIsbn.includes(searchedIsbn))) ||
        (urlAsin && isbn10 && urlAsin.toUpperCase() === isbn10.toUpperCase()) ||
        pageText.includes(searchedIsbn) ||
        (isbn10 ? pageText.includes(isbn10) : false);

      return {
        title,
        foundIsbn: foundIsbn || urlAsin || "Not explicitly listed",
        urlAsin,
        matched: !!matched,
      };
    },
    { searchedIsbn, isbn10 },
  );
}

export async function openAllOffersSidebar(page: any) {
  const alreadyLoaded = await page.evaluate(() => {
    return document.querySelectorAll("#aod-offer-list #aod-offer, #aod-pinned-offer").length > 0;
  });
  if (alreadyLoaded) return true;

  await page.evaluate(() => {
    const triggers = [
      "#buybox-see-all-buying-choices a",
      "#buybox-see-all-buying-choices .a-button-text",
      "#all-offers-display-params",
      "#mediaMatrixGridAODPopover a",
      ".aod-popover-caret-link",
      "#mediaMatrixGridAODPopover",
      "#moreBuyingChoices_feature_div a",
      "a[title='See All Buying Options']",
      "a:has-text('See All Buying Options')",
      "[data-action='show-all-offers-display']",
      "[data-action='s-show-all-offers-display']",
    ];

    for (const sel of triggers) {
      try {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el && el.offsetParent !== null) {
          el.click();
          return sel;
        }
      } catch (e) {}
    }

    const links = Array.from(document.querySelectorAll("a"));
    for (const a of links) {
      const txt = (a.innerText || "").toLowerCase();
      if (
        (txt.includes("see all buying options") ||
          txt.includes("other new from") ||
          txt.includes("new & used from") ||
          txt.includes("new offers from") ||
          txt.includes("buying choices")) &&
        a.offsetParent !== null
      ) {
        a.click();
        return;
      }
    }
  });

  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const popoverEntries = Array.from(
      document.querySelectorAll(
        ".a-popover:not(.a-popover-preload) .mm-grid-aod-popover-format-entry, " +
          ".a-popover:not(.a-popover-preload) [data-action='show-all-offers-display'] a, " +
          "#mediaMatrixGridAODPopoverEntries a, " +
          ".mm-grid-aod-popover-format-entry",
      ),
    );

    for (const entry of popoverEntries) {
      const el = entry as HTMLElement;
      if (el && (el.offsetParent !== null || el.id.includes("paperback"))) {
        el.click();
        return;
      }
    }
  });

  await page
    .waitForFunction(
      () => {
        const count = document.querySelectorAll("#aod-offer-list #aod-offer, #aod-pinned-offer").length;
        const zeroOfferConfirmed = document.querySelector(
          "#aod-filter-no-offer-count-heading, .aod-zero-offer-class, input#aod-total-offer-count[value='0']",
        );
        return count > 0 || zeroOfferConfirmed !== null;
      },
      { timeout: 8000 },
    )
    .catch(() => null);

  await page.waitForTimeout(600);

  const finalCount = await page.evaluate(() => {
    return document.querySelectorAll("#aod-offer-list #aod-offer, #aod-pinned-offer").length;
  });

  return finalCount > 0;
}

export async function extractAllOffers(page: any) {
  return await page.evaluate(() => {
    const offers: any[] = [];

    const parseNum = (str: string | null | undefined) => {
      if (!str) return null;
      const clean = str.replace(/[^0-9.]/g, "");
      const n = parseFloat(clean);
      return !isNaN(n) ? n : null;
    };

    const getPriceFromElement = (container: Element | null) => {
      if (!container) return null;
      const priceOffscreen = container.querySelector(".a-price .a-offscreen") as HTMLElement | null;
      const priceWhole = container.querySelector(".a-price .a-price-whole") as HTMLElement | null;
      let p = parseNum(priceOffscreen ? priceOffscreen.innerText : priceWhole?.innerText);
      if (p !== null) return p;

      const taxInclEl = container.querySelector("[id*='tax-incl-price']") as HTMLElement | null;
      if (taxInclEl) {
        p = parseNum(taxInclEl.innerText);
        if (p !== null) return p;
      }

      const atcInput = container.querySelector("input[name='submit.addToCart']");
      if (atcInput) {
        const aria = atcInput.getAttribute("aria-label") || "";
        const m = aria.match(/price\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
        if (m) {
          p = parseNum(m[1]);
          if (p !== null) return p;
        }
      }

      const priceSection =
        (container.querySelector("#aod-offer-price, #aod-pinned-offer-price") as HTMLElement | null) ||
        (container as HTMLElement);
      const m = priceSection.innerText.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      if (m) {
        p = parseNum(m[1]);
        if (p !== null) return p;
      }

      return null;
    };

    const getDeliveryInfo = (container: Element) => {
      let deliveryText = "";
      let shippingFee = 0;

      const timeEl = container.querySelector("[data-csa-c-delivery-time]");
      if (timeEl) {
        deliveryText = timeEl.getAttribute("data-csa-c-delivery-time") || "";
      }

      if (!deliveryText) {
        const delEl = container.querySelector(
          "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE, [id*='delivery']",
        ) as HTMLElement | null;
        if (delEl) deliveryText = delEl.innerText.trim();
      }

      const priceEl = container.querySelector("[data-csa-c-delivery-price]");
      if (priceEl) {
        const val = priceEl.getAttribute("data-csa-c-delivery-price") || "";
        if (val.toLowerCase() !== "free") {
          const sp = parseNum(val);
          if (sp !== null) shippingFee = sp;
        }
      }

      if (shippingFee === 0) {
        const shipMatch = (container as HTMLElement).innerText.match(/(?:₹|\+)\s*(\d+(?:\.\d+)?)\s*delivery/i);
        if (shipMatch) shippingFee = parseFloat(shipMatch[1]);
      }

      return { deliveryText, shippingFee };
    };

    const getSellerInfo = (container: Element) => {
      const link = container.querySelector("#aod-offer-soldBy .a-col-right a.a-link-normal, #aod-offer-soldBy a") as HTMLElement | null;
      if (link && link.innerText.trim()) return link.innerText.trim();

      const soldByEl = container.querySelector("#aod-offer-soldBy") as HTMLElement | null;
      if (soldByEl) {
        const txt = soldByEl.innerText.replace(/Sold by/i, "").trim();
        const firstLine = txt.split("\n")[0].trim();
        if (firstLine) return firstLine;
      }
      return "Amazon / Third-party Seller";
    };

    const pinned = document.querySelector("#aod-pinned-offer, #aod-sticky-pinned-offer");
    if (pinned) {
      const p = getPriceFromElement(pinned);
      const { deliveryText, shippingFee } = getDeliveryInfo(pinned);
      const seller = getSellerInfo(pinned);

      if (p !== null) {
        offers.push({
          source: "sidebar_pinned",
          itemPrice: p,
          shippingFee,
          totalPrice: p + shippingFee,
          deliveryText,
          seller,
          condition: "New",
          atcSelector: "#aod-pinned-offer input[name='submit.addToCart'], #aod-pinned-offer .a-button-input",
        });
      }
    }

    const aodItems = Array.from(document.querySelectorAll("#aod-offer-list #aod-offer"));
    aodItems.forEach((item, index) => {
      const p = getPriceFromElement(item);
      const { deliveryText, shippingFee } = getDeliveryInfo(item);
      const seller = getSellerInfo(item);
      const heading = (item.querySelector("#aod-offer-heading, h5") as HTMLElement | null)?.innerText || "";
      const condition = heading.toLowerCase().includes("used") ? "Used" : "New";

      if (p !== null) {
        offers.push({
          source: `sidebar_offer_${index + 1}`,
          offerIndex: index,
          itemPrice: p,
          shippingFee,
          totalPrice: p + shippingFee,
          deliveryText,
          seller,
          condition,
          atcSelector: `#aod-offer-list #aod-offer input[name='submit.addToCart']`,
        });
      }
    });

    if (offers.length === 0) {
      const buybox = document.querySelector("#desktop_buybox, #qualifiedBuybox");
      if (buybox) {
        const p = getPriceFromElement(buybox);
        const { deliveryText, shippingFee } = getDeliveryInfo(buybox);
        const sellerEl = buybox.querySelector("#sellerProfileTriggerId, #merchant-info a, #merchant-info") as HTMLElement | null;
        const seller = sellerEl ? sellerEl.innerText.trim() : "Amazon / Buybox Seller";

        if (p !== null) {
          offers.push({
            source: "main_buybox",
            itemPrice: p,
            shippingFee,
            totalPrice: p + shippingFee,
            deliveryText,
            seller,
            condition: "New",
            atcSelector: "#add-to-cart-button",
          });
        }
      }
    }

    let availabilityNotice: string | null = null;
    if (offers.length === 0) {
      const noticeEl = document.querySelector(
        "#aod-filter-offer-count-string, #aod-filter-no-offer-count-heading, #outOfStock, #availability span, .aod-no-offer-normal-font",
      ) as HTMLElement | null;
      if (noticeEl) {
        availabilityNotice = noticeEl.innerText.replace(/\s+/g, " ").trim();
      }
    }

    return { offers, availabilityNotice };
  });
}

export async function executeAddToCart(page: any, chosenOffer: any) {
  if (!chosenOffer) return false;

  try {
    let clicked = false;

    if (chosenOffer.source?.startsWith("sidebar_offer_") && typeof chosenOffer.offerIndex === "number") {
      clicked = await page.evaluate((targetIdx: number) => {
        const offers = Array.from(document.querySelectorAll("#aod-offer-list #aod-offer"));
        const target = offers[targetIdx];
        if (!target) return false;
        const btn =
          (target.querySelector("input[name='submit.addToCart']") as HTMLElement | null) ||
          (target.querySelector(".aod-atc-column input[type='submit']") as HTMLElement | null) ||
          (target.querySelector(".aod-atc-generic-btn-desktop input") as HTMLElement | null) ||
          (target.querySelector(".a-button-input") as HTMLElement | null) ||
          (target.querySelector("input[type='submit']") as HTMLElement | null);
        if (btn) {
          btn.scrollIntoView({ behavior: "instant", block: "center" });
          btn.click();
          return true;
        }
        return false;
      }, chosenOffer.offerIndex);
    } else if (chosenOffer.source === "sidebar_pinned") {
      clicked = await page.evaluate(() => {
        const pinned = document.querySelector("#aod-pinned-offer, #aod-sticky-pinned-offer");
        if (!pinned) return false;
        const btn =
          (pinned.querySelector("input[name='submit.addToCart']") as HTMLElement | null) ||
          (pinned.querySelector(".a-button-input") as HTMLElement | null);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
    }

    if (!clicked && chosenOffer.atcSelector) {
      const btn = await page.$(chosenOffer.atcSelector);
      if (btn) {
        await btn.click();
        clicked = true;
      }
    }

    if (!clicked) {
      const mainAtc = await page.$("#add-to-cart-button");
      if (mainAtc) {
        await mainAtc.click();
        clicked = true;
      }
    }

    if (clicked) {
      await page.waitForTimeout(2500);
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`❌ Error clicking Add-to-Cart: ${err.message}`);
    return false;
  }
}

// -------------------------------------------------------------
// MASTRA TOOL: scrapeAmazonOffersTool
// -------------------------------------------------------------
export const scrapeAmazonOffersTool = createTool({
  id: "scrape-amazon-offers",
  description:
    "Searches Amazon India for a book by ISBN, validates that the page matches the ISBN, opens the All Offers Display sidebar, and extracts all offers with prices and delivery details.",
  inputSchema: z.object({
    isbn: z.string().describe("10-digit or 13-digit ISBN to search on Amazon India"),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    isbn: z.string(),
    pageTitle: z.string().nullable(),
    isbnMatched: z.boolean(),
    foundIsbnOnPage: z.string().nullable(),
    offersCount: z.number(),
    availabilityNotice: z.string().nullable().optional(),
    offers: z.array(
      z.object({
        source: z.string(),
        itemPrice: z.number(),
        shippingFee: z.number(),
        totalPrice: z.number(),
        deliveryText: z.string(),
        seller: z.string(),
        condition: z.string(),
        atcSelector: z.string().optional(),
        offerIndex: z.number().optional(),
      }),
    ),
  }),
  execute: async ({ isbn }) => {
    const { page } = await getAmazonBrowserPage();
    const searchRes = await searchAmazonIsbn(page, isbn);

    if (!searchRes.found || !searchRes.url) {
      return {
        found: false,
        isbn,
        pageTitle: null,
        isbnMatched: false,
        foundIsbnOnPage: null,
        offersCount: 0,
        availabilityNotice: "Search returned no non-sponsored book results.",
        offers: [],
      };
    }

    await page.goto(searchRes.url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(1500);

    const isbnCheck = await checkProductPageIsbn(page, isbn);
    await openAllOffersSidebar(page);
    const { offers, availabilityNotice } = await extractAllOffers(page);

    return {
      found: true,
      isbn,
      pageTitle: isbnCheck.title,
      isbnMatched: isbnCheck.matched,
      foundIsbnOnPage: isbnCheck.foundIsbn,
      offersCount: offers.length,
      availabilityNotice,
      offers,
    };
  },
});

// -------------------------------------------------------------
// MASTRA TOOL: amazonAddToCartTool
// -------------------------------------------------------------
export const amazonAddToCartTool = createTool({
  id: "amazon-add-to-cart",
  description: "Triggers Add to Cart on Amazon for the chosen qualified offer.",
  inputSchema: z.object({
    offer: z.object({
      source: z.string(),
      offerIndex: z.number().optional(),
      atcSelector: z.string().optional(),
      seller: z.string(),
      itemPrice: z.number(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ offer }) => {
    const { page } = await getAmazonBrowserPage();
    const success = await executeAddToCart(page, offer);
    return {
      success,
      message: success
        ? `Successfully added offer from ${offer.seller} (₹${offer.itemPrice}) to cart.`
        : "Failed to click add-to-cart button.",
    };
  },
});

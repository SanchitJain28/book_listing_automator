/**
 * Clicks the "See All Buying Options" button if available and extracts marketplace prices, MRP, and used options from #aod-offer-list.
 * @param {import('playwright').Page} page
 * @returns {Promise<{ pPrice: string, pMrp: string, pDel: string, pSeller: string, pUsed: string } | null>}
 */
async function extractBuyingOptionsDrawer(page) {
  const seeAllBtn = await page.$(
    'a[title="See All Buying Options"], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, .aod-popover-caret-link, #mediaMatrixGridAODPopover a, #mediaMatrixGridAODPopover, a:has-text("Other New"), a:has-text("used & new"), a:has-text("New & Used"), a:has-text("New from"), a:has-text("Used from")',
  );

  if (seeAllBtn) {
    try {
      await page.evaluate(() => {
        const el1 = document.querySelector(
          "#mediaMatrixGridAODPopover a, .aod-popover-caret-link, #mediaMatrixGridAODPopover, a[title='See All Buying Options'], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a",
        );
        if (el1) el1.click();
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        const el2 = document.querySelector(
          ".mm-grid-aod-popover-format-entry, #mediaMatrixGridAODPopoverEntries a, [data-action='show-all-offers-display'] a",
        );
        if (el2) el2.click();
      });
      await page
        .waitForSelector("#aod-offer-list #aod-offer, #aod-offer", {
          timeout: 3500,
        })
        .catch(() => {});
    } catch (e) {}
  }

  try {
    return await page.evaluate(() => {
      let pPrice = "N/A",
        pMrp = "N/A",
        pDel = "N/A",
        pSeller = "N/A",
        pUsed = "No Used Options";

      // 1. Check AOD Drawer Offer List if populated
      const firstOffer = document.querySelector(
        "#aod-offer-list #aod-offer, #aod-pinned-offer",
      );
      if (firstOffer) {
        const priceWholeEl = firstOffer.querySelector(
          ".a-price .a-price-whole",
        );
        const priceOffscreenEl = firstOffer.querySelector(
          ".a-price .a-offscreen",
        );
        const taxInclEl = firstOffer.querySelector(
          "[id*='tax-incl-price'], .b2b-aod-tax-incl-price",
        );

        if (priceWholeEl) {
          pPrice = priceWholeEl.textContent.replace(".", "").trim();
        } else if (priceOffscreenEl) {
          pPrice = priceOffscreenEl.textContent
            .replace(/[^\d.,]/g, "")
            .trim();
        } else if (taxInclEl) {
          const m = taxInclEl.textContent.match(/₹\s*([\d,.]+)/);
          if (m) pPrice = m[1].replace(/[.,]/g, "");
        }

        const delEl = firstOffer.querySelector(
          "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold, [id*='delivery']",
        );
        if (delEl) pDel = delEl.innerText.trim();

        const mrpEl = firstOffer.querySelector(
          ".a-text-price .a-offscreen",
        );
        if (mrpEl) pMrp = mrpEl.textContent.trim();

        const sellerEl = firstOffer.querySelector(
          "#aod-offer-soldBy a, #aod-offer-soldBy",
        );
        if (sellerEl) pSeller = sellerEl.textContent.trim();
      }

      if (pMrp === "N/A") {
        const pinnedMrpEl = document.querySelector(
          "#aod-sticky-pinned-offer .a-text-price span.a-offscreen",
        );
        if (pinnedMrpEl) pMrp = pinnedMrpEl.textContent.trim();
      }

      // Check used offers in drawer
      const allOffers = document.querySelectorAll(
        "#aod-offer-list #aod-offer",
      );
      for (let offer of allOffers) {
        const headingEl = offer.querySelector("#aod-offer-heading, h5");
        const headingText = headingEl
          ? headingEl.textContent.trim().toLowerCase()
          : "";

        if (headingText.includes("used")) {
          const usedPriceWholeEl = offer.querySelector(
            ".a-price .a-price-whole",
          );
          let tempUsedPrice = null;

          if (usedPriceWholeEl)
            tempUsedPrice = usedPriceWholeEl.textContent
              .replace(/[.,]/g, "")
              .trim();
          else {
            const fallbackUsedPrice = offer.querySelector(
              ".a-price .a-offscreen",
            );
            if (fallbackUsedPrice && fallbackUsedPrice.innerText.trim())
              tempUsedPrice = fallbackUsedPrice.innerText
                .replace(/[^\d]/g, "")
                .trim();
          }

          if (tempUsedPrice && pUsed === "No Used Options") {
            pUsed = tempUsedPrice;
            break;
          }
        }
      }

      // 2. Fallback: If pPrice is still N/A, extract directly from inline OLP / Popover badges
      if (pPrice === "N/A" || pUsed === "No Used Options") {
        const olpElements = Array.from(
          document.querySelectorAll(
            "#mediaMatrixGridAODPopover, #mediaMatrixGridAODPopover a, .aod-popover-caret-link, .mm-grid-aod-popover-format-entry, #mediaMatrixGridAODPopoverEntries a, .olp-link, a[title='See All Buying Options'], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, a[href*='/gp/offer-listing/']",
          ),
        );

        for (const el of olpElements) {
          const text = (
            el.innerText ||
            el.getAttribute("aria-label") ||
            ""
          ).trim();
          const priceMatch = text.match(/₹\s*([\d,]+(?:\.\d+)?)/);
          if (priceMatch) {
            const rawNum = priceMatch[1].replace(/,/g, "");
            const num = Math.round(parseFloat(rawNum));
            if (!isNaN(num) && num > 0) {
              const isUsed =
                text.toLowerCase().includes("used") &&
                !text.toLowerCase().includes("new & used");
              if (isUsed && pUsed === "No Used Options") {
                pUsed = String(num);
              } else if (!isUsed && pPrice === "N/A") {
                pPrice = String(num);
              }
            }
          }
        }
      }

      return { pPrice, pMrp, pDel, pSeller, pUsed };
    });
  } catch (e) {
    return null;
  }
}

module.exports = { extractBuyingOptionsDrawer };

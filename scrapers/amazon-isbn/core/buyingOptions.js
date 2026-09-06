/**
 * Clicks the "See All Buying Options" button if available and extracts marketplace prices, MRP, and used options from #aod-offer-list.
 * @param {import('playwright').Page} page
 * @returns {Promise<{ pPrice: string, pMrp: string, pDel: string, pSeller: string, pUsed: string } | null>}
 */
async function extractBuyingOptionsDrawer(page) {
  const seeAllBtn = await page.$(
    'a[title="See All Buying Options"], #buybox-see-all-buying-choices a, #moreBuyingChoices_feature_div a, a:has-text("used & new"), a:has-text("New & Used")',
  );

  if (!seeAllBtn) return null;

  try {
    await seeAllBtn.click();
    await page
      .waitForSelector("#aod-offer-list", { timeout: 4000 })
      .catch(() => {});

    return await page.evaluate(() => {
      let pPrice = "N/A",
        pMrp = "N/A",
        pDel = "N/A",
        pSeller = "N/A",
        pUsed = "No Used Options";

      const firstOffer = document.querySelector(
        "#aod-offer-list #aod-offer",
      );
      if (firstOffer) {
        const priceWholeEl = firstOffer.querySelector(
          ".a-price .a-price-whole",
        );
        if (priceWholeEl)
          pPrice = priceWholeEl.textContent.replace(".", "").trim();
        else {
          const fallbackPrice = firstOffer.querySelector(
            ".a-price .a-offscreen",
          );
          if (fallbackPrice && fallbackPrice.innerText.trim())
            pPrice = fallbackPrice.innerText.trim();
        }

        const delEl = firstOffer.querySelector(
          "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE .a-text-bold",
        );
        if (delEl) pDel = delEl.innerText.trim();
        const mrpEl = firstOffer.querySelector(
          ".a-text-price .a-offscreen",
        );
        if (mrpEl) pMrp = mrpEl.textContent.trim();
        const sellerEl = firstOffer.querySelector("#aod-offer-soldBy a");
        if (sellerEl) pSeller = sellerEl.textContent.trim();
      }

      if (pMrp === "N/A") {
        const pinnedMrpEl = document.querySelector(
          "#aod-sticky-pinned-offer .a-text-price span.a-offscreen",
        );
        if (pinnedMrpEl) pMrp = pinnedMrpEl.textContent.trim();
      }

      const allOffers = document.querySelectorAll(
        "#aod-offer-list #aod-offer",
      );
      for (let offer of allOffers) {
        const headingEl = offer.querySelector("#aod-offer-heading");
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
      return { pPrice, pMrp, pDel, pSeller, pUsed };
    });
  } catch (e) {
    return null;
  }
}

module.exports = { extractBuyingOptionsDrawer };

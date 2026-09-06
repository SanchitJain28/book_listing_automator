/**
 * Checks #tmmSwatches on the Amazon product page to find the cheapest physical format (e.g. Paperback vs Hardcover vs Kindle).
 * @param {import('playwright').Page} page
 * @returns {Promise<{ url: string, format: string, price: number } | null>}
 */
async function getCheaperPhysicalFormat(page) {
  return await page.evaluate(() => {
    const swatches = Array.from(
      document.querySelectorAll("#tmmSwatches .swatchElement"),
    );
    if (swatches.length <= 1) return null;

    let lowestPrice = Infinity;
    let bestUrl = null;
    let bestFormatName = null;
    let isCurrentlySelectedCheapest = false;

    for (let swatch of swatches) {
      const isSelected = swatch.classList.contains("selected");
      const linkEl = swatch.querySelector("a");
      const url = linkEl ? linkEl.href : null;
      const priceText = swatch.innerText;
      let priceNum = Infinity;

      if (priceText) {
        const textLower = priceText.toLowerCase();
        const formatNameLower = priceText.split("\n")[0].toLowerCase();
        const isForbidden =
          formatNameLower.includes("kindle") ||
          formatNameLower.includes("ebook") ||
          formatNameLower.includes("e-book") ||
          formatNameLower.includes("audiobook") ||
          formatNameLower.includes("audible");

        if (!textLower.includes("unavailable") && !isForbidden) {
          const match = priceText.match(/[\d,]+(?:\.\d+)?/);
          if (match) priceNum = parseFloat(match[0].replace(/,/g, ""));
        }
      }

      if (priceNum < lowestPrice) {
        lowestPrice = priceNum;
        bestUrl = url;
        bestFormatName = priceText
          ? priceText.split("\n")[0].trim()
          : "Unknown";
        isCurrentlySelectedCheapest = isSelected;
      }
    }

    if (!isCurrentlySelectedCheapest && bestUrl && lowestPrice !== Infinity) {
      return { url: bestUrl, format: bestFormatName, price: lowestPrice };
    }
    return null;
  });
}

module.exports = { getCheaperPhysicalFormat };

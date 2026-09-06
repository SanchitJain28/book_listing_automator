/**
 * Navigates to AbeBooks search or direct URL with 429 rate-limit detection and retry cooldowns.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} targetIsbn
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
async function navigateWithRateLimitHandling(page, directUrl, targetIsbn) {
  let retries = 3;
  let targetUrl = directUrl;

  if (!targetUrl && targetIsbn) {
    targetUrl = `https://www.abebooks.com/products/isbn/${encodeURIComponent(targetIsbn)}`;
  }

  while (retries > 0) {
    const response = await page.goto(targetUrl, {
      timeout: 45000,
      waitUntil: "domcontentloaded",
    });

    const status = response ? response.status() : 200;
    const pageText = await page.content();

    if (status === 429 || pageText.includes("Too Many Requests")) {
      console.log(
        `   🛑 AbeBooks 429 Rate Limit hit! Waiting 45 seconds to cooldown...`,
      );
      await new Promise((r) => setTimeout(r, 45000));
      retries--;
      continue;
    }

    if (status === 404 && !directUrl && targetIsbn) {
      // Fallback to keyword search if /products/isbn/ returned 404
      targetUrl = `https://www.abebooks.com/servlet/SearchResults?kn=${encodeURIComponent(targetIsbn)}`;
      retries--;
      continue;
    }

    await page
      .waitForSelector(
        'h1, .detail-block, [data-srp-item-role="listing"], .result-data, #bookPurchase, #srp-no-results, .message-error',
        { timeout: 10000 },
      )
      .catch(() => {});

    return { ok: true, status };
  }

  return { ok: false, status: 429 };
}

module.exports = { navigateWithRateLimitHandling };

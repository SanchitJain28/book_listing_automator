/**
 * Navigates to Agapea direct product URL or searches by ISBN.
 * @param {import('playwright').Page} page
 * @param {string} directUrl
 * @param {string} isbn
 * @returns {Promise<{ found: boolean, url: string }>}
 */
async function searchAgapeaForIsbn(page, directUrl, isbn) {
  let targetUrl = directUrl;
  if (!targetUrl || !targetUrl.includes("agapea.com")) {
    targetUrl = `https://www.agapea.com/buscar/buscador.php?texto=${encodeURIComponent(isbn)}`;
  }

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  await page.waitForTimeout(1500);

  // If redirected to search results instead of product page, click first product
  const firstBookLink = await page.$(
    '.lista-libros .libro a, .items-libros a[href*="agapea.com/libros/"], a.enlace-libro',
  );

  if (firstBookLink) {
    const href = await page.evaluate((el) => el.href, firstBookLink);
    if (href) {
      await page.goto(href, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
    }
  }

  return { found: true, url: page.url() };
}

module.exports = { searchAgapeaForIsbn };

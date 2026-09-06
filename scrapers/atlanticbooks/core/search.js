/**
 * Searches Atlantic Books by ISBN to extract the Shopify product handle.
 * @param {string} isbn
 * @returns {Promise<string|null>}
 */
async function searchAtlanticByIsbn(isbn) {
  if (!isbn) return null;
  try {
    const searchUrl = `https://atlanticbooks.com/search?type=product&q=${encodeURIComponent(isbn)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    const matches = html.match(/\/products\/([a-zA-Z0-9_-]+)/g);
    if (!matches || matches.length === 0) return null;

    const handles = [
      ...new Set(matches.map((m) => m.replace("/products/", ""))),
    ];
    if (handles.length === 0) return null;

    const cleanTarget = isbn.replace(/[^0-9]/g, "");
    let matchedHandle = handles.find((h) => h.includes(cleanTarget)) || handles[0];
    return matchedHandle;
  } catch (e) {
    return null;
  }
}

module.exports = { searchAtlanticByIsbn };

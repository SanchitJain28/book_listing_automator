const fs = require("fs");
const path = require("path");
const { initBrowser, getRandomDelay } = require("../../utils/browser");
const {
  readJsonLines,
  readSearchTerms,
  appendResult,
} = require("../../utils/file");
const { initScraper } = require("../../utils/scraperInit");
const { startSpinner, stopSpinner } = require("../../utils/spinner");

// Helper to resolve Google /goto?url= redirects to their true canonical URLs
async function resolveGoogleUrl(requestContext, rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  if (
    !rawUrl.includes("google.com/goto?") &&
    !rawUrl.includes("google.com/url?") &&
    !rawUrl.startsWith("/goto?") &&
    !rawUrl.startsWith("/url?")
  ) {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      return rawUrl;
    }
    return null;
  }

  const fullUrl = rawUrl.startsWith("http")
    ? rawUrl
    : `https://www.google.com${rawUrl}`;

  try {
    const res = await requestContext.get(fullUrl, {
      maxRedirects: 0,
      timeout: 5000,
    });
    const location = res.headers()["location"];
    if (
      location &&
      (location.startsWith("http://") || location.startsWith("https://"))
    ) {
      return location;
    }
  } catch (e) {}

  return null;
}

/**
 * Searches Google SERP for an ISBN and returns canonical organic links from Page 1.
 * @param {import('playwright').Page} page
 * @param {string} targetIsbn
 * @returns {Promise<Array<string>>}
 */
async function fetchGoogleLinksForIsbn(page, targetIsbn) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(targetIsbn)}&hl=en`;

  const response = await page.goto(searchUrl, {
    timeout: 35000,
    waitUntil: "domcontentloaded",
  });

  const pageTitle = await page.title();
  const pageContent = await page.content();

  if (
    pageTitle.includes("Sorry...") ||
    pageContent.includes("unusual traffic from your computer network")
  ) {
    throw new Error("Google CAPTCHA / Rate-Limit detected");
  }

  const rawResults = await page.evaluate(() => {
    const list = [];
    const seenHrefs = new Set();

    // 1. Organic cards
    document
      .querySelectorAll("#rso .g, #rso div[data-hveid], #search a[href^='http']")
      .forEach((card) => {
        const a = card.tagName === "A" ? card : card.querySelector("a[href]");
        if (a && a.href) {
          const href = a.href;
          if (!seenHrefs.has(href)) {
            seenHrefs.add(href);
            list.push(href);
          }
        }
      });

    // 2. Also check any anchor tags on the page
    document.querySelectorAll("a[href^='http']").forEach((a) => {
      if (a.href && !seenHrefs.has(a.href)) {
        seenHrefs.add(a.href);
        list.push(a.href);
      }
    });

    return list;
  });

  const resolvePromises = rawResults.map(async (href) => {
    return await resolveGoogleUrl(page.request, href);
  });

  const resolvedUrls = await Promise.all(resolvePromises);

  const ignoredDomains = [
    "google.com",
    "google.co.in",
    "google.co.",
    "gstatic.com",
    "googleapis.com",
    "googleusercontent.com",
    "schema.org",
    "w3.org",
    "youtube.com",
    "wikipedia.org",
  ];

  const finalLinks = [];
  for (const u of resolvedUrls) {
    if (!u) continue;
    try {
      const parsed = new URL(u);
      const isIgnored = ignoredDomains.some((d) => parsed.hostname.includes(d));
      if (!isIgnored && !finalLinks.includes(u)) {
        finalLinks.push(u);
      }
    } catch (e) {}
  }

  return finalLinks.slice(0, 15);
}

// CLI Standalone Runner
if (require.main === module) {
  (async () => {
    const { inputFile, isHeadless, outputFilePath } = initScraper(
      "google-links-isbn.js",
      "google-links",
      ".json",
    );

    const isTxt = inputFile.endsWith(".txt");
    let inputItems = [];

    if (isTxt) {
      const isbns = readSearchTerms(inputFile);
      inputItems = isbns
        .filter(
          (isbn) =>
            isbn.toLowerCase() !== "isbn" &&
            isbn.toLowerCase() !== "search_term",
        )
        .map((isbn) => ({ searched_isbn: isbn }));
    } else {
      inputItems = readJsonLines(inputFile);
    }

    let startIndex = 0;
    if (fs.existsSync(outputFilePath)) {
      const existingOutput = fs
        .readFileSync(outputFilePath, "utf-8")
        .split("\n")
        .filter(Boolean);
      startIndex = existingOutput.length;
      if (startIndex > 0) {
        console.log(
          `\n▶ Found existing output file with ${startIndex} items. Resuming from item ${startIndex + 1}...`,
        );
      }
    }

    let { context, page } = await initBrowser(
      isHeadless,
      "google_links_profile",
      false,
    );

    for (let i = startIndex; i < inputItems.length; i++) {
      const item = inputItems[i];
      const targetIsbn = item.searched_isbn || item.isbn || item.query;

      console.log(
        `\n\x1b[1m[${i + 1}/${inputItems.length}] Searching Google for ISBN: ${targetIsbn}\x1b[0m`,
      );

      if (!targetIsbn) {
        stopSpinner("Skipping item with no ISBN/Query.", "warn");
        continue;
      }

      startSpinner(`Searching Google for "${targetIsbn}" (Page 1)...`);

      try {
        const finalLinks = await fetchGoogleLinksForIsbn(page, targetIsbn);
        const resultObject = {
          searched_isbn: targetIsbn,
          found: finalLinks.length > 0,
          total_links_found: finalLinks.length,
          links: finalLinks,
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, resultObject);
        stopSpinner(
          `[${i + 1}/${inputItems.length}] Found ${finalLinks.length} Page-1 links for ISBN ${targetIsbn}`,
          finalLinks.length > 0 ? "success" : "warn",
        );
      } catch (err) {
        stopSpinner(`Error searching Google for ${targetIsbn}: ${err.message}`, "error");
        appendResult(outputFilePath, {
          searched_isbn: targetIsbn,
          found: false,
          error: err.message,
          links: [],
          scraped_at: new Date().toISOString(),
        });
      }

      await page.waitForTimeout(getRandomDelay(2000, 4000));
    }

    await context.close();
    console.log(
      `\n🎉 Google Link Scraping Complete! Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = { fetchGoogleLinksForIsbn };

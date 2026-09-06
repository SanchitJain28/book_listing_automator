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

// Helper to normalize and strip tracking & fragments from URLs
function normalizeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  try {
    // 1. Strip hash fragments (e.g. #:~:text=...)
    let cleanStr = urlStr.split("#")[0].trim();
    try {
      cleanStr = decodeURI(cleanStr);
    } catch (e) {}

    const parsed = new URL(cleanStr);

    // 2. Remove ONLY tracking marketing query params
    const trackingParams = [
      "srsltid",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "_gl",
      "ref_",
      "ref",
      "source",
    ];

    const rawSearch = parsed.search.replace(/^\?/, "");
    if (rawSearch) {
      const parts = rawSearch.split("&").filter(Boolean);
      const filteredParts = parts.filter((part) => {
        const key = part.split("=")[0].toLowerCase();
        return !trackingParams.includes(key);
      });
      parsed.search =
        filteredParts.length > 0 ? `?${filteredParts.join("&")}` : "";
    }

    // 3. Normalize Amazon language localization subpaths (e.g. /-/he/, /-/es/, /-/zh/, etc.) -> default English
    if (parsed.hostname.includes("amazon.")) {
      parsed.pathname = parsed.pathname.replace(
        /^\/-\/[a-z]{2}(_[A-Z]{2})?\//i,
        "/",
      );
    }

    // 4. Normalize Flipkart language subpaths (e.g. /hi/, /ta/, etc.) and product-reviews -> product page
    if (parsed.hostname.includes("flipkart.com")) {
      parsed.pathname = parsed.pathname.replace(
        /^\/(hi|ta|te|kn|ml|mr|gu|bn|pa)\//i,
        "/",
      );
      if (parsed.pathname.includes("/product-reviews/")) {
        parsed.pathname = parsed.pathname.replace("/product-reviews/", "/p/");
      }
    }

    // 5. Remove trailing slash from pathname (unless root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch (e) {
    return urlStr.split("#")[0].trim();
  }
}

async function resolveGoogleUrl(requestContext, rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  if (
    !rawUrl.includes("google.com/goto?") &&
    !rawUrl.includes("google.com/url?") &&
    !rawUrl.startsWith("/goto?") &&
    !rawUrl.startsWith("/url?")
  ) {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      return normalizeUrl(rawUrl);
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
      return normalizeUrl(location);
    }
  } catch (e) {}

  return null;
}

/**
 * Searches Google SERP for an ISBN and returns unique, canonical organic links from Page 1 (top 20 results).
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
      .querySelectorAll(
        "#rso .g, #rso div[data-hveid], #search a[href^='http']",
      )
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
  const seenUrls = new Set();

  for (const u of resolvedUrls) {
    if (!u) continue;
    try {
      const normalized = normalizeUrl(u);
      if (!normalized) continue;

      const parsed = new URL(normalized);
      const isIgnored = ignoredDomains.some((d) => parsed.hostname.includes(d));
      if (!isIgnored && !seenUrls.has(normalized)) {
        seenUrls.add(normalized);
        finalLinks.push(normalized);
      }
    } catch (e) {}
  }

  return finalLinks.slice(0, 25);
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
    );

    for (let i = startIndex; i < inputItems.length; i++) {
      const item = inputItems[i];
      const targetIsbn = item.searched_isbn;

      console.log(
        `\n\x1b[1m[${i + 1}/${inputItems.length}] Processing ISBN: ${targetIsbn}\x1b[0m`,
      );

      if (!targetIsbn) {
        stopSpinner("Skipping item with no ISBN.", "warn");
        continue;
      }

      startSpinner(`Searching Google for ISBN: ${targetIsbn}...`);

      try {
        const uniqueLinks = await fetchGoogleLinksForIsbn(page, targetIsbn);

        const resultData = {
          ...item,
          searched_isbn: targetIsbn,
          found_links_count: uniqueLinks.length,
          links: uniqueLinks,
          scraped_at: new Date().toISOString(),
        };

        appendResult(outputFilePath, resultData);

        stopSpinner(
          `Found ${uniqueLinks.length} unique link(s) for ${targetIsbn}`,
          uniqueLinks.length > 0 ? "success" : "warn",
        );

        await page.waitForTimeout(getRandomDelay(2000, 4000));
      } catch (err) {
        stopSpinner(`Error searching ${targetIsbn}: ${err.message}`, "error");

        const errorData = {
          ...item,
          searched_isbn: targetIsbn,
          found_links_count: 0,
          links: [],
          error: err.message,
          scraped_at: new Date().toISOString(),
        };
        appendResult(outputFilePath, errorData);

        await page.waitForTimeout(1000);
      }
    }

    await context.close();
    console.log(
      `\n🎉 Google Links Scraper completed. Results saved to: ${outputFilePath}`,
    );
  })();
}

module.exports = {
  fetchGoogleLinksForIsbn,
  normalizeUrl,
};

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const EventEmitter = require("node:events");
const dns = require("node:dns/promises");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const { generateConfig } = require("./generate-sheet-config");

chromium.use(stealth);

const USER_DATA_DIR = path.join(__dirname, "..", "amazon_cart_bot_profile");
const DEFAULT_CSV_PATH = path.join(
  __dirname,
  "..",
  "test-files",
  "TEST_CSV.txt",
);
const DEFAULT_ISBN_PATH = path.join(
  __dirname,
  "..",
  "test-files",
  "TEST_INPUT_AMAZON_CART_SCRIPT.TXT",
);
const FEEDBACK_LOG_DIR = path.join(__dirname, "..", "logs");
const FEEDBACK_LOG_FILE = path.join(
  FEEDBACK_LOG_DIR,
  "amazon_cart_feedback.jsonl",
);

if (!fs.existsSync(FEEDBACK_LOG_DIR)) {
  fs.mkdirSync(FEEDBACK_LOG_DIR, { recursive: true });
}

// -------------------------------------------------------------
// CENTRALIZED SCRAPER CONFIG LOADER (scraper_config.json)
// -------------------------------------------------------------
const DEFAULT_SCRAPER_CONFIG = {
  marginRules: {
    minMarginBufferINR: 50,
  },
  deliveryRules: {
    maxDeliveryDays: 40,
    gracePeriodDays: 10,
    tiers: [
      { name: "Tier 1", startDay: 11, endDay: 20, startPenalty: 3.0, dailyIncrement: 0.8 },
      { name: "Tier 2", startDay: 21, endDay: 30, startPenalty: 5.0, dailyIncrement: 1.2 },
      { name: "Tier 3", startDay: 31, endDay: 40, startPenalty: 7.5, dailyIncrement: 1.5 },
    ],
  },
  automation: {
    minPacingSecondsPerIsbn: 30,
    cartBatchLimit: 50,
    deliveryPincode: "122101",
    headless: false,
  },
  networkMonitor: {
    pollIntervalMs: 3000,
    primaryDnsHost: "google.com",
    secondaryDnsHost: "amazon.in",
    fallbackPingUrl: "https://1.1.1.1",
    pingTimeoutMs: 2000,
    maxSheetUpdateRetries: 3,
  },
};

function loadScraperConfig(customPath = null) {
  const filePath =
    customPath || path.join(__dirname, "..", "scraper_config.json");
  if (!fs.existsSync(filePath)) {
    return DEFAULT_SCRAPER_CONFIG;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      marginRules: {
        ...DEFAULT_SCRAPER_CONFIG.marginRules,
        ...(parsed.marginRules || {}),
      },
      deliveryRules: {
        ...DEFAULT_SCRAPER_CONFIG.deliveryRules,
        ...(parsed.deliveryRules || {}),
        tiers:
          Array.isArray(parsed.deliveryRules?.tiers) &&
          parsed.deliveryRules.tiers.length > 0
            ? parsed.deliveryRules.tiers
            : DEFAULT_SCRAPER_CONFIG.deliveryRules.tiers,
      },
      automation: {
        ...DEFAULT_SCRAPER_CONFIG.automation,
        ...(parsed.automation || {}),
      },
      networkMonitor: {
        ...DEFAULT_SCRAPER_CONFIG.networkMonitor,
        ...(parsed.networkMonitor || {}),
      },
    };
  } catch (err) {
    console.warn(
      `⚠️ Could not parse scraper_config.json: ${err.message}. Using defaults.`,
    );
    return DEFAULT_SCRAPER_CONFIG;
  }
}

const scraperConfig = loadScraperConfig();

function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("net::err_") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("eai_again") ||
    msg.includes("network error") ||
    msg.includes("internet disconnected") ||
    msg.includes("name not resolved")
  );
}

class NetworkMonitor extends EventEmitter {
  constructor(pollIntervalMs = 3000, netConfig = {}) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.primaryDnsHost = netConfig.primaryDnsHost || "google.com";
    this.secondaryDnsHost = netConfig.secondaryDnsHost || "amazon.in";
    this.fallbackPingUrl = netConfig.fallbackPingUrl || "https://1.1.1.1";
    this.pingTimeoutMs = netConfig.pingTimeoutMs || 2000;
    this.isOnline = true;
    this.pollTimer = null;
    this.checking = false;
  }

  async check() {
    try {
      await dns.lookup(this.primaryDnsHost);
      return true;
    } catch {
      try {
        await dns.lookup(this.secondaryDnsHost);
        return true;
      } catch {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            this.pingTimeoutMs,
          );
          await fetch(this.fallbackPingUrl, {
            signal: controller.signal,
            method: "HEAD",
          });
          clearTimeout(timeout);
          return true;
        } catch {
          return false;
        }
      }
    }
  }

  start() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      if (this.checking) return;
      this.checking = true;
      try {
        const online = await this.check();
        if (!online && this.isOnline) {
          this.isOnline = false;
          this.emit("offline");
          this.emit("internet-off");
        } else if (online && !this.isOnline) {
          this.isOnline = true;
          this.emit("online");
          this.emit("internet-on");
        }
      } finally {
        this.checking = false;
      }
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async waitUntilOnline(contextMessage = "Operation") {
    const isNowOnline = await this.check();
    if (isNowOnline) {
      this.isOnline = true;
      return true;
    }

    this.isOnline = false;
    this.emit("offline");
    this.emit("internet-off");
    console.log(
      `\n📡 \x1b[1;31m[NETWORK MONITOR] 🔴 INTERNET CONNECTION LOST!\x1b[0m`,
    );
    console.log(
      `   ⏸️  Pausing ${contextMessage}... Waiting for internet to reconnect.`,
    );
    console.log(`   ⏳ Checking connectivity every 3 seconds...\n`);

    while (true) {
      await new Promise((r) => setTimeout(r, 3000));
      const restored = await this.check();
      if (restored) {
        this.isOnline = true;
        this.emit("online");
        this.emit("internet-on");
        console.log(
          `\n📡 \x1b[1;32m[NETWORK MONITOR] 🟢 INTERNET RESTORED!\x1b[0m`,
        );
        console.log(`   ▶️  Resuming operations seamlessly...\n`);
        await new Promise((r) => setTimeout(r, 2000));
        return true;
      }
    }
  }
}

const networkMonitor = new NetworkMonitor(
  scraperConfig.networkMonitor?.pollIntervalMs || 3000,
  scraperConfig.networkMonitor,
);
networkMonitor.on("internet-off", () => {
  console.log(
    `\n📡 \x1b[1;31m[EVENT: internet-off] Network connection lost at ${new Date().toLocaleTimeString()}.\x1b[0m`,
  );
});
networkMonitor.on("internet-on", () => {
  console.log(
    `\n📡 \x1b[1;32m[EVENT: internet-on] Network connection restored at ${new Date().toLocaleTimeString()}.\x1b[0m`,
  );
});
networkMonitor.start();

async function updateGoogleSheetCell(spreadsheetId, cellRange, value, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const credPath = path.join(__dirname, "..", "credentials.json");
      if (!fs.existsSync(credPath)) return false;
      const { google } = require("googleapis");
      const auth = new google.auth.GoogleAuth({
        keyFile: credPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: cellRange,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[value]],
        },
      });
      console.log(`📝 Live Sheet Updated: Cell ${cellRange} -> "${value}"`);
      return true;
    } catch (err) {
      if (isNetworkError(err) && attempt < maxRetries) {
        console.warn(
          `⚠️ Network drop during Google Sheet update (${cellRange}). Waiting for reconnection...`,
        );
        await networkMonitor.waitUntilOnline(`Google Sheet Cell Update (${cellRange})`);
        continue;
      }
      console.error(
        `⚠️ Could not update Google Sheet (${cellRange}):`,
        err.message,
      );
      return false;
    }
  }
  return false;
}

function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    }),
  );
}

function isbn13To10(isbn13) {
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

function parseDeliveryDays(deliveryText, referenceDate = new Date()) {
  if (!deliveryText || typeof deliveryText !== "string") {
    return { days: null, dateStr: "N/A", valid: false };
  }
  const text = deliveryText.toLowerCase();

  if (text.includes("today")) {
    return { days: 0, dateStr: "Today", valid: true };
  }
  if (text.includes("tomorrow")) {
    return { days: 1, dateStr: "Tomorrow", valid: true };
  }

  const inDaysMatch = text.match(
    /(?:in|within)\s+(\d+)(?:\s+to\s+\d+)?\s+days?/i,
  );
  if (inDaysMatch) {
    const d = parseInt(inDaysMatch[1], 10);
    return { days: d, dateStr: `${d} days`, valid: true };
  }

  const monthMap = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  const monthsPattern =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

  const p1 = text.match(
    new RegExp(`(\\b\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthsPattern})\\b`, "i"),
  );
  const p2 = text.match(
    new RegExp(`\\b(${monthsPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"),
  );

  let day = null;
  let monthName = null;

  if (p1 && monthMap[p1[2].toLowerCase()] !== undefined) {
    day = parseInt(p1[1], 10);
    monthName = p1[2].toLowerCase();
  } else if (p2 && monthMap[p2[1].toLowerCase()] !== undefined) {
    day = parseInt(p2[2], 10);
    monthName = p2[1].toLowerCase();
  }

  if (day !== null && monthName) {
    const month = monthMap[monthName];
    let year = referenceDate.getFullYear();
    let targetDate = new Date(year, month, day);

    if (targetDate.getTime() - referenceDate.getTime() < -180 * 86400000) {
      targetDate.setFullYear(year + 1);
    }

    const diffMs =
      targetDate.setHours(0, 0, 0, 0) -
      new Date(referenceDate).setHours(0, 0, 0, 0);
    const days = Math.round(diffMs / 86400000);
    return {
      days,
      dateStr: `${day} ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`,
      valid: true,
    };
  }

  return { days: null, dateStr: deliveryText.trim(), valid: false };
}

function loadTargetData(csvPath = DEFAULT_CSV_PATH) {
  const map = new Map();
  if (!fs.existsSync(csvPath)) return map;

  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip header line
    if (i === 0 && line.toLowerCase().includes("amazon price")) continue;

    // Support Tab, Comma, or Pipe separated
    const parts = line.includes("\t")
      ? line.split("\t")
      : line.includes(",")
        ? line.split(",")
        : [line];

    const isbn = parts[0]?.trim();
    if (!isbn) continue;

    const rawPrice = parts[1]?.trim() || "0";
    const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    const title = parts[3]?.trim() || "N/A";

    map.set(isbn, {
      isbn,
      targetPrice: !isNaN(cleanPrice) ? cleanPrice : 0,
      title,
      rawLine: line,
    });
  }

  return map;
}

function loadIsbnQueue(
  isbnFilePath = DEFAULT_ISBN_PATH,
  targetMap = new Map(),
) {
  let isbns = [];
  if (fs.existsSync(isbnFilePath)) {
    isbns = fs
      .readFileSync(isbnFilePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.toLowerCase().startsWith("isbn"));
  }

  // If no separate text file, use keys from targetMap
  if (isbns.length === 0 && targetMap.size > 0) {
    isbns = Array.from(targetMap.keys());
  }

  return isbns;
}

async function initAmazonBrowser(config = scraperConfig) {
  const isHeadless = config.automation?.headless ?? false;
  const pincode = config.automation?.deliveryPincode || "122101";

  console.log("🌐 Launching Playwright browser with persistent profile...");
  console.log(`📁 Profile location: ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: isHeadless, // Config-driven
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

  const page =
    context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Warming sequence
  console.log("☕ Warming up browser profile on Amazon India...");
  await page.goto("https://www.amazon.in/", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  // Verify / Set delivery location for accurate domestic shipping
  try {
    const currLoc = await page
      .textContent("#glow-ingress-line2", { timeout: 4000 })
      .catch(() => "");
    if (!currLoc || !currLoc.includes(pincode)) {
      console.log(`📍 Setting delivery pincode to ${pincode}...`);
      const btn = await page.$(
        "#nav-global-location-popover-link, #glow-ingress-block",
      );
      if (btn) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForSelector("#GLUXZipUpdateInput", {
          state: "visible",
          timeout: 6000,
        });
        await page.fill("#GLUXZipUpdateInput", pincode);
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const apply =
            document.querySelector("#GLUXZipUpdate input[type='submit']") ||
            document.querySelector("#GLUXZipUpdate .a-button-input") ||
            document.querySelector(
              '[data-action="GLUXPostalInputAction"] input',
            );
          if (apply) apply.click();
        });
        await page.waitForTimeout(2000);
        await page.reload({ waitUntil: "domcontentloaded" });
      }
    } else {
      console.log(`📍 Delivery location verified: ${currLoc.trim()}`);
    }
  } catch (e) {
    console.log(`⚠️ Note on location setup: ${e.message}`);
  }

  return { context, page };
}

async function searchTopNonSponsoredBook(page, isbn) {
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(isbn)}`;
  await page.goto(searchUrl, {
    waitUntil: "domcontentloaded",
    timeout: 35000,
  });

  // Check for dog page / robot check
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
    .waitForSelector(
      'div[data-component-type="s-search-result"], .s-result-item, h2 a',
      { timeout: 8000 },
    )
    .catch(() => {});

  // Extract the first non-sponsored product listing
  const topResult = await page.evaluate(() => {
    const resultElements = Array.from(
      document.querySelectorAll('div[data-component-type="s-search-result"]'),
    );

    for (const el of resultElements) {
      // Exclude sponsored items
      const isSponsored =
        el.getAttribute("data-component-type") === "sp-sponsored-result" ||
        el.querySelector(".puis-sponsored-label-text") !== null ||
        el
          .querySelector("span.a-color-secondary")
          ?.innerText.toLowerCase()
          .includes("sponsored") ||
        el.innerText.toLowerCase().includes("sponsored");

      if (isSponsored) continue;

      // Extract product link
      const titleRecipeLink = el.querySelector(
        'div[data-cy="title-recipe"] a.a-link-normal, h2 a.a-link-normal',
      );
      const linkEl =
        titleRecipeLink || el.querySelector('a.a-link-normal[href*="/dp/"]');

      if (linkEl && linkEl.href) {
        const titleEl =
          el.querySelector('div[data-cy="title-recipe"] h2 span') ||
          el.querySelector("h2 span") ||
          linkEl;
        const priceEl = el.querySelector(".a-price .a-price-whole");
        const rawPrice = priceEl ? priceEl.innerText.trim() : null;

        return {
          found: true,
          url: linkEl.href,
          title: titleEl ? titleEl.innerText.trim() : "Unknown Title",
          pricePreview: rawPrice,
        };
      }
    }

    return { found: false };
  });

  return topResult;
}

async function checkProductPageIsbn(page, searchedIsbn) {
  const isbn10 = isbn13To10(searchedIsbn);

  return await page.evaluate(
    ({ searchedIsbn, isbn10 }) => {
      const getText = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.innerText.trim() : "";
      };

      const title = getText("#productTitle") || document.title;
      let foundIsbn = null;

      // 1. Check carousel book details
      const carousel13 = getText(
        "#rpi-attribute-book_details-isbn13 .rpi-attribute-value span",
      );
      const carousel10 = getText(
        "#rpi-attribute-book_details-isbn10 .rpi-attribute-value span",
      );

      if (carousel13) foundIsbn = carousel13.replace(/[^\dX]/gi, "");
      else if (carousel10) foundIsbn = carousel10.replace(/[^\dX]/gi, "");

      // 2. Check Detail Bullets
      if (!foundIsbn) {
        const bullets = Array.from(
          document.querySelectorAll("#detailBullets_feature_div li"),
        );
        for (const li of bullets) {
          const t = li.innerText;
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

      // 3. Check Tech Specs table
      if (!foundIsbn) {
        const rows = Array.from(
          document.querySelectorAll(
            "#productDetails_techSpec_section_1 tr, .content ul li",
          ),
        );
        for (const r of rows) {
          const text = r.innerText;
          if (text.includes("ISBN-13") || text.includes("ISBN-10")) {
            const m = text.match(/ISBN(?:-13|-10)?\s*[:\s]*([0-9X]{10,13})/i);
            if (m) {
              foundIsbn = m[1].replace(/[^\dX]/gi, "");
              break;
            }
          }
        }
      }

      // 4. URL ASIN check (ASIN for books is often ISBN-10)
      const currentUrl = window.location.href;
      const asinMatch = currentUrl.match(
        /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i,
      );
      const urlAsin = asinMatch ? asinMatch[1] : null;

      const pageText = document.body.innerText;
      const matched =
        (foundIsbn &&
          (foundIsbn === searchedIsbn ||
            foundIsbn === isbn10 ||
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

async function openAllOffersSidebar(page) {
  // Check if offers are already loaded
  const alreadyLoaded = await page.evaluate(() => {
    return (
      document.querySelectorAll("#aod-offer-list #aod-offer, #aod-pinned-offer")
        .length > 0
    );
  });
  if (alreadyLoaded) return true;

  // 1. Try to find and click the trigger in page context
  const clickedTrigger = await page.evaluate(() => {
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
      "a:has-text('Other New from')",
      "a:has-text('New & Used from')",
      "a:has-text('new offers')",
      "a:has-text('New from')",
      "[data-action='show-all-offers-display']",
      "[data-action='s-show-all-offers-display']",
    ];

    for (const sel of triggers) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return sel;
        }
      } catch (e) {}
    }

    // Fallback: search links containing relevant keywords
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
        return "text_match:" + txt.slice(0, 30);
      }
    }

    return null;
  });

  if (clickedTrigger) {
    console.log(`   👉 Triggered sidebar link (${clickedTrigger})`);
  }

  // 2. If a format popover appeared (e.g. MediaMatrix format selection for Paperback vs Hardcover)
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
      if (
        entry &&
        (entry.offsetParent !== null || entry.id.includes("paperback"))
      ) {
        entry.click();
        return;
      }
    }
  });

  // 3. Explicitly WAIT for the AJAX request to populate the offers list (or confirm zero offers)
  console.log(`   ⏳ Waiting for sidebar offers to populate via AJAX...`);
  const populated = await page
    .waitForFunction(
      () => {
        const count = document.querySelectorAll(
          "#aod-offer-list #aod-offer, #aod-pinned-offer",
        ).length;
        const zeroOfferConfirmed = document.querySelector(
          "#aod-filter-no-offer-count-heading, .aod-zero-offer-class, input#aod-total-offer-count[value='0']",
        );
        return count > 0 || zeroOfferConfirmed !== null;
      },
      { timeout: 8000 },
    )
    .catch(() => null);

  if (populated) {
    // Settle time for prices and GST text to render
    await page.waitForTimeout(600);
    return true;
  }

  // Final check
  const finalCount = await page.evaluate(() => {
    return document.querySelectorAll(
      "#aod-offer-list #aod-offer, #aod-pinned-offer",
    ).length;
  });

  return finalCount > 0;
}

async function extractAllOffers(page) {
  return await page.evaluate(() => {
    const offers = [];

    const parseNum = (str) => {
      if (!str) return null;
      const clean = str.replace(/[^0-9.]/g, "");
      const n = parseFloat(clean);
      return !isNaN(n) ? n : null;
    };

    const getPriceFromElement = (container) => {
      if (!container) return null;
      // 1. Standard .a-price offscreen or whole
      const priceOffscreen = container.querySelector(".a-price .a-offscreen");
      const priceWhole = container.querySelector(".a-price .a-price-whole");
      let p = parseNum(
        priceOffscreen ? priceOffscreen.innerText : priceWhole?.innerText,
      );
      if (p !== null) return p;

      // 2. B2B / Tax-inclusive price container (e.g. #aod-tax-incl-price-X)
      const taxInclEl = container.querySelector("[id*='tax-incl-price']");
      if (taxInclEl) {
        p = parseNum(taxInclEl.innerText);
        if (p !== null) return p;
      }

      // 3. Aria-label on the Add to Cart submit input button
      const atcInput = container.querySelector(
        "input[name='submit.addToCart']",
      );
      if (atcInput) {
        const aria = atcInput.getAttribute("aria-label") || "";
        const m = aria.match(/price\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
        if (m) {
          p = parseNum(m[1]);
          if (p !== null) return p;
        }
      }

      // 4. Any direct ₹ price inside the price section
      const priceSection =
        container.querySelector("#aod-offer-price, #aod-pinned-offer-price") ||
        container;
      const m = priceSection.innerText.match(/₹\s*([\d,]+(?:\.\d+)?)/);
      if (m) {
        p = parseNum(m[1]);
        if (p !== null) return p;
      }

      return null;
    };

    const getDeliveryInfo = (container) => {
      let deliveryText = "";
      let shippingFee = 0;

      const timeEl = container.querySelector("[data-csa-c-delivery-time]");
      if (timeEl) {
        deliveryText = timeEl.getAttribute("data-csa-c-delivery-time") || "";
      }

      if (!deliveryText) {
        const delEl = container.querySelector(
          "#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE, [id*='delivery']",
        );
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
        const shipMatch = container.innerText.match(
          /(?:₹|\+)\s*(\d+(?:\.\d+)?)\s*delivery/i,
        );
        if (shipMatch) shippingFee = parseFloat(shipMatch[1]);
      }

      return { deliveryText, shippingFee };
    };

    const getSellerInfo = (container) => {
      const link = container.querySelector(
        "#aod-offer-soldBy .a-col-right a.a-link-normal, #aod-offer-soldBy a",
      );
      if (link && link.innerText.trim()) return link.innerText.trim();

      const soldByEl = container.querySelector("#aod-offer-soldBy");
      if (soldByEl) {
        const txt = soldByEl.innerText.replace(/Sold by/i, "").trim();
        const firstLine = txt.split("\n")[0].trim();
        if (firstLine) return firstLine;
      }
      return "Amazon / Third-party Seller";
    };

    // 1. Pinned Offer in AOD (if exists)
    const pinned = document.querySelector(
      "#aod-pinned-offer, #aod-sticky-pinned-offer",
    );
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
          atcSelector:
            "#aod-pinned-offer input[name='submit.addToCart'], #aod-pinned-offer .a-button-input",
        });
      }
    }

    // 2. Regular AOD Offers List
    const aodItems = Array.from(
      document.querySelectorAll("#aod-offer-list #aod-offer"),
    );
    aodItems.forEach((item, index) => {
      const p = getPriceFromElement(item);
      const { deliveryText, shippingFee } = getDeliveryInfo(item);
      const seller = getSellerInfo(item);

      const heading =
        item.querySelector("#aod-offer-heading, h5")?.innerText || "";
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

    // 3. Fallback to Primary Buy Box on product page if no sidebar offers extracted
    if (offers.length === 0) {
      const buybox = document.querySelector(
        "#desktop_buybox, #qualifiedBuybox",
      );
      if (buybox) {
        const p = getPriceFromElement(buybox);
        const { deliveryText, shippingFee } = getDeliveryInfo(buybox);
        const sellerEl = buybox.querySelector(
          "#sellerProfileTriggerId, #merchant-info a, #merchant-info",
        );
        const seller = sellerEl
          ? sellerEl.innerText.trim()
          : "Amazon / Buybox Seller";

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

    // 4. Capture any explicit unavailability notice from Amazon if 0 offers
    let availabilityNotice = null;
    if (offers.length === 0) {
      const noticeEl = document.querySelector(
        "#aod-filter-offer-count-string, #aod-filter-no-offer-count-heading, #outOfStock, #availability span, .aod-no-offer-normal-font",
      );
      if (noticeEl) {
        availabilityNotice = noticeEl.innerText.replace(/\s+/g, " ").trim();
      }
    }

    return { offers, availabilityNotice };
  });
}

function calculateDeliveryPenalty(
  deliveryDays,
  deliveryRules = scraperConfig.deliveryRules,
) {
  const graceDays = deliveryRules.gracePeriodDays ?? 10;
  const maxWindow = deliveryRules.maxDeliveryDays ?? 40;

  if (
    deliveryDays === null ||
    deliveryDays === undefined ||
    deliveryDays <= graceDays
  ) {
    return 0; // Tier 0: Days 1-graceDays are 100% penalty-free
  }
  if (deliveryDays > maxWindow) {
    return 0; // Exceeded max window, handled by passRule2
  }

  let totalPenalty = 0;
  const tiers = deliveryRules.tiers || [];

  for (const tier of tiers) {
    if (deliveryDays >= tier.startDay) {
      const tierDays =
        Math.min(deliveryDays, tier.endDay) - (tier.startDay - 1);
      for (let i = 1; i <= tierDays; i++) {
        totalPenalty += tier.startPenalty + (i - 1) * tier.dailyIncrement;
      }
    }
  }

  return parseFloat(totalPenalty.toFixed(1));
}

function evaluateOffers(
  rawOffers,
  targetPrice,
  isbnMatched,
  availabilityNotice = null,
  sellPrice = 0,
  customConfig = null,
) {
  const activeConfig = customConfig || scraperConfig;
  const minMarginBuffer =
    activeConfig?.marginRules?.minMarginBufferINR ?? 50;
  const deliveryRules =
    activeConfig?.deliveryRules ?? DEFAULT_SCRAPER_CONFIG.deliveryRules;
  const maxDeliveryDays = deliveryRules.maxDeliveryDays ?? 40;

  if (!isbnMatched) {
    return {
      status: "REJECTED",
      reason: "ISBN NOT MATCHED",
      chosenOffer: null,
      evaluatedOffers: [],
    };
  }

  if (!rawOffers || rawOffers.length === 0) {
    const reason = availabilityNotice
      ? `UNAVAILABLE: ${availabilityNotice}`
      : "UNAVAILABLE";
    return {
      status: "REJECTED",
      reason,
      availabilityNotice,
      chosenOffer: null,
      evaluatedOffers: [],
    };
  }

  // 1. Evaluate Rule 1 & Rule 2 for each offer
  const evaluatedOffers = rawOffers.map((offer) => {
    const deliveryEval = parseDeliveryDays(offer.deliveryText);
    // Rule 1: Item Price <= given target price OR Margin (Sell Price - raw Item Price) >= minMarginBuffer
    const margin = sellPrice > 0 ? (sellPrice - offer.itemPrice) : null;
    const passStandardPrice = offer.itemPrice <= targetPrice;
    const passMarginBuffer = margin !== null && margin >= minMarginBuffer;
    const passRule1 = passStandardPrice || passMarginBuffer;

    const passRule2 =
      deliveryEval.valid && deliveryEval.days !== null
        ? deliveryEval.days <= maxDeliveryDays
        : true; // Rule 2: Delivery <= maxDeliveryDays (or valid default)

    let failureReason = null;
    if (!passRule1) failureReason = "HIGH PRICE";
    else if (!passRule2) failureReason = "DELIVERY DATE";

    const deliveryDays = deliveryEval.days;
    const deliveryPenalty = passRule2
      ? calculateDeliveryPenalty(deliveryDays, deliveryRules)
      : 0;
    const effectivePrice = offer.itemPrice + deliveryPenalty;

    return {
      ...offer,
      deliveryDays,
      deliveryDateFormatted: deliveryEval.dateStr,
      deliveryPenalty,
      effectivePrice,
      passRule1,
      passRule2,
      isQualified: passRule1 && passRule2,
      failureReason,
      margin,
      minMarginBuffer,
      passedByMargin: !passStandardPrice && passMarginBuffer,
      score: 0,
    };
  });

  // 2. Score qualified offers
  const qualifiedOffers = evaluatedOffers.filter((o) => o.isQualified);

  if (qualifiedOffers.length > 0) {
    // Find lowest effective price among qualified offers
    const bestEffectivePrice = Math.min(
      ...qualifiedOffers.map((o) => o.effectivePrice),
    );

    qualifiedOffers.forEach((o) => {
      // Relative cost-efficiency: best / current
      // Optimal offer gets 1.00; competing offers smoothly scale between 0.00 and 1.00 (e.g. 0.82, 0.64)
      const rawScore = bestEffectivePrice / Math.max(1, o.effectivePrice);
      o.score = Math.max(0, Math.min(1, parseFloat(rawScore.toFixed(2))));
    });

    // 3. Sort qualified offers by:
    //    a. Score descending (highest score wins)
    //    b. Tie-breaker 1: Lowest item price (cheapest book price)
    //    c. Tie-breaker 2: Earliest delivery date (lowest deliveryDays wins!)
    //    d. Tie-breaker 3: Condition New > Used
    qualifiedOffers.sort((a, b) => {
      // Highest score
      if (Math.abs(b.score - a.score) > 0.0001) {
        return b.score - a.score;
      }
      // Tie-breaker 1: Lowest item price
      if (Math.abs(a.itemPrice - b.itemPrice) > 0.01) {
        return a.itemPrice - b.itemPrice;
      }
      // Tie-breaker 2: Earliest delivery date (lowest deliveryDays)
      const aDays =
        a.deliveryDays !== null && a.deliveryDays !== undefined
          ? a.deliveryDays
          : 999;
      const bDays =
        b.deliveryDays !== null && b.deliveryDays !== undefined
          ? b.deliveryDays
          : 999;
      if (aDays !== bDays) {
        return aDays - bDays;
      }
      // Tie-breaker 3: Condition New > Used
      const isANew = (a.condition || "").toLowerCase().includes("new");
      const isBNew = (b.condition || "").toLowerCase().includes("new");
      if (isANew && !isBNew) return -1;
      if (!isANew && isBNew) return 1;

      return 0;
    });

    const bestOffer = qualifiedOffers[0];

    return {
      status: "QUALIFIED",
      reason: "ALL RULES PASSED",
      chosenOffer: bestOffer,
      evaluatedOffers,
    };
  }

  // Determine aggregate failure reason
  const allHighPrice = evaluatedOffers.every((o) => !o.passRule1);
  const allBadDelivery = evaluatedOffers.every((o) => !o.passRule2);

  let reason = "HIGH PRICE";
  if (allBadDelivery && !allHighPrice) {
    reason = "DELIVERY DATE";
  } else if (allHighPrice) {
    reason = "HIGH PRICE";
  } else {
    reason = evaluatedOffers[0].failureReason || "HIGH PRICE";
  }

  return {
    status: "REJECTED",
    reason,
    chosenOffer: null,
    evaluatedOffers,
  };
}

async function executeAddToCart(page, chosenOffer) {
  if (!chosenOffer) return false;

  console.log(
    `\n🛒 Executing Add-to-Cart for chosen offer (${chosenOffer.source})...`,
  );

  try {
    let clicked = false;

    // 1. Precise targeting for sidebar offers via offerIndex
    if (
      chosenOffer.source.startsWith("sidebar_offer_") &&
      typeof chosenOffer.offerIndex === "number"
    ) {
      clicked = await page.evaluate((targetIdx) => {
        const offers = Array.from(
          document.querySelectorAll("#aod-offer-list #aod-offer"),
        );
        const target = offers[targetIdx];
        if (!target) return false;
        const btn =
          target.querySelector("input[name='submit.addToCart']") ||
          target.querySelector(".aod-atc-column input[type='submit']") ||
          target.querySelector(".aod-atc-generic-btn-desktop input") ||
          target.querySelector(".a-button-input") ||
          target.querySelector("input[type='submit']");
        if (btn) {
          btn.scrollIntoView({ behavior: "instant", block: "center" });
          btn.click();
          return true;
        }
        return false;
      }, chosenOffer.offerIndex);
    } else if (chosenOffer.source === "sidebar_pinned") {
      clicked = await page.evaluate(() => {
        const pinned = document.querySelector(
          "#aod-pinned-offer, #aod-sticky-pinned-offer",
        );
        if (!pinned) return false;
        const btn =
          pinned.querySelector("input[name='submit.addToCart']") ||
          pinned.querySelector(".a-button-input");
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
    }

    // 2. Direct selector fallback
    if (!clicked && chosenOffer.atcSelector) {
      const btn = await page.$(chosenOffer.atcSelector);
      if (btn) {
        await btn.click();
        clicked = true;
      }
    }

    // 3. Main Buybox fallback
    if (!clicked) {
      const mainAtc = await page.$("#add-to-cart-button");
      if (mainAtc) {
        await mainAtc.click();
        clicked = true;
      }
    }

    if (clicked) {
      await page.waitForTimeout(2500);
      console.log(`✅ Successfully triggered Add-to-Cart!`);
      return true;
    } else {
      console.log(`⚠️ Add-to-Cart button could not be clicked automatically.`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Error clicking Add-to-Cart: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(
    "================================================================",
  );
  console.log("🚀 AMAZON AUTOMATED CART CONTROLLER & DEBUG SYSTEM");
  console.log("   (Top Result • Sidebar AOD • Price & 40-Day Delivery Rules)");
  console.log(
    "================================================================\n",
  );

  const scraperConfigPath = path.join(__dirname, "..", "scraper_config.json");
  const hasCustomConfig = fs.existsSync(scraperConfigPath);
  console.log(
    `⚙️  Loaded Scraper Config: ${hasCustomConfig ? "scraper_config.json" : "default values"}`
  );
  console.log(
    `   • Min Margin Gap: ₹${scraperConfig.marginRules?.minMarginBufferINR || 50} (Sell - Amazon >= ₹${scraperConfig.marginRules?.minMarginBufferINR || 50})`
  );
  console.log(
    `   • Delivery Window: Max ${scraperConfig.deliveryRules?.maxDeliveryDays || 40} days (Grace: ${scraperConfig.deliveryRules?.gracePeriodDays || 10} days penalty-free)`
  );
  console.log(
    `   • Batch Size: ${scraperConfig.automation?.cartBatchLimit || 50} books | Pacing: ${scraperConfig.automation?.minPacingSecondsPerIsbn || 30}s per ISBN\n`
  );

  const configPath =
    process.argv[2] && process.argv[2].endsWith(".json")
      ? path.isAbsolute(process.argv[2])
        ? process.argv[2]
        : path.join(process.cwd(), process.argv[2])
      : path.join(__dirname, "..", "sheet_config.json");

  let sheetConfig = null;
  let targetMap = new Map();
  let isbnQueue = [];

  if (fs.existsSync(configPath)) {
    try {
      sheetConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log(
        `📊 Loaded Google Sheet Config for tab "${sheetConfig.tabName}" (${sheetConfig.totalItems} items)`,
      );
      if (sheetConfig.whiteItemsCount !== undefined) {
        console.log(
          `   ⚪ White rows (Profitable & Exact ISBN): ${sheetConfig.whiteItemsCount} (queued 1st)`,
        );
        console.log(
          `   🟡 Yellow rows (Profitable & Different edition): ${sheetConfig.yellowItemsCount} (queued 2nd)`,
        );
        if (sheetConfig.redItemsCount !== undefined) {
          console.log(
            `   🔴 Red rows (Accepted loss): ${sheetConfig.redItemsCount} (queued 3rd)`,
          );
        }
      }
      console.log(
        `   📌 Reason column: Column ${sheetConfig.columns.reasonColLetter || "D"} ("${sheetConfig.columns.reasonName}")`,
      );

      for (const item of sheetConfig.items) {
        targetMap.set(item.isbn, {
          isbn: item.isbn,
          targetPrice: item.targetPrice,
          sellPrice: item.sellPrice || 0,
          title: item.title,
          group: item.group || "",
          sheetRowNumber: item.sheetRowNumber,
          status: item.status,
          existingReason: item.existingReason,
          rowColor: item.rowColor || "white",
          matchType: item.matchType || "Exact ISBN",
        });
        isbnQueue.push(item.isbn);
      }
    } catch (e) {
      console.warn(`Could not parse ${configPath}:`, e.message);
    }
  }

  if (isbnQueue.length === 0) {
    const customIsbnFile = process.argv[2]
      ? path.isAbsolute(process.argv[2])
        ? process.argv[2]
        : path.join(process.cwd(), process.argv[2])
      : DEFAULT_ISBN_PATH;

    const customCsvFile = process.argv[3]
      ? path.isAbsolute(process.argv[3])
        ? process.argv[3]
        : path.join(process.cwd(), process.argv[3])
      : DEFAULT_CSV_PATH;

    targetMap = loadTargetData(customCsvFile);
    isbnQueue = loadIsbnQueue(customIsbnFile, targetMap);

    console.log(
      `📁 Input ISBN File: ${path.relative(process.cwd(), customIsbnFile)}`,
    );
    console.log(`📄 Loaded ${targetMap.size} reference items from target CSV`);
  }

  console.log(`📋 Total ISBNs in queue: ${isbnQueue.length}\n`);

  // Parse CLI flags like --cursor=2, --cursor 2, --batch=2, --auto, -a
  let requestedCursor = null;
  let isAutoMode = false;
  for (let a = 2; a < process.argv.length; a++) {
    const arg = process.argv[a];
    if (arg === "--auto" || arg === "-a") {
      isAutoMode = true;
    } else if (arg.startsWith("--cursor=")) {
      requestedCursor = arg.split("=")[1].trim();
    } else if (arg === "--cursor" && process.argv[a + 1]) {
      requestedCursor = process.argv[a + 1].trim();
      a++;
    } else if (arg.startsWith("--batch=")) {
      requestedCursor = arg.split("=")[1].trim();
    } else if (arg === "--batch" && process.argv[a + 1]) {
      requestedCursor = process.argv[a + 1].trim();
      a++;
    }
  }

  if (isAutoMode) {
    console.log(
      "----------------------------------------------------------------",
    );
    console.log("\x1b[1;36m🤖 AUTO MODE ACTIVATED (--auto):\x1b[0m");
    console.log("   • Hands-free: Automatically adds qualified offers to cart");
    console.log(
      "   • Automatic Google Sheet sync: Records rejection reasons to Column D",
    );
    console.log(
      `   • ⏱️  Pacing Enforcement: Minimum ${scraperConfig.automation?.minPacingSecondsPerIsbn || 30}s per ISBN to avoid rate limits`,
    );
    console.log(
      `   • 🛑 Pauses ONLY at ${scraperConfig.automation?.cartBatchLimit || 50}-item Amazon cart limit for checkout`,
    );
    console.log(
      "----------------------------------------------------------------\n",
    );
  }

  let cursorRow = null;
  let cursorBatch = 0;
  let defaultStartIndex = 0;

  if (requestedCursor) {
    console.log(
      `🔍 Searching for requested cursor: "CURSOR - ${requestedCursor}"...`,
    );
    // First search in loaded sheetConfig
    let matchedItem = sheetConfig?.items?.find((it) => {
      if (!it.existingCursor) return false;
      const c = it.existingCursor.toLowerCase();
      return (
        c === `cursor - ${requestedCursor}`.toLowerCase() ||
        c === `cursor-${requestedCursor}`.toLowerCase() ||
        c.includes(`cursor - ${requestedCursor}`) ||
        c.endsWith(` ${requestedCursor}`)
      );
    });

    // If not found locally in sheetConfig, refresh live from Google Sheet
    if (!matchedItem && sheetConfig?.spreadsheetId && sheetConfig?.tabName) {
      console.log(
        `   🔄 Not found in local config. Checking live Google Sheet for "CURSOR - ${requestedCursor}"...`,
      );
      try {
        const freshConfig = await generateConfig(
          sheetConfig.spreadsheetId,
          sheetConfig.tabName,
        );
        if (freshConfig) {
          sheetConfig = freshConfig;
          matchedItem = sheetConfig.items.find((it) => {
            if (!it.existingCursor) return false;
            const c = it.existingCursor.toLowerCase();
            return (
              c === `cursor - ${requestedCursor}`.toLowerCase() ||
              c === `cursor-${requestedCursor}`.toLowerCase() ||
              c.includes(`cursor - ${requestedCursor}`) ||
              c.endsWith(` ${requestedCursor}`)
            );
          });
        }
      } catch (err) {
        console.warn(
          `   ⚠️ Could not refresh live Google Sheet: ${err.message}`,
        );
      }
    }

    if (matchedItem) {
      cursorRow = matchedItem.sheetRowNumber;
      cursorBatch = parseInt(requestedCursor, 10) || 1;
      const foundIdx = isbnQueue.findIndex((isbn) => {
        const info = targetMap.get(isbn);
        return info && info.sheetRowNumber === cursorRow;
      });
      if (foundIdx !== -1) {
        defaultStartIndex = foundIdx;
        console.log(
          `\x1b[1;32m🎯 Flag --cursor=${requestedCursor} matched successfully!\x1b[0m`,
        );
        console.log(
          `   📍 Found "${matchedItem.existingCursor}" at Sheet Row #${cursorRow} (Queue Item ${foundIdx + 1}/${isbnQueue.length}, ISBN: ${matchedItem.isbn})`,
        );
        console.log(
          `   📦 Starting Batch ${cursorBatch + 1} from Row #${cursorRow}\n`,
        );
      }
    } else {
      console.log(
        `\x1b[1;33m⚠️ Could not find "CURSOR - ${requestedCursor}" in the Google Sheet.\x1b[0m`,
      );
      const available = sheetConfig?.items
        ?.filter((it) => it.existingCursor)
        ?.map((it) => `"${it.existingCursor}" at Row #${it.sheetRowNumber}`);
      if (available && available.length > 0) {
        console.log(
          `   💡 Available cursors in sheet: ${available.join(", ")}`,
        );
      }
    }
  }

  // If no specific cursor requested or not found, fall back to auto-detecting latestCursor
  if (!cursorRow && sheetConfig?.latestCursor) {
    cursorRow = sheetConfig.latestCursor.sheetRowNumber;
    cursorBatch = sheetConfig.latestCursor.batchNumber || 0;
    const foundIdx = isbnQueue.findIndex((isbn) => {
      const info = targetMap.get(isbn);
      return info && info.sheetRowNumber === cursorRow;
    });
    if (foundIdx !== -1) {
      defaultStartIndex = foundIdx;
      console.log(
        `\x1b[1;32m🚩 Existing Cursor detected:\x1b[0m "${sheetConfig.latestCursor.cursorText}" at Sheet Row #${cursorRow} (Queue Item ${foundIdx + 1}/${isbnQueue.length})`,
      );
      console.log(
        `   📦 Next Batch (Batch ${cursorBatch + 1}) will automatically start from Row #${cursorRow}\n`,
      );
    }
  }

  const { context, page } = await initAmazonBrowser();

  // Command Menu loop
  let isRunning = true;
  let currentIndex = defaultStartIndex;
  const CART_BATCH_LIMIT = scraperConfig.automation?.cartBatchLimit || 50;
  let cartItemsThisBatch = 0;
  let currentBatchNumber = cursorBatch + 1;

  while (isRunning) {
    console.log(
      "\n----------------------------------------------------------------",
    );
    console.log("📋 MAIN COMMAND MENU:");
    if (defaultStartIndex > 0) {
      console.log(
        `   [START]       -> Begin processing from Cursor (Sheet Row #${cursorRow}, Item ${defaultStartIndex + 1})`,
      );
      console.log(
        `   [RESET]       -> Start over from beginning of sheet (Row #13, Item 1)`,
      );
    } else {
      console.log("   [START]       -> Begin processing ISBNs step-by-step");
    }
    console.log("   [LOGIN]       -> Open Amazon for manual account sign-in");
    console.log(
      "   [GOTO <isbn>] -> Jump to a specific ISBN or Sheet Row number (e.g. GOTO 66)",
    );
    console.log("   [QUIT]        -> Close browser and exit");
    console.log(
      "----------------------------------------------------------------",
    );

    let cmd = "START";
    if (!isAutoMode) {
      cmd = (
        await ask("👉 Enter command [default: START]: ")
      ).toUpperCase();
    } else {
      console.log(
        "⚡ [Auto Mode] Automatically starting processing in 2 seconds...",
      );
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (cmd === "QUIT" || cmd === "Q" || cmd === "EXIT") {
      console.log("👋 Exiting script. Goodbye!");
      break;
    }

    if (cmd === "RESET") {
      currentIndex = 0;
      cartItemsThisBatch = 0;
      currentBatchNumber = 1;
      console.log("🔄 Reset queue to very beginning: Row #13 (Item 1).");
      continue;
    }

    if (cmd === "LOGIN" || cmd === "L") {
      console.log("\n🌐 Navigating to Amazon sign-in page...");
      await page.goto(
        "https://www.amazon.in/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.in%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=inflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0",
        {
          waitUntil: "domcontentloaded",
        },
      );
      console.log("🛑 SCRIPT PAUSED FOR USER SIGN-IN.");
      console.log(
        "👉 Please complete your login inside the opened browser window.",
      );
      await ask(
        "✅ When you are successfully logged in, press [ENTER] here to continue... ",
      );
      continue;
    }

    if (cmd.startsWith("GOTO")) {
      const targetParam = cmd.replace("GOTO", "").replace("#", "").trim();
      const num = parseInt(targetParam, 10);

      // Check if num matches a sheetRowNumber
      let foundIdx = -1;
      if (!isNaN(num)) {
        foundIdx = isbnQueue.findIndex((isbn) => {
          const info = targetMap.get(isbn);
          return info && info.sheetRowNumber === num;
        });
      }

      if (foundIdx !== -1) {
        currentIndex = foundIdx;
        console.log(
          `🎯 Jumped to Sheet Row #${num} (Queue Item ${currentIndex + 1}/${isbnQueue.length}, ISBN: ${isbnQueue[currentIndex]})`,
        );
      } else if (!isNaN(num) && num >= 1 && num <= isbnQueue.length) {
        currentIndex = num - 1;
        console.log(
          `🎯 Jumped to Queue Index ${num} (ISBN: ${isbnQueue[currentIndex]})`,
        );
      } else {
        foundIdx = isbnQueue.findIndex((i) => i.includes(targetParam));
        if (foundIdx !== -1) {
          currentIndex = foundIdx;
          console.log(
            `🎯 Jumped to ISBN match (Item ${currentIndex + 1}/${isbnQueue.length}, ISBN: ${isbnQueue[currentIndex]})`,
          );
        } else {
          console.log(
            `❌ Could not find matching ISBN, Sheet Row number, or index for '${targetParam}'`,
          );
        }
      }
    }

    // Process ISBNs loop
    console.log(
      `\n🚀 Starting Batch ${currentBatchNumber} (${cartItemsThisBatch}/${CART_BATCH_LIMIT} in cart so far)...\n`,
    );

    for (let i = currentIndex; i < isbnQueue.length; i++) {
      currentIndex = i;
      const isbn = isbnQueue[i];

      // Pre-flight check: ensure internet connectivity before starting ISBN
      await networkMonitor.waitUntilOnline(`ISBN ${isbn} processing`);

      const isbnStartTime = Date.now();
      const targetInfo = targetMap.get(isbn) || {
        isbn,
        targetPrice: 0,
        title: "N/A",
      };

      const isRed =
        targetInfo.rowColor === "red" ||
        (targetInfo.group && targetInfo.group.toLowerCase().includes("loss"));
      const isYellow =
        !isRed &&
        (targetInfo.rowColor === "yellow" ||
          (targetInfo.matchType &&
            targetInfo.matchType.toLowerCase().includes("different")));
      const colorBadge = isRed
        ? "\x1b[1;31m🔴 [RED - Accepted Loss]\x1b[0m"
        : isYellow
          ? "\x1b[1;33m🟡 [YELLOW - Different Edition]\x1b[0m"
          : "\x1b[1;37m⚪ [WHITE - Exact ISBN]\x1b[0m";

      console.log(
        "================================================================",
      );
      console.log(
        `📖 [${i + 1}/${isbnQueue.length}] Processing ISBN: \x1b[1;36m${isbn}\x1b[0m | ${colorBadge}`,
      );
      if (targetInfo.sheetRowNumber) {
        console.log(`📄 Google Sheet Row: #${targetInfo.sheetRowNumber}`);
      }
      console.log(`📚 Expected Title: ${targetInfo.title}`);
      const minMarginBuffer = scraperConfig.marginRules?.minMarginBufferINR ?? 50;
      console.log(
        `🎯 Compare Price: \x1b[1;32m₹${targetInfo.targetPrice.toFixed(2)}\x1b[0m | 💵 Sell Price: \x1b[1;36m₹${(targetInfo.sellPrice || 0).toFixed(2)}\x1b[0m (Min Margin: ₹${minMarginBuffer})`,
      );
      console.log(
        "================================================================",
      );

      let stepResult = {
        isbn,
        targetPrice: targetInfo.targetPrice,
        expectedTitle: targetInfo.title,
        timestamp: new Date().toISOString(),
      };

      try {
        // Step 1 & 2: Search top non-sponsored result
        console.log(`🔍 Searching Amazon for top non-sponsored listing...`);
        const searchResult = await searchTopNonSponsoredBook(page, isbn);

        if (!searchResult.found) {
          console.log(
            `❌ No non-sponsored search results found for ISBN ${isbn}.`,
          );
          stepResult.status = "REJECTED";
          stepResult.reason = "UNAVAILABLE";
        } else {
          console.log(`   ✔ Top Listing Found: "${searchResult.title}"`);
          console.log(`   🌐 Navigating to product page...`);
          await page.goto(searchResult.url, {
            waitUntil: "domcontentloaded",
            timeout: 35000,
          });
          await page.waitForTimeout(1500);

          // Step 3: Check ISBN Match (Rule 5)
          const isbnCheck = await checkProductPageIsbn(page, isbn);
          console.log(`   🔍 Page Title: "${isbnCheck.title}"`);
          console.log(
            `   🔍 Page ISBN / ASIN: ${isbnCheck.foundIsbn} | Matched: ${isbnCheck.matched ? "🟢 YES" : "🔴 NO"}`,
          );

          // Step 4: Open Sidebar (All Offers Display)
          console.log(`   📂 Opening All Buying Choices / Offers Sidebar...`);
          const sidebarOpened = await openAllOffersSidebar(page);
          console.log(
            `   📂 Sidebar Drawer Status: ${sidebarOpened ? "🟢 Open & Populated" : "⚪ Main Buybox Active"}`,
          );

          // Step 5: Extract All Offers
          const { offers: rawOffers, availabilityNotice } =
            await extractAllOffers(page);
          console.log(
            `   📦 Extracted ${rawOffers.length} offer(s) from page.`,
          );
          if (rawOffers.length === 0 && availabilityNotice) {
            console.log(`   ℹ️ Amazon Notice: "${availabilityNotice}"`);
          }

          // Step 6: Evaluate Rules with Sell Price Margin Buffer
          const evaluation = evaluateOffers(
            rawOffers,
            targetInfo.targetPrice,
            isbnCheck.matched,
            availabilityNotice,
            targetInfo.sellPrice || 0,
          );

          stepResult = {
            ...stepResult,
            ...evaluation,
            pageTitle: isbnCheck.title,
            pageIsbn: isbnCheck.foundIsbn,
            isbnMatched: isbnCheck.matched,
            rawOffersCount: rawOffers.length,
          };

          // Display evaluation table
          console.log("\n📊 OFFERS BREAKDOWN (SCORE SYSTEM):");
          if (evaluation.evaluatedOffers.length === 0) {
            console.log(`   ⚠️ No offers available to evaluate.`);
            if (availabilityNotice) {
              console.log(`   ℹ️ Reason: ${availabilityNotice}`);
            }
          } else {
            evaluation.evaluatedOffers.forEach((o, idx) => {
              const priceStr = `Item: ₹${o.itemPrice.toFixed(2)}`;
              const penStr =
                o.isQualified && o.deliveryPenalty > 0
                  ? ` (+₹${o.deliveryPenalty.toFixed(1)} pen)`
                  : "";
              const delStr = `${o.deliveryDateFormatted} (${o.deliveryDays !== null ? `${o.deliveryDays}d` : "N/A"})${penStr}`;
              const effStr = o.isQualified
                ? `Eff: ₹${o.effectivePrice.toFixed(1)}`
                : "";
              const scoreStr = o.isQualified
                ? `Score: ${o.score.toFixed(2)}`
                : "";
              const statStr = o.isQualified
                ? o.passedByMargin
                  ? `\x1b[32m✔ [${scoreStr} | ${effStr} | Margin: ₹${o.margin?.toFixed(0)}]\x1b[0m`
                  : `\x1b[32m✔ [${scoreStr} | ${effStr}]\x1b[0m`
                : `\x1b[31m✖ ${o.failureReason}${o.margin !== null ? ` (Margin: ₹${o.margin.toFixed(0)})` : ""}\x1b[0m`;

              console.log(
                `   [${idx + 1}] ${priceStr.padEnd(16)} | Del: ${delStr.padEnd(30)} | ${o.seller.slice(0, 18).padEnd(18)} | ${statStr}`,
              );
            });
          }

          console.log(
            "\n----------------------------------------------------------------",
          );
          if (evaluation.status === "QUALIFIED" && evaluation.chosenOffer) {
            const best = evaluation.chosenOffer;
            console.log(
              `🏆 \x1b[1;32mSELECTED BEST OFFER (HIGHEST SCORE):\x1b[0m`,
            );
            console.log(
              `   🏪 Seller:          ${best.seller} (${best.condition || "New"})`,
            );
            console.log(
              `   💰 Item Price:      ₹${best.itemPrice.toFixed(2)} (Compare Price: ₹${targetInfo.targetPrice.toFixed(2)})`,
            );
            if (best.passedByMargin) {
              console.log(
                `   📈 \x1b[1;33mQualified via Margin Buffer:\x1b[0m ₹${best.margin.toFixed(0)} margin (Sell ₹${targetInfo.sellPrice.toFixed(0)} - Item ₹${best.itemPrice.toFixed(0)} >= ₹${best.minMarginBuffer || 50})`,
              );
            }
            console.log(
              `   🚚 Delivery:        ${best.deliveryDateFormatted} (${best.deliveryDays} days) [Penalty: ₹${best.deliveryPenalty.toFixed(1)}]`,
            );
            console.log(
              `   🏷️  Effective Price: ₹${best.effectivePrice.toFixed(1)}`,
            );
            console.log(
              `   ⭐ Score:           ${best.score.toFixed(2)} / 1.00`,
            );
            console.log(`   ✅ STATUS:          RECOMMENDED TO ADD TO CART`);
          } else {
            console.log(`🛑 \x1b[1;31mDO NOT ADD TO CART\x1b[0m`);
            console.log(`   ❌ REASON: \x1b[1;31m${evaluation.reason}\x1b[0m`);
          }
          console.log(
            "----------------------------------------------------------------\n",
          );
        }
      } catch (err) {
        if (isNetworkError(err) || !(await networkMonitor.check())) {
          console.warn(
            `\n⚠️  \x1b[1;33m[NETWORK ERROR DETECTED]:\x1b[0m ${err.message}`,
          );
          console.log(
            `   ⏸️  Pausing operations. Waiting for internet connection to recover...`,
          );
          await networkMonitor.waitUntilOnline(`Retry for ISBN ${isbn}`);
          console.log(
            `   🔄 Internet restored! Refreshing Amazon session and retrying ISBN ${isbn}...\n`,
          );
          await page
            .goto("https://www.amazon.in/", {
              waitUntil: "domcontentloaded",
              timeout: 45000,
            })
            .catch(() => {});
          i--; // Decrement index so the loop retries this EXACT ISBN
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        console.error(`❌ Error during processing: ${err.message}`);
        stepResult.status = "ERROR";
        stepResult.error = err.message;
      }

      // ---------------------------------------------------------
      // DECISION & ADD TO CART (AUTO OR MANUAL MODE)
      // ---------------------------------------------------------
      let feedback = null;
      let shouldAddToCart = false;

      if (isAutoMode) {
        shouldAddToCart = stepResult.status === "QUALIFIED";
        console.log(
          `🤖 [Auto Mode Decision]: ${
            shouldAddToCart
              ? "\x1b[1;32m✔ Auto-adding highest score offer to cart\x1b[0m"
              : `\x1b[1;31m✖ Rejecting: ${stepResult.reason || "Not qualified"}\x1b[0m`
          }`,
        );
      } else {
        feedback = await ask(
          "📝 [FIELD 1] FEEDBACK (Type what is wrong/notes, or press ENTER to skip): ",
        );

        const defaultAdd = stepResult.status === "QUALIFIED" ? "YES" : "NO";
        const addChoice = (
          await ask(
            `🛒 [FIELD 2] ADD TO CART? (YES / NO) [default: ${defaultAdd}]: `,
          )
        ).toUpperCase();

        shouldAddToCart =
          addChoice === "YES" ||
          addChoice === "Y" ||
          (addChoice === "" && defaultAdd === "YES");
      }

      stepResult.userFeedback = feedback || null;
      stepResult.userConfirmedAddToCart = shouldAddToCart;

      if (shouldAddToCart && stepResult.chosenOffer) {
        await networkMonitor.waitUntilOnline(`Add to Cart for ISBN ${isbn}`);
        const added = await executeAddToCart(page, stepResult.chosenOffer);
        stepResult.cartAddedSuccess = added;
      } else {
        stepResult.cartAddedSuccess = false;
        console.log(`⏭️  Skipping Add-to-Cart for this item.`);
      }

      // Live Google Sheets Update for "NO WITH REASON"
      if (sheetConfig && targetInfo.sheetRowNumber) {
        const reasonCol = sheetConfig.columns?.reasonColLetter || "D";
        const cellRange = `'${sheetConfig.tabName}'!${reasonCol}${targetInfo.sheetRowNumber}`;

        if (stepResult.cartAddedSuccess) {
          cartItemsThisBatch++;
          console.log(
            `✨ Added to cart successfully: "${sheetConfig.columns?.reasonName || "NO WITH REASON"}" column left empty.`,
          );
          console.log(
            `🛒 Batch ${currentBatchNumber} Progress: \x1b[1;32m${cartItemsThisBatch}/${CART_BATCH_LIMIT}\x1b[0m books added to cart.`,
          );
        } else {
          const reasonText =
            stepResult.userFeedback || stepResult.reason || "Rejected";
          console.log(
            `📝 Updating Google Sheet: Writing "${reasonText}" to cell ${cellRange}...`,
          );
          await updateGoogleSheetCell(
            sheetConfig.spreadsheetId,
            cellRange,
            reasonText,
          );
        }
      }

      // Append record & feedback to log file
      fs.appendFileSync(FEEDBACK_LOG_FILE, JSON.stringify(stepResult) + "\n");
      console.log(
        `💾 Feedback & decision logged to ${path.basename(FEEDBACK_LOG_FILE)}`,
      );

      // Check if 50-book Amazon cart limit reached!
      if (cartItemsThisBatch >= CART_BATCH_LIMIT) {
        const nextIdx = i + 1;
        const nextIsbn = nextIdx < isbnQueue.length ? isbnQueue[nextIdx] : null;
        const nextTarget = nextIsbn ? targetMap.get(nextIsbn) : null;
        const nextRowNumber = nextTarget ? nextTarget.sheetRowNumber : null;
        const cursorCol = sheetConfig.columns?.cursorColLetter || "E";
        const cursorTag = `CURSOR - ${currentBatchNumber}`;

        console.log(
          "\n================================================================",
        );
        console.log(
          `🛑 \x1b[1;33mAMAZON CART LIMIT REACHED: 50/50 BOOKS ADDED (BATCH ${currentBatchNumber} COMPLETE)!\x1b[0m`,
        );
        console.log(
          "================================================================",
        );

        if (nextRowNumber && sheetConfig) {
          const cursorCell = `'${sheetConfig.tabName}'!${cursorCol}${nextRowNumber}`;
          console.log(
            `📝 Writing Cursor to Google Sheet: Cell ${cursorCell} -> "${cursorTag}"...`,
          );
          await updateGoogleSheetCell(
            sheetConfig.spreadsheetId,
            cursorCell,
            cursorTag,
          );
          console.log(
            `📍 Cursor successfully written to Row #${nextRowNumber} for Batch ${currentBatchNumber + 1}!`,
          );
        }

        console.log(
          "\n🛒 Your Amazon Cart now contains 50 items (maximum capacity).",
        );
        console.log(
          "👉 Please go to your open Amazon browser tab, place the order / checkout, and empty your cart.",
        );
        console.log(
          "================================================================\n",
        );

        const batchAction = (
          await ask(
            `👉 When cart is empty and you are ready for Batch ${currentBatchNumber + 1}, press [ENTER] (or type 'QUIT' to exit): `,
          )
        ).toUpperCase();

        if (batchAction === "QUIT" || batchAction === "Q") {
          isRunning = false;
          break;
        }

        cartItemsThisBatch = 0;
        currentBatchNumber++;
        console.log(
          `\n🚀 Starting Batch ${currentBatchNumber} from Row #${nextRowNumber || "next"}...\n`,
        );
        continue;
      }

      // ---------------------------------------------------------
      // AUTO MODE PACING (>= 30 SECONDS PER ISBN) OR MANUAL PROMPT
      // ---------------------------------------------------------
      if (isAutoMode) {
        const elapsedMs = Date.now() - isbnStartTime;
        const pacingSeconds =
          scraperConfig.automation?.minPacingSecondsPerIsbn || 30;
        const minPacingMs = pacingSeconds * 1000;
        if (elapsedMs < minPacingMs) {
          const remainingMs = minPacingMs - elapsedMs;
          const remainingSec = (remainingMs / 1000).toFixed(1);
          console.log(
            `\n⏱️  [Auto Pacing] ISBN completed in ${(elapsedMs / 1000).toFixed(1)}s. Waiting ${remainingSec}s to complete ${pacingSeconds}s rate-limit window...`,
          );
          await new Promise((r) => setTimeout(r, remainingMs));
        } else {
          console.log(
            `\n⏱️  [Auto Pacing] ISBN took ${(elapsedMs / 1000).toFixed(1)}s (>= ${pacingSeconds}s threshold). Proceeding directly to next ISBN...`,
          );
        }
      } else {
        // Action for next step in manual mode
        const nextAction = (
          await ask(
            "\n👉 Press [ENTER] for next ISBN, or type 'SKIP', 'RETRY', 'MENU', 'QUIT': ",
          )
        ).toUpperCase();

        if (nextAction === "QUIT" || nextAction === "Q") {
          isRunning = false;
          break;
        } else if (nextAction === "RETRY" || nextAction === "R") {
          i--; // Repeat same item
        } else if (nextAction === "MENU" || nextAction === "M") {
          break; // Return to main command loop
        }
      }
    }
  }

  networkMonitor.stop();
  await context.close();
  console.log("\n🎉 Session ended cleanly. All data preserved in profile.");
}

main().catch((err) => {
  console.error("Fatal exception:", err);
  process.exit(1);
});

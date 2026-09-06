const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");

chromium.use(stealth);

async function initBrowser(
  headless = true,
  profileName = "amazon_search_profile",
  blockResources = true,
) {
  const userDataDir = path.join(__dirname, "..", "..", "..", profileName);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--lang=en-IN,en-GB,en-US",
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    geolocation: { latitude: 28.6139, longitude: 77.209 }, // New Delhi, India
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await context
    .addCookies([
      { name: "lc-main", value: "en_US", domain: ".amazon.com", path: "/" },
      { name: "lc-main", value: "en_IN", domain: ".amazon.in", path: "/" },
      { name: "lc-main", value: "en_GB", domain: ".amazon.co.uk", path: "/" },
    ])
    .catch(() => {});

  if (blockResources) {
    await context.route("**/*", (route) => {
      const requestType = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(requestType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  let page =
    context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  return { context, page };
}

function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { initBrowser, getRandomDelay };

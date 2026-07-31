const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");

chromium.use(stealth);

async function initBrowser(
  headless = true,
  profileName = "amazon_search_profile",
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
    ],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  await context.route("**/*", (route) => {
    const requestType = route.request().resourceType();
    if (["image", "media", "font", "stylesheet"].includes(requestType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let page =
    context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  return { context, page };
}

function getRandomDelay(min = 2000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { initBrowser, getRandomDelay };

const { chromium } = require("playwright");

async function main() {
  console.log("🌐 Launching Playwright Chromium browser...");
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  console.log("🚀 Navigating to https://www.google.com ...");
  await page.goto("https://www.google.com", { waitUntil: "domcontentloaded" });

  console.log("✅ Google.com is open!");
  console.log("👉 The browser window will stay open. Press Ctrl+C in terminal or close the browser window when done.\n");

  // Keep process alive while browser is open
  page.on("close", async () => {
    console.log("Browser window closed. Exiting...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Error launching browser:", err);
  process.exit(1);
});

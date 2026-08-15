const fs = require("fs");
const readline = require("readline");
const { initBrowser } = require("../utils/browser");

(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("Launching browser...");
  const { context, page } = await initBrowser(false, "amazon_cart_profile", false);

  await page.goto("https://www.amazon.in/");
  console.log("\n==========================================================");
  console.log("👉 Please log in to your Amazon account in the browser window.");
  console.log("   (If you are already logged in, you can proceed.)");
  console.log("==========================================================\n");

  await question(
    "Press ENTER here when you are logged in and ready to start adding to cart...",
  );

  const dataPath = "order-via-amazon-in.json";
  if (!fs.existsSync(dataPath)) {
    console.error("❌ Could not find order-via-amazon-in.json!");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const itemsToAdd = data.slice(0, 200);

  console.log(
    `\nFound ${data.length} total items. Preparing to add the first ${itemsToAdd.length} to cart...\n`,
  );

  // 3. Loop and add to cart
  for (let i = 0; i < itemsToAdd.length; i++) {
    const item = itemsToAdd[i];
    const isbn = item.ISBN;
    console.log(
      `\x1b[1m[${i + 1}/${itemsToAdd.length}] Processing ISBN: ${isbn}\x1b[0m`,
    );

    try {
      await page.goto(`https://www.amazon.in/s?k=${isbn}`);

      // Look for the product link in the search results
      const productLink = await page.$(
        "a.a-link-normal.s-no-outline, h2 a.a-link-normal",
      );
      if (!productLink) {
        console.log(`   ❌ Could not find product in search results.`);
        continue;
      }

      const href = await productLink.getAttribute("href");
      await page.goto(`https://www.amazon.in${href}`);

      // Attempt to click Add to Cart
      const addToCartBtn = await page.$("#add-to-cart-button");
      if (addToCartBtn) {
        await Promise.all([
          page
            .waitForNavigation({
              waitUntil: "domcontentloaded",
              timeout: 15000,
            })
            .catch(() => {}), // ignore if no navigation happens (e.g. ajax sidebar cart)
          addToCartBtn.click(),
        ]);
        console.log(`   ✅ Added ${isbn} to cart.`);
      } else {
        // Sometimes it's a different buy box ID or only available via third party
        console.log(`   ⚠ No main 'Add to Cart' button found. Skipping.`);
      }

      // Wait to mimic human speed and avoid being completely blocked
      await new Promise((r) => setTimeout(r, 2500));
    } catch (e) {
      console.log(`   ❌ Error processing ${isbn}: ${e.message}`);
    }
  }

  console.log("\n🎉 Finished adding items to cart!");

  // 4. Wait for 'quit'
  while (true) {
    const ans = await question("\nType 'quit' to close the browser and exit: ");
    if (ans.trim().toLowerCase() === "quit") {
      break;
    }
  }

  await context.close();
  rl.close();
})();

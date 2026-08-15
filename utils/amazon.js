async function checkDogPage(page) {
  return await page.evaluate(() => {
    return (
      document.title.includes("Sorry! Something went wrong") ||
      document.title.includes("Robot Check") ||
      document.body.innerText.includes("something went wrong on our end") ||
      document.body.innerText.includes("Enter the characters you see below") ||
      document.querySelector('form[action="/errors/validateCaptcha"]') !== null
    );
  });
}

function cleanAndCheckMRP(priceStr, mrpStr) {
  if (priceStr === "N/A" || mrpStr === "N/A" || !priceStr || !mrpStr)
    return mrpStr;
  const pNum = parseFloat(priceStr.replace(/[^\d.]/g, ""));
  const mNum = parseFloat(mrpStr.replace(/[^\d.]/g, ""));
  if (!isNaN(pNum) && !isNaN(mNum)) {
    if (mNum <= pNum) return "N/A";
  }
  return mrpStr;
}

async function setAmazonLocation(page, pincode = "122101") {
  try {
    const url = page.url();
    if (!url.includes("amazon.in")) {
      await page.goto("https://www.amazon.in", {
        timeout: 30000,
        waitUntil: "domcontentloaded",
      });
    }

    // Check if location is already set to the desired pincode
    const currentLocation = await page
      .textContent("#glow-ingress-line2", { timeout: 4000 })
      .catch(() => "");

    if (currentLocation && currentLocation.includes(pincode)) {
      return { success: true, alreadySet: true, location: currentLocation.trim() };
    }

    // Click on the delivery location button in header
    const locationBtn = await page.waitForSelector("#nav-global-location-popover-link", {
      state: "attached",
      timeout: 8000,
    });

    if (locationBtn) {
      await page.evaluate(() => {
        const btn = document.querySelector("#nav-global-location-popover-link");
        if (btn) btn.click();
      });

      // Wait for pincode input box
      await page.waitForSelector("#GLUXZipUpdateInput", {
        state: "visible",
        timeout: 8000,
      });

      await page.fill("#GLUXZipUpdateInput", pincode);
      await page.waitForTimeout(500);

      // Click Apply/Submit button
      await page.evaluate(() => {
        const applyBtn =
          document.querySelector("#GLUXZipUpdate input[type='submit']") ||
          document.querySelector("#GLUXZipUpdate .a-button-input") ||
          document.querySelector('[data-action="GLUXPostalInputAction"] input');
        if (applyBtn) applyBtn.click();
      });

      // Wait for popover or reload
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });

      const updatedLocation = await page
        .textContent("#glow-ingress-line2", { timeout: 4000 })
        .catch(() => "");

      return { success: true, alreadySet: false, location: updatedLocation.trim() };
    }

    return { success: false, error: "Location button not found" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { checkDogPage, cleanAndCheckMRP, setAmazonLocation };

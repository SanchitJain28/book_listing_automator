async function detectBlock(page, response) {
  const status = response?.status() ?? null;
  const headers = response?.headers?.() || {};
  const wafAction = headers["x-amzn-waf-action"];
  const retryAfter = headers["retry-after"];
  if (/^(captcha|challenge)$/i.test(wafAction || "")) {
    return { reason: `Amazon WAF ${wafAction}`, status, retryAfter };
  }
  if ([403, 429, 503].includes(status)) {
    return { reason: `HTTP ${status}`, status, retryAfter };
  }

  const reason = await page.evaluate(() => {
    const title = document.title;
    const heading = document.querySelector("h1")?.textContent?.trim() || "";
    if (document.querySelector('form[action*="validateCaptcha"], #captchacharacters')
        || /robot check|amazon captcha/i.test(title)) {
      return "Amazon CAPTCHA or robot check";
    }
    const denied = /^(access denied|request blocked|too many requests)\b/i;
    if (denied.test(title) || denied.test(heading)) return "Amazon access denied or rate limited";
    if (document.querySelector("#productTitle, .s-search-results")) return null;

    const body = document.body?.innerText || "";
    if (/enter the characters you see below|sorry, we just need to make sure you're not a robot/i.test(body)) {
      return "Amazon CAPTCHA or robot check";
    }
    if (denied.test(body.trim())) return "Amazon access denied or rate limited";
    if (/sorry! something went wrong/i.test(title) || /something went wrong on our end/i.test(body)) {
      return "Amazon error page";
    }
    return null;
  });
  return reason ? { reason, status, retryAfter } : null;
}

async function navigateAmazon(page, url, { timeout, readySelector, readyTimeout, submitSearch }) {
  const options = { timeout, waitUntil: "domcontentloaded" };
  const response = submitSearch
    ? await submitSearch(options)
    : await page.goto(url, options);
  const block = await detectBlock(page, response);
  if (block || !readySelector) return block;

  const ready = await page.waitForSelector(readySelector, { timeout: readyTimeout }).catch(() => null);
  return ready ? null : detectBlock(page, response);
}

module.exports = { navigateAmazon };

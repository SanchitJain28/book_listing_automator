# Amazon.com and Amazon.co.uk

Both marketplace CLIs and the master scraper use `scrapeAmazonBook(page, { directUrl, isbn, domain })`. `domain` can be `amazon.com` or `amazon.co.uk`; a direct URL also selects its marketplace. Existing Amazon.in calls keep their default marketplace and extraction flow. The shared ISBN validator additionally supports equivalent ISBN-10 and ISBN-13 identifiers.

```sh
node scrapers/amazon-us-isbn/amazon-us-isbn.js test/data/amazon-scraper/input.txt --headless --output output/amazon-us-isbn/results.jsonl
node scrapers/amazon-uk-isbn/amazon-uk-isbn.js path/to/input.txt --headless --output output/amazon-uk-isbn/results.jsonl
npm run test:amazon-international
```

The international flow searches the ISBN on the requested domain, opens the first organic product listing, and reads its product details. It does not switch to a cheaper format or later listing. Product specifications independently establish ISBN evidence, with conflicts reported as mismatches. A matching out-of-stock listing remains found. Blocked requests, explicit empty searches, ISBN mismatches and extraction errors remain distinct.

Prices preserve decimal fractions, including the separate Amazon whole/fraction markup. Primary price, list price, seller, shipping and stock are scoped to the product buy box. Temporary out-of-stock text overrides retained prices and active order controls. The CLIs request USD or GBP using the site's currency preference; extraction records the actual displayed currency if Amazon shows a different one. Missing values stay null. No cart, purchases, login, address changes or CAPTCHA interactions are performed.

TXT ISBN inputs and JSON Lines records are supported. JSON Lines output includes ISBN evidence and an adjacent verification report. Runs are sequential with pacing, bounded navigation retries and resource cleanup. Resume continues from saved output without automatically retrying failures. Add `--retry-failed` for an intentional retry pass. The CLI wrappers are import-safe. A nonzero verification exit status means some inputs remain unverified. UK live verification is deliberately omitted when requested; its behavior is covered by the shared offline tests.

## Verification on 2026-10-25

The 25 ISBNs in `test/data/amazon-scraper/input.txt` were tested on Amazon.com. Canonical output: `output/amazon-us-isbn/verification-2026-10-25/checked-results.jsonl` and its adjacent `.report.json`.

20 listings had independently matching product ISBNs (1 in stock, 19 out of stock). Searches for `9780727914217`, `9788481747430`, and `9783111000657` returned explicit empty results. The first listing for `9780753139578` exposed ISBN-10 `1585679070`, a different edition. The first listing for `9781441780751` was ASIN `B004PF5CHM` without product ISBN evidence, so it remained unverified. These five records are not counted as verified matches. There was no UK live run, per the user's instruction.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

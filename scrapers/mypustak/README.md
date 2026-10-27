# MyPustak ISBN scraper

Searches `https://www.mypustak.com/search?value=<isbn>&page=1`. Inspects the top three result cards in order and verifies each product ISBN. Stops at the first exact match. If none of the top three match, reports an ISBN mismatch and retains the checked candidates and evidence. This follows the user’s updated rule in this chat, superseding PLAN.md’s original first-result-only rule. Recommendations cannot supply evidence. The site opens product cards in a new tab; the scraper reads and reliably closes that tab.

```sh
node scrapers/mypustak/mypustak-isbn.js test/data/mypustak-scraper/input.txt --headless --output output/mypustak/results.jsonl
npm run test:mypustak
```

Preserves `scrapeMyPustakBook(page, { directUrl, isbn })` for the master scraper. Supports TXT ISBN input and JSON Lines records. Results remain JSON Lines and include `found_isbn`, `isbn_matched`, `isbn_match_source`, `isbn_evidence`, and selected-result rank/title/product ID. Only a verified ISBN is counted as found. ISBN-10 and ISBN-13 equivalents match; conflicting product specifications or matching-product structured data reject a listing. Query text, image names and product URL text cannot independently establish a match.

When no checked result matches, the first result is retained for review with `found: false`, `isbn_matched: false`, `stock_status: "ISBN mismatch"` and its original availability in `listing_stock_status`. Empty searches, blocked responses and extraction failures are distinguished. Stock is independent of whether a listing matches the requested ISBN.

Prices come from the target product panel, excluding recommendations, discounts, totals and shipping. MyPustak's used donated books sometimes show "Pay Only Including Delivery" rather than an item price. These amounts are preserved as `price` with `price_includes_delivery: true` and `price_type: "delivery_inclusive_charge"`; the total is preserved without inventing an MRP or shipping split. New-book item prices and shipping are recorded separately. Missing values remain null. The adjacent `.report.json` includes evidence, condition, price semantics, checked candidate ranks, and any failure reason.

Navigation uses bounded retries and sequential 2–4 second pacing. Resume continues after saved output, preserving successes and failures. Add `--retry-failed` for an intentional retry pass. Browser resources close in finally. No cart actions, purchases or form submissions occur. Exit code 2 signals incomplete ISBN verification.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

## Bounded browser memory

The standalone runner now recycles its persistent browser context after every 100 saved inputs and closes extra pages after each input. It keeps the existing output/resume paths and top-three ISBN matching rule. Context generations, open-page counts and Node RSS are logged every 25 inputs. Ctrl+C/SIGTERM finishes cleanup and leaves the current pending input resumable.

Popup tracking starts before the candidate click and remains active through click failures. An idle guard closes late popups until the main page closes. If a card exposes an actual same-site product URL matching its product ID, the scraper can navigate the reusable main page directly; it never constructs a URL from an ID. All extraction still happens through Playwright.

For the shared Node/two-browser runner and resource/cache comparison options, see `../../scripts/SHARED-SCRAPERS.md`.

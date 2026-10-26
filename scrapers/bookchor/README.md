# BookChor ISBN scraper

Searches BookChor by ISBN, opens matching product cards, and verifies the product's ISBN. An unavailable matching book is still found; stock is reported separately.

```sh
node scrapers/bookchor/bookchor-isbn.js test/data/bookchor-scraper/input.txt --headless --output output/bookchor/my-run.jsonl
npm run test:bookchor
```

Omit `--headless` for a visible browser. Text inputs contain one ISBN per line. JSON Lines inputs accept `searched_isbn`/`isbn` and optional `buy_url`/`url`. The existing `scrapeBookChor(page, directUrl, targetIsbn)` export remains available through `bookchor-isbn.js` for the master scraper.

## Verification and data

- Searches `https://www.bookchor.com/search/?query=<isbn>`. Candidate links come only from the search results' product cards and must encode an equivalent ISBN in `/book/<isbn>/...`.
- Product Highlights, labeled specifications, or product-specific structured data provide ISBN evidence. A conflicting product ISBN rejects the candidate, even when the URL matches. If explicit ISBN metadata is absent, the final product URL's ISBN can establish the match; query text cannot. `isbn_match_source` and `isbn_evidence` explain the result.
- Item price, MRP, author, binding, and shipping text come from the target product's detail panel, excluding banners and recommendations. Empty metadata is null. The default selected condition is recorded in `condition`; `conditions` lists the displayed condition choices and prices without changing them.
- Waits for BookChor's startup script to reveal the active cart/availability area. `in_stock` is true, false, or null when the page provides no clear signal. A price alone does not establish availability. Hidden notification modals and unavailable recommendations do not change the target's stock label.
- No cart actions, purchases, address changes, or login actions are performed.

## Output and operations

Outputs are JSON Lines, with a companion `.report.json` summarizing each ISBN, title, URL, matching evidence, price, condition, and stock. Open the output through **Browse project files → output → bookchor** in the dashboard.

Processing is sequential with 2–4 seconds between inputs, at most three search result pages, and at most three navigation attempts per URL. Blocks, navigation failures, missing markup, empty searches, and ISBN conflicts remain distinct. Browser profiles are isolated under ignored `profiles/bookchor/`, with cleanup in `finally`.

Normal resume continues after saved output, including blocked, not-found and failed results. Add `--retry-failed` to explicitly retry unsuccessful records. Output is append-only, so retries preserve earlier attempt records. Choose a fresh `--output` filename for one clean row per input. Exit codes are 0 for all matched, 2 for incomplete verification, and 1 for fatal setup failures.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

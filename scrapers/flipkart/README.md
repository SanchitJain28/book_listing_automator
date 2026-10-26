# Flipkart ISBN scraper

Searches Flipkart's Books category, opens exact ISBN candidates in relevance order, and verifies their product details. An unavailable matching product is still `found: true`.

```sh
node scrapers/flipkart/flipkart-isbn.js data/test/flipkart-scraper/input.txt --headless --output output/flipkart/my-run.jsonl
node --test test/flipkart.test.js
```

Omit `--headless` for a visible browser. Input may be a text file with one ISBN per line or JSON Lines with `searched_isbn`/`isbn` and optional `buy_url`/`url`. Omitting `--output` preserves the shared output-path convention. The exported `scrapeFlipkart(page, directUrl, targetIsbn)` function remains available through `flipkart-isbn.js` for the master scraper.

## Evidence and extraction

- Searches `/books/pr?sid=bks&q=<isbn>&otracker=categorytree`, with a maximum of three result pages and three navigation attempts per URL. Search cards must independently match through `data-id` and product `pid`.
- Product specifications and product-specific JSON-LD take precedence. Conflicting product ISBNs reject the candidate. ISBN-10 and its equivalent ISBN-13 are supported; query parameters alone never establish a match.
- When product ISBNs are absent, matching search-card `data-id`, search-link `pid`, and final product `pid` provide fallback evidence. The source appears in `isbn_match_source`, with original values in `isbn_evidence`.
- Extracts the ordinary item price in INR, excluding ads, recommendations, conditional offers, and animated purchase-button digits. MRP and unavailable metadata remain null when absent. Authors can fall back to product-specific page metadata or the exact matched search card.
- `found` describes the verified listing; `in_stock` is independently true, false, or null when unknown. Delivery reflects the current page's location context; the scraper does not set a delivery address.
- Blocked requests and parsing/navigation failures carry `error_code` and `error`, independently from genuinely empty searches. Nothing is added to a cart.

## Output, reports, and resume

Output is append-only JSON Lines and can be opened directly in the dashboard. A companion `<output-name>.report.json` contains one current summary per input item, including title, URL, ISBN evidence, price, stock, and any failure reason.

Rerunning the same command with the same input/output resumes after the saved input prefix, including failed or unverified records. Failures are retried only with `--retry-failed`; retry results are appended to preserve attempt history. Use a **new `--output` path** for a clean verification run and a table with exactly one row per input.

The CLI exits with code 0 when all input records are matched, 2 when any remain unverified, and 1 for setup/fatal errors. Browser profiles are isolated by output path under ignored `profiles/flipkart/`. Processing is sequential with 2–4 seconds between input items, and browser cleanup runs in `finally`.

## Modules

- `core/search.js`: URL validation, exact search-card candidates, navigation, block detection.
- `core/productExtractor.js`: old and current layouts, product details expansion, scoped extraction.
- `core/isbn.js`: normalization, checksums, equivalence, evidence precedence.
- `scraper.js`: single-book orchestration; `runner.js`: CLI, batches, resume, reports.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

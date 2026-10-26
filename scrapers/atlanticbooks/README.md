# Atlantic Books ISBN scraper

Searches `https://atlanticbooks.com/search?q=<isbn>` and follows product links from the search results grid. Exact ISBN handles are tried first, with up to ten result candidates inspected. Product specifications, Shopify variant barcode/SKU, and variant metadata establish ISBN evidence; conflicting evidence rejects a candidate. Equivalent ISBN-10 and ISBN-13 identifiers are supported. If explicit evidence is absent, a product-path ISBN may establish a match and is labeled separately. Search query text never establishes a match.

```sh
node scrapers/atlanticbooks/atlanticbooks-isbn.js test/data/atlantic-scraper/input.txt --headless --output output/atlanticbooks/results.jsonl
npm run test:atlanticbooks
```

Preserves the master scraper export `scrapeAtlanticBook(page, { directUrl, isbn })`. The CLI is import-safe and accepts TXT ISBN inputs or JSON Lines records. Output is JSON Lines with existing fields plus `found_isbn`, `isbn_matched`, `isbn_match_source`, `isbn_evidence`, and the matching variant ID. When the target ISBN belongs to a later variant, price, stock and binding come from that variant. Missing values remain null; a matching unavailable product is still found. Prices are INR, with Shopify integer prices converted from paise. Delivery is the text currently shown by the site.

The scraper uses the embedded Shopify product data belonging to the current product handle and DOM metadata from its product section. Recommendation products, app offers and bulk quote forms cannot supply the main item price. Navigation is sequential with at most three attempts and 2–4 second pacing. Resume continues from saved output, including saved failures. Add `--retry-failed` for an intentional retry pass. Browser resources close in finally. An adjacent `.report.json` contains per-ISBN results; exit code 2 signals incomplete verification. No cart, form submissions or purchases are performed.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

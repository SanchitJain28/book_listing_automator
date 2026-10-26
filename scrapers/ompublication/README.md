# Om Publications ISBN scraper

Searches `https://www.ompublications.in/products/search?q=<isbn>` and follows discovered `/product/books/<id>` links from the search results section. Verifies the ISBN badge on the product page before counting a match. ISBN-10 and ISBN-13 equivalents are supported. Query text, titles and product IDs cannot prove an ISBN match; conflicting product ISBNs reject a candidate.

```sh
node scrapers/ompublication/ompublication-isbn.js test/data/ompublication-scraper/input.txt --headless --output output/ompublication/results.jsonl
npm run test:ompublication
```

Exports `scrapeOmPublication(page, directUrl, targetIsbn)` and is registered for `ompublications.in` in the master scraper. Direct product URLs require a target ISBN because product IDs do not encode ISBNs. TXT input and JSON Lines input are supported. Output is JSON Lines with book metadata, prices in INR, availability, `found_isbn`, `isbn_matched`, `isbn_match_source` and `isbn_evidence`. Publisher, delivery and other unavailable metadata remain null. A matching unavailable listing is still found; availability is reported separately. In-stock status requires an enabled visible Add to Cart control; no purchase controls are clicked.

Search candidates retain relevance order. At most three result pages and twenty candidate products are inspected. Navigation has at most three attempts with backoff. Inputs run sequentially with 2–4 second pacing. Resume continues from saved output, including saved failures. Add `--retry-failed` for an intentional retry pass. The adjacent `.report.json` includes per-ISBN titles, URLs, evidence, prices, stock and failure reasons. Exit code 2 indicates incomplete verification. Browser resources close in finally. No cart actions or purchases are performed.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

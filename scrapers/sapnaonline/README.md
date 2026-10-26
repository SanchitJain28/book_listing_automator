# SapnaOnline ISBN scraper

Searches `https://www.sapnaonline.com/search?keyword=<isbn>` and visits exact ISBN candidates from the search results container. Product specifications independently verify the ISBN; conflicting specifications reject a candidate. When specifications are absent, a product path ISBN can establish a match and is explicitly labeled as that evidence source. Equivalent ISBN-10/ISBN-13 identifiers are supported.

```sh
node scrapers/sapnaonline/sapnaonline-isbn.js test/data/sapnabooks-scraper/input.txt --headless --output output/sapnaonline/results.jsonl
npm run test:sapnaonline
```

The exported `scrapeSapnaOnline(page, directUrl, targetIsbn)` remains compatible with the master scraper. TXT ISBN inputs and JSON Lines inputs are supported. JSON Lines output preserves existing fields and adds `found_isbn`, `isbn_matched`, `isbn_match_source`, and `isbn_evidence`. A matching unavailable book is still found; availability is separate. Missing fields stay null. Product price and stock controls are scoped to the product panel, excluding recommendations.

Requests run sequentially with 2–4 second pacing, at most three navigation attempts, and browser cleanup in finally. Resume continues after saved output, preserving successes and failures. Add `--retry-failed` only when deliberately retrying unsuccessful records. An adjacent `.report.json` lists titles, URLs, ISBN evidence, prices, stock, and failure reasons. Exit code 2 indicates some inputs remain unverified. Delivery information is the site's current visible text; no cart or checkout actions are performed.

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

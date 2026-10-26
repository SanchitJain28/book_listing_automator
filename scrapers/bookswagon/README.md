# BooksWagon ISBN scraper

Searches `https://www.bookswagon.com/search-books/<isbn>` and selects exact ISBN product links from BooksWagon search result cards, supporting the reference list layout and the current grid layout. Checks product ISBN-10/ISBN-13 specifications and the product's hidden ISBN field for conflicts. Equivalent ISBN-10 and ISBN-13 identifiers are supported. If explicit ISBN evidence is absent, a matching `/book/<slug>/<isbn>` path can establish a match with its evidence source labeled separately.

```sh
node scrapers/bookswagon/bookswagon-isbn.js test/data/bookswagon-scraper/input.txt --headless --output output/bookswagon/results.jsonl
npm run test:bookswagon
```

Retains the master scraper export `scrapeBookswagon(page, directUrl, targetIsbn)`. TXT ISBN inputs and JSON Lines inputs are supported. Results are JSON Lines with existing fields plus ISBN evidence, verification source, metadata and visible shipping text. Prices are INR. Missing prices remain null; availability is independent of whether a matching book was found. Product price extraction excludes app-only offers, coupons, and recommendation prices.

Navigation runs sequentially with bounded retries and 2–4 second pacing. Resume identifies inputs by ISBN, input URL and duplicate occurrence. All saved records are preserved on normal resume, including failures. Add `--retry-failed` for an intentional retry pass. Duplicate input lines each retain an output row while reusing a verified listing. An adjacent `.report.json` contains a per-input verification report; nonzero exit status indicates unverified inputs. Browser resources close in finally. No cart or checkout actions are performed.

The supplied test input contains 28 lines, representing 27 unique ISBNs (`9781361168042` appears twice).

Resume recovery uses `utils/resume.js`. If interruption leaves an incomplete final JSON line, it is backed up to a `.partial-*.bak` file before the unfinished input is retried. Keep the same input order and output path when resuming. A malformed middle record stops the run rather than silently skipping data.

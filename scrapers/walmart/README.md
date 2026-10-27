# Walmart ISBN scraper

```sh
node scrapers/walmart/walmart-isbn.js test/data/walmart-scraper/input.txt --headless --output output/walmart/verification-2026-10-27/results.jsonl
npm run test:walmart
```

Omit `--headless` for a visible browser. On a block, headed mode keeps the blocked page open for inspection until you close the window or press Ctrl+C. The batch stays stopped and does not send more scraper requests. Headless mode still closes automatically. The saved cooldown applies to both modes on restart.

The interactive `node runner.js` menu recommends Walmart for paths containing `walmart`. The master scraper routes Walmart product/search links to the import-safe `scrapeWalmart(page, directUrl, targetIsbn)` export.

The scraper searches `https://www.walmart.com/search?q=<isbn>`, discovers organic product cards, and checks candidates in relevance order across at most three result pages and twenty candidates. Product specifications and product-specific structured data provide independent ISBN evidence; search queries, URL slugs, numeric Walmart item IDs, advertisements and recommendations cannot establish a match. Conflicting product ISBNs disqualify a candidate. Equivalent ISBN-10/ISBN-13 identifiers are supported.

Output is JSON Lines with the same core fields as the other scrapers, including `store`, `searched_isbn`, `found`, `found_isbn`, `isbn_matched`, `isbn_match_source`, and `isbn_evidence`. Title, author, publisher, binding, pages, language, publication date, price, MRP, currency, seller, stock and visible delivery information are extracted when present. Missing fields remain null. Prices retain USD decimal precision. A matching unavailable listing is found independently of stock. Pickup/delivery-option unavailability does not override available shipping. No cart or purchase controls are clicked.

Reports adjacent to the output (`.report.json` and `.report.csv`) list every input, its evidence, price, stock, failure reason, or pending status. The dashboard JSON Lines parser is covered by an offline compatibility test. Duplicate input occurrences keep separate indices.

## Resume and blocking

Use the same command, input order and output path to resume. Completed rows are preserved, including ordinary failures; `--retry-failed` explicitly retries unsuccessful rows. The shared resume helper backs up and repairs an incomplete final JSON line.

Page requests are sequential with 2–5 second pacing, and transient errors get bounded retries with increasing backoff. `Retry-After` is honored. HTTP blocks or Walmart's `Robot or human?` challenge immediately stop requests. The blocked attempt is saved in `<output>.attempts.jsonl`, not appended to completed output. A `<output>.pause.json` checkpoint preserves the pending ISBN and a minimum five-minute cooldown (extended by server timing). The report marks the remaining inputs pending. Restarting during cooldown opens no browser; restart after the deadline retries the pending input. The cooldown is an application minimum and does not establish that Walmart will grant access afterwards. No challenge solving, proxy rotation or anti-detection modifications are used.

Exit codes: 0 = all inputs verified; 2 = completed with unverified inputs; 3 = deliberately paused by a block; 1 = startup/runtime failure. The watcher respects codes 2 and 3 rather than repeatedly restarting Walmart.

## Verification on October 27, 2026

The supplied file contains 20 valid ISBNs. The live test was invoked against that full input using a fresh output, without predefined product URLs. Walmart redirected the first search, `9783384113221`, to its `/blocked` page with a `Robot or human?` challenge (HTTP 200). The scraper stopped immediately and closed its browser. **0/20 verified; 1 blocked, 19 unattempted/pending. Walmart is not live-verified.**

Artifacts are in `output/walmart/verification-2026-10-27/`: `results.report.json`, `results.report.csv`, `results.jsonl.attempts.jsonl`, the pause checkpoint, and the blocked-page HTML/screenshot. The main JSON Lines output remains empty so the blocked input is retried on resume. Completing the 20-ISBN acceptance test requires access to Walmart without the challenge.

The 18 offline tests use the supplied reference and synthetic edge cases. They test extraction and validation behavior, not twenty live matches.

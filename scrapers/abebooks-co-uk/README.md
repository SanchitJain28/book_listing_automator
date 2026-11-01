# AbeBooks UK advanced ISBN search

```sh
node scrapers/abebooks-co-uk/abebooks-co-uk-isbn.js \
  test/data/abebooks-co-uk/input.txt \
  --output output/abebooks-co-uk/headed-check/results.jsonl
```

Omit `--headless` to inspect the browser; add it for headless execution.
The scraper opens `/servlet/SearchEntry`, fills the ISBN field and submits the site's advanced-search form with its GBP/relevance defaults. It selects the first independently evidenced exact ISBN match among regular result cards. If regular results are absent, it uses the first card from AbeBooks' **Closest match to your search** section. It saves all cards from the selected section as seller offers.

`match_type` distinguishes `exact`, `closest_match`, `isbn_mismatch`, and `unverified`. Closest matches are site-provided suggestions, which can be unrelated to the requested edition; they are not independently verified equivalents. `isbn_matched` is true only for ISBNs explicitly printed in the selected result card, including equivalent ISBN-10/13. Stock-image ISBNs are retained as unverified metadata. Search query parameters and page-wide banners never establish a match.

Output is JSON Lines with the existing dashboard-compatible fields and nested `listings`. Missing fields remain null. Prices and shipping are separate, in GBP. The adjacent `.report.json` contains per-input results and counts exact and closest matches separately; `verified_count` is their sum under this scraper's requested acceptance rule.

Rerun the same command with the same input and output to resume. Add `--retry-failed` to retry missing, mismatched, unverified or failed records while preserving exact and closest-match successes. The runner checks input identity and repairs a truncated final output line using the shared resume utility. A per-output lock prevents duplicate local writers. The output-specific persistent profile is kept under `profiles/abebooks-co-uk/`.

Requests are sequential, with delays before form submission and between ISBNs. Extraction failures get one bounded retry. An HTTP 403/429 or recognized challenge stops the batch without consuming the blocked input; diagnostics are saved to `.blocked.jsonl`, and `.pause.json` preserves a cooldown of at least 30 minutes or the server's longer `Retry-After`. Browser resources close on completion or interruption.

```sh
npm run test:abebooks-uk
```

The 2026-10-28 live test of all 20 supplied inputs found 10 exact matches and 9 site-provided closest matches. ISBN `9781534803435` had neither a result nor a closest-match card, including on a separate check using equivalent ISBN-10 `1534803432`. This batch is therefore **19/20**, not fully verified. Results and the per-ISBN report are under `output/abebooks-co-uk/verification-2026-10-28/`.

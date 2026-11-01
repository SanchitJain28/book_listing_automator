# Amazon.it ISBN scraper

```sh
node scrapers/amazon-it-isbn/amazon-it-isbn.js \
  test/data/amazon-it/input.txt \
  --output output/amazon-it-isbn/headed-check/results.jsonl
```

This opens a headed browser. Add `--headless` for background execution, or `--slow` for the existing slower international Amazon pacing policy. Run the same command/input/output to resume saved progress. The scraper stops after the existing block policy trips and retains the pending ISBN separately; the watcher does not restart deliberate pauses or completed runs with unmatched inputs.

The flow searches the ISBN, opens the first organic product listing, and compares physical formats linked by that product's format selector. Kindle/eBooks and audio editions are excluded, as in the physical-format intention of the Amazon.in flow. Up to four linked physical formats (plus the initial physical listing) are inspected. A visible buying-options drawer is inspected where available, with up to 30 rendered offers. No cart or purchase actions occur.

Italy loads normal page resources: the existing image/font/media routing optimization prevented its seller-offer drawer from hydrating in live checks. Other marketplaces retain their existing resource policy. This uses more bandwidth but permits the visible offer comparison.

The lowest observed item price is selected, including used offers when cheaper. Its seller, condition and delivery remain attached to that same offer. Shipping is reported separately; this does not rank by delivered total or claim to search every seller or every Amazon edition. The default location is whatever Amazon reports for this browser session; no delivery address is changed. Currency preference is EUR and both Italian decimal commas and English decimal points are parsed.

An alternate format can have a different ISBN. `found` records that a readable physical book listing was found; `isbn_matched` independently checks the selected listing's product specifications/structured ISBNs. A cheaper mismatching edition is explicitly labelled `ISBN mismatch`, not counted as verified, and never validated from the search query or URL alone. Equivalent ISBN-10/13 values are supported; conflicting product identifiers reject a match. Missing values stay null.

The JSON Lines output includes `first_listing_url`, `format_observations`, `formats_inspected`, `price_source`, `offers_inspected`, `condition`, ISBN evidence and the normal scraper fields. An adjacent `.report.json` summarizes verification. The dashboard can open the output through the existing project browser; Amazon.it is also registered in the Node runner, master scraper and VPS scraper chooser. Remote execution requires deploying the new Italy files first; existing running VPS jobs are not modified.

Implementation is isolated in `../amazon-isbn/core/italy.js`, with the existing international runner providing file handling, profiles, pacing, retries and cleanup. Amazon.in extraction and request timing, and the US/UK format-selection behavior, remain unchanged.

```sh
npm run test:amazon-it
npm run test:amazon-international
```

## Live verification — 31 October 2026

All 20 supplied ISBNs were processed: 7 verified matches (6 in the first 10), 6 mismatching selected editions, 6 explicit empty searches, and 1 eBook with no readable physical-format link. Of the verified matches, 4 had prices and 3 were out of stock. There were no recorded blocks. Ten observations included visible seller-drawer comparisons. Unmatched observations remain explicitly unverified.

Results: `output/amazon-it-isbn/verification-2026-10-31/results.jsonl`; detailed per-ISBN report: `verification.md` in the same directory. Earlier interrupted diagnostic observations are retained separately and excluded from the final totals. The 47 combined Italy/international Amazon/request-policy/watcher tests passed, along with the dashboard and VPS-manager checks. The verification CLI exits 2 because some ISBNs remain unverified.

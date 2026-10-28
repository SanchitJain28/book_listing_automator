# AbeBooks via Google

This is a separate scraper. It searches each ISBN on the first Google results page and follows each organic AbeBooks product or search-results URL. Product ISBNs are checked against observed page metadata or structured data. Every card on a linked AbeBooks search page is saved with its own ISBN check.

```sh
node scrapers/abebooks-google/abebooks-google-isbn.js test/data/abebooks-google/input.txt --output output/abebooks-google/headed-check/results.jsonl
```

The browser is headed by default. Add `--headless` to hide it. Add `CAP_SOLVER=<key>` to the repository's `.env` if you want supported Google reCAPTCHA v2 challenges submitted through CapSolver. The terminal reports task creation, polling, token receipt, and Google submission without printing the key or token. Unsupported or rejected challenges pause the batch without writing a misleading "not found" record.

If Google shows a challenge without a supported reCAPTCHA v2 site key in headed mode, the browser stays open for up to two minutes so you can complete it manually. If Google does not return to search results, the ISBN remains pending and the blocked attempt is logged separately.

Each ISBN uses a fresh browser context because Google can show different first-page results in a reused context. To retry previously saved `not_found` records that had zero Google AbeBooks links while keeping successful records, add `--retry-zero-links` to the same command.

In headed mode, each fresh Chromium page is created in the background so it does not repeatedly take focus from your other apps. The browser remains visible if you choose to bring it forward. This uses Chromium's `Target.createTarget` background option; if that option is unavailable, the scraper stops with the current ISBN pending.

The scraper saves Google's short-lived challenge-clearance cookie in `profiles/abebooks-google/google-clearance.json` and reuses it across ISBNs and later runs. This local file is ignored by Git and restricted to the current user. A full Chrome profile is not reused because an earlier full profile changed Google's AbeBooks results. If the shared cookie yields zero AbeBooks links, the scraper checks that ISBN again in a clean context before saving `not_found`. Google may still issue a new challenge on either attempt. Add `--no-clearance-reuse` to use a fully clean context for every ISBN.

Results are one JSON Lines record per input ISBN, with the Google links, per-page status, all collected listings, and ISBN evidence. Reusing the same input and output resumes after the last completed record. On a block, the pending ISBN is saved to `<output>.blocked.jsonl`; the cooldown is in `<output>.pause.json`.

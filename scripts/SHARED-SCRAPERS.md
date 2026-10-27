# Shared Playwright scraper runner

Runs Atlantic Books, BooksWagon, Flipkart, MyPustak, SapnaOnline, Om Publications, BookChor and AbeBooks in one Node process. All extraction uses the existing Playwright scraper functions. Amazon scrapers, including Amazon.in, are excluded and unchanged.

```sh
node scripts/run-shared-scrapers.js input-data/manual-search/2026-10-27/input.txt --headless
```

The default pool uses up to two Chromium browser instances and four active browser contexts. Each platform has an isolated context. At 100 saved inputs, its context is closed and it joins the end of the queue for another batch. This bounds context lifetimes and lets all eight jobs make progress with fewer active contexts. Scrapers remain sequential within their own platform and retain their between-ISBN pacing.

Existing outputs for the dated input remain at `output/<platform>/manual-search/2026-10-27/results.jsonl`; AbeBooks retains `output/manual-search/2026-10-27/input.json`. Resume validates saved input identities and continues after the saved prefix. Failed rows remain processed, as before. A blocked result pauses only that platform, saves its attempt separately, and preserves the pending input. Its `.shared-pause.json` enforces at least 30 minutes before a manual restart; longer server timing is retained when supplied by the scraper. There is no automatic restart loop.

**Stop the existing individual scraper jobs before running this command against their output paths.** Old standalone runners do not honor the new `.shared.lock` files. The shared runner does not stop them or migrate a live VPS batch automatically. Run on the host where the current outputs are stored, or synchronize them first.

For a fresh, separate run:

```sh
node scripts/run-shared-scrapers.js test/data/mypustak-scraper/input.txt --headless --platforms mypustak --browsers 1 --concurrency 1 --batch-size 100 --output-subdir optimized-mypustak-test
```

Options:

- `--platforms atlanticbooks,bookswagon,flipkart,mypustak,sapnaonline,ompublication,bookchor,abebooks`: optional subset; duplicates and unsupported platforms are rejected.
- `--browsers 2`: maximum shared browser instances, launched lazily.
- `--concurrency 4`: maximum active contexts. Use a smaller number to reduce peak memory further. Inactive queued jobs do not retain open contexts.
- `--batch-size 100`: saved inputs before releasing a context and yielding to queued platforms.
- `--resources block-assets`: default, blocks images, media and fonts like the current runners.
- `--resources cache`: does not install request interception, preserving the browser's HTTP cache. It may download more assets. Compare accuracy and memory on a representative sample before choosing this for a live platform.
- `--output-subdir <relative-folder>`: selects a separate output directory under `output/`.
- Omit `--headless` for visible browsers.

The runner logs page counts and Node RSS periodically and writes a runtime snapshot to the printed `output/shared-runs/<id>.status.json` path. Each context is limited to a main page plus one temporary product page; surplus pages close immediately and extra pages close at every input boundary. The MyPustak popup guard also closes late popups when no candidate is being inspected. Failed context cleanup retires the owning browser; affected in-flight jobs can resume their unsaved inputs after restarting.

Context cookies, local storage and IndexedDB are saved in separate private files under `profiles/shared-scrapers/<run-id>/`. The new runner does **not** import old persistent Chromium profile directories. Its initial contexts are fresh, so review session-dependent settings such as delivery location before production use. Existing standalone MyPustak retains its persistent profile and now recycles that browser every 100 saved inputs.

Ctrl+C/SIGTERM requests a graceful stop after in-flight scraper calls finish; their pending inputs remain unsaved and resumable. Contexts and browsers close before exit. Verification reports use the platform's existing report writers. Exit codes: 0 = complete and matched; 2 = complete with unverified inputs; 3 = at least one platform blocked; 1 = runtime/report failure; 130 = user interruption.

## Verification

```sh
npm run test:shared-browsers
npm run verify:shared-browsers
```

The first command is offline. The second launches real Chromium against a temporary loopback fixture: eight simulated jobs, two browsers, at most four contexts, popup cleanup, context recycling, session isolation and both resource modes. It makes no retailer requests and leaves no fixture outputs behind. Its timing/RSS numbers are fixture diagnostics, not predicted production RAM savings. Retailer extraction still requires representative live regression checks before deployment.

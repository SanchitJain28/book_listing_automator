# Book Listing dashboard

A local React + Vite dashboard built with Material UI and the Community MUI X Data Grid. Vite serves a read-only project data browser; opening files does not execute scrapers.

## Run

From the repository root:

```sh
npm --prefix dashboard install
npm run dashboard
```

Open the local URL printed by Vite. To build or test:

```sh
npm run dashboard:build
npm run dashboard:test
```

## Inspect results

- **Open output file** opens an in-app modal listing project folders with supported data files. Navigate into `output/`, `input-data/`, `data/`, or other data folders, filter filenames, and click a file to load it. **From computer…** retains the native picker as an optional fallback. Drag-and-drop also works.
- Supports JSON arrays, single result objects, JSON Lines, and reports containing a `results` array. CSV/TSV files show their original columns; text files show ISBN inputs or a line table. Files are limited to 50 MB. Opening text inputs does not search or scrape websites.
- Books shows one row per output record. Seller offers expands nested `listings`; a record without nested listings becomes an offer when it has a price or seller.
- Search title, ISBN, author or seller; filter by platform, stock status and reported ISBN match. The grid toolbar provides column controls, additional column filtering and CSV export. Prices sort numerically within their source currencies; sorting across currencies does not compare converted values.
- Click a row or its arrow to inspect metadata, source links, nested offers and original JSON. Shipping remains separate from item price.
- Summary cards describe the entire file, independently of active table filters.
- Malformed imports report a line/record error and preserve the previously loaded file. Missing stock and ISBN flags remain unknown/unverified. No currency conversion or independent ISBN validation is performed.
- The sidebar keeps the five most recently opened outputs in IndexedDB, including their contents, so they can be reopened after refreshing without choosing the original file again. Reopening moves an entry to the top; opening the same filename and content updates its existing entry. Remove an entry with its × button; this does not delete the original file or close the current table. History belongs to the browser and address/port you use and is removed when that site's browser data is cleared.
- Sample data is synthetic and clearly labeled; it is not added to recent outputs. Refreshing clears the current table, while saved recent outputs remain available in the sidebar.

## Local project access

The Vite development and preview servers provide GET-only `/api/project-files?path=<relative-folder>` and `/api/project-file?path=<relative-file>` endpoints. Requests are restricted to the local dashboard, resolved inside the project, and blocked for traversal, symbolic links, hidden folders, browser profiles, dependency/build/debug folders, and credential/secret files. The endpoints are not included in a standalone static `dist/` deployment; use `npm run dashboard` or the Vite preview server to browse project files.

## AbeBooks verification scope

The scraper remains unrun and unchanged by this dashboard work. Before production runs, verify the requirements in `../PLAN.md` against `.com`, `.co.uk` and IberLibro: ISBN lookup, title fallback when ISBN lookup fails, direct product URLs, and choosing the correct result from search URLs.

Known code review gaps: the current shared search helper falls back from `/products/isbn/` to keyword ISBN search only for HTTP 404, with no title fallback; the wrapper selects `listings[0]`; some extraction branches infer a found ISBN from the requested ISBN. A displayed “Matched” value is the scraper's claim, not independent verification.

## VPS monitor

Choose **VPS** in the sidebar to inspect the 27 October manual-search batch on VPS 6. The monitor performs a read-only SSH status check when opened and when **Refresh status** is pressed. It displays tmux session state, processed input positions, recorded ISBN matches, blocks, errors, stock counts, last output time, available RAM, and swap usage. Select a scraper to see its reported outcome breakdown and remote output path. Use **View processes** under VPS resources for the largest processes, their RAM (RSS), PIDs, browser roles and inferred scraper ownership; click Refresh status for a new snapshot. Scraper-group RSS totals include shared pages and can overstate physical RAM. Command-line arguments are not sent to the browser. A running session does not necessarily mean progress; compare the last output time. A block count reflects explicitly recorded blocks, so other unrecognized failures may be counted elsewhere. A finished input is not necessarily a verified listing.

The dedicated script can also be run from the repository root:

```sh
node scripts/vps-status.js
node scripts/vps-status.js --json
```

It requires `ssh`, `sshpass`, a previously verified SSH host key, the VPS 6 credentials in local `VPSInfo.md`, Python 3 and tmux on VPS 6, and the batch's session manifest at `/root/migrations/vps6-manual-20261027T075310Z/sessions.json`. The password is passed to `sshpass` via its environment and is not returned to the browser. A failed connection leaves the last screen snapshot visible with a warning. Refresh performs no scraper starts, stops, retries, or remote file modifications.

This tab currently monitors the specified VPS 6 batch, rather than discovering every scraper on every server. The local GET-only `/api/vps-status` endpoint is restricted to the local dashboard and accepts no arbitrary host or command. It is available on Vite development and preview servers; standalone static builds need a server providing the endpoint. Restart the Vite server after installing this change.

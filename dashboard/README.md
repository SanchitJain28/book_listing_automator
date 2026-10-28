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
npm --prefix dashboard run verify:theme
```

The theme check uses a local headless browser and mocked VPS data to verify all five grids, text contrast, and status colors under light and dark OS preferences. It does not contact a VPS.

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

Choose **VPS** in the sidebar and **View existing VPS 6 batch** to inspect the 27 October manual-search batch. The monitor performs a read-only SSH status check when opened and when **Refresh status** is pressed. It displays tmux session state, processed input positions, recorded ISBN matches, blocks, errors, stock counts, last output time, available RAM, and swap usage. Select a scraper to see its reported outcome breakdown and remote output path. Use **View processes** under VPS resources for the largest processes, their RAM (RSS), PIDs, browser roles and inferred scraper ownership; click Refresh status for a new snapshot. Scraper-group RSS totals include shared pages and can overstate physical RAM. Command-line arguments are not sent to the browser. With the shared runner, the monitor shows active and queued scrapers separately and displays the shared browser/context counts. Queued scrapers retain their saved progress while waiting for a context; each active scraper yields after its 100-input batch. Shared browser processes appear under `shared-pool` because a browser can serve several platforms. A running session does not necessarily mean progress; compare the last output time. A block count reflects explicitly recorded blocks, so other unrecognized failures may be counted elsewhere. A finished input is not necessarily a verified listing.

The dedicated script can also be run from the repository root:

```sh
node scripts/vps-status.js
node scripts/vps-status.js --json
```

It requires `ssh`, `sshpass`, a previously verified SSH host key, the VPS 6 credentials in local `VPSInfo.md`, Python 3 and tmux on VPS 6, and the batch's session manifest at `/root/migrations/vps6-manual-20261027T075310Z/sessions.json`. The password is passed to `sshpass` via its environment and is not returned to the browser. A failed connection leaves the last screen snapshot visible with a warning. Refresh performs no scraper starts, stops, retries, or remote file modifications.

This detailed batch monitor covers the specified VPS 6 batch. The local GET-only `/api/vps-status` endpoint is restricted to the local dashboard and accepts no arbitrary host or command. It is available on Vite development and preview servers; standalone static builds need a server providing the endpoint. Restart the Vite server after installing this change.

## VPS management

The VPS page lists servers configured in `VPSInfo.md`. Select a server and choose **Connect / refresh** to see its Git state, process count, RAM, largest processes, and compatible running scraper jobs. Jobs created through this page remain visible after they stop. The existing VPS 6 batch monitor remains available from the page. Discovered jobs are limited to supported scraper processes with project-relative `input-data` paths; arbitrary tmux commands and processes are not attributed to a scraper.

Use **Sync Git** to fetch `origin/main` and fast-forward the VPS checkout to the local committed `HEAD` only when they match. The remote checkout must be clean and on `main`; the update is refused while scraper processes are active. Local uncommitted changes are not deployed. Sync never resets, stashes, or deletes remote changes. SSH uses the existing known-hosts file, `sshpass`, and the configured root account.

Choose a scraper and an input file already under the VPS's `input-data/` folder, then review and start it. The server runs the selected standalone scraper headless in tmux; launching requires a clean remote checkout at the local committed HEAD. Dashboard-managed outputs use `output/dashboard/<scraper>/...`; AbeBooks and Amazon.in use their existing derived output path. To prevent accidental resume against another dataset, pre-existing output must belong to a dashboard run using the same scraper and unchanged input. Active matching jobs and conflicting outputs are rejected. Resuming retains the scraper's own policy, including pause checkpoints and prior failure records. Dashboard-managed job records and logs are stored on the VPS under `~/.book-listing-dashboard/`. Jobs started outside this interface are only discovered where the command and input/output paths can be safely identified.

The dashboard management endpoint accepts requests only from the local same-origin interface, supports an allowlisted set of scraper entry points, and does not expose VPS passwords to the browser. A running tmux session is not proof of scraper progress; check output counts and errors. Counts reflect recorded output, and undetected blocks may appear as other outcomes. Restart the Vite server after upgrading the dashboard so the management endpoints are registered.

The **VPS controls** column provides **Stop** and **Resume** for remote scraper processes. Stop requests a clean scraper exit, then terminates any remaining scraper and Playwright browser children while preserving output. Resume runs the recorded command again in tmux with the original input, output and flags. Changed inputs, active output writers and standalone block cooldowns prevent an unsafe restart. Stop/Resume never accept arbitrary PIDs or commands, and the general server process table remains read-only.

Blocked jobs also provide **Remove pause** and **Retry now**. Remove pause immediately archives only the selected scraper's saved cooldown; it does not stop or start a process. Retry now archives that cooldown and retries the saved command from its current output. For a shared runner, the confirmation explains that the batch must restart; other platforms keep their output and cooldowns. A new block can create a new pause, so Retry now is one user-requested attempt. Pause archives are kept under `~/.book-listing-dashboard/pause-archive/`.

Several platform rows may belong to one shared Node runner. These rows display **Stop batch / Resume batch**, and the confirmation names every affected scraper. Stopping one shared process stops the whole batch; resuming continues each platform's saved output and respects its cooldown. Discovered scraper commands are recorded under `~/.book-listing-dashboard/process-*.json`, so they remain resumable after they exit or the local dashboard restarts. No production job is stopped or restarted until its confirmation is submitted.

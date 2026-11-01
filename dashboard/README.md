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

### Persistent VPS workspace

The dashboard backend reuses one password-authenticated SSH2 connection per active VPS. The browser receives status, connection state, activity, and selected logs through one multiplexed SSE stream. Existing CLI commands remain available.

- Recent cards remember all previously opened configured servers without a fixed card or history limit, with pinning and cached summaries. Credentials are never saved in browser storage.
- Selected-server status refreshes about every 10 seconds; other subscribed cards refresh about every 30 seconds. Collectors are shared across browser tabs. Hidden tabs unsubscribe; closing the browser never stops tmux jobs.
- SSH uses trusted keys from the existing OpenSSH `known_hosts` file, 15-second keepalives, bounded network backoff, four concurrent channels, and a 10-minute idle timeout. Authentication and host-key failures stop automatic reconnection. After correcting credentials or trusted keys, use **Connect / refresh** explicitly.
- Mutations are serialized per server and never automatically replayed after an uncertain SSH outcome. Refresh status before manually retrying.
- Incremental remote metrics are stored under `~/.book-listing-dashboard/metrics-cache/`. They reset after output truncation/replacement and ignore incomplete final records. A cold scan still reads existing output once.

**View logs** opens a read-only drawer with the latest recorded failure, message/ISBN search, severity filters, structured-attempt filters, pause/follow controls, auto-scroll, and download of the visible entries. Console source also offers historical dashboard launch attempts. The initial tail and each follow read are capped at 64 KiB/500 entries; the UI retains at most 2,000 entries. Rotation resets are shown explicitly. Older interleaved shared-batch console output is labelled as mixed; it is never presented as a trustworthy per-platform log.

Existing job logs are resolved only from validated job records, verified process stdout, or the known output-directory `run.log`; no arbitrary log paths are accepted. Missing historical logs are reported as unavailable. Recorded snapshot failures and block checkpoints take precedence over generic row errors. Missing process data is not treated as proof of an OOM or a successful run.

Future dashboard launches/resumes automatically install a small trusted runtime observer and console sink over the existing SSH connection. Each attempt has its own raw console log and ID; standalone structured events are appended to `<output>.events.jsonl`. Shared runs using the updated `scripts/run-shared-scrapers.js` also emit separate platform event logs and batch events. Existing running processes are not hot-patched or restarted.

Console and event logs rotate around 10 MiB, keeping the active file plus four archives. Old dashboard attempt logs are pruned after seven days when a new attempt starts; rotated event archives are aged out by the event writer. This does not delete result files or active logs. VPS activity is recorded locally under ignored `logs/vps-activity/`, with a bounded persisted history. Terminal controls and known secrets are removed before data is sent to the browser; log contents are rendered as text.

Verification:

```sh
npm run dashboard:test
python3 -B test/vps-manager.test.py
node --test test/job-events.test.js test/shared-browser.test.js
npm --prefix dashboard run verify:vps
npm --prefix dashboard run verify:theme
```

The browser verification uses mocked VPS responses and performs no remote control actions. Live verification should begin with read-only status/log requests on one server; instrumented launch behavior can be checked in an isolated temporary fixture.

### Shared browser lifecycle recovery

The shared runner distinguishes browser/context loss from HTTP blocking. An unexpectedly closed page or failed context creation retries the same unsaved input at most twice with a new context; repeated failures remain visible as `Failed`. Genuine block responses still stop that platform and retain its cooldown. Context cleanup never closes a shared browser while sibling leases are active.

Session snapshots are bounded to 2 MiB, omit IndexedDB/ad caches, and retain only bounded cookies/localStorage. Oversized or unreadable prior snapshots are preserved beside the original state file as `.oversized-*.bak` or `.invalid-*.bak`; failed restores are preserved as `.restore-failed-*.bak`. Result outputs are unaffected. Pool diagnostics include browser slot/generation, disconnects, and per-platform recovery counts.

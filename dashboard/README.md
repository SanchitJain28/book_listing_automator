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

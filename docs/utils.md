# Utilities Documentation

This file documents the global utilities in the `utils/` directory. AI agents and developers should refer to this to know which utility functions are available and when to use them instead of writing custom logic.

## 1. `utils/amazon.js`

**Purpose:** Amazon-specific scraper logic and checks.
**Functions:**

- `checkDogPage(page)`: Checks the current Playwright page to see if Amazon has served a CAPTCHA, "Sorry! Something went wrong" page, or a "Robot Check". Use this immediately after navigating to an Amazon page to verify if you were blocked before attempting to parse DOM elements.

## 2. `utils/browser.js`

**Purpose:** Browser initialization, stealth configuration, and generic browser utilities.
**Functions:**

- `initBrowser(isHeadless)`: Launches a Playwright Chromium browser with the `puppeteer-extra-plugin-stealth` enabled to prevent bot detection. Also aborts unnecessary network requests (images, fonts, media) to speed up scraping. Returns `{ context, page }`.
- `getRandomDelay(min, max)`: Generates a random delay (in ms) to simulate human browsing behavior. Use this in `page.waitForTimeout()` between navigations.

## 3. `utils/file.js`

**Purpose:** File system and I/O operations for reading input data and safely writing output data.
**Functions:**

- `readSearchTerms(filePath)`: Reads a text file line-by-line and returns an array of non-empty search terms.
- `appendResult(filePath, data)`: Safely appends a JSON object to a JSON array file. If the file doesn't exist, it creates it with an array containing the data. If it exists, it parses it, pushes the new data, and overwrites.

## 4. `utils/scraperInit.js`

**Purpose:** Standardizes the initialization of all scraper scripts.
**Functions:**

- `initScraper(scriptName, scraperFolder, stageSuffix)`: Reads `process.argv` to extract the input file and the `--headless` flag. Automatically calculates the correct output file path inside the `output/<scraperFolder>` directory. Returns `{ inputFile, isHeadless, outputFilePath }`.

## 5. `utils/spinner.js`

**Purpose:** Provides a beautiful CLI UX for long-running terminal tasks (like waiting for page loads).
**Functions:**

- `startSpinner(text)`: Starts an animated terminal spinner with the provided text.
- `updateSpinner(text)`: Updates the text of the currently running spinner.
- `stopSpinner(text, type)`: Stops the spinner and leaves a final message. `type` can be `"success"`, `"error"`, `"warn"`, or `"info"` to format the final icon color.

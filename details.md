# Project Phoenix: Automated Amazon ISBN Scraper
 
**Version:** 2.0 (Multi-PC, Proxy-Enabled)  
**Last Updated:** May 1, 2026  
**Author:** Sanchit Jain
 
---
 
## Table of Contents
 
- [Project Phoenix: Automated Amazon ISBN Scraper](#project-phoenix-automated-amazon-isbn-scraper)
  - [Table of Contents](#table-of-contents)
  - [1. Project Overview](#1-project-overview)
    - [Data Points Collected](#data-points-collected)
  - [2. Core Functionality](#2-core-functionality)
  - [3. Technology Stack](#3-technology-stack)
  - [4. Deployment \& Operations Guide](#4-deployment--operations-guide)
    - [For the Project Admin](#for-the-project-admin)
    - [For the Data Entry Operators](#for-the-data-entry-operators)
  - [5. Project Evolution](#5-project-evolution)
  - [6. Final Code Scripts](#6-final-code-scripts)
    - [Scraper Template (`scraper_pcX.js`)](#scraper-template-scraper_pcxjs)
    - [Setup Script (`setup_and_run.bat`)](#setup-script-setup_and_runbat)
  - [7. Pending Items \& Future Considerations](#7-pending-items--future-considerations)
---
 
## 1. Project Overview
 
**Objective:** Automate data collection for 50,000+ ISBNs from Amazon.in — eliminating manual entry, accelerating throughput via multi-PC deployment, and ensuring data accuracy.
 
### Data Points Collected
 
| Field | Description |
|---|---|
| Lowest New Price | Cheapest available price for a new physical copy |
| MRP | Official Maximum Retail Price, if listed |
| Fastest Delivery Date | Earliest possible delivery date |
| Lowest Used Price | Cheapest used copy price, if available |
 
---
 
## 2. Core Functionality
 
- **Multi-Computer Deployment** — Multiple operators run simultaneously, each with a unique script and ISBN list.
- **Automated Setup** — A `.bat` script handles the full setup for non-technical users.
- **Proxy Integration** — Dedicated proxy per computer to bypass Amazon rate-limiting and IP blocking.
- **Dynamic List Assignment** — Setup script detects operator number and runs the correct script + list.
- **Smart Format Selection** — Analyzes all physical formats, navigates to the cheapest before scraping.
- **Digital Format Rejection** — Ignores Kindle, eBook, and Audible editions.
- **Advanced Page Handling:**
  - Detects auto-redirect to product page vs. search results list.
  - Clicks "See All Buying Options" or "New & Used from..." if price is absent from the main page.
- **Precise Data Extraction** — Scrapes lowest New and Used prices from the buying options panel; validates MRP (marks N/A if MRP < selling price).
- **Automated Reporting** — Uploads the final JSON results file to a Discord channel via webhook on completion.
---
 
## 3. Technology Stack
 
| Category | Tool |
|---|---|
| Runtime | Node.js |
| Browser Automation | Playwright |
| Networking | Axios, Form-Data |
| Deployment | GitHub, Windows Batch Script (`.bat`) |
| Anonymity | Static/Residential Proxies (e.g., Webshare) |
| Reporting | Discord Webhooks |
 
---
 
## 4. Deployment & Operations Guide
 
### For the Project Admin
 
1. **Prepare ISBN Lists** — Split the master list into files named `1may_isbn_list1.txt`, `1may_isbn_list2.txt`, etc.
2. **Acquire Proxies** — Subscribe to an India-targeting proxy service. One set of credentials (IP, Port, Username, Password) per computer.
3. **Create Scraper Scripts** — Copy `scraper_pcX.js` for each computer and fill in unique `proxyConfig` credentials.
4. **Set Up Discord** — Create a private server, add a channel, go to **Server Settings → Integrations → Webhooks**, create a webhook, and paste the URL into `webhookUrl` in every `scraper_pcX.js`.
5. **Update GitHub** — Push the following to your public repo:
   - All `scraper_pcX.js` files
   - All `1may_isbn_listX.txt` files
   - `setup_and_run.bat`
   - `package.json` and `package-lock.json` (after running `npm install axios form-data` locally)
### For the Data Entry Operators
 
> **Prerequisite:** Node.js (LTS) must be installed from [nodejs.org](https://nodejs.org).
 
1. Double-click `setup_and_run.bat`.
2. Enter your assigned PC number (e.g., `3`) and press **Enter**.
3. Wait — the script will download the code, install dependencies, and install the browser (~5–10 minutes). **Do not close the window.**
4. A Chrome window will open and begin scraping. Minimize it and let it run.
5. When complete, the terminal will display **"SCRIPT HAS FINISHED!"** — results are already sent. You can close the window.
---
 
## 5. Project Evolution
 
| # | Problem | Solution |
|---|---|---|
| 1 | Manual entry too slow for 50,000 records | Decided to build a web scraper |
| 2 | Amazon blocked basic HTTP requests | Adopted Playwright (real browser automation) |
| 3 | Inconsistent page layouts (search list vs. product page) | Script checks for `#productTitle`; navigates intelligently if absent |
| 4 | Hardcoded "Paperback" preference wasn't always cheapest | Price-based format switching: reads all physical format swatches and clicks the cheapest |
| 5 | Cheapest format logic was selecting free Kindle editions | Blocklist added: ignores Kindle, eBook, Audible, Audiobook |
| 6 | Some pages hide prices behind "See All Buying Options" | Detects missing buy box; clicks the button and scrapes the side panel |
| 7 | Used price was raw "New & Used from..." text | Clicks "New & Used" link, finds first offer marked "Used", extracts clean price |
| 8 | Operators lacked developer tools | `.bat` script automates full setup: download, unzip, `npm install`, `playwright install`, run |
| 9 | Needed centralized code distribution and result collection | Public GitHub repo + Discord webhook auto-uploads results on completion |
| 10 | PowerShell blocked `npm` on cafe PCs | One-time fix: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` in Admin PowerShell |
| 11 | 7 scripts from one IP triggered "Oops! Rush Hour" | Proxy integration: each script uses a unique India-based static proxy |
 
---
 
## 6. Final Code Scripts
 
### Scraper Template (`scraper_pcX.js`)
 
> Create one copy per computer (`scraper_pc1.js`, `scraper_pc2.js`, etc.) and fill in the proxy credentials for each.
 
```javascript
// --- PROXY CONFIGURATION ---
const proxyConfig = {
  server: "http://YOUR_PC_SPECIFIC_PROXY_IP:PORT",
  username: "YOUR_PROXY_USERNAME",
  password: "YOUR_PROXY_PASSWORD"
};
 
const browser = await chromium.launch({
  headless: false,
  proxy: proxyConfig
});
 
// ...rest of scraper logic...
 
const webhookUrl = "YOUR_DISCORD_WEBHOOK_URL";
 
// ...Discord upload logic at the end...
```
 
### Setup Script (`setup_and_run.bat`)
 
```batch
@echo off
echo =================================================================
echo  Amazon Book Scraper - Automated Setup
echo =================================================================
echo.
 
set /p pc_number="Enter your assigned PC number (1 to 7) and press Enter: "
 
set script_file=scraper_pc%pc_number%.js
set list_file=1may_isbn_list%pc_number%.txt
 
echo.
echo Thank you! Preparing to run with:
echo   Script: %script_file%
echo   List:   %list_file%
echo.
echo =================================================================
echo  DOWNLOADING, INSTALLING, AND STARTING...
echo  (This may take up to 10 minutes. Please be patient.)
echo =================================================================
 
IF NOT EXIST "book_listing_automator-main" (
    echo Downloading project from GitHub...
    powershell -Command "Invoke-WebRequest -Uri https://github.com/SanchitJain28/book_listing_automator/archive/refs/heads/main.zip -OutFile book_scraper.zip"
    echo Unzipping files...
    powershell -Command "Expand-Archive -Path book_scraper.zip -DestinationPath ."
)
 
cd book_listing_automator-main
 
IF NOT EXIST "node_modules" (
    echo Installing required libraries...
    npm install
    echo Installing the automated browser...
    npx playwright install
)
 
echo.
echo =================================================================
echo  SETUP COMPLETE! STARTING THE SCRAPER...
echo =================================================================
echo.
 
node %script_file% %list_file%
 
echo.
echo =================================================================
echo  SCRIPT HAS FINISHED!
echo =================================================================
echo The output file has been sent to the main server. You can now close this window.
echo.
 
pause
```
 
---
 
## 7. Pending Items & Future Considerations
 
- **Data Aggregation** — The `output_*.json` files are sent to Discord. A local script could merge them into a single master CSV/Excel file.
- **CAPTCHA Handling** — Proxies reduce risk significantly, but integrating a service like [2Captcha](https://2captcha.com) is a viable upgrade if CAPTCHAs become frequent.
- **Headless Mode** — Switch to `headless: true` for efficiency and to prevent accidental browser closure by operators. Only do this after confirming proxy stability, as headless browsers are easier for Amazon to detect.
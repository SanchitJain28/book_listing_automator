---
name: book-sheet-automator
description: Automates ingesting, analyzing, and generating configurations for new Google Sheet tabs in the book listing pipeline, and running Amazon automated cart sessions with cursor tracking, 40-day delivery penalty scoring, and pacing.
---

# Book Sheet Automator

## Overview

Use this skill to onboard new Google Sheet tabs, generate isolated tab configurations into `sheet_configs/`, and execute hands-free Amazon cart automation with progressive delivery scoring, rate-limit pacing, and automatic batch cursor checkpoints.

Refer to bundled documentation when needed:
- [Amazon Evaluation Rules & Scoring System](references/scoring_and_rules.md) for price ceiling, margin buffer, 40-day delivery tiers, and tie-breakers.
- [Google Sheet Tab Schemas & Column Mappings](references/sheet_tab_schemas.md) for header variants, row color rules, and sheet column layouts.

---

## Workflow Decision Tree

Follow this decision tree based on the user request:

1. **User provides a new tab name or sheet URL**:
   - Proceed to **Workflow 1: Onboard & Inspect a New Tab**.
2. **User wants to run the automator for a specific tab**:
   - Proceed to **Workflow 2: Run Amazon Cart Automation**.
3. **User wants to adjust pricing margins, pacing, or delivery penalties**:
   - Proceed to **Workflow 3: Adjust Operational Config (`scraper_config.json`)**.
4. **User wants to resume from a previous batch or cursor**:
   - Proceed to **Workflow 4: Resume from Batch Cursor**.

---

## Workflow 1: Onboard & Inspect a New Tab

### Step 1: Inspect the Tab via Google Sheets API
Inspect the new tab in Google Spreadsheet `1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY` using `credentials.json`:
1. Identify the header row (typically Row 6 or Row 12).
2. Verify column names and detect:
   - ISBN field: `ISBN (customer order)` or `ISBN`.
   - Compare Price: `Amazon Price (INR)` or `Price`.
   - Margin basis: `PO Price (INR)` or `Sell (INR)`.
   - Batch Cursor: `CURSOR` (Column C or Column E).
   - Rejection Reason: `NO WITH REASON` (Column D).
   - Match Status: `ISBN Match` ("Yes" vs "No").
3. Determine total row count and color/profit breakdown:
   - White rows (`ISBN Match: Yes`): queued 1st.
   - Yellow rows (`ISBN Match: No` / different edition): queued 2nd.
   - Red rows (accepted loss / negative profit): queued 3rd.

### Step 2: Generate the Tab Config
Run the generator script with the tab name:
```bash
node scripts/generate-sheet-config.js <tabName>
```
Example:
```bash
node scripts/generate-sheet-config.js PREP_1_5TH_OCT_LESSTHEN3
```
This action:
- Saves the isolated configuration to `sheet_configs/<tabName>.json` (preserving historical cursors on other tabs).
- Updates `sheet_config.json` as the active default config.
- Auto-detects all column positions and header offsets.

---

## Workflow 2: Run Amazon Cart Automation

### Manual Review Mode (Interactive)
To launch with step-by-step interactive prompts for each ISBN:
```bash
node scripts/amazon-cart-automator.js --tab=<tabName>
```

### Auto Mode (Hands-Free)
To run automatically without manual keypresses:
```bash
node scripts/amazon-cart-automator.js --tab=<tabName> --auto
```

### Multi-Profile Support (Profile 1 & Profile 2)
To isolate Amazon buyer accounts with separate cookies, local storage, and sessions:
- **First-time login for Profile 2**:
  ```bash
  node scripts/amazon-cart-automator.js --profile=2 --login
  ```
  *(Sign in to Amazon in the opened browser window and press ENTER. Session is saved permanently.)*
- **Run automation on Profile 2**:
  ```bash
  node scripts/amazon-cart-automator.js --tab=<tabName> --auto --profile=2
  ```
- **Run automation on Profile 1 (Default)**:
  ```bash
  node scripts/amazon-cart-automator.js --tab=<tabName> --auto --profile=1
  ```

What auto mode enforces:
- Evaluates scraped Amazon offers against Rule 1 (price ceiling or margin gap) and Rule 2 (delivery rules).
- Automatically adds optimal qualified offer to cart.
- Enforces minimum pacing (default: 30 seconds per ISBN) to protect against Amazon rate limits and bot detection.
- Automatically writes rejection reasons to Google Sheet (`NO WITH REASON`).
- Automatically pauses when the 50-book Amazon cart limit is reached and writes `CURSOR - <N>` to the sheet.

---

## Workflow 3: Adjust Operational Config (`scraper_config.json`)

To change operational thresholds without modifying JavaScript code, edit `scraper_config.json`:
- **Margin Gap (`minMarginBufferINR`)**: Default is ₹50 (`Sell Price - raw Amazon price >= 50`).
- **Pacing (`minPacingSecondsPerIsbn`)**: Default is 30 seconds.
- **Cart Batch Limit (`cartBatchLimit`)**: Default is 50 books.
- **Delivery Rules (`maxDeliveryDays` & `tiers`)**: Default 40 days, with 10-day penalty-free grace period.
- **Pincode (`deliveryPincode`)**: Default is "122101".

---

## Workflow 4: Resume from Batch Cursor

To resume from a specific batch milestone on an existing tab:
```bash
node scripts/amazon-cart-automator.js --tab=<tabName> --cursor=<batchNumber> --auto
```
Examples:
```bash
# Resume Batch 28 on 337_23rd_SEP tab
node scripts/amazon-cart-automator.js --tab=337_23rd_SEP_LESSTHEN3 --cursor=27 --auto

# Resume Batch 2 on PREP_1_5TH_OCT tab
node scripts/amazon-cart-automator.js --tab=PREP_1_5TH_OCT_LESSTHEN3 --cursor=1 --auto
```

If the requested cursor is not in the local JSON config, the automator will automatically poll Google Sheets live to find the latest cursor position.

---

## Critical Rules to Respect
1. **Never alter Column A (`Status`)**: Status is reserved for order management and must never be overwritten.
2. **Always preserve previous configs**: Never overwrite configs across different tabs; always ensure configs are saved inside `sheet_configs/<tabName>.json`.
3. **Network Drops**: The automator monitors connection drops. If internet goes down, it pauses execution and resumes automatically once connection recovers.

# Google Sheet Tab Schemas & Column Mappings

## Common Tab Patterns

The pipeline processes books across different Google Sheet tabs within the main spreadsheet (`1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY`). Different tabs may have different header row indices and column naming conventions.

### Schema Comparison

| Target Purpose | Tab Variant A (e.g. `337_23rd_SEP...`) | Tab Variant B (e.g. `PREP_1_5TH_OCT...`) | Detection Logic |
| :--- | :--- | :--- | :--- |
| **Header Row** | Row 12 | Row 6 | Auto-scans rows 1–30 for row containing both "isbn" and "price" |
| **ISBN** | `ISBN` (Col C / idx 2) | `ISBN (customer order)` (Col A / idx 0) | Checks `isbn (customer order)`, then `isbn`, then `includes("isbn")` |
| **Compare Price** | `Amazon Price (INR)` (Col G) | `Amazon Price (INR)` (Col E) | Checks custom compare column name or `amazon price` / `price` |
| **Margin / Sell** | `Sell (INR)` (Col J) | `PO Price (INR)` (Col F) | Checks `po price (inr)`, `sell (inr)`, `po price`, `sell` |
| **Title** | `PO Title` or `Title` | `Title` | Checks `po title`, `title`, `amazon title` |
| **CURSOR** | `CURSOR` (Col E) | `CURSOR` (Col C) | Checks `cursor`. If missing, auto-inserts column in Google Sheet |
| **Reason** | `NO WITH REASON` (Col D) | `NO WITH REASON` (Col D) | Checks `no with reason` or `reason` |
| **ISBN Match** | `ISBN Match` | `ISBN Match` | Checks `isbn match` |
| **Status** | `Status` (Col A) | `Status` (Col T) | Checks `status` |

---

## Row Color & Queue Priority

Books are queued in the following strict priority order to maximize efficiency:
1. **⚪ White Rows (Exact ISBN Match)**:
   - Criteria: `group` does NOT contain "loss", and `ISBN Match` is "Yes" (or exact).
   - Queued 1st.
2. **🟡 Yellow Rows (Different Edition)**:
   - Criteria: `group` does NOT contain "loss", and `ISBN Match` is "No" (or contains "different").
   - Queued 2nd.
3. **🔴 Red Rows (Accepted Loss)**:
   - Criteria: `group` contains "loss" or profit is negative.
   - Queued 3rd.

---

## Critical Rules for Google Sheet Updates
1. **NEVER modify Column A (`Status`)**: Status is strictly maintained by human operators or separate processes.
2. **Failure Logging**: Write rejection reasons directly to Column `NO WITH REASON` (Column D).
3. **Success Logging**: Leave `NO WITH REASON` empty for items successfully added to cart.
4. **Batch Cursors**: When 50 items are added to the cart, write `CURSOR - <batchNumber>` to the `CURSOR` column at the next pending row.

const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { generateConfig } = require("./generate-sheet-config");

async function setupMainSheet() {
  const mainSpreadsheetId = "1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY";
  const oldSpreadsheetId = "1aaN4yvZ7WqBCjwlXPqIx0r8G2MoPVdx8P2lRuUiyNIQ";
  const tabName = "337_23rd_SEP_LESSTHEN3";

  console.log(`🚀 Setting up MAIN Google Sheet: ${mainSpreadsheetId} [Tab: ${tabName}]...`);

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "..", "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Fetch metadata of main sheet
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: mainSpreadsheetId });
  const sheetObj = metaRes.data.sheets.find((s) => s.properties.title === tabName);
  if (!sheetObj) throw new Error(`Tab "${tabName}" not found in main sheet.`);
  const sheetId = sheetObj.properties.sheetId;

  // 2. Read headers at row 12
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mainSpreadsheetId,
    range: `'${tabName}'!A12:Z12`,
  });
  let headers = headersRes.data.values?.[0] || [];
  console.log("Current main sheet headers:", headers);

  let reasonIdx = headers.findIndex((h) => h.toLowerCase().includes("no with reason"));
  let cursorIdx = headers.findIndex((h) => h.toLowerCase() === "cursor");

  // If NO WITH REASON and CURSOR are not present, insert them at column D (index 3)
  if (reasonIdx === -1 && cursorIdx === -1) {
    console.log("📌 Inserting 'NO WITH REASON' and 'CURSOR' columns at Column D and E...");
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: mainSpreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: "COLUMNS",
                startIndex: 3, // Column D
                endIndex: 5,   // Column D and E
              },
              inheritFromBefore: true,
            },
          },
        ],
      },
    });

    // Write header labels
    await sheets.spreadsheets.values.update({
      spreadsheetId: mainSpreadsheetId,
      range: `'${tabName}'!D12:E12`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [["NO WITH REASON", "CURSOR"]],
      },
    });
    console.log("✅ Created 'NO WITH REASON' (Col D) and 'CURSOR' (Col E)!");
  }

  // Refresh headers
  const newHeadersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mainSpreadsheetId,
    range: `'${tabName}'!A12:Z12`,
  });
  headers = newHeadersRes.data.values?.[0] || [];
  console.log("Updated main sheet headers:", headers);

  const groupColIdx = headers.findIndex((h) => h.toLowerCase() === "group");
  const matchColIdx = headers.findIndex((h) => h.toLowerCase().includes("isbn match"));
  console.log(`Sort indices: Group Col=${groupColIdx} (B), ISBN Match Col=${matchColIdx} (N)`);

  // 3. Apply 2-level sort:
  // Key 1: Group DESCENDING ("Profitable" first, "Accepted loss" last)
  // Key 2: ISBN Match DESCENDING ("Exact ISBN" first, "Different edition" second)
  console.log("🔄 Sorting data rows 13 to 2098: Whites (Top), Yellows (Middle), Reds (Bottom)...");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: mainSpreadsheetId,
    requestBody: {
      requests: [
        {
          sortRange: {
            range: {
              sheetId,
              startRowIndex: 12, // Row 13 (0-indexed)
              endRowIndex: 2098,
              startColumnIndex: 0,
              endColumnIndex: 26,
            },
            sortSpecs: [
              {
                dimensionIndex: groupColIdx !== -1 ? groupColIdx : 1,
                sortOrder: "DESCENDING",
              },
              {
                dimensionIndex: matchColIdx !== -1 ? matchColIdx : 13,
                sortOrder: "DESCENDING",
              },
            ],
          },
        },
      ],
    },
  });
  console.log("✅ Main sheet sorted successfully!");

  // 4. Migrate previous test results (reasons & cursor) from old sheet to main sheet by ISBN
  console.log("\n📦 Migrating test results (Column D reasons & Column E cursor) from previous run...");
  const oldDataRes = await sheets.spreadsheets.values.get({
    spreadsheetId: oldSpreadsheetId,
    range: `'${tabName}'!C13:E2098`, // ISBN (C), Reason (D), Cursor (E)
  });

  const oldRows = oldDataRes.data.values || [];
  const testResultsMap = new Map();
  oldRows.forEach((r) => {
    const isbn = r[0]?.trim();
    const reason = r[1]?.trim();
    const cursor = r[2]?.trim();
    if (isbn && (reason || cursor)) {
      testResultsMap.set(isbn, { reason: reason || "", cursor: cursor || "" });
    }
  });

  console.log(`Found ${testResultsMap.size} test items to sync to main sheet:`);
  for (const [isbn, res] of testResultsMap.entries()) {
    console.log(`   ISBN ${isbn} -> Reason: "${res.reason}", Cursor: "${res.cursor}"`);
  }

  if (testResultsMap.size > 0) {
    // Read current sorted ISBNs from main sheet
    const mainIsbnsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: mainSpreadsheetId,
      range: `'${tabName}'!C13:C2098`,
    });
    const mainIsbns = mainIsbnsRes.data.values || [];
    const updates = [];

    mainIsbns.forEach((r, idx) => {
      const isbn = r[0]?.trim();
      const rowNum = 13 + idx;
      if (isbn && testResultsMap.has(isbn)) {
        const item = testResultsMap.get(isbn);
        if (item.reason) {
          updates.push({
            range: `'${tabName}'!D${rowNum}`,
            values: [[item.reason]],
          });
        }
        if (item.cursor) {
          updates.push({
            range: `'${tabName}'!E${rowNum}`,
            values: [[item.cursor]],
          });
        }
      }
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: mainSpreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: updates,
        },
      });
      console.log(`✅ Synced ${updates.length} cells to main sheet!`);
    }
  }

  // 5. Update sheet_config.json targeting mainSpreadsheetId
  console.log("\n🔄 Rebuilding sheet_config.json for MAIN sheet...");
  await generateConfig(mainSpreadsheetId, tabName);
  console.log(`\n🎉 MAIN Google Sheet is now 100% configured, sorted, and synced!`);
}

setupMainSheet().catch(console.error);

const { google } = require("googleapis");
const path = require("path");
const { generateConfig } = require("./generate-sheet-config");

async function sortSheetAndRebuildConfig() {
  const spreadsheetId = process.argv[2] || "1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY";
  const tabName = process.argv[3] || "337_23rd_SEP_LESSTHEN3";

  console.log(`📊 Sorting Google Sheet ${spreadsheetId} [Tab: ${tabName}]...`);

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "..", "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Get sheet metadata to find sheetId and row boundaries
  const metaRes = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const sheet = metaRes.data.sheets.find(
    (s) => s.properties.title === tabName,
  );
  if (!sheet) {
    throw new Error(`Tab "${tabName}" not found in spreadsheet.`);
  }

  const sheetId = sheet.properties.sheetId;

  // We want to sort data rows starting from row 13 (index 12) to row 2098
  // Key 1: Column B (index 1: "Group") DESCENDING ("Profitable" before "Accepted loss")
  // Key 2: Column M (index 12: "ISBN Match") DESCENDING ("Exact ISBN" before "Different edition")
  console.log(`🔄 Applying 2-level sort on sheetId ${sheetId} (Rows 13 to 2098)...`);
  console.log(`   1️⃣ Key 1: Column B ("Group") DESCENDING -> "Profitable" first, "Accepted loss" last`);
  console.log(`   2️⃣ Key 2: Column M ("ISBN Match") DESCENDING -> "Exact ISBN" (White) first, "Different edition" (Yellow) second`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          sortRange: {
            range: {
              sheetId,
              startRowIndex: 12, // Row 13 (0-indexed)
              endRowIndex: 2098, // Row 2098
              startColumnIndex: 0,
              endColumnIndex: 26,
            },
            sortSpecs: [
              {
                dimensionIndex: 1, // Column B: Group
                sortOrder: "DESCENDING", // "Profitable" before "Accepted loss"
              },
              {
                dimensionIndex: 12, // Column M: ISBN Match
                sortOrder: "DESCENDING", // "Exact ISBN" before "Different edition"
              },
            ],
          },
        },
      ],
    },
  });

  console.log("✅ Google Sheet sorted successfully!");
  console.log("   ⚪ Rows 13 - 1829: White rows (Profitable & Exact ISBN)");
  console.log("   🟡 Rows 1830 - 1927: Yellow rows (Profitable & Different edition)");
  console.log("   🔴 Rows 1928 - 2098: Red rows (Accepted loss)");

  // Re-generate sheet_config.json with the updated row numbers
  console.log("\n🔄 Rebuilding sheet_config.json with newly sorted row numbers...");
  await generateConfig(spreadsheetId, tabName);
  console.log("✅ sheet_config.json updated successfully!");
}

if (require.main === module) {
  sortSheetAndRebuildConfig().catch((err) => {
    console.error("❌ Failed to sort Google Sheet:", err);
    process.exit(1);
  });
}

module.exports = { sortSheetAndRebuildConfig };

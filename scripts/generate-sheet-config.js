const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

function getSpreadsheetId(urlOrId) {
  if (!urlOrId) throw new Error("Spreadsheet URL or ID is required");
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return urlOrId.trim();
}

function colIndexToLetter(idx) {
  let letter = "";
  while (idx >= 0) {
    letter = String.fromCharCode((idx % 26) + 65) + letter;
    idx = Math.floor(idx / 26) - 1;
  }
  return letter;
}

const KNOWN_SPREADSHEET_IDS = [
  "15MqxbfFEkS-6ZPlw-sLGBPY2CcfMxbePPglYksVSgC8",
  "1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY",
];

async function generateConfig(
  urlOrId,
  tabName,
  customCompareColName = "Amazon Price (INR)",
  outputFile = "sheet_config.json",
) {
  let spreadsheetId = getSpreadsheetId(urlOrId);
  console.log(
    `📥 Reading Google Sheet: ${spreadsheetId} [Tab: ${tabName}] via API...`,
  );

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "..", "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tabName}'!A1:Z`,
    });
  } catch (err) {
    const fallbackIds = KNOWN_SPREADSHEET_IDS.filter(
      (id) => id !== spreadsheetId,
    );
    let loaded = false;
    for (const candidateId of fallbackIds) {
      try {
        console.log(
          `   🔄 Tab not found in ${spreadsheetId}, trying spreadsheet ${candidateId}...`,
        );
        res = await sheets.spreadsheets.values.get({
          spreadsheetId: candidateId,
          range: `'${tabName}'!A1:Z`,
        });
        spreadsheetId = candidateId;
        loaded = true;
        break;
      } catch (e) {}
    }
    if (!loaded) throw err;
  }

  const rows = res.data.values || [];
  if (rows.length === 0) {
    throw new Error(`Tab "${tabName}" is empty.`);
  }

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const nonEmptyCells = row.filter((c) => String(c || "").trim() !== "");
    if (nonEmptyCells.length < 4) continue; // Real table header row must have at least 4 column headers!

    const rowStr = row.map((c) => String(c || "").toLowerCase().trim());
    const hasIsbn = rowStr.some(
      (c) =>
        (c === "isbn" ||
          c === "isbn (po)" ||
          c === "isbn (customer order)" ||
          (c.includes("isbn") && !c.includes("match"))) &&
        c.length < 40,
    );
    const hasPrice = rowStr.some(
      (c) =>
        (c.includes("amazon price") || c.includes("price")) && c.length < 40,
    );
    if (hasIsbn && hasPrice) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 11; // default row 12

  const headers = (rows[headerRowIdx] || []).map((c) => String(c || "").trim());
  console.log(`Found headers at Row ${headerRowIdx + 1}:`, headers);

  const statusIdx = headers.findIndex((h) => h.toLowerCase() === "status");

  let isbnIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === "buy this isbn on amazon" ||
      h.toLowerCase() === "amazon isbn",
  );
  if (isbnIdx === -1) {
    isbnIdx = headers.findIndex(
      (h) =>
        h.toLowerCase() === "isbn (customer order)" ||
        h.toLowerCase() === "isbn (po)" ||
        h.toLowerCase() === "po isbn" ||
        h.toLowerCase() === "isbn",
    );
  }
  if (isbnIdx === -1) {
    isbnIdx = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("isbn") && !h.toLowerCase().includes("match"),
    );
  }

  const poIsbnIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === "po isbn" ||
      h.toLowerCase() === "isbn (po)" ||
      h.toLowerCase() === "isbn",
  );

  let reasonIdx = headers.findIndex((h) =>
    h.toLowerCase().includes("no with reason"),
  );
  if (reasonIdx === -1) {
    reasonIdx = headers.findIndex((h) => h.toLowerCase().includes("reason"));
  }

  let priceIdx = headers.findIndex(
    (h) => h.toLowerCase() === customCompareColName.toLowerCase(),
  );
  if (priceIdx === -1) {
    priceIdx = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("amazon price") ||
        h.toLowerCase().includes("price"),
    );
  }

  let titleIdx = headers.findIndex((h) => h.toLowerCase() === "po title");
  if (titleIdx === -1) {
    titleIdx = headers.findIndex((h) => h.toLowerCase() === "title");
  }
  if (titleIdx === -1) {
    titleIdx = headers.findIndex(
      (h) =>
        h.toLowerCase() === "amazon title" || h.toLowerCase().includes("title"),
    );
  }

  const matchIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes("isbn match") ||
      h.toLowerCase() === "match type" ||
      h.toLowerCase().includes("match type"),
  );

  const groupIdx = headers.findIndex((h) => h.toLowerCase() === "group");
  let cursorIdx = headers.findIndex(
    (h) => h.toLowerCase() === "cursor" || h.toLowerCase() === "curosr",
  );
  let sellIdx = headers.findIndex(
    (h) =>
      h.toLowerCase() === "po value (inr @ rate)" ||
      h.toLowerCase().includes("po value (inr") ||
      h.toLowerCase() === "po price (inr)" ||
      h.toLowerCase() === "po (inr)" ||
      h.toLowerCase().includes("po price (inr)") ||
      h.toLowerCase().includes("po (inr)") ||
      h.toLowerCase().includes("sell (inr)") ||
      h.toLowerCase() === "sell (inr)" ||
      h.toLowerCase() === "sell value (inr)" ||
      h.toLowerCase().includes("sell value"),
  );
  if (sellIdx === -1) {
    sellIdx = headers.findIndex(
      (h) =>
        !h.toLowerCase().includes("seller") &&
        (h.toLowerCase() === "sell" ||
          h.toLowerCase().includes("sell") ||
          h.toLowerCase().includes("po price")),
    );
  }

  // If CURSOR column doesn't exist, create it in Google Sheet!
  if (cursorIdx === -1) {
    console.log(
      `📌 "CURSOR" column not found. Creating it in Google Sheet at Row ${headerRowIdx + 1}...`,
    );
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetObj = meta.data.sheets.find(
        (s) => s.properties.title === tabName,
      );
      const sId = sheetObj ? sheetObj.properties.sheetId : 0;
      const insertAt = reasonIdx !== -1 ? reasonIdx + 1 : 4;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sId,
                  dimension: "COLUMNS",
                  startIndex: insertAt,
                  endIndex: insertAt + 1,
                },
                inheritFromBefore: true,
              },
            },
          ],
        },
      });

      const cursorColLet = colIndexToLetter(insertAt);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tabName}'!${cursorColLet}${headerRowIdx + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [["CURSOR"]],
        },
      });
      cursorIdx = insertAt;
      console.log(`✅ Created "CURSOR" column at Column ${cursorColLet}`);
    } catch (err) {
      console.warn("⚠️ Could not auto-insert CURSOR column:", err.message);
    }
  }

  const reasonColLetter = colIndexToLetter(reasonIdx !== -1 ? reasonIdx : 3);
  const cursorColLetter = cursorIdx !== -1 ? colIndexToLetter(cursorIdx) : "E";
  const sellColLetter = sellIdx !== -1 ? colIndexToLetter(sellIdx) : "J";

  const whiteItems = [];
  const yellowItems = [];
  const redItems = [];
  let latestCursor = null;
  let latestReverseCursor = null;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    let rawIsbn = String(row[isbnIdx] || "").trim();
    if (!rawIsbn && poIsbnIdx !== -1) {
      rawIsbn = String(row[poIsbnIdx] || "").trim();
    }
    if (!rawIsbn) continue;
    const cleanIsbn = rawIsbn.replace(/[^\dX]/gi, "");

    const rawPrice = row[priceIdx];
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : parseFloat(String(rawPrice || "0").replace(/[^0-9.]/g, ""));
    const rawSell = sellIdx !== -1 ? row[sellIdx] : null;
    const sellPrice =
      typeof rawSell === "number"
        ? rawSell
        : parseFloat(String(rawSell || "0").replace(/[^0-9.]/g, ""));

    const title = String(row[titleIdx] || "N/A").trim();
    const status =
      statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "Pending";
    const group = groupIdx !== -1 ? String(row[groupIdx] || "").trim() : "";
    const existingReason =
      reasonIdx !== -1 ? String(row[reasonIdx] || "").trim() : "";
    const existingCursor =
      cursorIdx !== -1 ? String(row[cursorIdx] || "").trim() : "";
    const matchType = matchIdx !== -1 ? String(row[matchIdx] || "").trim() : "";

    const matchVal = matchType.toLowerCase();
    const isRed = group.toLowerCase().includes("loss");
    const isYellow =
      !isRed &&
      (matchVal.includes("diff") ||
        matchVal.includes("different") ||
        matchVal === "no");
    const rowColor = isRed ? "red" : isYellow ? "yellow" : "white";

    const item = {
      sheetRowNumber: i + 1, // 1-indexed row number
      isbn: cleanIsbn,
      targetPrice: !isNaN(price) ? price : 0,
      sellPrice: !isNaN(sellPrice) ? sellPrice : 0,
      title,
      group,
      status,
      existingReason,
      existingCursor,
      matchType: matchType || (isYellow ? "Different edition" : "Exact ISBN"),
      rowColor,
    };

    if (
      existingCursor &&
      (existingCursor.toLowerCase().includes("cursor") ||
        existingCursor.toLowerCase().includes("curosr") ||
        /^r?\d+$/i.test(existingCursor.trim()))
    ) {
      const isRevCursor =
        /\br\s*\d+/i.test(existingCursor) ||
        existingCursor.toLowerCase().includes("reverse");
      const matchNum = existingCursor.match(/(\d+)/);
      const batchNum = matchNum ? parseInt(matchNum[1], 10) : 1;
      const cursorObj = {
        batchNumber: batchNum,
        sheetRowNumber: i + 1,
        isbn: cleanIsbn,
        cursorText: existingCursor,
      };
      if (isRevCursor) {
        if (
          !latestReverseCursor ||
          batchNum >= latestReverseCursor.batchNumber
        ) {
          latestReverseCursor = cursorObj;
        }
      } else {
        if (!latestCursor || batchNum >= latestCursor.batchNumber) {
          latestCursor = cursorObj;
        }
      }
    }

    if (isRed) {
      redItems.push(item);
    } else if (isYellow) {
      yellowItems.push(item);
    } else {
      whiteItems.push(item);
    }
  }

  // GROUPING RULE: Whites first, then Yellows, then Reds!
  const sortedItems = [...whiteItems, ...yellowItems, ...redItems];

  // If this sheet has no sell/margin column (e.g. 34_4-2_13NOV_ALLAM_RISZNREMAINIG in 15MqxbfFEkS-6ZPlw-sLGBPY2CcfMxbePPglYksVSgC8),
  // enrich sellPrice from equivalent tab ZB344-2_13NOV_ALLAMZNREMAINING (1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY)
  if (sellIdx === -1) {
    const refConfigPath = path.join(
      __dirname,
      "..",
      "sheet_configs",
      "ZB344-2_13NOV_ALLAMZNREMAINING.json",
    );
    if (fs.existsSync(refConfigPath)) {
      try {
        const refConfig = JSON.parse(fs.readFileSync(refConfigPath, "utf8"));
        const refByIsbn = new Map();
        (refConfig.items || []).forEach((it) => {
          if (it.isbn && it.sellPrice > 0) {
            refByIsbn.set(it.isbn, it.sellPrice);
          }
        });
        let enrichedCount = 0;
        sortedItems.forEach((it, idx) => {
          const refItem = (refConfig.items || [])[idx];
          if (refItem && refItem.isbn === it.isbn && refItem.sellPrice > 0) {
            it.sellPrice = refItem.sellPrice;
            enrichedCount++;
          } else if (refByIsbn.has(it.isbn)) {
            it.sellPrice = refByIsbn.get(it.isbn);
            enrichedCount++;
          }
        });
        console.log(
          `   💵 Enriched sellPrice for ${enrichedCount}/${sortedItems.length} rows from ZB344-2_13NOV_ALLAMZNREMAINING`,
        );
      } catch (e) {
        console.warn(`   ⚠️ Could not enrich sellPrice from reference config: ${e.message}`);
      }
    }
  }

  const config = {
    spreadsheetId,
    tabName,
    headerRow: headerRowIdx + 1,
    totalItems: sortedItems.length,
    whiteItemsCount: whiteItems.length,
    yellowItemsCount: yellowItems.length,
    redItemsCount: redItems.length,
    latestCursor,
    latestReverseCursor,
    columns: {
      status: statusIdx,
      statusName: headers[statusIdx] || "Status",
      group: groupIdx,
      groupName: headers[groupIdx] || "Group",
      isbn: isbnIdx,
      isbnName: headers[isbnIdx] || "ISBN",
      reason: reasonIdx,
      reasonName: headers[reasonIdx] || "NO WITH REASON",
      reasonColLetter,
      cursor: cursorIdx,
      cursorName: cursorIdx !== -1 ? headers[cursorIdx] : "CURSOR",
      cursorColLetter,
      comparePrice: priceIdx,
      comparePriceName: headers[priceIdx] || customCompareColName,
      sell: sellIdx,
      sellName: sellIdx !== -1 ? headers[sellIdx] : "Sell (INR)",
      sellColLetter,
      title: titleIdx,
      titleName: headers[titleIdx] || "Title",
      isbnMatch: matchIdx,
      isbnMatchName: matchIdx !== -1 ? headers[matchIdx] : "ISBN Match",
    },
    items: sortedItems,
  };

  const configsDir = path.join(__dirname, "..", "sheet_configs");
  if (!fs.existsSync(configsDir)) {
    fs.mkdirSync(configsDir, { recursive: true });
  }

  const safeTabFileName = tabName.replace(/[/\\?%*:|"<>]/g, "_").trim();
  const tabConfigPath = path.join(configsDir, `${safeTabFileName}.json`);
  fs.writeFileSync(tabConfigPath, JSON.stringify(config, null, 2), "utf8");
  console.log(`📁 Tab config saved to sheet_configs/${safeTabFileName}.json`);

  const outPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.join(process.cwd(), outputFile);
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2), "utf8");
  console.log(
    `✅ Active config updated at ${outputFile} with ${sortedItems.length} book rows.`,
  );
  console.log(
    `   ⚪ White rows (Exact ISBN): ${whiteItems.length} (queued first)`,
  );
  console.log(
    `   🟡 Yellow rows (Different edition): ${yellowItems.length} (queued second)`,
  );
  console.log(
    `   🔴 Red rows (Accepted loss): ${redItems.length} (queued third)`,
  );
  console.log(
    `   📌 Reason column: Column ${reasonColLetter} ("${config.columns.reasonName}")`,
  );
  console.log(
    `   📍 Cursor column: Column ${cursorColLetter} ("${config.columns.cursorName}")`,
  );
  if (latestCursor) {
    console.log(
      `   🚩 Latest Cursor found: "${latestCursor.cursorText}" at Row #${latestCursor.sheetRowNumber} (Batch ${latestCursor.batchNumber})`,
    );
  }
  return config;
}

if (require.main === module) {
  let url =
    "https://docs.google.com/spreadsheets/d/1jNGgr6d5mOZzHTpHiVlEyVBSACBdwL81VYNcUrSSOZY/edit?usp=sharing";
  let tab = "PREP_1_5TH_OCT_LESSTHEN3";
  let col = "Amazon Price (INR)";

  const arg1 = process.argv[2];
  const arg2 = process.argv[3];
  const arg3 = process.argv[4];

  if (arg1) {
    if (
      arg1.startsWith("http") ||
      (arg1.length >= 40 &&
        !arg1.includes("&") &&
        !arg1.includes("+") &&
        !arg1.includes("/") &&
        arg2)
    ) {
      url = arg1;
      if (arg2) tab = arg2;
      if (arg3) col = arg3;
    } else {
      // First arg is tab name!
      tab = arg1;
      if (arg2) col = arg2;
    }
  }

  generateConfig(url, tab, col).catch((err) => {
    console.error("Error generating config:", err);
    process.exit(1);
  });
}

module.exports = { generateConfig };

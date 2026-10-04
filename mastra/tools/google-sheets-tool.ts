import { google } from "googleapis";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as XLSX from "xlsx";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

export function getSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) throw new Error("Spreadsheet URL or ID is required");
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return urlOrId.trim();
}

export function getSheetsClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google credentials file not found at: ${CREDENTIALS_PATH}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export interface SheetRowItem {
  sheetRowNumber: number; // 1-based index in the spreadsheet
  isbn: string;
  targetPrice: number;
  title: string;
  status: string;
  group?: string;
  rowColor?: string;
  matchType?: string;
  existingReason?: string;
  existingCursor?: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  tabName: string;
  isNativeGoogleSheet: boolean;
  headerRow: number;
  totalItems: number;
  whiteItemsCount?: number;
  yellowItemsCount?: number;
  redItemsCount?: number;
  latestCursor?: {
    batchNumber: number;
    sheetRowNumber: number;
    isbn: string;
    cursorText: string;
  } | null;
  columns: {
    status: number;
    statusName: string;
    isbn: number;
    isbnName: string;
    comparePrice: number;
    comparePriceName: string;
    title: number;
    titleName: string;
    reason?: number;
    reasonName?: string;
    reasonColLetter?: string;
    cursor?: number;
    cursorName?: string;
    cursorColLetter?: string;
    group?: number;
    groupName?: string;
    isbnMatch?: number;
    isbnMatchName?: string;
  };
  items: SheetRowItem[];
}

/**
 * Downloads and parses any Google Sheet or Drive XLSX file.
 * Automatically scans the first 25 rows to locate the real table headers.
 */
export async function fetchAndAnalyzeSheet(
  urlOrId: string,
  tabName: string,
  customCompareColName = "Amazon Price (INR)",
): Promise<SheetConfig> {
  const spreadsheetId = getSpreadsheetId(urlOrId);

  // Try direct XLSX download (works for both native Google Sheets and uploaded Excel files)
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const res = await axios.get(downloadUrl, { responseType: "arraybuffer" });
  const wb = XLSX.read(res.data, { type: "buffer" });

  const targetTab = wb.Sheets[tabName];
  if (!targetTab) {
    throw new Error(
      `Tab "${tabName}" not found in spreadsheet. Available tabs are: ${wb.SheetNames.join(", ")}`,
    );
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(targetTab, { header: 1 });
  if (rows.length === 0) {
    throw new Error(`Tab "${tabName}" is empty.`);
  }

  // Find header row by searching for "ISBN" and compare price column
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const rowStr = row.map((c) => String(c || "").toLowerCase());
    const hasIsbn = rowStr.some((c) => c.includes("isbn"));
    const hasPrice = rowStr.some(
      (c) =>
        c.includes("price") ||
        c.includes("cost") ||
        c.includes(customCompareColName.toLowerCase()),
    );
    if (hasIsbn && hasPrice) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Default to row 0 if no specific row found
    headerRowIdx = 0;
  }

  const headers: string[] = (rows[headerRowIdx] || []).map((c) => String(c || "").trim());

  let statusIdx = headers.findIndex((h) => h.toLowerCase() === "status");
  let isbnIdx = headers.findIndex((h) => h.toLowerCase() === "isbn" || h.toLowerCase().includes("isbn"));
  let priceIdx = headers.findIndex((h) => h.toLowerCase() === customCompareColName.toLowerCase());
  if (priceIdx === -1) {
    priceIdx = headers.findIndex((h) => h.toLowerCase().includes("amazon price") || h.toLowerCase().includes("price"));
  }
  let titleIdx = headers.findIndex((h) => h.toLowerCase().includes("amazon title") || h.toLowerCase().includes("title"));

  // Fallbacks
  if (statusIdx === -1) statusIdx = 0;
  if (isbnIdx === -1) isbnIdx = 2;
  if (priceIdx === -1) priceIdx = 8;
  if (titleIdx === -1) titleIdx = 7;

  // Check if native Google Sheet via API
  let isNativeGoogleSheet = false;
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.get({ spreadsheetId });
    isNativeGoogleSheet = true;
  } catch (err: any) {
    isNativeGoogleSheet = false;
  }

  const items: SheetRowItem[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rawIsbn = String(row[isbnIdx] || "").trim();
    if (!rawIsbn) continue;
    const cleanIsbn = rawIsbn.replace(/[^\dX]/gi, "");

    const rawPrice = row[priceIdx];
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : parseFloat(String(rawPrice || "0").replace(/[^0-9.]/g, ""));

    const title = String(row[titleIdx] || "N/A").trim();
    const status = String(row[statusIdx] || "").trim();

    items.push({
      sheetRowNumber: i + 1, // 1-indexed
      isbn: cleanIsbn,
      targetPrice: !isNaN(price) ? price : 0,
      title,
      status,
    });
  }

  const config: SheetConfig = {
    spreadsheetId,
    tabName,
    isNativeGoogleSheet,
    headerRow: headerRowIdx + 1,
    totalItems: items.length,
    columns: {
      status: statusIdx,
      statusName: headers[statusIdx] || "Status",
      isbn: isbnIdx,
      isbnName: headers[isbnIdx] || "ISBN",
      comparePrice: priceIdx,
      comparePriceName: headers[priceIdx] || customCompareColName,
      title: titleIdx,
      titleName: headers[titleIdx] || "Title",
    },
    items,
  };

  return config;
}

export async function saveSheetConfigToFile(config: SheetConfig, filePath = "sheet_config.json") {
  const targetPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), "utf8");
  return targetPath;
}

// -------------------------------------------------------------
// MASTRA TOOL: analyzeGoogleSheetTool
// -------------------------------------------------------------
export const analyzeGoogleSheetTool = createTool({
  id: "analyze-google-sheet",
  description:
    "Analyzes a Google Sheet / Drive XLSX link, finds the table headers, extracts row counts, column mapping, and creates sheet_config.json for the automation script.",
  inputSchema: z.object({
    sheetUrl: z.string().describe("The Google Sheet URL or ID"),
    tabName: z.string().describe("The tab name (e.g. '337_23rd_SEP_LESSTHEN3')"),
    comparePriceColumn: z
      .string()
      .optional()
      .default("Amazon Price (INR)")
      .describe("Name of the column containing the target compare price"),
  }),
  outputSchema: z.object({
    spreadsheetId: z.string(),
    tabName: z.string(),
    isNativeGoogleSheet: z.boolean(),
    headerRow: z.number(),
    totalItems: z.number(),
    columns: z.object({
      status: z.number(),
      statusName: z.string(),
      isbn: z.number(),
      isbnName: z.string(),
      comparePrice: z.number(),
      comparePriceName: z.string(),
      title: z.number(),
      titleName: z.string(),
    }),
    sampleItems: z.array(
      z.object({
        sheetRowNumber: z.number(),
        isbn: z.string(),
        targetPrice: z.number(),
        title: z.string(),
        status: z.string(),
      }),
    ),
  }),
  execute: async ({ sheetUrl, tabName, comparePriceColumn }) => {
    const config = await fetchAndAnalyzeSheet(sheetUrl, tabName, comparePriceColumn);
    await saveSheetConfigToFile(config);
    return {
      spreadsheetId: config.spreadsheetId,
      tabName: config.tabName,
      isNativeGoogleSheet: config.isNativeGoogleSheet,
      headerRow: config.headerRow,
      totalItems: config.totalItems,
      columns: config.columns,
      sampleItems: config.items.slice(0, 5),
    };
  },
});

export async function updateRowStatus(params: {
  spreadsheetId: string;
  tabName: string;
  rowNumber: number;
  statusColIndex: number;
  status: string;
}) {
  const { spreadsheetId, tabName, rowNumber, statusColIndex, status } = params;

  // USER RULE: If successfully added to cart, add nothing!
  if (!status || status.toUpperCase() === "ADDED TO CART" || status.toUpperCase() === "SUCCESS") {
    return { updated: false, reason: "Cart success - no writeback needed" };
  }

  const sheets = getSheetsClient();

  function colIndexToLetter(idx: number): string {
    let letter = "";
    while (idx >= 0) {
      letter = String.fromCharCode((idx % 26) + 65) + letter;
      idx = Math.floor(idx / 26) - 1;
    }
    return letter;
  }

  const colLetter = colIndexToLetter(statusColIndex);
  const cellRange = `'${tabName}'!${colLetter}${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[status]],
    },
  });

  return { updated: true, cellRange, status };
}

// -------------------------------------------------------------
// MASTRA TOOL: updateSheetStatusTool
// -------------------------------------------------------------
export const updateSheetStatusTool = createTool({
  id: "update-sheet-status",
  description:
    "Writes back failure status to the Google Sheet (e.g. 'Not Available' or 'High Price'). If the book is successfully added to cart, it writes nothing as per user rule.",
  inputSchema: z.object({
    sheetUrl: z.string().describe("The Google Sheet URL or spreadsheet ID"),
    tabName: z.string().describe("The tab name"),
    rowNumber: z.number().describe("The 1-based row number in the sheet"),
    statusColIndex: z.number().describe("The 0-based column index for the status column"),
    status: z
      .string()
      .describe("Status to write back ('Not Available', 'High Price', etc.). Blank or cart success writes nothing."),
  }),
  outputSchema: z.object({
    updated: z.boolean(),
    cellRange: z.string().optional(),
    status: z.string().optional(),
    reason: z.string().optional(),
  }),
  execute: async ({ sheetUrl, tabName, rowNumber, statusColIndex, status }) => {
    const spreadsheetId = getSpreadsheetId(sheetUrl);
    return await updateRowStatus({
      spreadsheetId,
      tabName,
      rowNumber,
      statusColIndex,
      status,
    });
  },
});


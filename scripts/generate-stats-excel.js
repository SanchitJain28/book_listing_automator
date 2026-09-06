const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const JSON_INPUT = path.join(
  __dirname,
  "../output/google-links/isbns/input-2.json"
);
const EXCEL_OUTPUT = path.join(
  __dirname,
  "../output/google-links/isbns/input-2-stats.xlsx"
);

function generateStatsExcel() {
  console.log("📊 Analyzing input-2.json and generating Excel workbook...");

  if (!fs.existsSync(JSON_INPUT)) {
    console.error(`❌ File not found: ${JSON_INPUT}`);
    return;
  }

  const rawLines = fs.readFileSync(JSON_INPUT, "utf8").split("\n").filter(Boolean);
  const records = [];
  for (const line of rawLines) {
    try {
      records.push(JSON.parse(line));
    } catch (e) {}
  }

  console.log(`ℹ Loaded ${records.length} records.`);

  // 1. Compute High-Level Metrics
  const totalProcessed = records.length;
  let inStockIsbnsCount = 0;
  let outOfStockIsbnsCount = 0;
  let totalWhitelistedLinks = 0;
  let totalDiscoveredGoogleLinks = 0;
  let totalIndividualListings = 0;
  let totalInStockListings = 0;
  let totalOutOfStockListings = 0;

  const validPricesInr = [];
  const platformStats = {};
  const bestPlatformCounts = {};

  const booksSheetData = [];
  const listingsSheetData = [];

  records.forEach((rec, idx) => {
    const hasStock = rec.in_stock_count > 0 || (rec.best_price_inr !== null && rec.best_price_inr !== undefined);
    if (hasStock) {
      inStockIsbnsCount++;
    } else {
      outOfStockIsbnsCount++;
    }

    totalWhitelistedLinks += (rec.total_whitelisted_links || 0);
    totalDiscoveredGoogleLinks += (rec.links_found ? rec.links_found.length : 0);

    let bestPriceNum = null;
    if (rec.best_price_inr !== null && rec.best_price_inr !== undefined) {
      const cleanP = parseFloat(String(rec.best_price_inr).replace(/[^0-9.]/g, ""));
      if (!isNaN(cleanP)) {
        bestPriceNum = cleanP;
        validPricesInr.push(cleanP);
      }
    }

    if (rec.best_platform) {
      bestPlatformCounts[rec.best_platform] = (bestPlatformCounts[rec.best_platform] || 0) + 1;
    }

    // Books row
    booksSheetData.push({
      "Index": idx + 1,
      "ISBN": rec.isbn || "",
      "Title": rec.title || "N/A",
      "Author": rec.author || "N/A",
      "Status": hasStock ? "IN STOCK" : "OUT OF STOCK",
      "Best Price (INR)": bestPriceNum !== null ? bestPriceNum : "N/A",
      "Best Platform": rec.best_platform || "N/A",
      "In-Stock Stores Count": rec.in_stock_count || 0,
      "Matched Whitelisted Stores": rec.total_whitelisted_links || 0,
      "Total Discovered Google Links": rec.links_found ? rec.links_found.length : 0,
      "Scraped At": rec.scraped_at || "",
    });

    // Process Listings
    if (rec.listings && Array.isArray(rec.listings)) {
      rec.listings.forEach((item) => {
        totalIndividualListings++;
        const plat = item.platform || "Unknown";
        if (!platformStats[plat]) {
          platformStats[plat] = {
            platform: plat,
            method: item.extraction_method || "N/A",
            total: 0,
            inStock: 0,
            outOfStock: 0,
            prices: [],
          };
        }

        platformStats[plat].total++;
        if (item.in_stock) {
          totalInStockListings++;
          platformStats[plat].inStock++;
          if (item.price !== null && item.price !== undefined) {
            const num = parseFloat(String(item.price).replace(/[^0-9.]/g, ""));
            if (!isNaN(num)) platformStats[plat].prices.push(num);
          }
        } else {
          totalOutOfStockListings++;
          platformStats[plat].outOfStock++;
        }

        // Listings Row
        listingsSheetData.push({
          "ISBN": rec.isbn || "",
          "Book Title": rec.title || item.title || "N/A",
          "Platform / Store": item.platform || "N/A",
          "Extraction Method": item.extraction_method || "N/A",
          "Stock Status": item.in_stock ? "In Stock" : "Out of Stock",
          "Price": item.price !== null && item.price !== undefined ? item.price : "N/A",
          "Currency": item.currency || "INR",
          "MRP": item.mrp !== null && item.mrp !== undefined ? item.mrp : "N/A",
          "Discount": item.discount || "",
          "Seller": item.seller || "N/A",
          "Seller Origin / Location": item.seller_address || "",
          "Shipping Info": item.shipping || "",
          "Publisher": item.publisher || "",
          "Binding": item.binding || "",
          "Store URL": item.url || "",
        });
      });
    }
  });

  // Calculate pricing summary stats
  validPricesInr.sort((a, b) => a - b);
  const avgPrice = validPricesInr.length > 0 ? (validPricesInr.reduce((a, b) => a + b, 0) / validPricesInr.length).toFixed(2) : "0";
  const medianPrice = validPricesInr.length > 0 ? validPricesInr[Math.floor(validPricesInr.length / 2)] : "0";
  const minPrice = validPricesInr.length > 0 ? validPricesInr[0] : "0";
  const maxPrice = validPricesInr.length > 0 ? validPricesInr[validPricesInr.length - 1] : "0";

  // Tab 1: KPI Overview
  const summarySheetData = [
    { "Metric": "Total ISBNs Processed", "Value": totalProcessed },
    { "Metric": "In-Stock ISBNs (Found Available)", "Value": inStockIsbnsCount },
    { "Metric": "Out-of-Stock ISBNs", "Value": outOfStockIsbnsCount },
    { "Metric": "Overall Book Availability Rate (%)", "Value": `${((inStockIsbnsCount / totalProcessed) * 100).toFixed(2)}%` },
    { "Metric": "", "Value": "" },
    { "Metric": "Total Store Listings Inspected", "Value": totalIndividualListings },
    { "Metric": "In-Stock Store Listings Found", "Value": totalInStockListings },
    { "Metric": "Out-of-Stock Store Listings", "Value": totalOutOfStockListings },
    { "Metric": "Total Whitelisted Store Matches", "Value": totalWhitelistedLinks },
    { "Metric": "Avg Whitelisted Stores Matched per ISBN", "Value": (totalWhitelistedLinks / totalProcessed).toFixed(2) },
    { "Metric": "Total Discovered Google Links (Page 1)", "Value": totalDiscoveredGoogleLinks },
    { "Metric": "", "Value": "" },
    { "Metric": "Average Best Price (INR)", "Value": `₹${avgPrice}` },
    { "Metric": "Median Best Price (INR)", "Value": `₹${medianPrice}` },
    { "Metric": "Minimum Price Found (INR)", "Value": `₹${minPrice}` },
    { "Metric": "Maximum Price Found (INR)", "Value": `₹${maxPrice}` },
  ];

  // Tab 2: Platform Stats
  const platformSheetData = Object.values(platformStats).map((p) => {
    const avg = p.prices.length > 0 ? (p.prices.reduce((a, b) => a + b, 0) / p.prices.length).toFixed(2) : "N/A";
    const winCount = bestPlatformCounts[p.platform] || 0;
    return {
      "Store Platform": p.platform,
      "Extraction Method": p.method,
      "Total Times Discovered": p.total,
      "In-Stock Listings": p.inStock,
      "Out-of-Stock Listings": p.outOfStock,
      "Stock Availability Rate (%)": `${((p.inStock / p.total) * 100).toFixed(1)}%`,
      "Lowest Price Wins (Best Platform)": winCount,
      "Avg Listing Price": avg,
    };
  }).sort((a, b) => b["Total Times Discovered"] - a["Total Times Discovered"]);

  // 3. Create Workbook
  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  const wsPlatform = XLSX.utils.json_to_sheet(platformSheetData);
  const wsBooks = XLSX.utils.json_to_sheet(booksSheetData);
  const wsListings = XLSX.utils.json_to_sheet(listingsSheetData);

  // Set column widths for readability
  wsSummary["!cols"] = [{ wch: 38 }, { wch: 22 }];
  wsPlatform["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 32 }, { wch: 18 }];
  wsBooks["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 45 }, { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 28 }, { wch: 24 }];
  wsListings["!cols"] = [{ wch: 16 }, { wch: 35 }, { wch: 20 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 60 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, "KPI Summary");
  XLSX.utils.book_append_sheet(wb, wsPlatform, "Store Breakdown");
  XLSX.utils.book_append_sheet(wb, wsBooks, "Book Comparison");
  XLSX.utils.book_append_sheet(wb, wsListings, "All Store Listings");

  XLSX.writeFile(wb, EXCEL_OUTPUT);
  console.log(`\n🎉 Excel file created successfully: ${EXCEL_OUTPUT}`);
}

if (require.main === module) {
  generateStatsExcel();
}

module.exports = { generateStatsExcel };

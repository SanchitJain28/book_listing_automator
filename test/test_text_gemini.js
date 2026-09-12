const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

chromium.use(stealth);

async function extractWithGeminiText(pageText) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = "gemini-flash-lite-latest";

  const bookSchema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Exact book title" },
      price: { type: "number", description: "Selling price as clean number without currency" },
      mrp: { type: "number", description: "List price / MRP as a number" },
      currency: { type: "string", description: "Currency (e.g. INR, USD, GBP)" },
      in_stock: { type: "boolean", description: "true if active Buy Now or In Stock, false if Out of stock or unavailable" },
      stock_status: { type: "string", description: "'In Stock' or 'Out of Stock'" },
      author: { type: "string", description: "Author of the book" },
      publisher: { type: "string", description: "Publisher name" },
      binding: { type: "string", description: "Format (Paperback, Hardcover, etc.)" },
      seller: { type: "string", description: "Seller or store name" },
    },
    required: ["title", "price", "in_stock", "stock_status"],
  };

  const prompt = `You are an expert e-commerce book listing data extractor.
Analyze the following webpage text extracted from an online book store and extract all key product, pricing, and stock details.

WEBPAGE TEXT:
---
${pageText.slice(0, 15000)}
---

CRITICAL INSTRUCTIONS:
1. Extract the current selling price and original MRP accurately.
2. Check if the book is in stock or out of stock. If you see 'Out of Stock', 'Unavailable', 'Sold Out', mark in_stock: false.
3. If price is in INR / ₹, set currency: 'INR'.`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: bookSchema,
      temperature: 0.1,
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

(async () => {
  const testUrl = "https://www.bookswagon.com/book/ai-agent-memory-architecture-abhay/9798279171385";
  console.log(`🌐 Testing Universal Text Extraction on: ${testUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const startTime = Date.now();
  await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 25000 });

  // Extract clean text from the page (no screenshots!)
  const extractedText = await page.evaluate(() => {
    // Remove scripts, styles, svg
    const scripts = document.querySelectorAll("script, style, noscript, svg");
    scripts.forEach((s) => s.remove());
    return document.body.innerText;
  });

  console.log(`📄 Extracted ${extractedText.length} chars of clean text from DOM in ${Date.now() - startTime}ms.`);
  console.log(`🤖 Passing clean text to Gemini Flash Lite...`);

  const geminiStart = Date.now();
  const bookData = await extractWithGeminiText(extractedText);
  console.log(`⚡ Gemini extracted data in ${Date.now() - geminiStart}ms:`);
  console.log(JSON.stringify(bookData, null, 2));

  await browser.close();
})();

const fs = require("fs");

/**
 * Extracts structured book listing metadata from a screenshot using Google Gemini 2.5 Flash Vision API.
 * Uses official responseMimeType + responseSchema for 100% schema-guaranteed JSON.
 * @param {string|Buffer} imageInput - Absolute file path or Buffer of the screenshot
 * @param {Object} options - Optional config { apiKey, model }
 * @returns {Promise<Object>} Extracted book data
 */
async function extractBookDataWithGemini(imageInput, options = {}) {
  const apiKey =
    options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const model = options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please set GEMINI_API_KEY in your environment or .env file.",
    );
  }

  let base64Image = "";
  let mimeType = "image/png";

  if (Buffer.isBuffer(imageInput)) {
    base64Image = imageInput.toString("base64");
  } else if (typeof imageInput === "string") {
    if (imageInput.endsWith(".jpg") || imageInput.endsWith(".jpeg")) {
      mimeType = "image/jpeg";
    } else if (imageInput.endsWith(".webp")) {
      mimeType = "image/webp";
    }
    const buffer = fs.readFileSync(imageInput);
    base64Image = buffer.toString("base64");
  } else {
    throw new Error("Invalid imageInput provided to extractBookDataWithGemini");
  }

  const prompt = `You are a professional e-commerce book listing data extractor.
Analyze this webpage screenshot of a book listing and extract all key product, pricing, and stock details according to the schema.`;

  // Official Gemini 2.5 Flash JSON Schema specification
  const bookSchema = {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Exact book title as displayed on the page",
      },
      price: {
        type: "number",
        description:
          "Current buy/selling price as a clean number without currency symbol (e.g. 241.90)",
      },
      mrp: {
        type: "number",
        description:
          "Original list price or strikethrough MRP as a number (e.g. 295.00)",
      },
      discount: {
        type: "string",
        description:
          "Discount percentage if shown on the page (e.g. '18%' or '25% OFF')",
      },
      currency: {
        type: "string",
        description: "Currency code (e.g. 'INR', 'USD', 'GBP', 'EUR')",
      },
      in_stock: {
        type: "boolean",
        description:
          "true if item is in stock / Buy Now / Add to Cart is active; false if Out of Stock, Sold Out, or Unavailable",
      },
      stock_status: {
        type: "string",
        description: "Either 'In Stock' or 'Out of Stock'",
      },
      author: {
        type: "string",
        description: "Author or authors of the book",
      },
      publisher: {
        type: "string",
        description: "Publisher name if visible",
      },
      binding: {
        type: "string",
        description: "Format or binding (e.g. 'Paperback', 'Hardcover')",
      },
      seller: {
        type: "string",
        description: "Marketplace seller or bookstore name",
      },
    },
    required: ["title", "price", "in_stock", "stock_status"],
  };

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: bookSchema,
      temperature: 0.1,
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }

  return JSON.parse(text);
}

module.exports = { extractBookDataWithGemini };

require("dotenv").config();
const base = {
  rootCategory: 976389031,
  productType: 0,
  lastUpdate_gte: 0,
  current_COUNT_REVIEWS_lte: 20,
};
const variants = {
  "new, in stock (your current run)": { current_BUY_BOX_SHIPPING_gte: 1 },
  "has a used offer with a price": { current_USED_gte: 1 },
  "has >= 1 used offer": { current_COUNT_USED_gte: 1 },
  "used, Like New or Very Good": {
    current_USED_gte: 1,
    buyBoxUsedCondition: [2, 3],
  },
};
(async () => {
  for (const [label, extra] of Object.entries(variants)) {
    const sel = { ...base, ...extra, perPage: 50, page: 0 };
    const url = `https://api.keepa.com/query?key=${process.env.KEEPA_API_KEY}&domain=10&selection=${encodeURIComponent(JSON.stringify(sel))}`;
    const res = await fetch(url);
    const d = await res.json();
    if (typeof d.totalResults === "number") {
      console.log(
        `${label.padEnd(36)} ${d.totalResults.toLocaleString("en-IN")}   (tokens left ${d.tokensLeft})`,
      );
    } else {
      console.log(
        `${label.padEnd(36)} HTTP ${res.status}: ${JSON.stringify(d).slice(0, 250)}`,
      );
    }
  }
})();

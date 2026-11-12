const { runAmazonIsbn } = require("../amazon-isbn/amazon-isbn");
const { scrapeAmazonBook, emptyBookDetails } = require("./scraper");

const blockResources = process.argv.slice(3).includes("--no-blocked-resources")
  ? false
  : ["media"];

runAmazonIsbn({
  name: "amazon-isbn-enchanced",
  scrape: scrapeAmazonBook,
  emptyFields: emptyBookDetails,
  blockResources,
}).then(code => { process.exitCode = code ?? 0; });

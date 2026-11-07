const { runAmazonIsbn } = require("../amazon-isbn/amazon-isbn");
const { scrapeAmazonBook, emptyBookDetails } = require("./scraper");

const blockResources = process.argv.slice(3).includes("--no-blocked-resources")
  ? false
  : ["stylesheet", "image"];

runAmazonIsbn({
  name: "amazon-isbn-enchanced",
  scrape: scrapeAmazonBook,
  emptyFields: emptyBookDetails,
  blockResources,
});

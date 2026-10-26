const { scrapeFlipkart } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`Flipkart scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeFlipkart };

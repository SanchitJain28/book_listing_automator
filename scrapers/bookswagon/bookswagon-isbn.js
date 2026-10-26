const { scrapeBookswagon } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`Bookswagon scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeBookswagon };

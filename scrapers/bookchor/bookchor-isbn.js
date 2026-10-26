const { scrapeBookChor } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`BookChor scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeBookChor };

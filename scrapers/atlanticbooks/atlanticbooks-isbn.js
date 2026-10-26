const { scrapeAtlanticBook } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`Atlantic Books scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeAtlanticBook };

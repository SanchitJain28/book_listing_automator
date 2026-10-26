const { scrapeOmPublication } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`Om Publications scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeOmPublication };

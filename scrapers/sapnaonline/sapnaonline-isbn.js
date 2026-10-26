const { scrapeSapnaOnline } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`SapnaOnline scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeSapnaOnline };

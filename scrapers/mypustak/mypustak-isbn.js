const { scrapeMyPustakBook } = require('./scraper');

if (require.main === module) {
  require('./runner').main().catch(error => {
    console.error(`MyPustak scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { scrapeMyPustakBook };

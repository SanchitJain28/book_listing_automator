const { scrapeAmazonBook } = require('../amazon-isbn/scraper');
const scrape = (page, params) => scrapeAmazonBook(page, { ...params, domain: 'amazon.it' });
if (require.main === module) {
  require('../amazon-isbn/internationalRunner').main('amazon.it').catch(error => {
    console.error(`Amazon.it scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { scrapeAmazonBook: scrape };

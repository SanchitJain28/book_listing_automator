const { scrapeAmazonBook } = require('../amazon-isbn/scraper');
const scrape = (page, params) => scrapeAmazonBook(page, { ...params, domain: 'amazon.com' });
if (require.main === module) {
  require('../amazon-isbn/internationalRunner').main('amazon.com').catch(error => {
    console.error(`Amazon scraper failed: ${error.message}`);
    process.exitCode = 1;
  });
}
module.exports = { scrapeAmazonBook: scrape };

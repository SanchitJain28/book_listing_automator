const { scrapeWalmart } = require('./scraper');
if (require.main === module) require('./runner').main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { scrapeWalmart };

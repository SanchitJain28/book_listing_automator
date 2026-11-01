const { scrapeAbeBooksUk } = require('./scraper');
if (require.main === module) require('./runner').main().catch(error => { console.error(`AbeBooks UK: ${error.message}`); process.exitCode = 1; });
module.exports = { scrapeAbeBooksUk };
